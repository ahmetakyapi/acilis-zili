import test from "node:test";
import assert from "node:assert/strict";

import { DEVIATION_REACH, deviationSpans, formatDeviation, releaseDeviation, roundedDiff, seriesKey } from "../lib/release-deviation";
import { horizonLead, KARNE_CONCURRENCY, karneMarks, peakCell, runKarneRound, tileScale, type KarneFetch } from "../lib/earnings-horizon";
import { buyWindowPassed, dividendHighlights, firstBuyableDay, orderDayRows } from "../lib/dividend-groups";
import { calendarVisualsEn, calendarVisualsTr } from "../lib/i18n/dictionaries/calendar-visuals";

/**
 * Takvim görselleri (25 Ekim): sapma çizgisi, bilanço ufku ve temettü
 * öne çıkanları. Üçü de ekranda bir İDDİA basıyor ("6 Bin Altında",
 * "en büyükleri Çarşamba", "en yüksek getiri"); iddia veriden şablonla
 * çıkıyor ve burada sınanıyor.
 */

const TR = calendarVisualsTr.released;
const EN = calendarVisualsEn.released;
const NBSP = " ";

test("sapma: beklenti sıfır, fark ekrandaki hassasiyetle", () => {
  const d = releaseDeviation("194", "200", "191")!;
  assert.equal(d.base, "forecast");
  assert.equal(d.direction, "below");
  assert.equal(d.diff, -6);
  assert.equal(d.previousDiff, -9);
  /* Ölçek en büyük sapma: önceki (−9) uca, gerçekleşen (−6) onun 2/3'üne. */
  assert.equal(d.previousAt, -DEVIATION_REACH);
  assert.ok(Math.abs(d.actualAt - (-6 / 9) * DEVIATION_REACH) < 1e-9);
  assert.equal(formatDeviation(d.diff, "bin", d.digits, "tr", TR), `6${NBSP}Bin`);
  assert.equal(formatDeviation(d.diff, "bin", d.digits, "en", EN), "6K");
});

test("sapma: yüzde serilerde fark puan, kayan nokta gürültüsü yok", () => {
  const d = releaseDeviation("3.1", "3.0", "2.9")!;
  assert.equal(d.direction, "above");
  assert.equal(d.diff, 0.1);
  assert.equal(d.digits, 1);
  assert.equal(formatDeviation(d.diff, "%", d.digits, "tr", TR), `0,1${NBSP}Puan`);
  assert.equal(formatDeviation(d.diff, "%", d.digits, "en", EN), `0.1${NBSP}pp`);
});

test("sapma: ekranda aynı görünen değer 'aynı' sayılır (compareReleased kuralı)", () => {
  const d = releaseDeviation("3.461", "3.46", null)!;
  assert.equal(d.direction, "inline");
  assert.equal(d.diff, 0);
  assert.equal(d.actualAt, 0);
  assert.equal(d.previousAt, null);
});

test("sapma: beklenti yoksa sıfır önceki; düz sayı değilse çizgi yok", () => {
  const d = releaseDeviation("4.2", null, "4.0")!;
  assert.equal(d.base, "previous");
  assert.equal(d.previousAt, null);
  assert.equal(d.actualAt, DEVIATION_REACH);
  assert.equal(releaseDeviation("4.25-4.50", "4.25", "4.0"), null);
  assert.equal(releaseDeviation("250K", "240K", null), null);
  assert.equal(releaseDeviation("1", null, null), null);
  assert.equal(releaseDeviation(null, "1", "2"), null);
});

test("sapma: eksi değerler ve tanınmayan birim", () => {
  const d = releaseDeviation("-0.3", "0.2", "0.1")!;
  assert.equal(d.direction, "below");
  assert.equal(d.diff, -0.5);
  assert.equal(formatDeviation(d.diff, null, d.digits, "tr", TR), "0,5");
  assert.equal(formatDeviation(12.5, "milyar $", 1, "tr", TR), `12,5${NBSP}milyar $`);
});

test("karne: son dört eşli çeyrek, eskiden yeniye; tek çeyrek karne değil", () => {
  const rows = [
    { period: "2025-06-30", epsActual: 1.0, epsEstimate: 0.9 },
    { period: "2026-06-30", epsActual: 1.4, epsEstimate: 1.5 },
    { period: "2025-12-31", epsActual: 1.2, epsEstimate: 1.1 },
    { period: "2026-03-31", epsActual: 1.3, epsEstimate: 1.3 },
    { period: "2025-09-30", epsActual: 1.1, epsEstimate: 1.0 },
    { period: "2026-09-30", epsActual: null, epsEstimate: 1.6 },
  ];
  /* En yeni dört eşli: 2025-09, 2025-12, 2026-03 (eşit = aşılmadı), 2026-06. */
  assert.deepEqual(karneMarks(rows), ["beat", "beat", "miss", "miss"]);
  assert.deepEqual(karneMarks([rows[0]]), []);
  assert.deepEqual(karneMarks([]), []);
});

