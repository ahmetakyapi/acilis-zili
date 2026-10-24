import test from "node:test";
import assert from "node:assert/strict";
import {
  archivePosters,
  archiveSessions,
  bellEnergy,
  breadthOf,
  buildPoster,
  dayChange,
  latestPosterDate,
  parsePosterDate,
  posterComplete,
  posterReadyAt,
  posterScale,
  posterRetryable,
  posterSeed,
  type PosterBreadth,
} from "../lib/day-poster";
import { posterBoxHeight, posterScene } from "../lib/ink/poster";
import { makeHeroTap, INK_SCENES } from "../lib/ink/scenes";
import type { MarketHoliday } from "../lib/market-hours";
import type { Bar } from "../lib/providers/types";

/**
 * Günün Posteri'nin saf kararları — hangi gün basılır, yüzde hangi iki
 * kapanıştan, genişlik ne zaman yok sayılır, zilin şiddeti nasıl ölçülür.
 * Posterin sözü "bu sahnedeki her şey O GÜNÜN kapanışı"; testler o sözü
 * tutuyor.
 */

const HOLIDAYS: MarketHoliday[] = [
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day After Thanksgiving", earlyCloseEt: "13:00" },
];

/** Alpaca gün barı damgası: günün 00:00 ET'si = 04:00Z (yaz saati). */
function bar(date: string, close: number): Bar {
  return { time: Date.parse(`${date}T04:00:00Z`) / 1000, open: close, high: close, low: close, close, volume: 1 };
}

test("tarih: biçim, gerçek gün ve bir yıllık pencere", () => {
  const today = "2026-10-24";
  assert.equal(parsePosterDate("2026-10-23", today), "2026-10-23");
  assert.equal(parsePosterDate("2026-02-30", today), null);
  assert.equal(parsePosterDate("23-10-2026", today), null);
  assert.equal(parsePosterDate("bugun", today), null);
  assert.equal(parsePosterDate("2026-10-25", today), null, "gelecek yok");
  assert.equal(parsePosterDate("2025-10-23", today), null, "bir yıldan eski yok");
});

test("tamamlanma: kapanış + gecikme + pay; yarım gün erken, tatil hiç", () => {
  // 23 Ekim (yaz saati): 16:00 + 15 + 5 = 16:20 ET = 20:20Z.
  assert.equal(posterReadyAt("2026-10-23", HOLIDAYS).toISOString(), "2026-10-23T20:20:00.000Z");
  assert.equal(posterComplete("2026-10-23", HOLIDAYS, new Date("2026-10-23T20:19:00Z")), false);
  assert.equal(posterComplete("2026-10-23", HOLIDAYS, new Date("2026-10-23T20:20:00Z")), true);
  // Yarım gün: 13:00 kapanış → 13:20 ET (kış saati, 18:20Z).
  assert.equal(posterReadyAt("2026-11-27", HOLIDAYS).toISOString(), "2026-11-27T18:20:00.000Z");
  assert.equal(posterComplete("2026-11-26", HOLIDAYS, new Date("2026-11-30T00:00:00Z")), false, "tam tatil");
  assert.equal(posterComplete("2026-10-24", HOLIDAYS, new Date("2026-10-26T00:00:00Z")), false, "cumartesi");
});

test("en yeni poster: cumartesi cuma, seans içinde dün, kapanıştan sonra bugün", () => {
  assert.equal(latestPosterDate("2026-10-24", HOLIDAYS, new Date("2026-10-24T15:00:00Z")), "2026-10-23");
  assert.equal(latestPosterDate("2026-10-27", HOLIDAYS, new Date("2026-10-27T15:00:00Z")), "2026-10-26");
  assert.equal(latestPosterDate("2026-10-27", HOLIDAYS, new Date("2026-10-27T20:30:00Z")), "2026-10-27");
  assert.equal(latestPosterDate("2026-11-26", HOLIDAYS, new Date("2026-11-26T22:00:00Z")), "2026-11-25", "tatil");
});

test("yüzde iki BELİRLİ günün kapanışından; gün eksikse yok", () => {
  const bars = [bar("2026-10-21", 100), bar("2026-10-22", 110), bar("2026-10-23", 99)];
  assert.equal(dayChange(bars, "2026-10-23", "2026-10-22"), -10);
  // O gün barı yok: dünün yüzdesi onun yerine geçmiyor.
  assert.equal(dayChange(bars.slice(0, 2), "2026-10-23", "2026-10-22"), null);
  // Önceki gün barı yok (işlem durdu): iki gün öncesine kıyaslanmıyor.
  assert.equal(dayChange([bars[0], bars[2]], "2026-10-23", "2026-10-22"), null);
  assert.equal(dayChange(undefined, "2026-10-23", "2026-10-22"), null);
});

test("genişlik: sayım ve kapsam eşiği", () => {
  const members = Array.from({ length: 10 }, (_, i) => `M${i}`);
  const full = new Map(members.map((m, i) => [m, i < 6 ? 1 : i < 9 ? -1 : 0] as const));
  assert.deepEqual(breadthOf(full, members), { advancing: 6, declining: 3, unchanged: 1, known: 10, members: 10 });
  // %90'ın altında kapsam: genişlik yok, uydurma kesinlik yok.
  const thin = new Map(members.slice(0, 8).map((m) => [m, 1] as const));
  assert.equal(breadthOf(thin, members), null);
});

