import test from "node:test";
import assert from "node:assert/strict";
import { parseDecimalInput } from "../lib/utils";

/* Alarm formlarındaki sayı okuma (lib/utils.ts → parseDecimalInput). */

test("TR: binlik nokta, ondalık virgül", () => {
  assert.equal(parseDecimalInput("1.500", "tr"), 1500);
  assert.equal(parseDecimalInput("1.477,21", "tr"), 1477.21);
  assert.equal(parseDecimalInput("12.345.678", "tr"), 12345678);
  assert.equal(parseDecimalInput("245,50", "tr"), 245.5);
  assert.equal(parseDecimalInput("$ 1.500", "tr"), 1500);
});

test("EN: binlik virgül, ondalık nokta", () => {
  assert.equal(parseDecimalInput("5,100", "en"), 5100);
  assert.equal(parseDecimalInput("5,100.75", "en"), 5100.75);
  assert.equal(parseDecimalInput("245.50", "en"), 245.5);
  assert.equal(parseDecimalInput("1.500", "en"), 1.5, "EN'de nokta ondalık");
});

test("tek ayırıcı ve 1–2 hane iki dilde de ondalık (eski davranış)", () => {
  for (const locale of ["tr", "en"] as const) {
    assert.equal(parseDecimalInput("245.50", locale), 245.5);
    assert.equal(parseDecimalInput("2,25", locale), 2.25);
    assert.equal(parseDecimalInput("5", locale), 5);
    assert.equal(parseDecimalInput("%5,5", locale), 5.5);
  }
});

test("karışık ya da bozuk biçim reddedilir", () => {
  for (const raw of ["", "abc", "1.500.5", "1,500,5", "1.5.0", "-5", "1e3", "1,5.0"]) {
    assert.equal(parseDecimalInput(raw, "tr"), null, `tr: ${raw}`);
  }
  assert.equal(parseDecimalInput("1.500,25", "en"), null, "EN'de TR biçimi belirsiz — reddedilir");
});
