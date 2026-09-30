import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  allocateSlots,
  buildSchedule,
  buildWeek,
  currentWeekStart,
  defaultWeekStart,
  epsSurprise,
  revenueSurprise,
  SCHEDULE_DAY_MAX,
  splitScheduleDay,
  tileTier,
  type ScheduleRow,
  mondayOf,
  parseWeekParam,
  pickNotable,
  weekRangeLabel,
  WEEK_MAX_NAMES,
  type WeekCandidate,
} from "../lib/earnings-week";
import {
  EXTRAS_INPUT_SHAPE,
  extrasFromInput,
  extrasIssues,
  extrasToOutput,
} from "../lib/earnings-extras";
import { kpiValueText, segmentShares, segmentTotalDiffers } from "../lib/earnings-report";

/**
 * Haftalık Bilanço Takvimi ve analiz ekleri — saf mantık.
 *
 * Hafta seçimi pazar gecesi ET ile TR'nin pazartesisi arasında kayıyor;
 * yarım günde kapanış sonrası saat iki saat erkene çekiliyor; yatay
 * görselde bir günün karoları taşmamalı. Testler bu üç vakayı tutuyor.
 */

test("mondayOf: pazar biten haftaya, cumartesi aynı haftaya", () => {
  assert.equal(mondayOf("2026-09-27"), "2026-09-21"); // pazar
  assert.equal(mondayOf("2026-09-26"), "2026-09-21"); // cumartesi
  assert.equal(mondayOf("2026-09-28"), "2026-09-28"); // pazartesi
});

test("defaultWeekStart: bugünden sonraki pazartesi", () => {
  assert.equal(defaultWeekStart("2026-09-27"), "2026-09-28");
  assert.equal(defaultWeekStart("2026-09-28"), "2026-10-05");
  assert.equal(defaultWeekStart("2026-10-02"), "2026-10-05");
});

test("parseWeekParam: takvimde olmayan günü reddeder, haftanın başına iner", () => {
  assert.equal(parseWeekParam("2026-10-21"), "2026-10-19");
  assert.equal(parseWeekParam("2026-02-31"), null);
  assert.equal(parseWeekParam("2026-10"), null);
  assert.equal(parseWeekParam(undefined), null);
});

test("weekRangeLabel: ay değişmiyorsa bir kez", () => {
  assert.equal(weekRangeLabel("2026-10-19", "tr"), "19–23 Ekim 2026");
  assert.equal(weekRangeLabel("2026-09-28", "tr"), "28 Eylül – 2 Ekim 2026");
  assert.equal(weekRangeLabel("2026-10-19", "en"), "Oct 19–23, 2026");
});

const row = (symbol: string, extra: Partial<WeekCandidate> = {}): WeekCandidate => ({
  symbol,
  reportDate: "2026-10-19",
  hour: "bmo",
  name: null,
  logoUrl: null,
  marketCap: null,
  indexMember: false,
  spotlight: false,
  ...extra,
});

test("pickNotable: kapı, sıra, tekrar ve tavan", () => {
  const picked = pickNotable([
    row("SMALL", { marketCap: 2e9 }),
    row("BIG", { marketCap: 500e9 }),
    row("MID", { marketCap: 20e9 }),
    row("IDX", { indexMember: true, marketCap: 5e9 }),
    row("SPOT", { spotlight: true, marketCap: 1e9 }),
    row("BIG", { marketCap: 500e9, reportDate: "2026-10-20" }),
  ]);
  assert.deepEqual(picked.map((item) => item.symbol), ["SPOT", "BIG", "MID", "IDX"]);
  assert.equal(picked.find((item) => item.symbol === "BIG")?.reportDate, "2026-10-19");

  const many = Array.from({ length: 50 }, (_, i) => row(`S${i}`, { indexMember: true }));
  assert.equal(pickNotable(many).length, WEEK_MAX_NAMES);
});

