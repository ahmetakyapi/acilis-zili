import test from "node:test";
import assert from "node:assert/strict";
import {
  EARNINGS_SOON_DAYS,
  MOVE_MIN_PCT,
  pickFollowUps,
  rankSuggestions,
  type SuggestCopy,
  type SuggestFacts,
} from "../lib/stock-question-suggest";
import { HISTORY_ANSWER_CHARS, historyKey, normalizeHistory } from "../lib/stock-question-core";

/**
 * "Bu Hisseye Sor"un öneri ve takip soruları (lib/stock-question-suggest.ts)
 * ve sohbet geçmişinin temizliği (lib/stock-question-core.ts).
 */

const COPY: SuggestCopy = {
  earningsSoon: "earningsSoon",
  moveUp: "up {pct}",
  moveDown: "down {pct}",
  technical: "technical",
  target: "target",
  analysts: "analysts",
  sectorValue: "sectorValue",
  valuation: "valuation",
  lastEarnings: "lastEarnings",
  dividend: "dividend",
  session: "session",
};
const pct = (abs: number) => `%${abs.toFixed(1).replace(".", ",")}`;
const NONE: SuggestFacts = {
  earningsInDays: null,
  movePct: null,
  hasTechnical: false,
  hasTarget: false,
  hasAnalysts: false,
  hasScorecard: false,
  hasValuation: false,
  hasPastEarnings: false,
  paysDividend: false,
  hasSession: false,
};
const topics = (facts: Partial<SuggestFacts>) => rankSuggestions({ ...NONE, ...facts }, COPY, pct).map((item) => item.topic);

test("veri yoksa hiçbir soru önerilmez", () => {
  assert.deepEqual(topics({}), []);
});

test("yaklaşan bilanço yalnız pencere içindeyse ve listenin başında", () => {
  assert.deepEqual(topics({ earningsInDays: 4, hasTechnical: true }), ["earningsSoon", "technical"]);
  assert.deepEqual(topics({ earningsInDays: EARNINGS_SOON_DAYS }), ["earningsSoon"]);
  assert.deepEqual(topics({ earningsInDays: EARNINGS_SOON_DAYS + 1 }), []);
  assert.deepEqual(topics({ earningsInDays: -1 }), []);
});

test("yaklaşan bilanço varken 'son bilanço' sorusu tekrar edilmez", () => {
  assert.deepEqual(topics({ earningsInDays: 2, hasPastEarnings: true }), ["earningsSoon"]);
  assert.deepEqual(topics({ earningsInDays: 30, hasPastEarnings: true }), ["lastEarnings"]);
});

test("büyük hareket yönüyle ve mutlak yüzdeyle yazılır; eşiğin altı önerilmez", () => {
  assert.deepEqual(rankSuggestions({ ...NONE, movePct: -7.42 }, COPY, pct), [{ topic: "move", text: "down %7,4" }]);
  assert.deepEqual(rankSuggestions({ ...NONE, movePct: MOVE_MIN_PCT }, COPY, pct), [{ topic: "move", text: "up %4,0" }]);
  assert.deepEqual(topics({ movePct: 3.9 }), []);
  assert.deepEqual(topics({ movePct: Number.NaN }), []);
});

test("hedef varken dağılım, skor kartı varken çarpan sorusu ayrıca önerilmez", () => {
  assert.deepEqual(topics({ hasTarget: true, hasAnalysts: true }), ["target"]);
  assert.deepEqual(topics({ hasAnalysts: true }), ["analysts"]);
  assert.deepEqual(topics({ hasScorecard: true, hasValuation: true }), ["sectorValue"]);
  assert.deepEqual(topics({ hasValuation: true }), ["valuation"]);
});

test("sıra: olay → hareket → seviye → analist → değerleme → geçmiş → temettü → seans", () => {
  const all = { earningsInDays: null, movePct: 5, hasTechnical: true, hasTarget: true, hasScorecard: true, hasPastEarnings: true, paysDividend: true, hasSession: true };
  assert.deepEqual(topics(all), ["move", "technical", "target", "sectorValue", "lastEarnings", "dividend", "session"]);
});

const POOL = rankSuggestions(
  { ...NONE, earningsInDays: 3, movePct: -6, hasTechnical: true, hasTarget: true, hasScorecard: true, paysDividend: true, hasSession: true },
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
