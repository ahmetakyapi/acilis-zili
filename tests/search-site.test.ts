import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { SITE_PAGES, siteEntries, siteIndex } from "../lib/search-site";
import { searchSite } from "../lib/search-catalog";
import { searchPaletteEn, searchPaletteTr } from "../lib/i18n/dictionaries/search-palette";
import { GLOSSARY_SLUGS } from "../content/glossary";
import { THEME_SLUGS } from "../content/themes";
import { INVESTOR_SLUGS } from "../lib/investors";

/**
 * ⌘K kataloğu gerçek içerikle (14 Kasım) — gerekçe `lib/search-site.ts`.
 * Katalog elle tutulan bir liste değil; bu sınamalar kaynaklarla bağını
 * tutuyor: her sayfa var olan bir rotaya gidiyor, her sayfanın iki dilde
 * eşanlamlısı var, görev tanımındaki örnek aramalar doğru kaydı buluyor.
 */

const ROOT = join(import.meta.dirname, "..");
const first = (locale: "tr" | "en", query: string) => {
  const hit = searchSite(siteIndex(locale), query).groups[0]?.hits[0];
  return hit ? hit.href : null;
};

test("her sayfa var olan bir rotaya gidiyor", () => {
  for (const page of SITE_PAGES) {
    const dir = page.href === "/" ? "app/(app)" : `app/(app)${page.href}`;
    assert.ok(existsSync(join(ROOT, dir, "page.tsx")), `${page.href}: ${dir}/page.tsx yok`);
  }
  assert.equal(new Set(SITE_PAGES.map((page) => page.href)).size, SITE_PAGES.length, "yinelenen sayfa");
});

test("her sayfanın iki dilde eşanlamlısı var, fazladan anahtar yok", () => {
  const hrefs = SITE_PAGES.map((page) => page.href).sort();
  assert.deepEqual(Object.keys(searchPaletteTr.keywords).sort(), hrefs);
  assert.deepEqual(Object.keys(searchPaletteEn.keywords).sort(), hrefs);
  for (const list of [...Object.values(searchPaletteTr.keywords), ...Object.values(searchPaletteEn.keywords)]) {
    assert.ok(list.length > 0);
  }
});

test("her kaydın başlığı ve ikinci satırı var; iki dil aynı adresleri taşıyor", () => {
  const trEntries = siteEntries("tr");
  const enEntries = siteEntries("en");
  assert.deepEqual(trEntries.map((item) => item.href).sort(), enEntries.map((item) => item.href).sort());
  for (const item of [...trEntries, ...enEntries]) {
    assert.ok(item.title.trim(), `${item.href}: başlık boş`);
    assert.ok(item.detail.trim(), `${item.href}: ikinci satır boş`);
    assert.ok(item.detail.length <= 111, `${item.href}: ikinci satır ${item.detail.length} karakter`);
    assert.match(item.href, /^\/[a-z0-9/-]*$/, `${item.href}: dil öneksiz, küçük harfli yol`);
  }
});

test("katalog kaynakların tamamını taşıyor", () => {
  const hrefs = new Set(siteEntries("tr").map((item) => item.href));
  for (const slug of GLOSSARY_SLUGS) assert.ok(hrefs.has(`/sozluk/${slug}`), slug);
  for (const slug of THEME_SLUGS) assert.ok(hrefs.has(`/temalar/${slug}`), slug);
  for (const slug of INVESTOR_SLUGS) assert.ok(hrefs.has(`/yatirimcilar/${slug}`), slug);
});

test("kapılı ekran kapısıyla gelir", () => {
  const risk = siteEntries("tr").find((item) => item.href === "/risk-masasi");
  assert.equal(risk?.gate, "risk");
  assert.equal(siteEntries("tr").filter((item) => item.gate).length, 1);
});

test("Türkçe örnek aramalar", () => {
  assert.equal(first("tr", "sozluk"), "/sozluk");
  assert.equal(first("tr", "SÖZLÜK"), "/sozluk");
  assert.equal(first("tr", "takvim"), "/takvim");
  assert.equal(first("tr", "TAKVİM"), "/takvim");
  assert.equal(first("tr", "vergi"), "/vergi");
  assert.equal(first("tr", "karsilastir"), "/karsilastir");
  assert.equal(first("tr", "hisse tarayici"), "/tarama");
  assert.equal(first("tr", "makro"), "/makro");
  assert.equal(first("tr", "olasiliklar"), "/olasiliklar");
  assert.equal(first("tr", "bulmaca"), "/bulmaca");
  assert.equal(first("tr", "araci kurumlar"), "/araci-kurumlar");
  assert.equal(first("tr", "yenilikler"), "/yenilikler");
  assert.equal(first("tr", "isi haritasi"), "/piyasalar");
  assert.equal(first("tr", "ISI HARİTASI"), "/piyasalar");
  assert.equal(first("tr", "fk"), "/sozluk/fk");
  assert.equal(first("tr", "F/K"), "/sozluk/fk");
  assert.equal(first("tr", "yapay zeka"), "/temalar/yapay-zeka");
  assert.equal(first("tr", "buffett"), "/yatirimcilar/warren-buffett");
  assert.equal(first("tr", "BUFFETT"), "/yatirimcilar/warren-buffett");
  assert.equal(first("tr", "berkshire"), "/yatirimcilar/warren-buffett");
});

test("İngilizce örnek aramalar", () => {
  assert.equal(first("en", "glossary"), "/sozluk");
  assert.equal(first("en", "calendar"), "/takvim");
  assert.equal(first("en", "tax"), "/vergi");
  assert.equal(first("en", "screener"), "/tarama");
  assert.equal(first("en", "compare"), "/karsilastir");
  assert.equal(first("en", "brokers"), "/araci-kurumlar");
  assert.equal(first("en", "what's new"), "/yenilikler");
  assert.equal(first("en", "INDICES"), "/piyasalar");
  assert.equal(first("en", "artificial intelligence"), "/temalar/yapay-zeka");
  assert.equal(first("en", "buffett"), "/yatirimcilar/warren-buffett");
  /* Türkçe adıyla arayan İngilizce arayüz okuru. */
  assert.equal(first("en", "sozluk"), "/sozluk");
  assert.equal(first("en", "vergi"), "/vergi");
});

test("dizin dil başına bir kez kurulur", () => {
  assert.equal(siteIndex("tr"), siteIndex("tr"));
  assert.notEqual(siteIndex("tr"), siteIndex("en"));
});
