import test from "node:test";
import assert from "node:assert/strict";
import {
  EARNINGS_FRESH_DAYS,
  EARNINGS_SOON_DAYS,
  MOVE_MIN_PCT,
  nearRangeEdge,
  pickFollowUps,
  RANGE_NEAR_PCT,
  rankSuggestions,
  STARTER_COUNT,
  type SuggestCopy,
  type SuggestFacts,
} from "../lib/stock-question-suggest";
import { adviceMatches } from "../lib/advice-guard";
import { askStockEn, askStockTr } from "../lib/i18n/dictionaries/ask-stock";
import { HISTORY_ANSWER_CHARS, historyKey, normalizeHistory } from "../lib/stock-question-core";

/**
 * "Bu Hisseye Sor"un öneri ve takip soruları (lib/stock-question-suggest.ts)
 * ve sohbet geçmişinin temizliği (lib/stock-question-core.ts).
 */

const COPY: SuggestCopy = {
  earningsOut: "earningsOut",
  earningsReaction: "earningsReaction",
  earningsSoon: "earningsSoon",
  earningsDate: "earningsDate",
  moveUp: "up {pct}",
  moveDown: "down {pct}",
  range52High: "near high",
  range52Low: "near low",
  technical: "technical",
  target: "target",
  analysts: "analysts",
  sectorValue: "sectorValue",
  valuation: "valuation",
  lastEarnings: "lastEarnings",
  news: "news",
  volatility: "volatility",
  dividendYield: "dividend yield",
  dividendLast: "dividend last",
  session: "session",
};
const pct = (abs: number) => `%${abs.toFixed(1).replace(".", ",")}`;
const NONE: SuggestFacts = {
  earningsInDays: null,
  hasConsensus: false,
  reportedDaysAgo: null,
  hasEarningsReaction: false,
  movePct: null,
  hasMoveEvidence: false,
  near52: null,
  hasTechnical: false,
  hasTarget: false,
  hasAnalysts: false,
  hasScorecard: false,
  hasValuation: false,
  hasPastEarnings: false,
  paysDividend: false,
  hasDividendYield: false,
  hasNews: false,
  hasBeta: false,
  hasSession: false,
};
const rank = (facts: Partial<SuggestFacts>) => rankSuggestions({ ...NONE, ...facts }, COPY, pct);
const topics = (facts: Partial<SuggestFacts>) => rank(facts).map((item) => item.topic);
const starters = (facts: Partial<SuggestFacts>) => topics(facts).slice(0, STARTER_COUNT);

test("veri yoksa hiçbir soru önerilmez", () => {
  assert.deepEqual(topics({}), []);
});

test("yaklaşan bilanço pencere içindeyse başta; beklenti sayısı yoksa soru tarihe döner", () => {
  assert.deepEqual(topics({ earningsInDays: 4, hasConsensus: true, hasTechnical: true }), ["earningsSoon", "technical"]);
  assert.deepEqual(topics({ earningsInDays: EARNINGS_SOON_DAYS, hasConsensus: true }), ["earningsSoon"]);
  /* Beklenti yok: "piyasa ne bekliyor"un yanıtı olmaz, tarih yine sorulur. */
  assert.deepEqual(topics({ earningsInDays: 4, hasConsensus: false }), ["earningsDate"]);
  assert.deepEqual(topics({ earningsInDays: -1, hasConsensus: true }), []);
});

test("pencerenin dışındaki bilanço yalnız tarih sorusu olur ve arkada durur", () => {
  assert.deepEqual(topics({ earningsInDays: EARNINGS_SOON_DAYS + 1, hasConsensus: true, hasTechnical: true, hasPastEarnings: true }), [
    "technical",
    "lastEarnings",
    "earningsDate",
  ]);
});

test("her soru tek şey sorar: yaklaşan bilanço ile 'son bilanço' ayrı haplar", () => {
  assert.deepEqual(topics({ earningsInDays: 2, hasConsensus: true, hasPastEarnings: true }), ["earningsSoon", "lastEarnings"]);
});

test("bilanço ertesi: 'karşıladı mı' ve tepki başta; 'son bilanço' ve 'neden hareket etti' tekrar edilmez", () => {
  const dayAfter = { reportedDaysAgo: 1, hasEarningsReaction: true, hasPastEarnings: true, movePct: -11, hasMoveEvidence: true, hasTarget: true };
  assert.deepEqual(topics(dayAfter), ["earningsOut", "earningsReaction", "target"]);
  /* Kapanış sonrası açıklandı, tepki seansı henüz kapanmadı: tepki sorulmaz, hareket sorusu kalır. */
  assert.deepEqual(topics({ ...dayAfter, reportedDaysAgo: 0, hasEarningsReaction: false }), ["earningsOut", "move", "target"]);
  /* Pencere geçince yeniden "son bilanço". */
  assert.deepEqual(topics({ reportedDaysAgo: EARNINGS_FRESH_DAYS + 1, hasEarningsReaction: true, hasPastEarnings: true }), ["lastEarnings"]);
});

