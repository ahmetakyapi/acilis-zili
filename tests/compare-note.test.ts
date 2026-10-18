import test from "node:test";
import assert from "node:assert/strict";

import {
  annualizedVolatility,
  compareNoteKey,
  completedCloses,
  maxDrawdown,
  mondayOf,
  noteSymbols,
  periodReturn,
  rankByReturn,
  seriesStats,
} from "../lib/compare-note-core";
import { periodChangePct } from "../lib/compare";
import type { Bar } from "../lib/providers/types";

/**
 * Claude Karşılaştırma Notu'nun saf hesapları (lib/compare-note-core.ts).
 * Claude hesap yapmıyor; buradaki her sayı modele biçimlenmiş gidiyor ve
 * çıktıdaki sayı girdide geçmek zorunda. Yani bu hesaplar yanlışsa notun
 * kendisi yanlış olur — denetim onu yakalayamaz.
 */

const bar = (date: string, close: number): Bar => ({
  time: Date.parse(`${date}T04:00:00Z`) / 1000,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
});

test("noteSymbols: sıralı, tekrarsız, 2–4; fazlası ya da geçersizi reddeder", () => {
  assert.deepEqual(noteSymbols("NVDA,amd,NVDA"), ["AMD", "NVDA"]);
  assert.equal(noteSymbols("NVDA"), null);
  assert.equal(noteSymbols("A,B,C,D,E"), null);
  assert.equal(noteSymbols("NVDA,<x>"), null);
  assert.equal(noteSymbols(null), null);
});

test("compareNoteKey: sıra fark etmez, seans ve aralık anahtara girer", () => {
  const a = compareNoteKey(["NVDA", "AMD"], "6M", "2026-10-16");
  assert.equal(a, compareNoteKey(["AMD", "NVDA"], "6M", "2026-10-16"));
  assert.equal(a, "AMD,NVDA:6M:2026-10-16");
  assert.notEqual(a, compareNoteKey(["AMD", "NVDA"], "1Y", "2026-10-16"));
  assert.notEqual(a, compareNoteKey(["AMD", "NVDA"], "6M", "2026-10-19"));
});

test("periodReturn: grafiğin dönem getirisiyle aynı tanım", () => {
  const closes = [100, 90, 120, 110];
  assert.equal(periodReturn(closes), 10);
  assert.equal(periodReturn(closes), periodChangePct({ symbol: "X", closes, times: [1, 2, 3, 4] }));
  assert.equal(periodReturn([100]), null);
  assert.equal(periodReturn([0, 5]), null);
});

test("maxDrawdown: zirveden sonraki en derin dip, zirve önceden gelmeli", () => {
  const dd = maxDrawdown([100, 120, 90, 130, 117])!;
  assert.equal(dd.pct, -25); // 120 → 90
  assert.equal(dd.peak, 1);
  assert.equal(dd.trough, 2);
  // Hep yükselen seride düşüş sıfır (dipten önceki "zirve" sonradan gelemez).
  assert.equal(maxDrawdown([50, 60, 70])!.pct, 0);
  assert.equal(maxDrawdown([5]), null);
});

test("annualizedVolatility: sabit adımda sıfır, beş getiriden azında null", () => {
  assert.equal(annualizedVolatility([100, 100, 100, 100, 100, 100], 252), 0);
  assert.equal(annualizedVolatility([100, 101, 102, 103, 104], 252), null);
  // ±%1 dönüşümlü: örneklem std ≈ 0,01 × √(n/(n−1)); √252 ile yıllık.
  const closes = [100];
  for (let i = 0; i < 20; i++) closes.push(closes[closes.length - 1]! * (i % 2 ? 0.99 : 1.01));
  const vol = annualizedVolatility(closes, 252)!;
  assert.ok(vol > 15.8 && vol < 16.5, String(vol));
});

test("completedCloses: günlükte son bar beklenen seans değilse not yazılmaz", () => {
  const bars = [bar("2026-10-14", 10), bar("2026-10-15", 11), bar("2026-10-16", 12), bar("2026-10-19", 13)];
  // Seans sürüyor (19'u açık): 19'un barı atılır, 16'da biter.
  const points = completedCloses(bars, "2026-10-16")!;
  assert.deepEqual(points.map((p) => p.date), ["2026-10-14", "2026-10-15", "2026-10-16"]);
  // Bayat seri: son tamamlanmış seans 19 ama seri 16'da kalmış.
  assert.equal(completedCloses(bars.slice(0, 3), "2026-10-19"), null);
  assert.equal(completedCloses([], "2026-10-16"), null);
});

test("mondayOf: haftanın pazartesisi", () => {
  assert.equal(mondayOf("2026-10-16"), "2026-10-12"); // cuma
  assert.equal(mondayOf("2026-10-12"), "2026-10-12"); // pazartesi
  assert.equal(mondayOf("2026-10-18"), "2026-10-12"); // pazar
});

test("completedCloses (5Y haftalık): süren hafta atılır, yerine son seansın günlük kapanışı", () => {
  const weekly = [bar("2026-09-28", 100), bar("2026-10-05", 104), bar("2026-10-12", 999)];
  const daily = [bar("2026-10-15", 108), bar("2026-10-16", 110), bar("2026-10-19", 111)];
  const points = completedCloses(weekly, "2026-10-16", { weekly: true, daily })!;
  assert.deepEqual(points, [
    { date: "2026-09-28", close: 100 },
    { date: "2026-10-05", close: 104 },
    { date: "2026-10-16", close: 110 },
  ]);
  // Günlük kuyruk beklenen seansa ulaşmıyorsa yine yazılmaz.
  assert.equal(completedCloses(weekly, "2026-10-19", { weekly: true, daily: daily.slice(0, 2) }), null);
});

test("seriesStats + rankByReturn", () => {
  const pts = (closes: number[]) => closes.map((close, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, close }));
  const a = seriesStats("AAA", pts([100, 110, 99, 120, 121, 125, 130]), false)!;
  const b = seriesStats("BBB", pts([50, 49, 48, 47, 46, 45, 40]), false)!;
  assert.equal(a.returnPct, 30);
  assert.equal(a.troughDate, "2026-10-03");
  assert.equal(b.returnPct, -20);
  assert.ok(a.volatilityPct !== null);
  assert.deepEqual(rankByReturn([b, a]), ["AAA", "BBB"]);
  // Haftalıkta son (yarım hafta) parça oynaklığa girmez: 6 nokta → 4 getiri → null.
  assert.equal(seriesStats("W", pts([1, 2, 3, 4, 5, 6]), true)!.volatilityPct, null);
});
