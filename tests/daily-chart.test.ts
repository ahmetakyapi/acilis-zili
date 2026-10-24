import test from "node:test";
import assert from "node:assert/strict";
import {
  BODY_WORDS,
  bodyProblem,
  breadthOf,
  chartGaps,
  checkChartBlock,
  firstSentence,
  formatted,
  groundingSource,
  lastCompletedSession,
  moveFields,
  moveOver,
  pickMovers,
  recentSessions,
  signedPct,
  universeCovered,
  wordCount,
} from "../lib/daily-chart";
import { ungroundedNumbers } from "../lib/ai-grounding";
import type { MarketHoliday } from "../lib/market-hours";
import type { Bar } from "../lib/providers/types";

/* Günün Grafiği'nin saf mantığı (lib/daily-chart.ts): blok kuralı, açıklama
   aralığı, "son tamamlanmış seans", kapanıştan kapanışa hareket, iki dilli
   biçim ve panelin eksik listesi. */

const HOLIDAYS: MarketHoliday[] = [
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day After Thanksgiving", earlyCloseEt: "13:00" },
];

const bar = (day: string, close: number): Bar => ({
  time: Date.parse(`${day}T04:00:00Z`) / 1000,
  open: close,
  high: close,
  low: close,
  close,
  volume: 0,
});

test("grafik: tek bar bloğu geçer, iki blok ve izinsiz blok geçmez", () => {
  const ok = checkChartBlock("::: bar Sektörler\nTeknoloji | +1,23\nEnerji | -0,85\n:::", "tr");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.block.kind, "bars");

  const two = checkChartBlock("::: bar A\nX | 1\nY | 2\n:::\n::: bar B\nX | 1\nY | 2\n:::", "tr");
  assert.equal(two.ok, false);

  /* Canlı seri arşivde değişir — günün grafiği olamaz. */
  assert.equal(checkChartBlock("::: grafik\nNVDA | 1M | not\n:::", "tr").ok, false);
  assert.equal(checkChartBlock("::: sayilar\n%4 | büyüme\n:::", "tr").ok, false);
  /* Blok dışı metin de ikinci "blok" sayılır. */
  assert.equal(checkChartBlock("Giriş cümlesi.\n::: bar A\nX | 1\nY | 2\n:::", "tr").ok, false);
});

test("grafik: sayıya çevrilemeyen satır ve satır sınırı reddedilir", () => {
  assert.equal(checkChartBlock("::: bar A\nX | yok\nY | 2\n:::", "tr").ok, false);
  assert.equal(checkChartBlock("::: bar A\nX | 1\n:::", "tr").ok, false);
  const many = Array.from({ length: 13 }, (_, i) => `S${i} | ${i + 1}`).join("\n");
  assert.equal(checkChartBlock(`::: bar A\n${many}\n:::`, "tr").ok, false);
  assert.equal(checkChartBlock("::: bar A\nX | %4,5\nY | −2,1\n:::", "tr").ok, true);
});

test("grafik: pay ve oncesi kabul, oncesinin iki değeri sayı olmalı", () => {
  assert.equal(checkChartBlock("::: pay Hacim\nTeknoloji | 34\nDiğerleri | 66\n:::", "tr").ok, true);
  assert.equal(checkChartBlock("::: oncesi SPY\n660,12 | 22 Eylül\n671,30 | 23 Ekim\n:::", "tr").ok, true);
  assert.equal(checkChartBlock("::: oncesi SPY\nçok | önce\nbiraz | sonra\n:::", "tr").ok, false);
});

test("açıklama: kelime aralığı ve düz paragraf", () => {
  const words = (n: number) => Array.from({ length: n }, () => "kelime").join(" ");
  assert.equal(wordCount("  bir  iki\nüç "), 3);
  assert.equal(bodyProblem(words(100)), null);
  assert.match(bodyProblem(words(BODY_WORDS.min - 1)) ?? "", /kelime/);
  assert.match(bodyProblem(words(BODY_WORDS.max + 1)) ?? "", /kelime/);
  assert.match(bodyProblem(`${words(80)}\n::: ozet\nx\n:::`) ?? "", /düz paragraf/);
  assert.match(bodyProblem(`## Başlık\n${words(80)}`) ?? "", /düz paragraf/);
});

test("ilk cümle biçim işaretlerini atar ve uzunsa kelimede keser", () => {
  assert.equal(firstSentence("**Teknoloji** öne geçti. Enerji geride kaldı."), "Teknoloji öne geçti.");
  assert.equal(firstSentence("[Fon](/hisse/XLK) yükseldi! Sonra."), "Fon yükseldi!");
  const long = firstSentence(`${"uzun ".repeat(80)}son.`, 50);
  assert.ok(long.endsWith("…") && long.length <= 51);
});

test("son tamamlanmış seans: akşam seansı ve gecikme bitmeden bugün değil", () => {
  // Cuma 16:00 ET (EDT) — kapanış zili çaldı ama gün henüz kapanmadı.
  assert.equal(lastCompletedSession(new Date("2026-10-23T20:00:00Z"), []), "2026-10-22");
  // Cuma 20:20 ET — akşam seansı + 15 dakika geçti.
  assert.equal(lastCompletedSession(new Date("2026-10-24T00:20:00Z"), []), "2026-10-23");
  // Cumartesi ve pazartesi sabahı cumayı anlatır.
  assert.equal(lastCompletedSession(new Date("2026-10-24T15:00:00Z"), []), "2026-10-23");
  assert.equal(lastCompletedSession(new Date("2026-10-26T10:00:00Z"), []), "2026-10-23");
});

