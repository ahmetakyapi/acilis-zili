import test from "node:test";
import assert from "node:assert/strict";
import { axisBands, axisDomain, axisHours, axisShare, bandOf, flowLead, layoutFlags, minutesOfClock, remainingParts, type FlagInput } from "../lib/flow-axis";

/* Günün ekseni (components/today/flow/FlowAxis.tsx): bant sınırları,
   olayın eksendeki yeri, basamaklı bayrak yerleşimi ve "sıradaki olay". */

const NORMAL = axisDomain(16 * 60, true);
const HALF = axisDomain(13 * 60, true);
const at = (clock: string) => minutesOfClock(clock);
const flags = (...clocks: (string | null)[]): FlagInput[] => clocks.map((clock, i) => ({ id: `e${i}`, minutes: clock === null ? null : at(clock) }));

test("eksen ön seansın başından akşam seansının sonuna; yarım günde kapanış + dört saat", () => {
  assert.deepEqual([NORMAL.start, NORMAL.open, NORMAL.close, NORMAL.end], [240, 570, 960, 1200]);
  assert.deepEqual([HALF.close, HALF.end], [780, 1020]);
});

test("işlem günü değilse bant yok, eksen normal günün cetveli", () => {
  const closed = axisDomain(13 * 60, false);
  assert.equal(axisBands(closed).length, 0);
  assert.equal(closed.end, 1200);
});

test("bantlar ekseni boşluksuz kaplar", () => {
  for (const domain of [NORMAL, HALF]) {
    const bands = axisBands(domain);
    assert.deepEqual(bands.map((band) => band.key), ["pre", "regular", "after"]);
    assert.equal(bands[0]!.from, 0);
    assert.equal(bands[2]!.to, 1);
    assert.equal(bands[0]!.to, bands[1]!.from);
    assert.equal(bands[1]!.to, bands[2]!.from);
  }
});

test("eksenin dışındaki saat uca yapışır", () => {
  assert.equal(axisShare(at("02:00"), NORMAL), 0);
  assert.equal(axisShare(at("21:30"), NORMAL), 1);
  assert.equal(axisShare(at("12:00"), NORMAL), 0.5);
});

test("sınır dakikası başlayan bandındır", () => {
  assert.equal(bandOf(at("08:30"), NORMAL), "pre");
  assert.equal(bandOf(at("09:30"), NORMAL), "regular");
  assert.equal(bandOf(at("16:00"), NORMAL), "after");
  assert.equal(bandOf(at("13:00"), HALF), "after");
  assert.equal(bandOf(at("14:00"), HALF), "after");
});

test("saat çentikleri uçları basmaz, dört saatte biri uzun", () => {
  const hours = axisHours(NORMAL);
  assert.equal(hours.length, 15);
  assert.deepEqual(hours.filter((hour) => hour.major).map((hour) => hour.at), [0.25, 0.5, 0.75]);
});

test("tek olay en alt katta, saati bilinmeyen tepside", () => {
  const layout = layoutFlags(flags("08:30", null), NORMAL, 0.13);
  assert.equal(layout.rows, 1);
  assert.deepEqual(layout.loose, ["e1"]);
  assert.equal(layout.placed[0]!.row, 0);
  assert.equal(layout.placed[0]!.band, "pre");
});

test("aynı dakikadaki beş olay tek direkte kümelenir, listede ilk gelen en üstte", () => {
  const layout = layoutFlags(flags("08:30", "08:30", "08:30", "08:30", "08:30"), NORMAL, 0.13);
  assert.equal(layout.rows, 5);
  assert.deepEqual(layout.placed.map((flag) => flag.row), [4, 3, 2, 1, 0]);
  assert.ok(layout.placed.every((flag) => flag.clusterSize === 5));
  assert.deepEqual(layout.placed.map((flag) => flag.clusterIndex), [0, 1, 2, 3, 4]);
});

test("uzak olaylar aynı katı paylaşır", () => {
  const layout = layoutFlags(flags("08:30", "13:00", "16:00"), NORMAL, 0.13);
  assert.deepEqual(layout.placed.map((flag) => flag.row), [0, 0, 0]);
});

test("yakın olaylar soldan sağa inen basamak olur: hiçbir direk bayrağın altından geçmez", () => {
  const input = flags("08:00", "08:30", "08:30", "08:30", "09:45", "10:00", "10:00", "10:30", "14:00", "14:00", "14:30", "16:00");
  const share = 0.13;
  const layout = layoutFlags(input, NORMAL, share);
  const boxes = layout.placed.map((flag) => ({ ...flag, lo: flag.flip ? flag.at - share : flag.at, hi: flag.flip ? flag.at : flag.at + share }));
  for (const a of boxes) for (const b of boxes) {
    if (a === b) continue;
    if (a.row === b.row) assert.ok(a.hi <= b.lo + 1e-9 || b.hi <= a.lo + 1e-9, `${a.id} ile ${b.id} aynı katta üst üste`);
    /* b'nin direği a'nın bayrağının içinden geçiyorsa b a'dan aşağıda olmalı */
    if (Math.abs(a.at - b.at) > 1e-9 && b.at > a.lo + 1e-9 && b.at < a.hi - 1e-9) assert.ok(b.row < a.row, `${b.id} direği ${a.id} bayrağını kesiyor`);
  }
  assert.equal(layout.placed[0]!.row, layout.rows - 1);
});

