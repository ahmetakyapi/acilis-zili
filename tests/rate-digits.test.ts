import test from "node:test";
import assert from "node:assert/strict";
import { rateDigits } from "../components/stock/rate-digits";

test("yuvarlak küçük tutar iki haneyle yazılır", () => {
  assert.equal(rateDigits(0.01), 2);
  assert.equal(rateDigits(0.04), 2);
  assert.equal(rateDigits(0.07), 2);
});

test("hassasiyet taşıyan küçük tutar hanesini korur", () => {
  assert.equal(rateDigits(0.0325), 4);
  assert.equal(rateDigits(0.015), 3);
  assert.equal(rateDigits(0.00005), 4);
});

test("eşiğin üstü her zaman iki hane", () => {
  assert.equal(rateDigits(0.1), 2);
  assert.equal(rateDigits(0.25), 2);
  assert.equal(rateDigits(0.5125), 2);
});

test("kayan nokta toplamı fazladan hane açmaz", () => {
  // Dört çeyrek × 0,01: 0.04 tam temsil edilmiyor.
  assert.equal(rateDigits(0.01 + 0.01 + 0.01 + 0.01), 2);
  assert.equal(rateDigits(0.0175 * 4), 2);
});
