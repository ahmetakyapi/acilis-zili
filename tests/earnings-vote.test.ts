import test from "node:test";
import assert from "node:assert/strict";
import {
  beatQuarters,
  beatRecord,
  boardFor,
  matchVoteRow,
  sameReportVote,
  staleVotePeriods,
  voteGate,
  VOTE_SAME_REPORT_DAYS,
  type CalendarLike,
} from "../lib/earnings-vote";
import { completedCloses, reactionScale, storyReaction } from "../lib/earnings-story";
import type { MarketHoliday } from "../lib/market-hours";

/**
 * "Beklentiyi Geçer mi?" — eylemin kilit kapısı (`voteGate`, `castEarningsVote`
 * bunu çağırıyor), tarih anahtarı kayınca tek oy kuralı, beklenti karnesi;
 * hikâye tepkisinin "tamamlanmış seans" ölçüsü. Kilit anının kendisi
 * (`voteLockAt`) `tests/earnings-season.test.ts`te.
 */

const NO_HOLIDAYS: MarketHoliday[] = [];
const BLACK_FRIDAY: MarketHoliday[] = [
  { date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day After Thanksgiving", earlyCloseEt: "13:00" },
];

function row(over: Partial<CalendarLike> = {}): CalendarLike {
  return {
    symbol: "NVDA",
    year: 2026,
    quarter: 3,
    reportDate: "2026-11-19",
    hour: "amc",
    epsEstimate: 1.25,
    epsActual: null,
    ...over,
  };
}

const at = (iso: string) => new Date(iso);

/* ---- Kilit kapısı ---- */

test("kapanış sonrası: kapanış zilinin bir saniye öncesine kadar açık, zilde kapalı", () => {
  // 19 Kasım 2026, EST: 16:00 ET = 21:00 UTC.
  const gate = (iso: string) => voteGate({ row: row(), period: "2026Q3", holidays: NO_HOLIDAYS, now: at(iso) });
  assert.equal(gate("2026-11-19T20:59:59Z"), "open");
  assert.equal(gate("2026-11-19T21:00:00Z"), "locked");
  // Rapor günü sabahı hâlâ açık: kapanış sonrası rapor zilden önce gelmiyor.
  assert.equal(gate("2026-11-19T14:00:00Z"), "open");
});

test("kapanış sonrası, yaz saati: zil 20:00 UTC", () => {
  const summer = row({ reportDate: "2026-08-26", quarter: 2 });
  const gate = (iso: string) => voteGate({ row: summer, period: "2026Q2", holidays: NO_HOLIDAYS, now: at(iso) });
  assert.equal(gate("2026-08-26T19:59:59Z"), "open");
  assert.equal(gate("2026-08-26T20:00:00Z"), "locked");
});

test("yarım gün: kapanış sonrası kilit erken kapanışta (13:00 ET)", () => {
  const friday = row({ reportDate: "2026-11-27" });
  const gate = (iso: string) => voteGate({ row: friday, period: "2026Q3", holidays: BLACK_FRIDAY, now: at(iso) });
  assert.equal(gate("2026-11-27T17:59:59Z"), "open");
  assert.equal(gate("2026-11-27T18:00:00Z"), "locked");
  // Yarım günü bilmeyen hesap 16:00'ya kadar açık bırakırdı.
  assert.equal(gate("2026-11-27T20:00:00Z"), "locked");
});

test("açılış öncesi ve bilinmeyen pencere: ET gün başında kapanır", () => {
  for (const hour of ["bmo", "dmh", null, "  "]) {
    const target = row({ hour });
    const gate = (iso: string) => voteGate({ row: target, period: "2026Q3", holidays: NO_HOLIDAYS, now: at(iso) });
    // 19 Kasım 00:00 EST = 05:00 UTC.
    assert.equal(gate("2026-11-19T04:59:59Z"), "open", String(hour));
    assert.equal(gate("2026-11-19T05:00:00Z"), "locked", String(hour));
  }
});

test("gerçekleşen EPS düştüyse kilitten önce de kapalı", () => {
  const early = row({ epsActual: 1.4 });
  assert.equal(voteGate({ row: early, period: "2026Q3", holidays: NO_HOLIDAYS, now: at("2026-11-18T12:00:00Z") }), "locked");
});

test("satır yoksa ya da anahtar satırın bugünkü anahtarı değilse oy reddedilir", () => {
  const now = at("2026-11-18T12:00:00Z");
  assert.equal(voteGate({ row: null, period: "2026Q3", holidays: NO_HOLIDAYS, now }), "locked");
  // Eski sayfa: çeyrek sonradan bilindi, istemci hâlâ tarih anahtarını gönderiyor.
  assert.equal(voteGate({ row: row(), period: "d2026-11-19", holidays: NO_HOLIDAYS, now }), "locked");
  // Tarih kaydı: satır 24 Kasım'a gitti, istemci 19'unu gönderiyor.
  const moved = row({ year: null, quarter: null, reportDate: "2026-11-24" });
  assert.equal(voteGate({ row: moved, period: "d2026-11-19", holidays: NO_HOLIDAYS, now }), "locked");
  assert.equal(voteGate({ row: moved, period: "d2026-11-24", holidays: NO_HOLIDAYS, now }), "open");
});

/* ---- Tarih anahtarı kayınca tek oy ---- */

test("aynı rapor: tarih anahtarı pencere içinde birleşir, iki çeyrek anahtarı asla", () => {
  assert.equal(sameReportVote("d2026-11-19", "d2026-11-24", "2026-11-24"), true);
  assert.equal(sameReportVote("d2026-11-19", "2026Q3", "2026-11-24"), true);
  assert.equal(sameReportVote("2026Q2", "2026Q3", "2026-11-24"), false);
  // Önceki çeyreğin raporu (~90 gün) pencerenin dışında.
  assert.equal(sameReportVote("d2026-08-26", "d2026-11-24", "2026-11-24"), false);
  assert.equal(VOTE_SAME_REPORT_DAYS, 45);
});

test("tahta: kaymış tarih anahtarının oyu ve dağılımı yeni satıra sayılır", () => {
  const board = {
    mine: { "NVDA:d2026-11-19": "beat" as const },
    tallies: {
      "NVDA:d2026-11-19": { beat: 3, miss: 1 },
      "NVDA:d2026-11-24": { beat: 1, miss: 2 },
      "NVDA:d2026-08-26": { beat: 9, miss: 9 },
      "AMD:d2026-11-24": { beat: 5, miss: 5 },
    },
  };
  const moved = row({ year: null, quarter: null, reportDate: "2026-11-24" });
  assert.deepEqual(boardFor(board, moved), { mine: "beat", tally: { beat: 4, miss: 3 } });
  // Hiç oy yoksa null (görünüm "henüz oy yok"u kendisi kurar).
  assert.deepEqual(boardFor({ mine: {}, tallies: {} }, moved), { mine: null, tally: null });
});

test("yazım: okurun aynı rapora eski tarih anahtarlı oyu taşınır, öteki oyları kalır", () => {
  const own = [{ period: "d2026-11-19" }, { period: "2026Q2" }, { period: "d2026-08-26" }, { period: "d2026-11-24" }];
  assert.deepEqual(staleVotePeriods(own, "d2026-11-24", "2026-11-24"), ["d2026-11-19"]);
  // Çeyrek sonradan bilindi: tarih anahtarlı oy çeyrek anahtarına taşınır.
  assert.deepEqual(staleVotePeriods(own, "2026Q3", "2026-11-24"), ["d2026-11-19", "d2026-11-24"]);
});

test("isabet eşlemesi: kaymış tarih anahtarı pencere içindeki en yakın satırı bulur", () => {
  const rows = [
    row({ year: null, quarter: null, reportDate: "2026-11-24", epsActual: 1.4 }),
    row({ year: null, quarter: null, reportDate: "2026-08-26", epsActual: 1.1 }),
  ];
  const found = matchVoteRow({ symbol: "NVDA", period: "d2026-11-19", reportDate: "2026-11-19" }, rows);
  assert.equal(found?.reportDate, "2026-11-24");
  // Pencerenin dışında satır yoksa eşleşme yok.
  assert.equal(matchVoteRow({ symbol: "NVDA", period: "d2026-05-01", reportDate: "2026-05-01" }, rows), null);
});

/* ---- Beklenti karnesi ---- */

test("karne: son dört çeyrek, eskiden yeniye; denk paydada, eksik satır yok sayılır", () => {
  const record = beatRecord([
    { period: "2026-07-31", epsEstimate: 1, epsActual: 1.1 },
    { period: "2026-04-30", epsEstimate: 1, epsActual: 1.002 },
    { period: "2026-01-31", epsEstimate: 1, epsActual: 0.9 },
    { period: "2025-10-31", epsEstimate: 1, epsActual: 1.2 },
    { period: "2025-07-31", epsEstimate: 1, epsActual: 1.3 },
    { period: "2026-10-31", epsEstimate: 1, epsActual: null },
  ]);
  assert.deepEqual(record, { beats: 2, total: 4, marks: ["beat", "miss", "inline", "beat"] });
  assert.equal(beatRecord([{ period: "2026-07-31", epsEstimate: null, epsActual: 1 }]), null);
});

test("karne hücreleri: beatRecord ile aynı seçim ve sıra, satırın kendisi taşınır", () => {
  const rows = [
    { period: "2026-07-31", epsEstimate: 1, epsActual: 1.1, quarter: 2 },
    { period: "2026-04-30", epsEstimate: 1, epsActual: 0.9, quarter: 1 },
    { period: "2026-10-31", epsEstimate: 1, epsActual: null, quarter: 3 },
  ];
  const cells = beatQuarters(rows);
  assert.deepEqual(cells.map((cell) => [cell.row.quarter, cell.outcome]), [[1, "miss"], [2, "beat"]]);
  assert.deepEqual(beatRecord(rows)?.marks, cells.map((cell) => cell.outcome));
});

test("karne: sağlayıcının çift satırı tek çeyrek sayılır", () => {
  const row = { period: "2026-06-30", epsEstimate: -0.42, epsActual: -26.16 };
  assert.deepEqual(beatRecord([row, { ...row }]), { beats: 0, total: 1, marks: ["miss"] });
});

/* ---- Hikâye tepkisi ---- */

const STATUS = { etDate: "2026-08-27", tradingToday: true, closeMinutes: 16 * 60 };
const BARS = [
  { date: "2026-08-26", close: 100 },
  { date: "2026-08-27", close: 96.9 },
];

test("bugünün barı kapanıştan 30 dakika sonra tamam (besleme 15 dk gecikmeli)", () => {
  const at = (etMinutes: number) => completedCloses(BARS, { ...STATUS, etMinutes }).map((bar) => bar.date);
  // 16:01 ET — akşam seansı başladı ama gecikmeli besleme son çeyreği vermedi.
  assert.deepEqual(at(16 * 60 + 1), ["2026-08-26"]);
  assert.deepEqual(at(16 * 60 + 29), ["2026-08-26"]);
  assert.deepEqual(at(16 * 60 + 30), ["2026-08-26", "2026-08-27"]);
  // Yarım gün: 13:00 kapanış → 13:30'da tamam.
  assert.deepEqual(
    completedCloses(BARS, { ...STATUS, closeMinutes: 13 * 60, etMinutes: 13 * 60 + 30 }).map((bar) => bar.date),
    ["2026-08-26", "2026-08-27"],
  );
  // İşlem günü değilse bugünün barı sayılmaz.
  assert.deepEqual(
    completedCloses(BARS, { ...STATUS, tradingToday: false, etMinutes: 23 * 60 }).map((bar) => bar.date),
    ["2026-08-26"],
  );
});

test("tepki geçmişi: önceki raporlar yeniden eskiye, ölçülemeyen elenir; ortak ölçek", () => {
  const closes = [
    { date: "2026-02-25", close: 100 },
    { date: "2026-02-26", close: 108 },
    { date: "2026-05-27", close: 100 },
    { date: "2026-05-28", close: 97 },
    { date: "2026-08-26", close: 100 },
    { date: "2026-08-27", close: 96.9 },
  ];
  const reaction = storyReaction(
    { date: "2026-08-26", timing: "amc" },
    [
      { date: "2026-05-27", timing: "amc" },
      { date: "2026-02-25", timing: "amc" },
      { date: "2025-11-19", timing: null },
    ],
    closes,
  );
  assert.ok(reaction);
  assert.deepEqual(
    reaction.history.map((move) => [move.date, Math.round(move.movePct * 10) / 10]),
    [
      ["2026-05-27", -3],
      ["2026-02-25", 8],
    ],
  );
  const scale = reactionScale(reaction.movePct, reaction.history, reaction.average?.avg ?? null);
  assert.ok(Math.abs(scale.peak - 8) < 1e-9);
  assert.ok(scale.guide !== null && Math.abs(scale.guide - 5.5 / 8) < 1e-9);
  // Ortalama yokken çentik yok.
  assert.equal(reactionScale(4, [], null).guide, null);
});
