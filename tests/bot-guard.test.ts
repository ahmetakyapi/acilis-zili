import assert from "node:assert/strict";
import test from "node:test";
import { heavyKind, isDocumentRequest } from "../lib/bot-guard";

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

test("yalnız tam sayfa yüklemesi sayılır: önceden yükleme ve RSC gezinmesi muaf", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(isDocumentRequest(h({})), true);
  assert.equal(isDocumentRequest(h({ "sec-fetch-dest": "document" })), true);
  assert.equal(isDocumentRequest(h({ rsc: "1" })), false);
  assert.equal(isDocumentRequest(h({ "next-router-prefetch": "1" })), false);
  assert.equal(isDocumentRequest(h({ "sec-purpose": "prefetch" })), false);
  assert.equal(isDocumentRequest(h({ purpose: "prefetch" })), false);
  assert.equal(isDocumentRequest(h({ "sec-fetch-dest": "empty" })), false);
});
