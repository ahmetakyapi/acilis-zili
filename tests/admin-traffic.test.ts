import test from "node:test";
import assert from "node:assert/strict";
import { mergeDays, sumDays, type DayCount } from "../lib/admin-traffic";

/**
 * Yönetim trafiğinin tek taraması (28 Kasım): kutuların pencereleri gün gün
 * sayımdan toplanıyor. Ziyaretçi-günü günlük tekillerin toplamı — özet her
 * gün döndüğü için penceredeki `count(distinct)` ile birebir aynı.
 */

const DAYS: DayCount[] = [
  { day: "2026-11-20", views: 400, visitors: 120 },
  { day: "2026-11-21", views: 380, visitors: 110 },
  /* 22 Kasım kayıtsız — sorgudan hiç dönmez. */
  { day: "2026-11-23", views: 410, visitors: 125 },
  { day: "2026-11-26", views: 44057, visitors: 9100 },
];

test("pencere toplamı iki ucu da sayar, kayıtsız gün sıfır katkı", () => {
  assert.deepEqual(sumDays(DAYS, "2026-11-20", "2026-11-23"), { views: 1190, visitorDays: 355 });
  assert.deepEqual(sumDays(DAYS, "2026-11-22", "2026-11-22"), { views: 0, visitorDays: 0 });
  assert.deepEqual(sumDays(DAYS, "2026-11-26", "2026-11-26"), { views: 44057, visitorDays: 9100 });
});

test("dizinin dışına taşan pencere yalnız kapsadığını toplar", () => {
  assert.deepEqual(sumDays(DAYS, "2026-11-01", "2026-11-20"), { views: 400, visitorDays: 120 });
  assert.deepEqual(sumDays([], "2026-11-01", "2026-11-30"), { views: 0, visitorDays: 0 });
});

test("önbellekli günler ile canlı bugün sırayla birleşir, canlı kazanır", () => {
  const cached: DayCount[] = [
    { day: "2026-11-27", views: 10, visitors: 2 },
    { day: "2026-11-26", views: 9, visitors: 1 },
  ];
  const live: DayCount[] = [
    { day: "2026-11-28", views: 5, visitors: 3 },
    { day: "2026-11-27", views: 12, visitors: 4 },
  ];
  assert.deepEqual(
    mergeDays(cached, live).map((d) => [d.day, d.views]),
    [
      ["2026-11-26", 9],
      ["2026-11-27", 12],
      ["2026-11-28", 5],
    ],
  );
});
