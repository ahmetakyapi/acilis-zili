import test from "node:test";
import assert from "node:assert/strict";

import {
  dividendResult,
  indexMonthsFor,
  lotResult,
  matchFifo,
  progressiveTax,
  TAX_YEARS,
  toCsv,
  type TradeInput,
} from "../lib/tax";

/**
 * Vergi hesaplayıcısının saf katmanı. Tarife ve endeks örnekleri GİB
 * rehberlerinden (kaynaklar lib/tax.ts başında).
 */

const trade = (partial: Partial<TradeInput> & Pick<TradeInput, "id" | "side" | "date" | "quantity" | "priceUsd">): TradeInput => ({
  symbol: "NVDA",
  commissionUsd: 0,
  ...partial,
});

test("ilk giren ilk çıkar: satış en eski alıştan başlar ve parçayı böler", () => {
  const { lots, shortfalls } = matchFifo([
    trade({ id: "b2", side: "buy", date: "2024-06-01", quantity: 10, priceUsd: 120 }),
    trade({ id: "b1", side: "buy", date: "2024-01-10", quantity: 5, priceUsd: 50, commissionUsd: 5 }),
    trade({ id: "s1", side: "sell", date: "2025-03-01", quantity: 8, priceUsd: 150, commissionUsd: 8 }),
  ]);
  assert.equal(shortfalls.length, 0);
  assert.equal(lots.length, 2);
  assert.equal(lots[0].buyId, "b1");
  assert.equal(lots[0].quantity, 5);
  /* Alış komisyonunun tamamı (5 adetin 5'i), satış komisyonunun 5/8'i. */
  assert.equal(lots[0].costUsd, 5 * 50 + 5);
  assert.equal(lots[0].proceedsUsd, 5 * 150 - 5);
  assert.equal(lots[1].buyId, "b2");
  assert.equal(lots[1].quantity, 3);
});

test("eldekinden fazla satış uydurma maliyetle değil eksik olarak döner", () => {
  const { lots, shortfalls } = matchFifo([
    trade({ id: "b1", side: "buy", date: "2024-01-10", quantity: 2, priceUsd: 50 }),
    trade({ id: "s1", side: "sell", date: "2025-03-01", quantity: 5, priceUsd: 60 }),
  ]);
  assert.equal(lots.length, 1);
  assert.deepEqual(shortfalls, [{ sellId: "s1", symbol: "NVDA", date: "2025-03-01", quantity: 3 }]);
});

test("aynı gün alış satıştan önce işlenir", () => {
  const { lots } = matchFifo([
    trade({ id: "s1", side: "sell", date: "2025-03-01", quantity: 1, priceUsd: 60 }),
    trade({ id: "b1", side: "buy", date: "2025-03-01", quantity: 1, priceUsd: 50 }),
  ]);
  assert.equal(lots.length, 1);
  assert.equal(lots[0].buyId, "b1");
});

test("endeks ayları: alıştan ve satıştan ÖNCEKİ ay (GİB Örnek 13)", () => {
  assert.deepEqual(indexMonthsFor("2021-11-15", "2024-09-23"), { buy: "2021-10", sell: "2024-08" });
  assert.deepEqual(indexMonthsFor("2025-01-05", "2025-06-01"), { buy: "2024-12", sell: "2025-05" });
});

const LOT = {
  sellId: "s",
  buyId: "b",
  symbol: "NVDA",
  buyDate: "2021-11-15",
  sellDate: "2024-09-23",
  quantity: 10,
  costUsd: 1000,
  proceedsUsd: 1500,
};

test("Yİ-ÜFE artışı %10'u geçince kazançlı satışta maliyet endekslenir", () => {
  /* GİB örneğinin endeksleri: Ekim 2021 780,45 → Ağustos 2024 3.610,51 */
  const result = lotResult(LOT, 10, 34, 780.45, 3610.51);
  assert.equal(result.costTl, 10_000);
  assert.equal(result.proceedsTl, 51_000);
  assert.equal(result.indexed, true);
  /* 10.000 × 4,626 = 46.262 → kazanç ~4.738 */
  assert.ok(Math.abs(result.taxCostTl! - 10_000 * (3610.51 / 780.45)) < 1e-6);
  assert.ok(result.gainTl! > 0);
});

test("endeksleme %10'un altında uygulanmaz, zarardaki satışta uygulanmaz, kazancı sıfırın altına itmez", () => {
  assert.equal(lotResult(LOT, 10, 34, 100, 109).indexed, false);
  const zarar = lotResult({ ...LOT, proceedsUsd: 200 }, 10, 34, 100, 200);
  assert.equal(zarar.indexed, false);
  assert.ok(zarar.gainTl! < 0);
  const sinir = lotResult({ ...LOT, proceedsUsd: 400 }, 10, 34, 100, 500);
  assert.equal(sinir.indexed, true);
  assert.equal(sinir.gainTl, 0);
});

test("kur yoksa TL sonucu boş kalır, sıfır yazılmaz", () => {
  const result = lotResult(LOT, null, 34, null, null);
  assert.equal(result.costTl, null);
  assert.equal(result.gainTl, null);
});

test("tarife dilimleri rehberdeki birikimli tutarları verir", () => {
  const y2025 = TAX_YEARS[2025].brackets;
  assert.equal(progressiveTax(158_000, y2025), 23_700);
  assert.equal(progressiveTax(330_000, y2025), 58_100);
  assert.equal(progressiveTax(800_000, y2025), 185_000);
  assert.equal(progressiveTax(4_300_000, y2025), 1_410_000);
  const y2026 = TAX_YEARS[2026].brackets;
  assert.equal(progressiveTax(190_000, y2026), 28_500);
  assert.equal(progressiveTax(400_000, y2026), 70_500);
  assert.equal(progressiveTax(1_000_000, y2026), 232_500);
  assert.equal(progressiveTax(5_300_000, y2026), 1_737_500);
  assert.equal(progressiveTax(-5, y2026), 0);
});

test("temettü brüt TL ve stopaj", () => {
  const result = dividendResult(
    { id: "d", symbol: "KO", date: "2026-04-01", grossUsd: 100, withholdingPct: 20 },
    40,
  );
  assert.equal(result.grossTl, 4000);
  assert.equal(result.withheldTl, 800);
});

test("CSV Türkçede noktalı virgül ve virgüllü ondalık, BOM ile", () => {
  const csv = toCsv([["Sembol", "Kazanç"], ["NVDA", 1234.5]], "tr");
  assert.equal(csv, "﻿Sembol;Kazanç\r\nNVDA;1234,5");
  assert.equal(toCsv([["a,b", 1.25]], "en"), '\uFEFF"a,b",1.25');
});
