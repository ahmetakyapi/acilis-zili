import test from "node:test";
import assert from "node:assert/strict";
import {
  accuracyPercent,
  buildVoteView,
  matchVoteRow,
  showDistribution,
  tallyShares,
  voteAccuracy,
  voteHit,
  voteLockAt,
  voteOutcome,
  votePeriodKey,
  votePhase,
  VOTE_PERIOD_PATTERN,
} from "../lib/earnings-vote";
import { companyCopy, companyWhen, earningsHref, reportWindowOf } from "../lib/earnings-company";
import {
  buildStoryCards,
  firstSentence,
  railPositions,
  rangePositions,
  storyGuaranteed,
  storyReaction,
  STORY_MIN_CARDS,
  type StoryInput,
} from "../lib/earnings-story";
import { earningsSeasonEn, earningsSeasonTr } from "../lib/i18n/dictionaries/earnings-season";
import type { MarketHoliday } from "../lib/market-hours";

/**
 * Bilanço Sezonu paketi — oylamanın kilidi ve isabeti, şirket bazlı
 * bilanço sayfasının cevap metni, hikâye kartlarının seçimi.
 */

const NO_HOLIDAYS: MarketHoliday[] = [];
const BLACK_FRIDAY: MarketHoliday[] = [
  { date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day After Thanksgiving", earlyCloseEt: "13:00" },
];

/* ---- Oylama: kilit ---- */

test("kapanış sonrası raporda oy kapanış ziliyle kilitlenir (yaz ve kış saati)", () => {
  // 19 Kasım 2026: ABD kış saati (EST, UTC-5) → 16:00 ET = 21:00 UTC = 24:00 TR.
  assert.equal(voteLockAt("2026-11-19", "amc", NO_HOLIDAYS).toISOString(), "2026-11-19T21:00:00.000Z");
  // 26 Ağustos 2026: yaz saati (EDT, UTC-4) → 16:00 ET = 20:00 UTC = 23:00 TR.
  assert.equal(voteLockAt("2026-08-26", "amc", NO_HOLIDAYS).toISOString(), "2026-08-26T20:00:00.000Z");
});

test("yarım günde kapanış sonrası kilit erken kapanışta", () => {
  assert.equal(voteLockAt("2026-11-27", "amc", BLACK_FRIDAY).toISOString(), "2026-11-27T18:00:00.000Z");
});

test("açılış öncesi, seans içi ve bilinmeyen pencerede kilit gün başı (ET)", () => {
  for (const hour of ["bmo", "dmh", null]) {
    assert.equal(voteLockAt("2026-11-19", hour, NO_HOLIDAYS).toISOString(), "2026-11-19T05:00:00.000Z");
  }
});

test("faz: kilitten önce açık, sonra kapalı; gerçekleşen gelince sonuçlandı", () => {
  const lock = new Date("2026-11-19T21:00:00Z");
  assert.equal(votePhase(new Date("2026-11-19T20:59:59Z"), lock, null), "open");
  assert.equal(votePhase(new Date("2026-11-19T21:00:00Z"), lock, null), "locked");
  assert.equal(votePhase(new Date("2026-11-19T20:00:00Z"), lock, "beat"), "resolved");
});

/* ---- Oylama: sonuç ve dağılım ---- */

test("sonuç sitenin eşiğiyle: yarım sentin altı denk", () => {
  assert.equal(voteOutcome(1.05, 1.0), "beat");
  assert.equal(voteOutcome(0.95, 1.0), "miss");
  assert.equal(voteOutcome(1.004, 1.0), "inline");
  assert.equal(voteOutcome(null, 1.0), null);
  // Negatif beklentide daha küçük zarar beklentiyi geçmektir.
  assert.equal(voteOutcome(-0.5, -0.72), "beat");
});

test("dağılım oy vermeden gösterilmez; kilitten sonra herkese açık", () => {
  assert.equal(showDistribution("open", null), false);
  assert.equal(showDistribution("open", "beat"), true);
  assert.equal(showDistribution("locked", null), true);
  assert.equal(showDistribution("resolved", null), true);
});

test("yüzdeler toplamı 100", () => {
  assert.deepEqual(tallyShares({ beat: 1, miss: 7 }), { beat: 13, miss: 87 });
  assert.deepEqual(tallyShares({ beat: 2, miss: 1 }), { beat: 67, miss: 33 });
  assert.equal(tallyShares({ beat: 0, miss: 0 }), null);
});

test("isabet: denk ve bekleyen paydaya girmez, yüzde ancak beş oyda", () => {
  const accuracy = voteAccuracy([
    { choice: "beat", outcome: "beat" },
    { choice: "miss", outcome: "beat" },
    { choice: "beat", outcome: "inline" },
    { choice: "miss", outcome: null },
  ]);
  assert.deepEqual(accuracy, { correct: 1, scored: 2, pending: 1, inline: 1 });
  assert.equal(accuracyPercent(accuracy), null);
  const five = voteAccuracy(
    (["beat", "beat", "beat", "miss", "miss"] as const).map((choice) => ({ choice, outcome: "beat" as const })),
  );
  assert.equal(accuracyPercent(five), 60);
  assert.equal(voteHit("beat", "inline"), null);
  assert.equal(voteHit("miss", "miss"), true);
});

/* ---- Oylama: anahtar ve eşleme ---- */

test("anahtar çeyrek; çeyrek yoksa tarih — ikisi de eylemin kalıbından geçer", () => {
  const quarter = votePeriodKey({ year: 2026, quarter: 3, reportDate: "2026-11-19" });
  const dated = votePeriodKey({ year: null, quarter: null, reportDate: "2026-11-19" });
  assert.equal(quarter, "2026Q3");
  assert.equal(dated, "d2026-11-19");
  assert.ok(VOTE_PERIOD_PATTERN.test(quarter) && VOTE_PERIOD_PATTERN.test(dated));
  assert.equal(VOTE_PERIOD_PATTERN.test("2026Q5"), false);
});

test("oy, tarihi kaymış raporu çeyrek anahtarıyla bulur", () => {
  const rows = [
    { symbol: "NVDA", reportDate: "2026-11-26", hour: "amc", year: 2026, quarter: 3, epsEstimate: 1, epsActual: 1.1 },
    { symbol: "NVDA", reportDate: "2027-02-25", hour: null, year: 2026, quarter: 4, epsEstimate: 1.2, epsActual: null },
  ];
  const match = matchVoteRow({ symbol: "NVDA", period: "2026Q3", reportDate: "2026-11-19" }, rows);
  assert.equal(match?.reportDate, "2026-11-26");
  assert.equal(matchVoteRow({ symbol: "AMD", period: "2026Q3", reportDate: "2026-11-19" }, rows), null);
});

test("görünüm: açıkken oy yoksa dağılım sunucudan hiç çıkmaz", () => {
  const row = { symbol: "NVDA", reportDate: "2026-11-19", hour: "amc", year: 2026, quarter: 3, epsEstimate: 1, epsActual: null };
  const now = new Date("2026-11-18T12:00:00Z");
  const hidden = buildVoteView({ row, holidays: NO_HOLIDAYS, now, mine: null, tally: { beat: 5, miss: 2 } });
  assert.equal(hidden.phase, "open");
  assert.equal(hidden.tally, null);
  const shown = buildVoteView({ row, holidays: NO_HOLIDAYS, now, mine: "beat", tally: { beat: 5, miss: 2 } });
  assert.deepEqual(shown.tally, { beat: 5, miss: 2 });
});

/* ---- Şirket bazlı bilanço sayfası ---- */

const NAMES_TR = { afterClose: "Kapanış Sonrası", beforeOpen: "Açılış Öncesi", duringMarket: "Seans İçi" };
const NAMES_EN = { afterClose: "After Close", beforeOpen: "Before Open", duringMarket: "During Market" };

test("adres küçük harf; pencere sözlüğü dar", () => {
  assert.equal(earningsHref("NVDA"), "/bilancolar/nvda");
  assert.equal(reportWindowOf(" AMC "), "amc");
  assert.equal(reportWindowOf(""), "unknown");
});

test("başlık soruyu sorar, cevabı TR saatiyle taşır; kışın gün değişir", () => {
  const when = companyWhen({ date: "2026-08-26", hour: "amc" }, NO_HOLIDAYS, "tr", NAMES_TR);
  assert.equal(when.titleWhen, "26 Ağustos, ~23:00 TR · Kapanış Sonrası");
  const copy = companyCopy({
    name: "NVIDIA",
    symbol: "NVDA",
    when,
    dateLong: "26 Ağustos Çarşamba",
    dateShort: "26 Ağustos",
    labels: earningsSeasonTr.company,
    windowLower: "kapanış sonrası",
  });
  assert.equal(copy.title, "NVIDIA Bilançosu Ne Zaman?");
  assert.equal(copy.metaTitle, "NVIDIA Bilançosu Ne Zaman? 26 Ağustos, ~23:00 TR · Kapanış Sonrası");
  assert.match(copy.answer, /Türkiye saatiyle 23:00 civarı/);
  assert.match(copy.lead, /^NVIDIA \(NVDA\)/);
  /* Kışın 16:00 ET, Türkiye'de ertesi günün 00:00'ı: başlık okurun gününü yazar. */
  const winter = companyWhen({ date: "2026-11-19", hour: "amc" }, NO_HOLIDAYS, "tr", NAMES_TR);
  assert.equal(winter.titleWhen, "20 Kasım, ~00:00 TR · Kapanış Sonrası");
  assert.equal(winter.closeClock, "20 Kasım 00:00");
});

test("açılış öncesinde saat uydurulmaz, açılışın saati yazılır; EN'de New York önce", () => {
  const tr = companyWhen({ date: "2026-11-19", hour: "bmo" }, NO_HOLIDAYS, "tr", NAMES_TR);
  assert.equal(tr.titleWhen, "19 Kasım · Açılış Öncesi");
  assert.equal(tr.openClock, "17:30");
  const en = companyWhen({ date: "2026-11-19", hour: "amc" }, NO_HOLIDAYS, "en", NAMES_EN);
  assert.equal(en.titleWhen, "November 19, ~16:00 NY · After Close");
});

test("pencere bilinmiyorsa tarih tahmini; takvimde yoksa soru açık kalır", () => {
  const when = companyWhen({ date: "2026-11-19", hour: null }, NO_HOLIDAYS, "tr", NAMES_TR);
  assert.equal(when.estimated, true);
  const copy = companyCopy({
    name: "Nike",
    symbol: "NKE",
    when,
    dateLong: "19 Kasım Perşembe",
    dateShort: "19 Kasım",
    labels: earningsSeasonTr.company,
    windowLower: null,
  });
  assert.equal(copy.metaTitle, "Nike Bilançosu Ne Zaman? 19 Kasım (Tahmini)");
  assert.match(copy.description, /tahminen 19 Kasım/);
  const none = companyCopy({
    name: "Nike",
    symbol: "NKE",
    when: companyWhen(null, NO_HOLIDAYS, "en", NAMES_EN),
    dateLong: null,
    dateShort: null,
    labels: earningsSeasonEn.company,
    windowLower: null,
  });
  assert.equal(none.metaTitle, "When Does Nike Report Earnings?");
});

/* ---- Hikâye kartları ---- */

const BASE: StoryInput = {
  calendar: null,
  recorded: { eps: null, epsSurprisePct: null },
  guidance: null,
  reaction: null,
  takeaways: null,
  headline: "Veri merkezi geliri beklentinin üstünde.",
  score: 78,
  verdict: "buy",
};

test("veri olmayan kart basılmaz; özet ve skor her zaman", () => {
  const cards = buildStoryCards(BASE);
  assert.deepEqual(cards.map((card) => card.kind), ["ozet", "skor"]);
  assert.ok(cards.length < STORY_MIN_CARDS);
});

test("beklenti kartı takvimden; takvim yoksa analizin kaydettiği sapma", () => {
  const withCalendar = buildStoryCards({
    ...BASE,
    calendar: { epsEstimate: 1.0, epsActual: 1.08, revenueEstimate: null, revenueActual: null },
  });
  const expect = withCalendar[0];
  assert.equal(expect.kind, "beklenti");
  if (expect.kind === "beklenti") {
    assert.equal(expect.eps?.surprise.direction, "beat");
    assert.equal(expect.revenue, null);
    assert.equal(expect.recorded, null);
  }
  const recorded = buildStoryCards({ ...BASE, recorded: { eps: 1.08, epsSurprisePct: 8 } })[0];
  assert.equal(recorded.kind === "beklenti" && recorded.recorded?.surprisePct, 8);
});

test("tam hikâye beş kart, sırası sabit; özet ilk maddenin ilk cümlesi", () => {
  const cards = buildStoryCards({
    ...BASE,
    calendar: { epsEstimate: 1, epsActual: 1.1, revenueEstimate: 10e9, revenueActual: 10.5e9 },
    guidance: [{ label: "Gelir", low: 11, high: 12, consensus: 11.8, unit: "Mr $" }],
    reaction: { movePct: 4.2, timing: "amc", average: { avg: 6.1, count: 4 }, history: [] },
    takeaways: ["Gelir 8,97 milyar dolarla rekor kırdı. Marj daraldı.", "İkinci madde."],
  });
  assert.deepEqual(cards.map((card) => card.kind), ["beklenti", "rehberlik", "tepki", "ozet", "skor"]);
  const summary = cards[3];
  assert.equal(summary.kind === "ozet" && summary.text, "Gelir 8,97 milyar dolarla rekor kırdı.");
});

test("bağlantı ön koşulu yalnız üç kartı garanti eden durumda doğru", () => {
  assert.equal(storyGuaranteed({ eps: 1, epsSurprisePct: 3, guidance: null }), true);
  assert.equal(storyGuaranteed({ eps: null, epsSurprisePct: null, guidance: [{}] }), true);
  assert.equal(storyGuaranteed({ eps: 1, epsSurprisePct: null, guidance: [] }), false);
});

test("ilk cümle ondalık sayıda bölünmez", () => {
  assert.equal(firstSentence("EPS 1.05 dolar oldu. Ardından"), "EPS 1.05 dolar oldu.");
  assert.equal(firstSentence("Tek cümle"), "Tek cümle");
});

test("çizgi konumları: iki işaret içeride, sıra korunur; aralık noktayı çevreler", () => {
  const rail = railPositions(1.0, 1.1);
  assert.ok(rail.estimate > 0 && rail.actual < 1 && rail.estimate < rail.actual);
  const same = railPositions(0, 0);
  assert.ok(Number.isFinite(same.estimate) && same.estimate === same.actual);
  const range = rangePositions(11, 12, 12.4);
  assert.ok(range.low < range.high && (range.consensus ?? 0) > range.high && (range.consensus ?? 2) < 1);
});

test("tepki tamamlanmış barlardan; kapanış sonrası raporda ertesi seans gerekir", () => {
  const closes = [
    { date: "2026-08-25", close: 100 },
    { date: "2026-08-26", close: 102 },
    { date: "2026-08-27", close: 96.9 },
  ];
  const reaction = storyReaction({ date: "2026-08-26", timing: "amc" }, [], closes);
  assert.ok(reaction && Math.abs(reaction.movePct - -5) < 1e-9);
  assert.equal(reaction?.average, null);
  // Ertesi seans henüz kapanmadıysa (bar yok) kart yok.
  assert.equal(storyReaction({ date: "2026-08-26", timing: "amc" }, [], closes.slice(0, 2)), null);
  // Saati bilinmeyen raporda iki kapanış seçilmez.
  assert.equal(storyReaction({ date: "2026-08-26", timing: null }, [], closes), null);
});

test("kilit künyesi okurun saatiyle", async () => {
  const { lockLabel } = await import("../lib/earnings-company");
  const lock = voteLockAt("2026-11-19", "amc", NO_HOLIDAYS);
  assert.equal(lockLabel(lock, "tr"), "20 Kas 00:00 TR");
  assert.equal(lockLabel(lock, "en"), "Nov 19, 16:00 NY");
});
