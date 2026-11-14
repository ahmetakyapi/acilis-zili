import test from "node:test";
import assert from "node:assert/strict";

import { PERIOD_SESSIONS, barDate, periodReturns, thinSeries, ytdSeries } from "../lib/period-returns";
import type { Bar } from "../lib/providers/types";

/**
 * Sektör ve emtia panellerinin dönem getirileri.
 *
 * Değişmezler: dönem İŞLEM GÜNÜ sayısıyla geriye gidiyor; yeterli bar yoksa
 * sonuç null (daha kısa bir dönemin getirisi "3A" başlığı altında
 * yazılmaz); YBB tabanı önceki yılın SON kapanışı.
 */

const DAY_SECONDS = 86_400;
/** Günlük bar damgası 04:00Z (yaz saati, 00:00 ET). */
const ET_MIDNIGHT_OFFSET = 4 * 3600;

function barsFrom(start: string, closes: number[]): Bar[] {
  const base = Date.parse(`${start}T00:00:00Z`) / 1000 + ET_MIDNIGHT_OFFSET;
  return closes.map((close, index) => ({
    time: base + index * DAY_SECONDS,
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
  }));
}

test("barın günü ET gün başı damgasından okunur", () => {
  assert.equal(barDate({ time: Date.parse("2026-09-25T04:00:00Z") / 1000 }), "2026-09-25");
  assert.equal(barDate({ time: Date.parse("2026-01-05T05:00:00Z") / 1000 }), "2026-01-05");
});

test("dönemler işlem günü sayısıyla geriye gider", () => {
  const closes = Array.from({ length: 70 }, (_, index) => 100 + index);
  const result = periodReturns(barsFrom("2026-06-01", closes));
  const last = closes.at(-1)!;
  const expect = (sessions: number) => ((last - closes[closes.length - 1 - sessions]) / closes[closes.length - 1 - sessions]) * 100;
  assert.equal(result.w1, expect(PERIOD_SESSIONS.w1));
  assert.equal(result.m1, expect(PERIOD_SESSIONS.m1));
  assert.equal(result.m3, expect(PERIOD_SESSIONS.m3));
});

test("yeterli bar yoksa dönem null, eldeki en eski bar kullanılmaz", () => {
  const result = periodReturns(barsFrom("2026-09-01", Array.from({ length: 30 }, () => 50)));
  assert.equal(result.m3, null);
  assert.notEqual(result.m1, null);
});

test("YBB tabanı önceki yılın son kapanışı", () => {
  const bars = barsFrom("2025-12-29", [90, 95, 100, 104, 110]);
  // 29, 30, 31 Aralık 2025 → taban 31 Aralık (100); son kapanış 110.
  const result = periodReturns(bars);
  assert.equal(result.lastDate, "2026-01-02");
  assert.equal(result.ytd, 10);
});

test("önceki yıldan bar yoksa YBB null", () => {
  assert.equal(periodReturns(barsFrom("2026-01-02", [10, 11, 12])).ytd, null);
});

test("YBB çizgisi yüzdeyle aynı tabandan başlar; taban yoksa null", () => {
  const series = ytdSeries(barsFrom("2025-12-29", [90, 95, 100, 104, 110]))!;
  assert.equal(series.base, 100);
  assert.deepEqual(series.points.map((point) => point.value), [100, 104, 110]);
  assert.equal(ytdSeries(barsFrom("2026-01-02", [10, 11, 12])), null);
  assert.equal(ytdSeries([]), null);
});

test("boş seri", () => {
  assert.deepEqual(periodReturns([]), { w1: null, m1: null, m3: null, ytd: null, lastDate: null });
});

/* Mini çizginin seyreltmesi: uçlar ve tepe/dip kalır, noktalar özgün
   sırasını taşır, kova başına en çok iki nokta. */
function wave(n: number): { value: number }[] {
  // Gürültülü ama tekrarlanabilir seri: iki sinüs + sıraya bağlı kıpırtı.
  return Array.from({ length: n }, (_, i) => ({ value: 100 + 12 * Math.sin(i / 17) + 4 * Math.sin(i * 1.7) + ((i * 37) % 11) / 5 }));
}

test("seyreltme: kısa seri olduğu gibi döner", () => {
  const points = wave(30);
  const thin = thinSeries(points, 120);
  assert.equal(thin.points.length, 30);
  assert.deepEqual(thin.points.map((point) => point.index), [...Array(30).keys()]);
  assert.deepEqual(thin.domain, [0, 29]);
});

test("seyreltme: uçlar, tepe ve dip kalır; sıra artan; değerler özgün", () => {
  const points = wave(220);
  points[137] = { value: 500 }; // tepe
  points[61] = { value: -50 }; // dip
  const thin = thinSeries(points, 120);
  const idx = thin.points.map((point) => point.index);
  assert.equal(idx[0], 0);
  assert.equal(idx.at(-1), 219);
  assert.ok(idx.includes(137) && idx.includes(61));
  assert.ok(idx.every((value, at) => at === 0 || value > idx[at - 1]));
  assert.ok(thin.points.every((point) => point.value === points[point.index].value));
  assert.ok(thin.points.length <= 60 * 2 + 2, `nokta ${thin.points.length}`);
  assert.ok(thin.points.length < 220);
  assert.deepEqual(thin.domain, [0, 219]);
});

test("seyreltme: uçtaki tepe/dip de kalır, dar çizimde daha az nokta", () => {
  const points = wave(220);
  points[0] = { value: 999 };
  points[219] = { value: -999 };
  const narrow = thinSeries(points, 40);
  assert.equal(narrow.points[0].value, 999);
  assert.equal(narrow.points.at(-1)!.value, -999);
  assert.ok(narrow.points.length <= 20 * 2 + 2);
  assert.ok(narrow.points.length < thinSeries(points, 120).points.length);
});