test("büyük hareket yönüyle ve mutlak yüzdeyle yazılır; eşiğin altı ve habersiz hareket önerilmez", () => {
  assert.deepEqual(rank({ movePct: -7.42, hasMoveEvidence: true }), [{ topic: "move", text: "down %7,4" }]);
  assert.deepEqual(rank({ movePct: MOVE_MIN_PCT, hasMoveEvidence: true }), [{ topic: "move", text: "up %4,0" }]);
  assert.deepEqual(topics({ movePct: 3.9, hasMoveEvidence: true }), []);
  assert.deepEqual(topics({ movePct: Number.NaN, hasMoveEvidence: true }), []);
  /* Nedeni anlatacak haber yok: yanıt "haberlerde görünmüyor" olurdu. */
  assert.deepEqual(topics({ movePct: -12.7, hasMoveEvidence: false }), []);
});

test("52 hafta bandının ucu: yön doğru kelimeyle, ortadaysa soru yok", () => {
  assert.deepEqual(rank({ near52: "high" }), [{ topic: "range52", text: "near high" }]);
  assert.deepEqual(rank({ near52: "low" }), [{ topic: "range52", text: "near low" }]);
  assert.equal(nearRangeEdge(99, 50, 100), "high");
  assert.equal(nearRangeEdge(100 * (1 - RANGE_NEAR_PCT / 100), 50, 100), "high");
  assert.equal(nearRangeEdge(51, 50, 100), "low");
  assert.equal(nearRangeEdge(75, 50, 100), null);
  assert.equal(nearRangeEdge(null, 50, 100), null);
  assert.equal(nearRangeEdge(75, null, 100), null);
  assert.equal(nearRangeEdge(75, 100, 100), null);
});

test("hedef varken dağılım, skor kartı varken çarpan sorusu ayrıca önerilmez", () => {
  assert.deepEqual(topics({ hasTarget: true, hasAnalysts: true }), ["target"]);
  assert.deepEqual(topics({ hasAnalysts: true }), ["analysts"]);
  assert.deepEqual(topics({ hasScorecard: true, hasValuation: true }), ["sectorValue"]);
  assert.deepEqual(topics({ hasValuation: true }), ["valuation"]);
});

test("temettü: ödemeyen hissede soru yok; verim yoksa soru tutara döner", () => {
  assert.deepEqual(topics({ paysDividend: false, hasDividendYield: true }), []);
  assert.deepEqual(rank({ paysDividend: true, hasDividendYield: true }), [{ topic: "dividend", text: "dividend yield" }]);
  assert.deepEqual(rank({ paysDividend: true }), [{ topic: "dividend", text: "dividend last" }]);
});

test("sıra: olay → hareket → seviye → analist → değerleme → geçmiş → haber → oynaklık → temettü → seans", () => {
  const all = { movePct: 5, hasMoveEvidence: true, hasTechnical: true, hasTarget: true, hasScorecard: true, hasPastEarnings: true, hasNews: true, hasBeta: true, paysDividend: true, hasSession: true };
  assert.deepEqual(topics(all), ["move", "technical", "target", "sectorValue", "lastEarnings", "news", "volatility", "dividend", "session"]);
});

test("ilk dört hap farklı açılardan: aynı açının ikincisi arkaya düşer (olayda en çok iki)", () => {
  /* Üç olay sorusu var (tepki dahil); üçüncüsü (haber) ilk dörtte yer tutmaz. */
  const earningsWeek = { reportedDaysAgo: 2, hasEarningsReaction: true, hasNews: true, hasTechnical: true, near52: "low" as const, hasTarget: true, hasScorecard: true };
  assert.deepEqual(starters(earningsWeek), ["earningsOut", "earningsReaction", "range52", "target"]);
  /* İki seviye sorusu (52 hafta ve teknik): ikincisi arkada, havuzda duruyor. */
  assert.deepEqual(topics(earningsWeek), ["earningsOut", "earningsReaction", "range52", "target", "sectorValue", "technical", "news"]);
});

test("uç durumlar: hangi haplar basılıyor", () => {
  /* Verisiz küçük şirket: yalnız son seansın barı var. */
  assert.deepEqual(starters({ hasSession: true }), ["session"]);
  /* Fon / ETF (şirket verisi yok): bilanço, analist ve değerleme sorusu çıkmaz. */
  assert.deepEqual(starters({ hasSession: true, hasTechnical: true, paysDividend: true, hasDividendYield: true, hasNews: true }), ["technical", "news", "dividend", "session"]);
  /* Bilanço haftası, büyük şirket. */
  assert.deepEqual(
    starters({ earningsInDays: 5, hasConsensus: true, hasPastEarnings: true, hasTechnical: true, hasTarget: true, hasScorecard: true, hasNews: true, hasBeta: true, hasSession: true }),
    ["earningsSoon", "technical", "target", "sectorValue"],
  );
  /* Büyük düşüş, dibe yakın. */
  assert.deepEqual(
    rank({ movePct: -12.74, hasMoveEvidence: true, hasNews: true, near52: "low", hasTechnical: true, hasAnalysts: true, hasValuation: true, hasSession: true }).slice(0, STARTER_COUNT),
    [
      { topic: "move", text: "down %12,7" },
      { topic: "range52", text: "near low" },
      { topic: "analysts", text: "analysts" },
      { topic: "valuation", text: "valuation" },
    ],
  );
  /* Büyük yükseliş, zirveye yakın. */
  assert.deepEqual(
    rank({ movePct: 9.06, hasMoveEvidence: true, near52: "high", hasTarget: true, hasScorecard: true }).map((item) => item.text),
    ["up %9,1", "near high", "target", "sectorValue"],
  );
});

