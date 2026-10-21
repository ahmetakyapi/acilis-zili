import test from "node:test";
import assert from "node:assert/strict";
import { getMarketStatus } from "../lib/market-hours";
import type { Bar, Quote } from "../lib/providers/types";
import { computeSnapshot, sessionQuote } from "../lib/technical";

/**
 * Teknik analiz fotoğrafında SEMBOL BAŞINA seans kapısı (20 Ekim).
 *
 * Ön seans yayını (12:45 UTC): paket güncel sayılıyor çünkü bazı semboller
 * işlem görmüş; henüz işlem görmemiş bir sembolün kotasyonu dünün yüzdesini,
 * iki seans önceki kapanışı ve dünün hacmini taşıyor. Bunlar fotoğrafa
 * girmemeli; fiyat kalıyor ve önceki kapanış dünkü bara düşüyor.
 */

// Salı 20 Ekim 2026, 12:45 UTC = 08:45 ET — ön seans.
const status = getMarketStatus(new Date("2026-10-20T12:45:00Z"));

const bar = (date: string, close: number): Bar => ({
  time: Math.floor(new Date(`${date}T20:00:00Z`).getTime() / 1000),
  open: close,
  high: close,
  low: close,
  close,
  volume: 1_000,
});

const bars: Bar[] = [bar("2026-10-15", 95), bar("2026-10-16", 100), bar("2026-10-19", 106)];

const quote = (tradedAt: string): Quote => ({
  symbol: "ONDS",
  price: 106.5,
  change: 6.5,
  changePct: 6.5,
  open: 100,
  high: 107,
  low: 99,
  prevClose: 100, // iki seans önceki kapanış
  volume: 5_000_000,
  tradedAt: new Date(tradedAt),
});

test("bu seansta işlem görmemiş sembol: fiyat kalır, yüzde/önceki kapanış/hacim girmez", () => {
  // Dünün akşam seansı işlemi (19 Ekim 19:50 ET).
  const own = sessionQuote(quote("2026-10-19T23:50:00Z"), status);
  assert.equal(own?.price, 106.5);
  assert.equal(own?.changePct, null);
  assert.equal(own?.change, null);
  assert.equal(own?.prevClose, null);
  assert.equal(own?.volume, null);

  const snap = computeSnapshot(bars, own, status, new Date("2026-10-20T12:45:00Z"));
  assert.equal(snap.price, 106.5);
  assert.equal(snap.changePct, null);
  // Önceki kapanış son tamamlanmış bar: dünkü kapanış.
  assert.equal(snap.prevClose, 106);
});

test("bu seansta işlem görmüş sembol olduğu gibi geçer", () => {
  // Bugünün ön seansı (20 Ekim 08:20 ET).
  const q = quote("2026-10-20T12:20:00Z");
  assert.equal(sessionQuote(q, status), q);
  assert.equal(sessionQuote(null, status), null);
});