test("karo: alan piyasa değeriyle orantılı", () => {
  assert.equal(tileScale(4e12, 4e12), 1);
  assert.equal(tileScale(1e12, 4e12), 0.5);
  assert.equal(tileScale(null, 4e12), 0);
  assert.equal(tileScale(5e12, 4e12), 1);
  assert.equal(tileScale(1e9, 0), 0);
});

const ROWS = [
  { symbol: "KO", reportDate: "2026-10-27", hour: "bmo", marketCap: 300e9 },
  { symbol: "V", reportDate: "2026-10-27", hour: "amc", marketCap: 700e9 },
  { symbol: "MSFT", reportDate: "2026-10-28", hour: "amc", marketCap: 3.9e12 },
  { symbol: "GOOGL", reportDate: "2026-10-28", hour: "amc", marketCap: 3.4e12 },
  { symbol: "META", reportDate: "2026-10-28", hour: "amc", marketCap: 1.8e12 },
  { symbol: "NOW", reportDate: "2026-10-28", hour: "amc", marketCap: 200e9 },
  { symbol: "AAPL", reportDate: "2026-10-29", hour: "amc", marketCap: 4.2e12 },
  { symbol: "XYZ", reportDate: "2026-10-29", hour: "bmo", marketCap: null },
];

test("zirve hücresi: toplam piyasa değeri en yüksek gün × pencere", () => {
  const peak = peakCell(ROWS)!;
  assert.equal(peak.date, "2026-10-28");
  assert.equal(peak.lane, "amc");
  assert.deepEqual(peak.symbols, ["MSFT", "GOOGL", "META"]);
  assert.equal(peakCell([{ symbol: "A", reportDate: "2026-10-27", hour: null, marketCap: null }]), null);
});

test("tepe cümlesi: şablon + veri, iki dil", () => {
  const listTr = (items: string[]) => new Intl.ListFormat("tr-TR", { type: "conjunction" }).format(items);
  const listEn = (items: string[]) => new Intl.ListFormat("en-US", { type: "conjunction" }).format(items);
  const peak = peakCell(ROWS);
  assert.equal(
    horizonLead({ count: 963, upcoming: false, peak, weekday: "Çarşamba", words: calendarVisualsTr.horizon, listFormat: listTr, formatCount: (n) => n.toLocaleString("tr-TR") }),
    "Bu hafta 963 bilanço var; en büyükleri Çarşamba kapanış sonrası: MSFT, GOOGL ve META.",
  );
  assert.equal(
    horizonLead({ count: 34, upcoming: true, peak: { date: "2026-10-27", lane: "bmo", symbols: ["KO"] }, weekday: "Tuesday", words: calendarVisualsEn.horizon, listFormat: listEn, formatCount: String }),
    "34 reports next week; the largest comes Tuesday before the open: KO.",
  );
  assert.equal(
    horizonLead({ count: 1200, upcoming: false, peak: null, weekday: null, words: calendarVisualsTr.horizon, listFormat: listTr, formatCount: (n) => n.toLocaleString("tr-TR") }),
    "Bu hafta 1.200 bilanço var.",
  );
});

const div = (symbol: string, exDate: string, yieldPct: number | null) => ({ dividend: { symbol, exDate }, yieldPct });

test("temettü: gün içinde önce takip listesi, sonra getiri", () => {
  const rows = [div("AAA", "2026-10-27", 1.2), div("BBB", "2026-10-27", null), div("CCC", "2026-10-27", 4.5), div("DDD", "2026-10-27", 0.8)];
  const ordered = orderDayRows(rows, new Set(["DDD"])).map((row) => row.dividend.symbol);
  assert.deepEqual(ordered, ["DDD", "CCC", "AAA", "BBB"]);
});

test("temettü: öne çıkanlar — takip listesi tarih sırasıyla, getiri listesi tekrarsız", () => {
  const days = [
    { exDate: "2026-10-27", rows: [div("O", "2026-10-27", 5.7), div("CAT", "2026-10-27", 1.0)] },
    { exDate: "2026-11-03", rows: [div("OKE", "2026-11-03", 4.5), div("PAYX", "2026-11-03", 4.0)] },
    { exDate: "2026-11-24", rows: [div("O", "2026-11-24", 5.7), div("KMI", "2026-11-24", 3.4)] },
  ];
  const { watched, topYield } = dividendHighlights(days, new Set(["PAYX", "CAT"]), { top: 3 });
  assert.deepEqual(watched.map((row) => row.dividend.symbol), ["CAT", "PAYX"]);
  assert.deepEqual(topYield.map((row) => `${row.dividend.symbol}:${row.dividend.exDate}`), ["O:2026-10-27", "OKE:2026-11-03", "KMI:2026-11-24"]);
});

/* Karne turu (25 Ekim, kota incelemesi): eşzamanlılık tavanı, 429'da kesme,
   eksik turun "tam" sayılmaması. */
