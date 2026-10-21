import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_COMPONENTS,
  MIN_HISTORY,
  breadthCounts,
  breadthReading,
  deviationFromAverage,
  fearLevelReading,
  momentumReading,
  movingAverage,
  overallScore,
  percentileRank,
  safeHavenReading,
  scoreLatest,
  sentimentBand,
  type DatedValue,
  type SentimentReading,
} from "../lib/sentiment";
import { getMarketStatus } from "../lib/market-hours";

/**
 * Piyasa Nabzı'nın kuralları — ekranda "nasıl hesaplandı" diye yazdığımız
 * cümlenin kendisi. Değişmezler:
 *  - yüzdelik sıra orta sıra yöntemiyle (yatay seri 50, uç değil);
 *  - korku yönlü ölçüde yükselen okuma DÜŞÜK puan;
 *  - yetersiz geçmişte bileşen yok, genel puan en az üç bileşenle;
 *  - güvenli liman iki seriyi TARİHE göre eşliyor.
 */

function series(values: number[], start = "2026-01-01"): DatedValue[] {
  const base = Date.parse(`${start}T00:00:00Z`);
  return values.map((value, index) => ({
    date: new Date(base + index * 86_400_000).toISOString().slice(0, 10),
    value,
  }));
}

test("yüzdelik sıra: eşitler yarım sayılır", () => {
  assert.equal(percentileRank([1, 1, 1, 1], 1), 50);
  assert.equal(percentileRank([1, 2, 3, 4], 4), 87.5);
  assert.equal(percentileRank([1, 2, 3, 4], 0), 0);
  assert.equal(percentileRank([], 5), 50);
});

test("kayan ortalama pencere dolmadan null", () => {
  assert.deepEqual(movingAverage([2, 4, 6, 8], 2), [null, 3, 5, 7]);
});

test("ortalamadan sapma yalnızca pencere dolan günlerde", () => {
  const out = deviationFromAverage(series([10, 10, 20]), 2);
  assert.equal(out.length, 2);
  assert.equal(out[1].value, 20 / 15 - 1);
});

test("kısa geçmişte puan yok", () => {
  assert.equal(scoreLatest(series(Array.from({ length: MIN_HISTORY - 1 }, (_, i) => i)), false), null);
});

test("korku yönlü ölçü: ortalamanın çok üstündeki VIX düşük puan", () => {
  const calm = Array.from({ length: 200 }, (_, i) => 15 + (i % 3) * 0.1);
  const spiking = fearLevelReading("vix", series([...calm, 30]));
  assert.ok(spiking);
  assert.ok(spiking.score < 5, `puan ${spiking.score}`);
  assert.equal(spiking.value, 30);
  const easing = fearLevelReading("vix", series([...calm, 11]));
  assert.ok(easing && easing.score > 95);
});

test("momentum: ortalamanın üstündeki kapanış yüksek puan", () => {
  const flat = Array.from({ length: 250 }, (_, i) => 100 + (i % 5) * 0.1);
  const reading = momentumReading(series([...flat, 120]));
  assert.ok(reading && reading.score > 95);
});

test("güvenli liman seriyi tarihe göre eşler", () => {
  const days = 120;
  const stocks = series(Array.from({ length: days }, (_, i) => 100 + i));
  const bondsAll = series(Array.from({ length: days }, () => 100));
  // Tahvilden bir gün eksik: sıraya göre eşlense getiriler kayardı.
  const bonds = bondsAll.filter((_, index) => index !== 50);
  const reading = safeHavenReading(stocks, bonds);
  assert.ok(reading);
  assert.equal(reading.reference, 0);
  const last = stocks.at(-1)!.value;
  const base = stocks[days - 1 - 20].value;
  assert.equal(reading.value, (last / base - 1) * 100);
});

test("genişlik: kapsam yetersizse bileşen yok", () => {
  assert.equal(breadthReading(100, 200, 500, "2026-09-25"), null);
  const reading = breadthReading(300, 480, 500, "2026-09-25");
  assert.ok(reading);
  assert.equal(reading.score, 62.5);
});

test("genel puan en az üç bileşenle, düz ortalama", () => {
  const make = (score: number): SentimentReading => ({ key: "vix", score, value: 0, reference: null, date: "2026-09-25" });
  assert.equal(overallScore([make(10), make(20)].slice(0, MIN_COMPONENTS - 1)), null);
  assert.equal(overallScore([make(10), make(20), make(60)]), 30);
});

test("bantlar", () => {
  assert.equal(sentimentBand(0).key, "extremeFear");
  assert.equal(sentimentBand(25).key, "fear");
  assert.equal(sentimentBand(50).key, "neutral");
  assert.equal(sentimentBand(55).key, "greed");
  assert.equal(sentimentBand(100).key, "extremeGreed");
});

test("genişlik açılış öncesinde dünün yüzdesini bugünün okumasına katmaz", () => {
  // Salı 05:00 ET (12:00 TR): ön seans, anlatılan seans bugün.
  const status = getMarketStatus(new Date("2026-10-20T09:00:00Z"));
  assert.equal(status.session, "pre-market");
  assert.equal(status.sessionDate, "2026-10-20");
  const yesterday = new Date("2026-10-19T19:59:00Z");
  const thisMorning = new Date("2026-10-20T08:55:00Z");
  const symbols = Array.from({ length: 10 }, (_, i) => `S${i}`);
  // Dokuzu dün düştü ve bugün henüz işlem görmedi; biri bu sabah yükseldi.
  const quotes = Object.fromEntries(symbols.map((symbol, i) => [symbol, i === 0
    ? { changePct: 1.2, tradedAt: thisMorning }
    : { changePct: -2, tradedAt: yesterday }]));
  assert.deepEqual(breadthCounts(symbols, quotes, status), { advancing: 1, known: 1 });
  // Kapsam eşiğin altında: bileşen düşer, dünün %10'u bugünün tarihiyle basılmaz.
  assert.equal(breadthReading(1, 1, symbols.length, status.sessionDate), null);
});

test("genişlik seans içinde bilinmeyen değişimi saymaz, işlem anı olmayanı da", () => {
  const status = getMarketStatus(new Date("2026-10-20T15:00:00Z"));
  assert.equal(status.session, "regular");
  const now = new Date("2026-10-20T14:58:00Z");
  const quotes = {
    A: { changePct: 0.5, tradedAt: now },
    B: { changePct: -0.5, tradedAt: now },
    C: { changePct: null, tradedAt: now },
    D: { changePct: 1, tradedAt: null },
  };
  assert.deepEqual(breadthCounts(["A", "B", "C", "D", "E"], quotes, status), { advancing: 1, known: 2 });
});