test("son tamamlanmış seans: yarım gün 17:15'te kapanır, tatil atlanır", () => {
  // 27 Kasım yarım gün (13:00 EST kapanış): 13:00'te hâlâ açık sayılır → tatilden önceki gün.
  assert.equal(lastCompletedSession(new Date("2026-11-27T18:00:00Z"), HOLIDAYS), "2026-11-25");
  // 17:30 EST: 13:00 + dört saat + 15 dakika geçti.
  assert.equal(lastCompletedSession(new Date("2026-11-27T22:30:00Z"), HOLIDAYS), "2026-11-27");
  // Tam tatilde bir önceki işlem günü.
  assert.equal(lastCompletedSession(new Date("2026-11-26T23:00:00Z"), HOLIDAYS), "2026-11-25");
});

test("hareket: kapanıştan kapanışa, gün ya da taban yoksa null", () => {
  const bars = [bar("2026-10-19", 100), bar("2026-10-20", 102), bar("2026-10-21", 99), bar("2026-10-22", 101), bar("2026-10-23", 103.02)];
  const d1 = moveOver(bars, "2026-10-23", 1);
  assert.ok(d1);
  assert.equal(d1.base_date, "2026-10-22");
  assert.equal(d1.pct.toFixed(2), "2.00");
  assert.equal(moveOver(bars, "2026-10-23", 4)?.base_date, "2026-10-19");
  assert.equal(moveOver(bars, "2026-10-23", 5), null);
  assert.equal(moveOver(bars, "2026-10-24", 1), null);
  assert.equal(moveFields(null), null);
});

test("biçim: iki dil, işaret ve sayı denetimiyle uyum", () => {
  assert.deepEqual(formatted(6712.456), { value: 6712.46, tr: "6.712,46", en: "6,712.46" });
  assert.deepEqual(signedPct(-1.234), { value: -1.23, tr: "-1,23", en: "-1.23" });
  assert.deepEqual(signedPct(0.001), { value: 0, tr: "0,00", en: "0.00" });
  const context = JSON.stringify({ pct: signedPct(1.234), close: formatted(6712.456), date: "2026-10-23" });
  assert.deepEqual(ungroundedNumbers("S&P 23 Ekim'de %1,23 yükseldi, 6.712,46", context), []);
  assert.deepEqual(ungroundedNumbers("S&P %1,2 yükseldi", context), ["1,2"]);
});

test("genişlik: bilinmeyen sayılmaz, kapsam eşiğin altındaysa null", () => {
  const rows = [
    { symbol: "A", pct: 1 },
    { symbol: "B", pct: -1 },
    { symbol: "C", pct: 0.001 },
    { symbol: "D", pct: 2 },
    { symbol: "E", pct: null },
  ];
  const reading = breadthOf(rows, 5);
  assert.ok(reading);
  assert.equal(reading.advancing, 2);
  assert.equal(reading.declining, 1);
  assert.equal(reading.unchanged, 1);
  assert.equal(reading.advancing_share.tr, "50,0");
  assert.equal(breadthOf(rows, 10), null);
});

test("öne çıkanlar: yönüne göre, en büyükten", () => {
  const rows = [
    { symbol: "A", pct: 3 },
    { symbol: "B", pct: -5 },
    { symbol: "C", pct: 7 },
    { symbol: "D", pct: -1 },
    { symbol: "E", pct: null },
  ];
  const { gainers, losers } = pickMovers(rows, 1);
  assert.deepEqual(gainers.map((r) => r.symbol), ["C"]);
  assert.deepEqual(losers.map((r) => r.symbol), ["B"]);
});

test("panel: son seanslar tatili atlar, eksik gün ve eksik çeviri ayrı", () => {
  assert.deepEqual(recentSessions("2026-11-27", 3, HOLIDAYS), ["2026-11-27", "2026-11-25", "2026-11-24"]);
  const gaps = chartGaps(
    ["2026-10-23", "2026-10-22", "2026-10-21"],
    new Map([
      ["2026-10-23", ["tr", "en"]],
      ["2026-10-22", ["tr"]],
    ]),
  );
  assert.deepEqual(gaps, [
    { day: "2026-10-22", missing: "en" },
    { day: "2026-10-21", missing: "chart" },
  ]);
});

test("movers and breadth need 80% of the universe", () => {
  assert.equal(universeCovered(400, 500), true);
  assert.equal(universeCovered(399, 500), false);
  assert.equal(universeCovered(0, 0), false);
});

test("recent chart titles are not a source for the number check", () => {
  const context = { indices: [{ d1: { pct: { tr: "%1,2" } } }], recent_charts: { available: true, items: [{ title: "Enerji %3,1 Yükseldi" }] } };
  const source = groundingSource(context);
  assert.deepEqual(ungroundedNumbers("Enerji %3,1 yükseldi, S&P %1,2.", source), ["3,1"]);
  assert.equal(source.includes("recent_charts"), false);
});
