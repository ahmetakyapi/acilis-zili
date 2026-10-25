import test from "node:test";
import assert from "node:assert/strict";

import { cumulativePath, loudestSession, weekMoveFromBars } from "../components/stock/week-move";
import type { Bar } from "../lib/providers/types";

/**
 * "Bu Hafta Neden Hareket Etti" kartının sayıları (components/stock/week-move.ts).
 *
 * Kart sayıları sunucuda kendisi hesaplıyor, Claude notu yalnız metni
 * getiriyor; iki hesap ayrışırsa ekranda notun anlattığı haftayla kartın
 * çizdiği hafta farklı olur. Değişmezler:
 *
 *  1. Pencere son altı kapanış: toplam değişim ilk ile son kapanış arası,
 *     beş adım (lib/stock-insights.ts → buildMove ile aynı).
 *  2. S&P 500 yalnız son barı aynı güne düşüyorsa; yoksa null.
 *  3. Yetersiz ya da bozuk barda kart hiç çizilmez (null).
 *  4. Birikimli yol bileşik: +10 ve −10 sıfıra değil −1'e iner.
 */

const DAY = 86_400;
const START = Date.UTC(2026, 9, 1) / 1000;
const bars = (closes: number[], volume = 100): Bar[] =>
  closes.map((close, i) => ({ time: START + i * DAY, open: close, high: close, low: close, close, volume }));

test("beş seansın toplamı ilk ve son kapanış arası", () => {
  const out = weekMoveFromBars("ABC", bars([90, 100, 101, 99, 102, 105, 110]), null);
  assert.ok(out);
  assert.equal(out.sessions.length, 5);
  assert.equal(out.from, "2026-10-03");
  assert.equal(out.to, "2026-10-07");
  assert.ok(Math.abs(out.changePct - 10) < 1e-9);
  assert.ok(Math.abs(out.sessions[0]!.changePct - 1) < 1e-9);
  assert.equal(out.marketPct, null);
  assert.equal(out.marketSessions, null);
});

test("S&P 500 yalnız aynı güne hizalıysa", () => {
  const stock = bars([100, 101, 102, 103, 104, 105]);
  const aligned = weekMoveFromBars("ABC", stock, bars([200, 202, 204, 206, 208, 210]));
  assert.ok(aligned && aligned.marketPct !== null);
  assert.ok(Math.abs(aligned.marketPct - 5) < 1e-9);
  assert.equal(aligned.marketSessions?.length, 5);
  const shifted = weekMoveFromBars("ABC", stock, bars([200, 202, 204, 206, 208]));
  assert.equal(shifted?.marketPct, null);
});

test("yetersiz ya da bozuk bar çizilmez", () => {
  assert.equal(weekMoveFromBars("ABC", null, null), null);
  assert.equal(weekMoveFromBars("ABC", bars([1, 2, 3, 4, 5]), null), null);
  assert.equal(weekMoveFromBars("ABC", bars([100, 0, 101, 102, 103, 104]), null), null);
});

test("hacim oranı önceki seansların ortalamasına göre", () => {
  const series = bars(Array.from({ length: 26 }, () => 100));
  series[series.length - 1] = { ...series[series.length - 1]!, volume: 300 };
  const out = weekMoveFromBars("ABC", series, null);
  assert.ok(Math.abs((out?.sessions[4]?.volumeRatio ?? 0) - 3) < 1e-9);
});

test("birikimli yol bileşik", () => {
  const path = cumulativePath([{ changePct: 10 }, { changePct: -10 }]);
  assert.equal(path[0], 0);
  assert.ok(Math.abs(path[2]! - -1) < 1e-9);
});

test("en sert seans mutlak değere göre", () => {
  assert.equal(loudestSession([{ changePct: 1 }, { changePct: -3 }, { changePct: 2 }]), 1);
  assert.equal(loudestSession([]), -1);
});
