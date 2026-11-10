import test from "node:test";
import assert from "node:assert/strict";
import { briefReleases, laneOverflows, sharedLaneScale, MOVERS_LANE_FLOOR, WORLD_LANE_FLOOR } from "../lib/home-figures";
import type { EconomicEventRow } from "../lib/schema";

/**
 * Ana sayfa ölçü panellerinin saf hesabı — kurallar `lib/home-figures.ts`.
 * Örnek: 6 Kasım Cuma bülteni (5 Kasım Perşembe seansını anlatıyor, 09:00
 * ET'de yazılıyor); tarım dışı istihdam 6 Kasım 08:30 ET.
 */

const row = (over: Partial<EconomicEventRow>): EconomicEventRow =>
  ({
    id: over.slug ?? "x",
    eventDate: "2026-11-06",
    eventTimeEt: "08:30",
    slug: "nfp-2026-11-06",
    titleTr: "Tarım Dışı İstihdam",
    titleEn: "Nonfarm Payrolls",
    importance: "high",
    actual: "165",
    forecast: "55",
    previous: "22",
    unit: "bin",
    fredSeriesId: null,
    source: "seed",
    updatedAt: new Date(0),
    ...over,
  }) as EconomicEventRow;

const OPTS = { from: "2026-11-05", briefDate: "2026-11-06", publishTimeEt: "09:00" };

test("ortak ölçek: en büyük mutlak değer, tabanın altına inmez", () => {
  assert.equal(sharedLaneScale([-6.49, -4.41, -3.53], WORLD_LANE_FLOOR), 6.49);
  assert.equal(sharedLaneScale([0.2, -0.3], WORLD_LANE_FLOOR), 1);
  assert.equal(sharedLaneScale([2.4, -1.1], MOVERS_LANE_FLOOR), 3);
  assert.equal(sharedLaneScale([12.5, -20.66], MOVERS_LANE_FLOOR), 20.66);
});

test("ortak ölçek: tek uç değer ölçeği belirlemez, ikinci değer belirler", () => {
  /* 10 Kasım canlısı: tek sert satır öteki beşi çizgiye indiriyordu. */
  const day = [-6.93, -1.54, -1.2, 0.9, -0.42, 0.31];
  const scale = sharedLaneScale(day, WORLD_LANE_FLOOR);
  assert.equal(scale, 1.54);
  assert.equal(laneOverflows(-6.93, scale), true);
  assert.equal(laneOverflows(-1.54, scale), false);
  /* En büyük ikinciye yakınsa (1,5 katın altında) kimse taşmaz. */
  assert.equal(sharedLaneScale([-6.49, -4.41, -3.53], WORLD_LANE_FLOOR), 6.49);
  assert.equal(sharedLaneScale([16.79, 16.6, 13.26, -6.93, -6.4], MOVERS_LANE_FLOOR), 16.79);
  /* Uç değerin ardındaki ikinci değer tabanın altındaysa ölçek taban. */
  const calm = sharedLaneScale([4.2, 0.3, -0.2, 0.1], WORLD_LANE_FLOOR);
  assert.equal(calm, 1);
  assert.equal(laneOverflows(4.2, calm), true);
  /* İki değerde "uç" tanımsız. */
  assert.equal(sharedLaneScale([12.5, -2], MOVERS_LANE_FLOOR), 12.5);
  assert.equal(laneOverflows(null, 3), false);
  assert.equal(laneOverflows(3, 3), false);
});

test("ortak ölçek: bilinmeyen değer hesaba girmez", () => {
  assert.equal(sharedLaneScale([null, undefined, Number.NaN, -1.5], WORLD_LANE_FLOOR), 1.5);
  assert.equal(sharedLaneScale([], WORLD_LANE_FLOOR), WORLD_LANE_FLOOR);
});

test("açıklamalar: yayın saatinden önce açıklanan yüksek etkili veri girer", () => {
  const picked = briefReleases([row({})], OPTS);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].slug, "nfp-2026-11-06");
});

test("açıklamalar: yayından sonra, saatsiz ya da gerçekleşensiz satır girmez", () => {
  const rows = [
    row({ slug: "late", eventTimeEt: "10:00" }),
    row({ slug: "untimed", eventTimeEt: null }),
    row({ slug: "pending", actual: null }),
    row({ slug: "dash", actual: "—" }),
    row({ slug: "medium", importance: "medium" }),
    row({ slug: "old", eventDate: "2026-11-04" }),
    row({ slug: "future", eventDate: "2026-11-07" }),
  ];
  assert.deepEqual(briefReleases(rows, OPTS), []);
});

test("açıklamalar: seans günü saatsiz de girer; sıra gün ve saat, tavan iki", () => {
  const rows = [
    row({ slug: "nfp", eventDate: "2026-11-06", eventTimeEt: "08:30" }),
    row({ slug: "ism", eventDate: "2026-11-05", eventTimeEt: "10:00" }),
    row({ slug: "claims", eventDate: "2026-11-05", eventTimeEt: "08:30" }),
    row({ slug: "untimed-session", eventDate: "2026-11-05", eventTimeEt: null }),
  ];
  const picked = briefReleases(rows, OPTS);
  assert.deepEqual(
    picked.map((r) => r.slug),
    ["claims", "ism"],
  );
  assert.deepEqual(
    briefReleases(rows, { ...OPTS, limit: 4 }).map((r) => r.slug),
    ["claims", "ism", "untimed-session", "nfp"],
  );
  // Girdi bozulmaz.
  assert.equal(rows[0].slug, "nfp");
});