test("sağ uca sığmayan bayrak sola açılır", () => {
  const layout = layoutFlags(flags("16:00", "19:30"), NORMAL, 0.13);
  assert.equal(layout.placed[0]!.flip, false);
  assert.equal(layout.placed[1]!.flip, true);
});

test("bayrak açıldığı yöndeki ilk engele kadar uzayabilir", () => {
  const layout = layoutFlags(flags("08:00", "08:30", "08:30", "16:00", "19:30"), NORMAL, 0.13);
  const [early, top, low, close, late] = layout.placed;
  /* 19:30 sola açılır ve en altta; 16:00 onunla üst üste bindiği için bir kat yukarıda. */
  assert.deepEqual(layout.placed.map((flag) => flag.row), [2, 1, 0, 1, 0]);
  /* 08:00 en üst katta: sağında o kata yükselen direk yok, eksenin sonuna dek boş. */
  assert.ok(Math.abs(early!.room - (1 - early!.at)) < 1e-9);
  /* 08:30'un iki bayrağı da 16:00 direğine kadar (direk birinci kata yükseliyor). */
  assert.ok(Math.abs(top!.room - (close!.at - top!.at)) < 1e-9);
  assert.ok(Math.abs(low!.room - (close!.at - low!.at)) < 1e-9);
  /* 16:00'nın katında sağda engel yok. */
  assert.ok(Math.abs(close!.room - (1 - close!.at)) < 1e-9);
  assert.equal(late!.flip, true);
  /* 19:30 sola açılır; solunda, katını kesen ilk direk 16:00 (birinci kata yükseliyor). */
  assert.ok(Math.abs(late!.room - (late!.at - close!.at)) < 1e-9);
  /* Aynı katta karşı karşıya iki bayrak birbirinin payına girmez. */
  const pair = layoutFlags(flags("13:00", "19:30"), NORMAL, 0.13).placed;
  assert.deepEqual(pair.map((flag) => flag.row), [0, 0]);
  assert.ok(pair[0]!.at + pair[0]!.room <= pair[1]!.at - pair[1]!.room + 1e-9);
});

const NOW = Date.parse("2026-11-13T14:50:00Z");
const iso = (minutesFromNow: number) => new Date(NOW + minutesFromNow * 60_000).toISOString();

test("sıradaki olay ve kalan dakika; kalan süre yukarı yuvarlanır", () => {
  const lead = flowLead([
    { id: "a", scheduledAt: iso(-60), state: "released" },
    { id: "b", scheduledAt: iso(99.5), state: "scheduled" },
    { id: "c", scheduledAt: iso(400), state: "scheduled" },
  ], NOW, "today");
  assert.deepEqual(lead, { kind: "next", id: "b", minutes: 100 });
});

test("sıradaki yoksa süren, o da yoksa sonucu beklenen; hepsi geldiyse gün tamam", () => {
  assert.deepEqual(flowLead([{ id: "a", scheduledAt: iso(-10), state: "live" }, { id: "b", scheduledAt: iso(-30), state: "awaiting" }], NOW, "today"), { kind: "live", id: "a" });
  assert.deepEqual(flowLead([{ id: "a", scheduledAt: iso(-90), state: "awaiting" }, { id: "b", scheduledAt: iso(-30), state: "partial" }], NOW, "today"), { kind: "awaiting", id: "b" });
  assert.deepEqual(flowLead([{ id: "a", scheduledAt: iso(-90), state: "released" }, { id: "b", scheduledAt: iso(-30), state: "held" }], NOW, "today"), { kind: "done" });
});

test("saati belirsiz planlı olay kaldıysa gün tamam denmez", () => {
  assert.deepEqual(flowLead([{ id: "a", scheduledAt: iso(-90), state: "released" }, { id: "b", scheduledAt: null, state: "scheduled" }], NOW, "today"), { kind: "awaiting", id: "b" });
});

test("başka gün: gelecekte ilk olay, geçmişte özet, boş günde boş", () => {
  assert.deepEqual(flowLead([{ id: "a", scheduledAt: iso(2000), state: "scheduled" }], NOW, "future"), { kind: "first", id: "a" });
  assert.deepEqual(flowLead([{ id: "a", scheduledAt: iso(-2000), state: "released" }], NOW, "past"), { kind: "past" });
  assert.deepEqual(flowLead([], NOW, "today"), { kind: "empty" });
});

test("kalan süre parçaları", () => {
  assert.deepEqual(remainingParts(100), { days: 0, hours: 1, minutes: 40 });
  assert.deepEqual(remainingParts(45), { days: 0, hours: 0, minutes: 45 });
  assert.deepEqual(remainingParts(26 * 60 + 5), { days: 1, hours: 2, minutes: 0 });
});
