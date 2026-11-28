import assert from "node:assert/strict";
import test from "node:test";
import { heavyKind } from "../lib/bot-guard";

/* Ağır sayfa sınıflaması (lib/bot-guard.ts). */

test("ağır sayfalar: sorgulu karşılaştırma dizini, giriş ve kayıt", () => {
  assert.equal(heavyKind("/karsilastir"), "compare");
  assert.equal(heavyKind("/karsilastir/"), "compare");
  assert.equal(heavyKind("/giris"), "auth");
  assert.equal(heavyKind("/kayit"), "auth");
});

test("küratörlü çift, hisse ve ana sayfa hafif", () => {
  assert.equal(heavyKind("/karsilastir/nvda-amd"), null);
  assert.equal(heavyKind("/hisse/NVDA"), null);
  assert.equal(heavyKind("/"), null);
  assert.equal(heavyKind("/girisim"), null);
});