test("karne turu: aynı anda en çok KARNE_CONCURRENCY çağrı", async () => {
  const symbols = Array.from({ length: 30 }, (_, i) => `S${i}`);
  let active = 0;
  let peak = 0;
  const round = await runKarneRound(symbols, async (): Promise<KarneFetch> => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return { kind: "ok", marks: ["beat", "miss"] };
  });
  assert.equal(peak, KARNE_CONCURRENCY);
  assert.equal(round.calls, 30);
  assert.equal(round.complete, true);
  assert.equal(round.limited, false);
  assert.deepEqual(round.marks.S7, ["beat", "miss"]);
});

test("karne turu: 429 görülünce tur kesilir, kalanlar karnesiz ve eksik", async () => {
  const symbols = Array.from({ length: 30 }, (_, i) => `S${i}`);
  const round = await runKarneRound(symbols, async (symbol): Promise<KarneFetch> => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return symbol === "S5" ? { kind: "retry", limited: true } : { kind: "ok", marks: ["beat", "beat"] };
  });
  assert.equal(round.limited, true);
  assert.equal(round.complete, false);
  /* S5'i soran işçi 6. çağrı; o sırada uçuşta en çok KARNE_CONCURRENCY - 1 çağrı daha var. */
  assert.ok(round.calls <= 6 + KARNE_CONCURRENCY - 1, `çağrı ${round.calls}`);
  assert.equal(Object.keys(round.marks).length, 30);
  assert.deepEqual(round.marks.S29, []);
});

test("karne turu: geçici hata turu eksik bırakır ama kesmez; fırlatan çağrı da", async () => {
  const round = await runKarneRound(["A", "B", "C"], async (symbol): Promise<KarneFetch> => {
    if (symbol === "A") return { kind: "retry", limited: false };
    if (symbol === "B") throw new Error("ağ");
    return { kind: "ok", marks: [] };
  });
  assert.equal(round.calls, 3);
  assert.equal(round.complete, false);
  assert.equal(round.limited, false);
});

test("sapma: aynı serinin kartları ortak ölçekte, farklı seri kendi ölçeğinde", () => {
  const events = [
    { slug: "jobless-claims-2026-10-22", actual: "194", forecast: "200", previous: "200" },
    { slug: "jobless-claims-2026-10-15", actual: "199", forecast: "200", previous: "198" },
    { slug: "cpi-2026-10-14", actual: "3.1", forecast: "3.0", previous: "2.9" },
  ];
  const spans = deviationSpans(events);
  assert.equal(seriesKey("jobless-claims-2026-10-22"), "jobless-claims");
  assert.equal(spans.get("jobless-claims"), 6);
  assert.equal(spans.get("cpi"), 0.1);
  const big = releaseDeviation("194", "200", "200", { span: spans.get("jobless-claims") })!;
  const small = releaseDeviation("199", "200", "198", { span: spans.get("jobless-claims") })!;
  /* 1 bin, 6 binin altıda biri kadar: eskiden ikisi de rayın ucuna yakındı. */
  assert.ok(Math.abs(small.actualAt / big.actualAt - 1 / 6) < 1e-9);
  assert.equal(big.actualAt, -DEVIATION_REACH);
});

test("sapma: yuvarlama ölçeği basılan haneden", () => {
  assert.equal(roundedDiff(3.14, 3.1, 1), 0);
  assert.equal(roundedDiff(3.14, 3.1, 2), 0.04);
  assert.equal(roundedDiff(194, 200, 0), -6);
  const d = releaseDeviation("0.25", "0.2", null)!;
  assert.equal(d.digits, 2);
  assert.equal(d.diff, 0.05);
});

test("temettü: son alım günü geçmiş hak kesim kahramana çıkmaz", () => {
  const days = [
    { exDate: "2026-10-26", lastBuy: "2026-10-23" },
    { exDate: "2026-10-27", lastBuy: "2026-10-26" },
  ];
  /* 25 Ekim pazar: 26 Ekim'in son alım günü (23 Ekim cuma) geçti. */
  assert.equal(buyWindowPassed(days[0], "2026-10-25"), true);
  assert.equal(firstBuyableDay(days, "2026-10-25")?.exDate, "2026-10-27");
  /* Son alım günü bugünse hâlâ alınabilir (ABD kapanışına kadar). */
  assert.equal(buyWindowPassed(days[1], "2026-10-26"), false);
  /* Son alım günü bilinmiyorsa hak kesim bugünden sonra olmalı. */
  assert.equal(buyWindowPassed({ exDate: "2026-10-26", lastBuy: null }, "2026-10-26"), true);
  /* Hiçbiri alınamıyorsa ilk gün (rozetiyle). */
  assert.equal(firstBuyableDay(days, "2026-10-28")?.exDate, "2026-10-26");
  assert.equal(firstBuyableDay([], "2026-10-28"), null);
});
