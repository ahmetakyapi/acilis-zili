import test from "node:test";
import assert from "node:assert/strict";
import { safeRedirectTarget } from "../lib/safe-redirect";

/** Giriş sonrası `devam` doğrulaması (lib/safe-redirect.ts) — açık yönlendirme. */

test("site içi göreli yol sorgu ve çapasıyla korunur", () => {
  assert.equal(safeRedirectTarget("/portfoy?ekle=NVDA"), "/portfoy?ekle=NVDA");
  assert.equal(safeRedirectTarget("/en/hisse/NVDA#x"), "/en/hisse/NVDA#x");
  assert.equal(safeRedirectTarget("/a//b"), "/a//b");
  assert.equal(safeRedirectTarget("  /favoriler  "), "/favoriler");
});

test("boş, mutlak ya da dize olmayan değer köke düşer", () => {
  assert.equal(safeRedirectTarget(null), "/");
  assert.equal(safeRedirectTarget(""), "/");
  assert.equal(safeRedirectTarget("https://evil.com"), "/");
  assert.equal(safeRedirectTarget("evil.com"), "/");
  assert.equal(safeRedirectTarget("javascript:alert(1)"), "/");
});

test("protokole göreli ön ekler köke düşer", () => {
  for (const payload of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "\\\\evil.com"]) {
    assert.equal(safeRedirectTarget(payload), "/", JSON.stringify(payload));
  }
});

test("nokta parçalı yük origin'i korusa da köke düşer (20 Ekim)", () => {
  for (const payload of [
    "/.//evil.com",
    "/./\\evil.com",
    "/%2e//evil.com",
    "/..//evil.com",
    "/a/..//evil.com",
    "/%2E%2E//evil.com",
  ]) {
    assert.equal(safeRedirectTarget(payload), "/", JSON.stringify(payload));
  }
});
