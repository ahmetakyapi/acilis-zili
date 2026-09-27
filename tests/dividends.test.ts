import test from "node:test";
import assert from "node:assert/strict";

import { annualYieldPct, inferFrequency, lastBuyDay, regularHistory } from "../lib/dividends";
import type { CashDividend } from "../lib/providers/alpaca-corporate";

/**
 * Temettü kuralları: sıklık yalnızca kanıtlanabiliyorsa, getiri yalnızca
 * sıklık varsa; son alım günü hak kesimden önceki İŞLEM günü.
 */

function dividend(exDate: string, rate = 0.25, extra: Partial<CashDividend> = {}): CashDividend {
  return { symbol: "TEST", exDate, recordDate: exDate, payableDate: null, rate, special: false, foreign: false, ...extra };
}

test("çeyreklik ödeyen (Apple 2025-2026 hak kesimleri)", () => {
  const history = ["2025-08-11", "2025-11-10", "2026-02-09", "2026-05-11", "2026-08-10"].map((d) => dividend(d));
  assert.equal(inferFrequency(history), 4);
});

test("aylık ve yıllık ödeyen", () => {
  assert.equal(inferFrequency(["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"].map((d) => dividend(d))), 12);
  assert.equal(inferFrequency(["2024-05-10", "2025-05-12"].map((d) => dividend(d))), 1);
});

test("tek ödeme ya da düzensiz aralık: sıklık yok", () => {
  assert.equal(inferFrequency([dividend("2026-03-01")]), null);
  assert.equal(inferFrequency(["2026-01-05", "2026-02-05", "2026-06-05"].map((d) => dividend(d))), null);
  // Çeyreklik görünen ama tek aralıklı geçmiş kanıt sayılmaz.
  assert.equal(inferFrequency(["2026-03-01", "2026-06-01"].map((d) => dividend(d))), null);
});

test("özel temettü sıklık hesabından çıkar", () => {
  const history = regularHistory([
    ...["2025-11-10", "2026-02-09", "2026-05-11", "2026-08-10"].map((d) => dividend(d)),
    dividend("2026-06-15", 5, { special: true }),
  ]);
  assert.equal(history.length, 4);
  assert.equal(inferFrequency(history), 4);
});

test("yıllık getiri: tutar × sıklık ÷ fiyat; eksikte yok", () => {
  assert.equal(annualYieldPct(dividend("2026-10-01", 0.5), 4, 100), 2);
  assert.equal(annualYieldPct(dividend("2026-10-01", 0.5), null, 100), null);
  assert.equal(annualYieldPct(dividend("2026-10-01", 0.5, { special: true }), 4, 100), null);
  assert.equal(annualYieldPct(dividend("2026-10-01", 0.5, { foreign: true }), 4, 100), null);
  assert.equal(annualYieldPct(dividend("2026-10-01", 0.5), 4, null), null);
});

test("son alım günü: hafta sonu ve tatil atlanır", () => {
  const holidays = [{ date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null }];
  // Pazartesi hak kesim → cuma.
  assert.equal(lastBuyDay("2026-10-05", holidays), "2026-10-02");
  // Cuma hak kesim, perşembe tatil → çarşamba.
  assert.equal(lastBuyDay("2026-11-27", holidays), "2026-11-25");
  // Tatil takvimi yoksa tarih uydurulmaz.
  assert.equal(lastBuyDay("2026-10-05", null), null);
});
