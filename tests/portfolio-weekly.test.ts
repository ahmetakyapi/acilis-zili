import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPortfolioWeekNote,
  portfolioWeek,
  portfolioWeekInput,
  weekPct,
  weekPoints,
  weekShare,
  type WeeklyLot,
  type WeeklyMove,
} from "../lib/portfolio-weekly";

/** Haftalık portföy karnesi — saf hesap (lib/portfolio-weekly.ts). */

const plain = (value: string) => value.replace(/[   ]/g, " ");
const MONDAY = "2026-11-02";
const lot = (symbol: string, quantity: number, boughtAt = "2026-06-01"): WeeklyLot => ({ symbol, quantity, boughtAt });
/** Başlangıç kapanışı `start`, haftanın kapanışı `end` olan hareket. */
const move = (start: number, end: number): WeeklyMove => ({ changePct: ((end - start) / start) * 100, price: end });

test("portföyün haftası başlangıç değeriyle ağırlıklı, katkı yüzde puan", () => {
  const moves = new Map([
    ["AAA", move(100, 110)], // 10 × 100 = 1000 → 1100
    ["BBB", move(50, 45)], // 20 × 50 = 1000 → 900
  ]);
  const week = portfolioWeek([lot("AAA", 10), lot("BBB", 20)], moves, new Map(), MONDAY)!;
  assert.ok(week);
  assert.equal(Math.round(week.changePct * 1000) / 1000, 0); // 2000 → 2000
  const aaa = week.movers.find((m) => m.symbol === "AAA")!;
  const bbb = week.movers.find((m) => m.symbol === "BBB")!;
  assert.equal(Math.round(aaa.weight), 50);
  assert.equal(Math.round(aaa.contribution * 100) / 100, 5);
  assert.equal(Math.round(bbb.contribution * 100) / 100, -5);
  assert.equal(week.best?.symbol, "AAA");
  assert.equal(week.worst?.symbol, "BBB");
  assert.equal(week.covered, 2);
  assert.equal(week.total, 2);
});

test("aynı hissenin lotları birleşir; hafta içinde alınan lot hesaba girmez ama sayılır", () => {
  const moves = new Map([["AAA", move(100, 120)]]);
  const week = portfolioWeek([lot("AAA", 5), lot("AAA", 5), lot("AAA", 100, MONDAY), lot("AAA", 1, "2026-11-04")], moves, new Map(), MONDAY)!;
  assert.equal(week.skippedLots, 2);
  assert.equal(Math.round(week.changePct), 20);
  assert.equal(week.movers.length, 1);
  /* Tek pozisyonda en iyi/en kötü basılmaz. */
  assert.equal(week.best, null);
  assert.equal(week.worst, null);
});

test("yarıdan azı ölçülebildiyse portföyün haftası yok", () => {
  const moves = new Map([["AAA", move(100, 101)]]);
  assert.equal(portfolioWeek([lot("AAA", 1), lot("BBB", 1), lot("CCC", 1)], moves, new Map(), MONDAY), null);
  assert.ok(portfolioWeek([lot("AAA", 1), lot("BBB", 1)], moves, new Map(), MONDAY));
  assert.equal(portfolioWeek([], moves, new Map(), MONDAY), null);
  /* Bütün lotlar hafta içinde alınmışsa ölçülecek pozisyon yok. */
  assert.equal(portfolioWeek([lot("AAA", 1, MONDAY)], moves, new Map(), MONDAY), null);
});