test("poster: on bir sektörün hepsi ve SPY şart; sıra güçlüden zayıfa", () => {
  const date = "2026-10-23";
  const prev = "2026-10-22";
  const sectors = ["XLA", "XLB", "XLC"];
  const bars: Record<string, Bar[]> = {
    XLA: [bar(prev, 100), bar(date, 99)],
    XLB: [bar(prev, 100), bar(date, 102)],
    XLC: [bar(prev, 100), bar(date, 100.5)],
    SPY: [bar(prev, 100), bar(date, 100.2)],
    M1: [bar(prev, 10), bar(date, 11)],
  };
  const poster = buildPoster({ date, prevDate: prev, bars, sectorSymbols: sectors, indexSymbols: ["QQQ", "SPY"], memberSymbols: ["M1"] });
  assert.ok(poster);
  assert.deepEqual(poster.sectors.map((m) => m.symbol), ["XLB", "XLC", "XLA"]);
  assert.deepEqual(poster.indices.map((m) => m.symbol), ["SPY"], "QQQ verisi yok, düşer");
  assert.equal(poster.breadth?.advancing, 1);
  assert.equal(posterScale(poster), 2, "en büyük hareket, taban 1");

  const missingSector = buildPoster({ date, prevDate: prev, bars: { ...bars, XLA: [bar(prev, 100)] }, sectorSymbols: sectors, indexSymbols: ["SPY"], memberSymbols: [] });
  assert.equal(missingSector, null);
  const missingAnchor = buildPoster({ date, prevDate: prev, bars: { ...bars, SPY: [] }, sectorSymbols: sectors, indexSymbols: ["SPY"], memberSymbols: [] });
  assert.equal(missingAnchor, null);
});

test("zilin şiddeti: %70'e kadar sıfır, %95'te tam, iki yön simetrik", () => {
  const b = (advancing: number, declining: number): PosterBreadth => ({ advancing, declining, unchanged: 0, known: advancing + declining, members: advancing + declining });
  assert.equal(bellEnergy(null), 0);
  assert.equal(bellEnergy(b(50, 50)), 0);
  assert.equal(bellEnergy(b(70, 30)), 0);
  assert.ok(Math.abs(bellEnergy(b(95, 5)) - 1) < 1e-9);
  assert.ok(Math.abs(bellEnergy(b(5, 95)) - bellEnergy(b(95, 5))) < 1e-9);
  assert.ok(bellEnergy(b(85, 15)) > 0 && bellEnergy(b(85, 15)) < 1);
});

test("arşiv: seanslar en yeniden geriye, tatil atlanıyor; kurulamayan gün düşüyor", () => {
  const sessions = archiveSessions("2026-11-30", HOLIDAYS, 3);
  // 26 Kasım tam tatil: 27'nin öncesi 25.
  assert.deepEqual(sessions, [
    { date: "2026-11-30", prevDate: "2026-11-27" },
    { date: "2026-11-27", prevDate: "2026-11-25" },
    { date: "2026-11-25", prevDate: "2026-11-24" },
  ]);
  const spy = [bar("2026-10-20", 100), bar("2026-10-21", 101), bar("2026-10-23", 102)];
  const posters = archivePosters({
    sessions: archiveSessions("2026-10-23", HOLIDAYS, 3),
    bars: { SPY: spy, XLK: spy },
    sectorSymbols: ["XLK"],
    indexSymbols: ["SPY"],
    memberSymbols: [],
  });
  // 23'ün öncesi 22 (işlem günü) ama bar yok → 23 düşer; 22'nin kendisi yok; 21 20'ye kıyasla.
  assert.deepEqual(posters.map((p) => p.date), ["2026-10-21"]);
  assert.equal(posters[0].indices[0].change, 1);
});

test("yeni seansın eksiği geçici: beş gün içinde yeniden sorulur, eskisi önbellekte kalır", () => {
  assert.equal(posterRetryable("2026-10-23", "2026-10-25"), true);
  assert.equal(posterRetryable("2026-10-20", "2026-10-25"), true);
  assert.equal(posterRetryable("2026-10-19", "2026-10-25"), false);
});

test("sahne: deterministik kutu, son kare tanımlı; zil şiddeti yalnız genliği büyütüyor", () => {
  const data = { seed: posterSeed("2026-10-23"), scale: 2, sectors: Array(11).fill(0.5), indices: Array(4).fill(-0.5), breadth: { advancing: 300, unchanged: 3, declining: 200 } };
  assert.equal(posterSeed("2026-10-23"), posterSeed("2026-10-23"));
  assert.notEqual(posterSeed("2026-10-23"), posterSeed("2026-10-22"));
  const scene = posterScene(data);
  assert.equal(scene.box.h, posterBoxHeight(data));
  assert.ok(scene.end > 1 && scene.end < 4, "sahne kısa ve bir kez");
  assert.ok(posterBoxHeight({ ...data, breadth: null }) < scene.box.h, "genişlik yoksa bant yer tutmuyor");
  assert.equal(makeHeroTap(0).end, INK_SCENES.heroTap.end);
});
