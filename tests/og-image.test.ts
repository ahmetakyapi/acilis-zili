import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

import { ogImageSuffix, ogImageUrl } from "../lib/og-image";
import { SITE_URL } from "../lib/site";

/**
 * Dosya tabanlı paylaşım görselinin adresi (14 Kasım) — gerekçe
 * `lib/og-image.ts`. Ek Next'in iç kuralından geliyor; burada Next'in KENDİ
 * fonksiyonuyla karşılaştırılıyor ki sürüm yükseltmesinde kural değişirse
 * makale JSON-LD'sine ölü görsel adresi çıkmadan test düşsün.
 */
const require = createRequire(import.meta.url);
const { fillMetadataSegment } = require("next/dist/lib/metadata/get-metadata-route") as {
  fillMetadataSegment: (segment: string, params: Record<string, string>, lastSegment: string, isStatic: boolean) => string;
};

/** JSON-LD'de görseli dosya tabanlı karttan gelen rotalar: klasör, örnek parametre, örnek yol. */
const ROUTES = [
  ["/(app)/mercek/[slug]", { slug: "faiz-karari" }, "/mercek/faiz-karari"],
  ["/(app)/rehber/[slug]", { slug: "endeks" }, "/rehber/endeks"],
  ["/(app)/bulten/[tarih]", { tarih: "2026-11-13" }, "/bulten/2026-11-13"],
  ["/(app)/bulten/haftalik/[tarih]", { tarih: "2026-11-09" }, "/bulten/haftalik/2026-11-09"],
  ["/(app)/teknik-analiz/[symbol]", { symbol: "nvda" }, "/teknik-analiz/nvda"],
  ["/(app)/bilancolar/[symbol]/[period]", { symbol: "nvda", period: "3c-fy2027" }, "/bilancolar/nvda/3c-fy2027"],
] as const;

test("adres Next'in ürettiğiyle aynı (rota grubu eki dahil)", () => {
  for (const [dir, params, path] of ROUTES) {
    const expected = fillMetadataSegment(dir, { ...params }, "opengraph-image", false);
    assert.equal(ogImageUrl(dir, path), `${SITE_URL}${expected}`, dir);
  }
});

test("her rotanın opengraph-image dosyası gerçekten var", () => {
  for (const [dir] of ROUTES) {
    assert.ok(existsSync(`app${dir}/opengraph-image.tsx`), dir);
  }
});

test("ek yalnız rota grubu ya da paralel rota varsa, altı karakter", () => {
  assert.equal(ogImageSuffix("/mercek/[slug]"), "");
  assert.match(ogImageSuffix("/(app)/mercek/[slug]"), /^[0-9a-z]{1,6}$/);
  assert.notEqual(ogImageSuffix("/(app)/mercek/[slug]"), ogImageSuffix("/(app)/rehber/[slug]"));
  assert.equal(ogImageUrl("/mercek/[slug]", "/mercek/x"), `${SITE_URL}/mercek/x/opengraph-image`);
});
