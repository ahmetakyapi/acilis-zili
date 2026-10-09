import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../lib/tax";
import { importCsv } from "../lib/tax-import";

/** Vergi hesaplayıcısının kendi dökümünü geri okuması (lib/tax-import/own.ts). */

const HEAD = ["Sembol", "Alış Tarihi", "Satış Tarihi", "Adet", "Alış Kuru", "Satış Kuru", "TL Maliyet", "Endeks", "Vergi Maliyeti", "Satış Bedeli", "Kazanç", "Maliyet (USD)", "Satış Tutarı (USD)"];
const lot = ["NVDA", "2026-01-12", "2026-08-03", 4, 43.0609, 47.4497, 17224.36, null, 17224.36, 34163.78, 16939.42, 400, 720];
const dividendRows = [[], ["Sembol", "Ödeme Tarihi", "Brüt (USD)", "Stopaj %", "Brüt TL", "Stopaj TL"], ["AAPL", "2026-05-14", 12.5, 20, 512.3, 102.46]];

for (const locale of ["tr", "en"] as const) {
  test(`kendi dökümü geri okunur (${locale})`, () => {
    const csv = toCsv([HEAD, lot, [], ["Satış Bedeli", 34163.78], ...dividendRows], locale);
    const result = importCsv(csv);
    assert.equal(result.broker, "acilis-zili");
    assert.equal(result.trades.length, 2);
    const [buy, sell] = result.trades;
    assert.deepEqual([buy.side, buy.symbol, buy.date, buy.quantity, buy.priceUsd], ["buy", "NVDA", "2026-01-12", 4, 100]);
    assert.deepEqual([sell.side, sell.date, sell.priceUsd], ["sell", "2026-08-03", 180]);
    assert.equal(result.dividends.length, 1);
    assert.equal(result.dividends[0].symbol, "AAPL");
    assert.equal(result.dividends[0].grossUsd, 12.5);
    assert.equal(result.dividends[0].withheldUsd, 2.5);
  });
}

test("eski döküm (dolar sütunu yok): dolar tutarı lira ÷ kurdan", () => {
  const old = toCsv([HEAD.slice(0, 11), lot.slice(0, 11)], "tr");
  const result = importCsv(old);
  assert.equal(result.broker, "acilis-zili");
  const [buy, sell] = result.trades;
  assert.ok(Math.abs(buy.priceUsd - 17224.36 / 43.0609 / 4) < 1e-9);
  assert.ok(Math.abs(sell.priceUsd - 34163.78 / 47.4497 / 4) < 1e-9);
});

test("kuru boş eski satır atlanır, uydurulmaz", () => {
  const old = toCsv([HEAD.slice(0, 11), ["NVDA", "2026-01-12", "2026-08-03", 4, null, null, null, null, null, null, null]], "tr");
  const result = importCsv(old);
  assert.equal(result.trades.length, 0);
  assert.equal(result.skipped.length, 1);
});
