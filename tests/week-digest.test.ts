import test from "node:test";
import assert from "node:assert/strict";

import { LOUD_VOLUME_RATIO, rangePosition, weekDigest } from "../lib/week-digest";

/**
 * Haftanın Okuması (lib/week-digest.ts): Claude notu yokken kartın sağ
 * kolonunu dolduran deterministik özet. Değişmezler:
 *
 *  1. En sert seans mutlak değişimi en büyük olan; S&P 500 aynı günü
 *     yalnız seriler hizalıysa.
 *  2. Hacim tabanı yoksa (oran hiç yok) hacim okuması null, "0/5" değil.
 *  3. S&P 500 okuması yalnız aynı günler hizalıysa; fark işaretli.
 *  4. Aralık bileşik birikimli yoldan, başlangıç kapanışı (0) dahil;
 *     düz yolda null.
 */

const D = ["2026-11-19", "2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25"];
/* Canlı MU haftasına benzer: −2,1 / −13,9 / +19,0 / −11,0 / −4,5. */
const MU = [-2.1, -13.9, 19.0, -11.0, -4.5];
const VOL = [1.1, 1.9, 1.6, 1.2, 1.7];
const SPY = [-0.4, -1.2, 1.2, -0.9, -0.6];

const sessions = (changes: number[], vols: (number | null)[] = VOL) =>
  changes.map((changePct, i) => ({ date: D[i]!, changePct, volumeRatio: vols[i] ?? null }));
const market = (changes: number[], dates = D) => changes.map((changePct, i) => ({ date: dates[i]!, changePct }));

test("en sert seans mutlak değişimle seçilir, S&P aynı gün eklenir", () => {
  const out = weekDigest({ sessions: sessions(MU), marketSessions: market(SPY) });
  assert.deepEqual(out.loudest, { date: D[2], changePct: 19.0, marketPct: 1.2 });
});

test("yüksek hacimli seans eşiği ortak sabit; en yüksek kat ve günü", () => {
  assert.equal(LOUD_VOLUME_RATIO, 1.5);
  const out = weekDigest({ sessions: sessions(MU), marketSessions: null });
  assert.ok(out.volume);
  assert.equal(out.volume.loud, 3);
  assert.equal(out.volume.total, 5);
  assert.deepEqual(out.volume.peak, { date: D[1], ratio: 1.9 });
});

test("hacim tabanı yoksa okuma hiç yok", () => {
  const out = weekDigest({ sessions: sessions(MU, [null, null, null, null, null]), marketSessions: null });
  assert.equal(out.volume, null);
});

test("S&P okuması: önde kapatılan seans sayısı ve işaretli en geniş fark", () => {
  const out = weekDigest({ sessions: sessions(MU), marketSessions: market(SPY) });
  assert.ok(out.market);
  assert.equal(out.market.ahead, 1);
  assert.equal(out.market.total, 5);
  assert.equal(out.market.widest.date, D[2]);
  assert.ok(Math.abs(out.market.widest.gapPts - 17.8) < 1e-9);
});

test("hizasız S&P serisinde kıyas okumaları yok", () => {
  const shifted = market(SPY, ["2026-11-18", ...D.slice(0, 4)]);
  const out = weekDigest({ sessions: sessions(MU), marketSessions: shifted });
  assert.equal(out.market, null);
  assert.equal(out.loudest?.marketPct, null);
  assert.equal(weekDigest({ sessions: sessions(MU), marketSessions: market(SPY.slice(0, 4)) }).market, null);
});

test("aralık bileşik yoldan; başlangıç dahil, kapanışın yeri", () => {
  const out = weekDigest({ sessions: sessions(MU), marketSessions: null });
  assert.ok(out.range);
  // −2,1 sonra −13,9: 0,979 × 0,861 = 0,842919 → dip −%15,71 (Cuma)
  assert.equal(out.range.low.date, D[1]);
  assert.ok(Math.abs(out.range.low.pct - -15.7081) < 1e-3);
  // +19: 0,842919 × 1,19 = 1,003074 → zirve +%0,31 (Pazartesi)
  assert.equal(out.range.high.date, D[2]);
  assert.equal(out.range.near, "low");
});

test("yalnız yükselen haftada dip başlangıç kapanışı, kapanış zirvede", () => {
  const out = weekDigest({ sessions: sessions([1, 1, 1, 1, 1]), marketSessions: null });
  assert.ok(out.range);
  assert.deepEqual(out.range.low, { date: null, pct: 0 });
  assert.equal(out.range.high.date, D[4]);
  assert.equal(out.range.near, "high");
});

test("düz hafta: aralık yok; sıfır değişim en sert seansı yine verir", () => {
  const out = weekDigest({ sessions: sessions([0, 0, 0, 0, 0]), marketSessions: null });
  assert.equal(out.range, null);
  assert.equal(out.loudest?.date, D[0]);
});

test("bozuk değişimde hiçbir okuma yok", () => {
  const out = weekDigest({ sessions: sessions([1, Number.NaN, 1, 1, 1]), marketSessions: null });
  assert.deepEqual(out, { loudest: null, volume: null, market: null, range: null });
  assert.deepEqual(weekDigest({ sessions: [], marketSessions: null }), { loudest: null, volume: null, market: null, range: null });
});

test("kulvar yeri sınırlı ve düz aralıkta ortada", () => {
  assert.equal(rangePosition(0, -10, 10), 50);
  assert.equal(rangePosition(-20, -10, 10), 0);
  assert.equal(rangePosition(5, 5, 5), 50);
});