test("buildWeek: yarım günde kapanış sonrası saati erkene çekilir", () => {
  const days = buildWeek(
    "2026-11-23",
    [row("A", { reportDate: "2026-11-27", hour: "amc" })],
    [
      { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
      { date: "2026-11-27", nameTr: "Yarım Gün", nameEn: "Early Close", earlyCloseEt: "13:00" },
    ],
    "tr",
  );
  assert.equal(days.length, 5);
  assert.ok(days[3]?.closed, "perşembe kapalı");
  assert.equal(days[4]?.amc[0]?.symbol, "A");
  // 13:00 ET kasımda (EST, TR +8 saat) 21:00 TR; sabit "~23:00" iki saat yanlış olurdu.
  assert.equal(days[4]?.amcClock.primary, "21:00");
  assert.equal(days[0]?.bmoClock.primary, "16:00"); // 08:00 ET kışın 16:00 TR
});

test("allocateSlots: her dolu şerit en az bir karo, bütçe aşılmaz", () => {
  assert.deepEqual(allocateSlots([6, 1, 3], 5), [2, 1, 2]);
  assert.deepEqual(allocateSlots([2, 0, 1], 6), [2, 0, 1]);
  assert.deepEqual(allocateSlots([10], 7), [7]);
});

test("currentWeekStart: iş günü içinde bu hafta, hafta sonu gelecek hafta", () => {
  assert.equal(currentWeekStart("2026-09-28"), "2026-09-28"); // pazartesi
  assert.equal(currentWeekStart("2026-09-29"), "2026-09-28"); // salı
  assert.equal(currentWeekStart("2026-10-02"), "2026-09-28"); // cuma
  assert.equal(currentWeekStart("2026-10-03"), "2026-10-05"); // cumartesi
  assert.equal(currentWeekStart("2026-10-04"), "2026-10-05"); // pazar
});

test("tileTier: üç basamak, eşik dahil, bilinmeyen en küçük", () => {
  assert.equal(tileTier(1.2e12), "xl");
  assert.equal(tileTier(500e9), "xl");
  assert.equal(tileTier(499e9), "lg");
  assert.equal(tileTier(100e9), "lg");
  assert.equal(tileTier(12e9), "md");
  assert.equal(tileTier(null), "md");
});

test("epsSurprise: yön, negatif beklenti, yuvarlama payı ve sıfıra yakın payda", () => {
  assert.equal(epsSurprise(null, 1), null);
  assert.equal(epsSurprise(1, null), null);
  const beat = epsSurprise(56.05, 54.4);
  assert.equal(beat?.direction, "beat");
  assert.ok(Math.abs((beat?.ratio ?? 0) - 0.0303) < 0.001);
  assert.equal(epsSurprise(0.78, 0.89)?.direction, "miss");
  // -0,72 beklenen, -0,50 açıklayan: beklentiyi aştı, sapma artı.
  const negative = epsSurprise(-0.5, -0.72);
  assert.equal(negative?.direction, "beat");
  assert.ok((negative?.ratio ?? 0) > 0);
  // 0,4444 beklenti, 0,44 açıklama: yuvarlama, olay değil.
  assert.deepEqual(epsSurprise(0.44, 0.4444), { direction: "inline", ratio: null });
  // 0,0031 beklenti: yön var, yüzde yok.
  assert.deepEqual(epsSurprise(5.11, 0.0031), { direction: "beat", ratio: null });
});

test("revenueSurprise: oransal eşitlik bandı, sıfır ve negatif beklenti", () => {
  assert.equal(revenueSurprise(null, 1e9), null);
  assert.equal(revenueSurprise(1e9, null), null);
  // CTAS, 22 Eylül: 3,014 Mr açıkladı, 3,044 Mr bekleniyordu.
  const miss = revenueSurprise(3013980000, 3043574328);
  assert.equal(miss?.direction, "miss");
  assert.ok(Math.abs((miss?.ratio ?? 0) + 0.0097) < 0.001);
  assert.equal(revenueSurprise(54.2e9, 52.6e9)?.direction, "beat");
  // Binde yarımın altı "%0,0" yazılırdı: eşit, yüzde yok.
  assert.deepEqual(revenueSurprise(100.04e9, 100e9), { direction: "inline", ratio: null });
  assert.equal(revenueSurprise(1e9, 0), null);
  assert.equal(revenueSurprise(1e9, -5e8), null);
});

const sched = (symbol: string, extra: Partial<ScheduleRow> = {}): ScheduleRow => ({
  ...row(symbol),
  epsEstimate: null,
  epsActual: null,
  revenueEstimate: null,
  revenueActual: null,
  currency: "USD",
  ...extra,
});

test("splitScheduleDay: taban, sıra, tavan ve kalanlar", () => {
  const { listed, rest } = splitScheduleDay(
    [
      sched("FUND", { marketCap: 0.4e9 }),
      sched("MID", { marketCap: 30e9 }),
      sched("SPOT", { spotlight: true, marketCap: null }),
      sched("BIG", { marketCap: 900e9 }),
      sched("MID", { marketCap: 30e9 }),
      sched("NOCAP"),
    ],
    3,
  );
  assert.deepEqual(listed.map((r) => r.symbol), ["SPOT", "BIG", "MID"]);
  assert.deepEqual(rest.map((r) => r.symbol), ["FUND", "NOCAP"]);

  const crowd = Array.from({ length: 20 }, (_, i) => sched(`C${i}`, { marketCap: (i + 2) * 1e9 }));
  const split = splitScheduleDay(crowd);
  assert.equal(split.listed.length, SCHEDULE_DAY_MAX);
  assert.equal(split.listed[0]?.symbol, "C19");
  assert.equal(split.rest.length, 20 - SCHEDULE_DAY_MAX);
});

test("buildSchedule: beş gün, kalanlar pencereye göre, tatil kapalı", () => {
  const days = buildSchedule(
    "2026-11-23",
    [
      sched("A", { reportDate: "2026-11-23", marketCap: 50e9 }),
      sched("B", { reportDate: "2026-11-23", hour: "amc", marketCap: 0.2e9 }),
      sched("C", { reportDate: "2026-11-23", hour: null, marketCap: 0.1e9 }),
    ],
    [{ date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null }],
    "tr",
  );
  assert.equal(days.length, 5);
  assert.deepEqual(days[0]?.listed.map((r) => r.symbol), ["A"]);
  assert.deepEqual(days[0]?.rest.amc.map((r) => r.symbol), ["B"]);
  assert.deepEqual(days[0]?.rest.other.map((r) => r.symbol), ["C"]);
  assert.equal(days[0]?.total, 3);
  assert.ok(days[3]?.closed);
  assert.equal(days[1]?.total, 0);
});

const Extras = z.object(EXTRAS_INPUT_SHAPE);

test("ek şeması: tam üç madde, negatif segment yok, kaynak sözlükten", () => {
  const ok = Extras.parse({
    takeaways: ["Gelir beklentiyi yüzde beş aştı.", "Marj rekor seviyede kaldı.", "Öngörü piyasanın altında."],
    segments: [
      { name: "Veri Merkezi", revenue: 4e9, yoy_pct: 30 },
      { name: "Tüketici", revenue: 1e9 },
    ],
    segments_source: "10-Q",
    kpis: [{ name: "Abone", value: 301e6, unit: "abone", source: "shareholder-letter" }],
  });
  assert.deepEqual(extrasIssues(ok), []);
  assert.equal(Extras.safeParse({ takeaways: ["a".repeat(30), "b".repeat(30)] }).success, false);
  assert.equal(
    Extras.safeParse({ segments: [{ name: "Elim", revenue: -1 }, { name: "Ana", revenue: 5 }] }).success,
    false,
  );
  assert.equal(
    Extras.safeParse({ kpis: [{ name: "Tahmin", value: 1, unit: "%", source: "analyst" }] }).success,
    false,
  );
  assert.equal(extrasIssues({ segments: ok.segments, segments_source: null }).length, 1);

  // Gidiş-dönüş: GET'in döndürdüğü paket POST'a aynen geri gönderilebilir.
  const back = extrasToOutput(extrasFromInput(ok));
  assert.equal(Extras.safeParse(back).success, true);
  assert.equal(back.segments[0]?.yoy_pct, 30);
});

test("segment payları toplam üzerinden, fark künyesi yüzde birde", () => {
  const { rows, total } = segmentShares([
    { name: "B", revenue: 1e9 },
    { name: "A", revenue: 3e9 },
  ]);
  assert.equal(total, 4e9);
  assert.deepEqual(rows.map((item) => [item.name, item.share]), [["A", 0.75], ["B", 0.25]]);
  assert.equal(segmentTotalDiffers(4e9, 4.02e9), false);
  assert.equal(segmentTotalDiffers(4e9, 4.2e9), true);
  assert.equal(segmentTotalDiffers(4e9, null), false);
});

test("KPI değeri: birim sayıdan kopmaz", () => {
  assert.equal(kpiValueText({ value: 301e6, unit: "abone" }, "tr"), "301 Mn abone");
  assert.equal(kpiValueText({ value: 45.2, unit: "%" }, "tr"), "%45,2");
  assert.equal(kpiValueText({ value: 96, unit: "gün" }, "tr"), "96\u00A0gün");
  // Eksi marj işaretli; işaretle sayı arasındaki dar boşluk sitenin `SIGN_GAP`i.
  assert.match(kpiValueText({ value: -3.1, unit: "%" }, "en"), /^−\s?3\.1%$/u);
  assert.match(kpiValueText({ value: 4.2e9, unit: "USD" }, "en"), /4\.20 B/);
});