test("bozuk hareket ölçülmez; katkıya göre ilk dört, bilançolar tarih sırasıyla", () => {
  const moves = new Map<string, WeeklyMove>([
    ["A", move(10, 11)],
    ["B", move(10, 9.5)],
    ["C", move(10, 10.1)],
    ["D", move(10, 13)],
    ["E", move(10, 7)],
    ["F", { changePct: Number.NaN, price: 10 }],
  ]);
  const ahead = new Map([
    ["E", { date: "2026-11-12", timing: "amc" as const }],
    ["A", { date: "2026-11-10", timing: "bmo" as const }],
    ["NEW", { date: "2026-11-11", timing: "other" as const }],
  ]);
  const lots = ["A", "B", "C", "D", "E", "F"].map((s) => lot(s, 1)).concat(lot("NEW", 1, "2026-11-05"));
  const week = portfolioWeek(lots, moves, ahead, MONDAY)!;
  assert.equal(week.covered, 5);
  assert.equal(week.total, 7);
  assert.deepEqual(week.movers.map((m) => m.symbol), ["D", "E", "A", "B"]);
  /* Hafta içinde alınan pozisyon da yeni haftanın bilanço listesine girer. */
  assert.deepEqual(week.ahead.map((a) => a.symbol), ["A", "NEW", "E"]);
});

test("biçim: yüzde bitişik işaret, puan, pay", () => {
  assert.equal(plain(weekPct(2.345, "tr")), "+%2,3");
  assert.equal(plain(weekPct(-1.2, "en")), "−1.2%");
  assert.equal(weekPoints(1.26, "tr"), "+1,3 puan");
  assert.equal(weekPoints(-0.4, "en"), "−0.4 pts");
  assert.equal(weekPoints(0.01, "tr"), "0,0 puan");
  assert.equal(weekShare(33.6, "tr"), "%34");
  assert.equal(weekShare(33.6, "en"), "34%");
});

test("girdi: tutar ve adet yok, posta ile aynı dizgeler", () => {
  const moves = new Map([
    ["AAA", move(100, 112)],
    ["BBB", move(50, 45)],
  ]);
  const week = portfolioWeek([lot("AAA", 7), lot("BBB", 20)], moves, new Map([["AAA", { date: "2026-11-10", timing: "amc" as const }]]), MONDAY)!;
  const input = portfolioWeekInput(week, "tr", { pastWeek: "2–6 Kasım", sp500: 1.24, dayLabel: () => "Salı" });
  const parsed = JSON.parse(input);
  assert.equal(parsed.biggestImpact[0].weeklyChange, weekPct(week.movers[0]!.changePct, "tr"));
  assert.equal(parsed.biggestImpact[0].contributionToPortfolio, weekPoints(week.movers[0]!.contribution, "tr"));
  assert.equal(parsed.earningsNextWeek[0].day, "Salı");
  /* Fiyat (112), değer (700, 1000) ve adet (7, 20) girdide geçmez. */
  assert.ok(!/112|700|1000|\b7\b|\b20\b/.test(input.replace(/2026-11-10/g, "")), input);
});

test("not denetimi: uydurma sayı ve tavsiye düşer, sahipte tavsiye serbest", () => {
  const input = JSON.stringify({ portfolioWeeklyChange: "+%1,2", biggestImpact: [{ symbol: "NVDA", weeklyChange: "+%4,5", contributionToPortfolio: "+1,8 puan" }] });
  const good = "Portföyün haftayı +%1,2 ile kapattı; en büyük katkı +%4,5 yükselen NVDA'dan geldi.";
  assert.deepEqual(checkPortfolioWeekNote(`  ${good} `, input, "tr"), { ok: true, text: good });
  const made = checkPortfolioWeekNote("Portföyün +%3,7 yükseldi.", input, "tr");
  assert.equal(made.ok, false);
  const advice = "NVDA'da kârın bir kısmını almalısın.";
  assert.equal(checkPortfolioWeekNote(advice, input, "tr").ok, false);
  assert.equal(checkPortfolioWeekNote(advice, input, "tr", { adviceAllowed: true }).ok, true);
  /* Sahipte de sayı denetimi açık. */
  assert.equal(checkPortfolioWeekNote("NVDA'yı 150 dolardan sat.", input, "tr", { adviceAllowed: true }).ok, false);
  assert.equal(checkPortfolioWeekNote("   ", input, "tr").ok, false);
  assert.equal(checkPortfolioWeekNote("a ".repeat(400), input, "tr").ok, false);
});
