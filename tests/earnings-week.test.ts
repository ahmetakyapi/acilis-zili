import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  allocateSlots,
  buildWeek,
  defaultWeekStart,
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
