import test from "node:test";
import assert from "node:assert/strict";
import { getMarketStatus } from "../lib/market-hours";
import { ogCloseSeries, ogQuoteStamp, seriesChangePct } from "../lib/og-series";

/* Hisse paylaşım kartının verisi (lib/og-series.ts): çizginin ucu başlıktaki
   fiyat, künye işlemin seansı + gün + saat. */

const LABELS = {
  session: "Seans İçi",
  sessionClose: "Seans Kapanışı",
  preMarket: "Açılış Öncesi",
  afterHours: "Kapanış Sonrası",
  lastClose: "Son Kapanış",
  lastPrice: "Son Fiyat",
};
/* 2026-10-22 (perşembe) ve 2026-10-23 (cuma) 16:00 ET = 20:00 UTC. */
const bars = [
  { time: Date.UTC(2026, 9, 22, 20) / 1000, close: 100 },
  { time: Date.UTC(2026, 9, 23, 20) / 1000, close: 110 },
];

test("seri: aynı günün kotasyonu ucu değiştirir, yeni gün ekler, eskisi dokunmaz", () => {
  assert.deepEqual(ogCloseSeries(bars, { price: 111, tradedAt: new Date(Date.UTC(2026, 9, 23, 23, 59)) }), [100, 111]);
  assert.deepEqual(ogCloseSeries(bars, { price: 112, tradedAt: new Date(Date.UTC(2026, 9, 26, 13)) }), [100, 110, 112]);
  assert.deepEqual(ogCloseSeries(bars, { price: 99, tradedAt: new Date(Date.UTC(2026, 9, 22, 19)) }), [100, 110]);
  assert.deepEqual(ogCloseSeries(bars, { price: 99, tradedAt: null }), [100, 110]);
  assert.equal(seriesChangePct([100, 110]), 10);
  assert.equal(seriesChangePct([0, 1]), null);
});

test("künye: kapanış sonrası işlem, gün ve saat okuyucunun diliminde", () => {
  /* Cumartesi 24 Ekim, 12:00 TR: anlatılan seans cuma. */
  const status = getMarketStatus(new Date(Date.UTC(2026, 9, 24, 9)), []);
  assert.equal(status.sessionDate, "2026-10-23");
  /* Cuma 19:59 ET = cumartesi 02:59 TR — gün TR'de 24, NY'de 23. */
  const quote = { tradedAt: new Date(Date.UTC(2026, 9, 23, 23, 59)) };
  const tr = ogQuoteStamp(quote, false, status, "tr", LABELS);
  assert.equal(tr.text, "24 Eki · Kapanış Sonrası · 02:59 TR");
  assert.equal(tr.live, true);
  const en = ogQuoteStamp(quote, false, status, "en", LABELS);
  assert.equal(en.text, "Oct 23 · Kapanış Sonrası · 19:59 NY");
});

test("künye: seansa ait olmayan işlem Son Kapanış, eski paket Son Fiyat; ikisi de renksiz", () => {
  const status = getMarketStatus(new Date(Date.UTC(2026, 9, 24, 9)), []);
  const old = ogQuoteStamp({ tradedAt: new Date(Date.UTC(2026, 9, 22, 19, 59)) }, false, status, "tr", LABELS);
  assert.equal(old.basis, "lastClose");
  assert.equal(old.live, false);
  assert.match(old.text, /^22 Eki · Son Kapanış · /);
  const stale = ogQuoteStamp({ tradedAt: new Date(Date.UTC(2026, 9, 23, 19, 59)) }, true, status, "tr", LABELS);
  assert.equal(stale.basis, "lastPrice");
  assert.equal(stale.live, false);
  const none = ogQuoteStamp({ tradedAt: null }, false, status, "tr", LABELS);
  assert.equal(none.text, "Son Kapanış");
});
