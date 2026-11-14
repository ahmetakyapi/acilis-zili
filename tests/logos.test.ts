import test from "node:test";
import assert from "node:assert/strict";

import { LOCAL_LOGOS } from "../lib/logo-manifest";
import { listLogoSrc, logoSrc } from "../lib/logos";

/**
 * Logo adresi. Değişmezler: depodaki logo her zaman önce; liste yuvası
 * (`listLogoSrc`) manifest dışı sembolde uzak adrese HİÇ düşmez — 1000×1000
 * PNG'ler `/bilancolar`ın baytlarının %40'ıydı (gerekçe lib/logos.ts).
 */

const REMOTE = "https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/XXXX.png";

test("depodaki sembol: iki yol da yerel webp", () => {
  assert.ok(LOCAL_LOGOS.has("NVDA"));
  assert.equal(logoSrc("NVDA", REMOTE), "/logos/NVDA.webp");
  assert.equal(listLogoSrc("NVDA"), "/logos/NVDA.webp");
});

test("rezerve dosya adı eşlemesi liste yuvasında da geçerli", () => {
  assert.equal(listLogoSrc("CON"), "/logos/CON_.webp");
});

test("manifest dışı sembol: ayrıntı uzak logoya düşer, liste yuvası düşmez", () => {
  const symbol = "ZZZQ";
  assert.ok(!LOCAL_LOGOS.has(symbol));
  assert.equal(logoSrc(symbol, REMOTE), REMOTE);
  assert.equal(listLogoSrc(symbol), null);
});
