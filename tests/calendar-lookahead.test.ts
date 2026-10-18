import test from "node:test";
import assert from "node:assert/strict";

import { buildLookahead, byImportance, mondayOf, valueRatios } from "../components/calendar/lookahead";
import type { EconomicEventRow } from "../lib/schema";

/**
 * Takvimin altı haftalık görünümü ve değer çubuğu.
 *
 * Görünüm bir boşluk İDDİASI taşıyor: kulvarı boş bir gün "o gün açıklama
 * yok" demek. Bu yüzden sorgulanmamış günlere (bugünden önce, pencerenin
 * ötesi) olay yazılmamalı ve hafta sonu bakan okuyucu biten haftayı değil
 * gelecek haftayı görmeli.
 */

function event(date: string, importance: string, slug = `x-${date}-${importance}`, time: string | null = "08:30"): EconomicEventRow {
  return {
    id: slug,
    eventDate: date,
    eventTimeEt: time,
    slug,
    titleTr: slug,
    titleEn: slug,
    importance,
    actual: null,
    forecast: null,
    previous: null,
    unit: null,
    fredSeriesId: null,
    source: "seed",
    updatedAt: new Date(0),
  };
}

test("mondayOf: Pazar haftanın son günü sayılır", () => {
  assert.equal(mondayOf("2026-10-18"), "2026-10-12"); // Pazar
  assert.equal(mondayOf("2026-10-19"), "2026-10-19"); // Pazartesi
  assert.equal(mondayOf("2026-10-23"), "2026-10-19"); // Cuma
});

test("hafta sonu bakan okuyucu gelecek haftadan başlar", () => {
  const weeks = buildLookahead({ events: [], holidays: new Map(), from: "2026-10-18", until: "2026-11-28" });
  assert.equal(weeks[0].monday, "2026-10-19");
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0].current, false);
});

test("hafta içi: bugünden önceki günler sorgulanmamış, olay taşımaz", () => {
  const weeks = buildLookahead({
    events: [event("2026-10-21", "high"), event("2026-10-22", "medium")],
    holidays: new Map(),
    from: "2026-10-21",
    until: "2026-12-01",
  });
  assert.equal(weeks[0].monday, "2026-10-19");
  assert.equal(weeks[0].current, true);
  assert.deepEqual(weeks[0].days.map((day) => day.past), [true, true, false, false, false]);
  assert.equal(weeks[0].days[2].today, true);
  assert.equal(weeks[0].total, 2);
  assert.equal(weeks[0].high.length, 1);
});

test("pencerenin ötesindeki gün olay taşımaz ve işaretlenir", () => {
  const weeks = buildLookahead({
    events: [event("2026-11-27", "high")],
    holidays: new Map(),
    from: "2026-10-19",
    until: "2026-11-26",
  });
  const last = weeks.at(-1)!;
  const friday = last.days.find((day) => day.date === "2026-11-27");
  assert.ok(!friday || (friday.outside && friday.events.length === 0));
});

test("byImportance: yüksek önce, aynı önemde saat sırası", () => {
  const sorted = byImportance([
    event("2026-10-21", "low", "a"),
    event("2026-10-21", "high", "b", "14:00"),
    event("2026-10-21", "high", "c", "08:30"),
    event("2026-10-21", "medium", "d"),
  ]);
  assert.deepEqual(sorted.map((row) => row.slug), ["c", "b", "d", "a"]);
});

test("valueRatios: yalnız düz sayılar, en az iki tane", () => {
  assert.equal(valueRatios(["4.2", null, null]), null);
  assert.equal(valueRatios(["250K", "180K", null]), null);
  const scale = valueRatios(["4.5", "4.0", "-1"]);
  assert.ok(scale);
  assert.equal(scale.signed, true);
  assert.equal(scale.ratios[0], 1);
  assert.equal(valueRatios(["0", "0", null]), null);
});