test("sözlük: her dilde bütün sorular dolu, tek soru işaretli ve tavsiye kalıpsız", () => {
  for (const [locale, copy] of [["tr", askStockTr.suggest], ["en", askStockEn.suggest]] as const) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(COPY).sort());
    for (const [key, text] of Object.entries(copy)) {
      assert.equal(text.split("?").length - 1, 1, `${locale}.${key}: tek soru`);
      assert.ok(text.endsWith("?"), `${locale}.${key}: soru cümlesi`);
      assert.ok(!text.includes(","), `${locale}.${key}: iki parçalı soru olmasın`);
      assert.deepEqual(adviceMatches(text, locale), [], `${locale}.${key}: tavsiye kalıbı`);
      assert.equal(text.includes("{pct}"), key === "moveUp" || key === "moveDown", `${locale}.${key}: {pct}`);
    }
  }
});

const POOL = rankSuggestions(
  { ...NONE, earningsInDays: 3, hasConsensus: true, movePct: -6, hasMoveEvidence: true, hasTechnical: true, hasTarget: true, hasScorecard: true, paysDividend: true, hasSession: true },
  COPY,
  pct,
);

test("takip soruları son yanıtın konusuna komşu konulardan, en çok üç", () => {
  const next = pickFollowUps(POOL, { topic: "earningsSoon", sources: ["nextEarnings", "earnings"] }, { texts: ["earningsSoon"], topics: ["earningsSoon"] });
  assert.deepEqual(next.map((item) => item.topic), ["target", "move", "technical"]);
});

test("kendi yazılan sorunun konusu yanıtın kaynaklarından çıkar", () => {
  const next = pickFollowUps(POOL, { topic: null, sources: ["target", "analysts"] }, { texts: ["hedef kaç?"], topics: [] });
  assert.equal(next[0]?.topic, "sectorValue");
  assert.ok(!next.some((item) => item.topic === "target"));
});

test("sorulmuş soru metniyle ya da konusuyla bir daha önerilmez", () => {
  const next = pickFollowUps(POOL, { topic: "move", sources: [] }, { texts: ["technical ", "down %6,0"], topics: ["earningsSoon"] });
  assert.ok(!next.some((item) => ["technical", "move", "earningsSoon"].includes(item.topic)));
  assert.equal(next.length, 3);
});

test("yanıtlanamayan soru (kaynaksız, konusuz) havuzu önem sırasıyla açar; havuz bitince boş", () => {
  assert.deepEqual(
    pickFollowUps(POOL, { topic: null, sources: [] }, { texts: [], topics: [] }).map((item) => item.topic),
    ["earningsSoon", "move", "technical"],
  );
  const everything = POOL.map((item) => item.topic);
  assert.deepEqual(pickFollowUps(POOL, { topic: null, sources: [] }, { texts: [], topics: everything }), []);
});

test("geçmiş: en çok son iki tur, bozuk tur atılır, yanıt kısaltılır", () => {
  const long = "a".repeat(HISTORY_ANSWER_CHARS + 50);
  const turns = normalizeHistory([
    { question: "ilk soru burada", answer: "eski" },
    { question: "x", answer: "çok kısa soru atılır" },
    { question: "  hedef\nkaç?  ", answer: long },
  ]);
  assert.equal(turns.length, 1);
  assert.equal(turns[0]!.question, "hedef kaç?");
  assert.equal(turns[0]!.answer.length, HISTORY_ANSWER_CHARS);
  assert.ok(turns[0]!.answer.endsWith("…"));
  assert.deepEqual(normalizeHistory("yok"), []);
  assert.deepEqual(normalizeHistory([null, { question: "geçerli soru", answer: 5 }]), []);
});

test("geçmişsiz sorunun anahtar parçası boş; geçmiş değişince anahtar değişir", () => {
  assert.equal(historyKey([], "tr"), "");
  const a = historyKey([{ question: "Hedef ne?", answer: "Ortalama hedef 210,00 $." }], "tr");
  const b = historyKey([{ question: "hedef ne", answer: "Ortalama hedef 210,00 $." }], "tr");
  const c = historyKey([{ question: "Hedef ne?", answer: "Ortalama hedef 205,00 $." }], "tr");
  assert.equal(a, b);
  assert.notEqual(a, c);
});
