import test from "node:test";
import assert from "node:assert/strict";

import {
  INDEX_PAGES,
  indexPageBySlug,
  indexPageCopy,
  indexPagePath,
  indexSummary,
  legacyIndexTarget,
} from "../lib/index-pages";
import { BRAND_SUFFIX, TITLE_LIMIT } from "../lib/seo-titles";
import { INDEX_TABS } from "../components/markets/index-shared";

/**
 * Endeks bileşen sayfaları (14 Kasım, SEO ikinci tur) — gerekçe
 * `lib/index-pages.ts`. Ölçülenler: adres eşlemesi, eski `?endeks=`
 * adresinin 308 hedefi, başlık/açıklama uzunlukları ve özet cümlesinin
 * veri dürüstlüğü (sayı yalnız seansı kanıtlıysa).
 */

test("liste sekmelerle aynı anahtar ve sırada", () => {
  assert.deepEqual(INDEX_PAGES.map((page) => page.key), INDEX_TABS.map((tab) => tab.key));
  assert.deepEqual(INDEX_PAGES.map((page) => page.name), INDEX_TABS.map((tab) => tab.label));
});

test("adresler: üç yol, olmayan ad bulunmaz", () => {
  assert.equal(indexPagePath("sp500"), "/piyasalar/sp-500");
  assert.equal(indexPagePath("nasdaq"), "/piyasalar/nasdaq-100");
  assert.equal(indexPagePath("dow"), "/piyasalar/dow-jones");
  assert.equal(indexPageBySlug("sp-500")?.key, "sp500");
  for (const slug of ["sp500", "russell-2000", "SP-500", "", "sp-500/x"]) {
    assert.equal(indexPageBySlug(slug), null, slug);
  }
});

test("eski ?endeks= adresi yeni yola iner; öteki parametreler korunur, endeks düşer", () => {
  assert.equal(legacyIndexTarget({ endeks: "sp500" }), "/piyasalar/sp-500");
  assert.equal(legacyIndexTarget({ endeks: "nasdaq" }), "/piyasalar/nasdaq-100");
  assert.equal(
    legacyIndexTarget({ endeks: "dow", sirala: "cap", yon: "asc", adet: "120" }),
    "/piyasalar/dow-jones?sirala=cap&yon=asc&adet=120",
  );
  // Tekrarlanan anahtar (dizi) ve boş değer taşınmaz.
  assert.equal(legacyIndexTarget({ endeks: "dow", sirala: ["a", "b"], yon: "" }), "/piyasalar/dow-jones");
});

test("endeks parametresi yoksa ya da tanınmıyorsa yönlendirme yok (döngü de yok)", () => {
  assert.equal(legacyIndexTarget({}), null);
  assert.equal(legacyIndexTarget({ sirala: "cap" }), null);
  assert.equal(legacyIndexTarget({ endeks: "russell" }), null);
  assert.equal(legacyIndexTarget({ endeks: ["sp500", "dow"] }), null);
  // Hedef adresin kendi sorgusu yeniden yönlendirme üretmez.
  assert.equal(legacyIndexTarget({ sirala: "cap", yon: "asc" }), null);
});

test("başlık + marka eki ≤ 65, açıklama 110–160, iki dilde", () => {
  for (const page of INDEX_PAGES) {
    for (const locale of ["tr", "en"] as const) {
      const copy = indexPageCopy(page, locale);
      const full = copy.title + BRAND_SUFFIX[locale];
      assert.ok(full.length <= TITLE_LIMIT, `${full} (${full.length})`);
      assert.ok(
        copy.description.length >= 110 && copy.description.length <= 160,
        `${locale} ${page.slug} açıklama ${copy.description.length}`,
      );
      assert.ok(copy.title.startsWith(page.name));
      assert.ok(copy.heading.startsWith(page.name));
    }
  }
  assert.equal(indexPageCopy(INDEX_PAGES[1], "tr").title, "S&P 500 Hisseleri: Bileşenler ve Günlük Değişim");
  assert.equal(indexPageCopy(INDEX_PAGES[1], "en").title, "S&P 500 Stocks: Constituents and Daily Change");
  assert.equal(indexPageCopy(INDEX_PAGES[1], "tr").heading, "S&P 500 Hisseleri");
});

test("açıklama tabloda olmayan bir sıralamayı vaat etmez", () => {
  for (const page of INDEX_PAGES) {
    assert.doesNotMatch(indexPageCopy(page, "tr").description, /sektöre göre/i);
    assert.doesNotMatch(indexPageCopy(page, "en").description, /by sector/i);
  }
});

test("özet: seans kanıtlıysa sayı, pencereye göre fiil", () => {
  const base = { name: "S&P 500", members: 499 } as const;
  assert.equal(
    indexSummary({ ...base, breadth: { counted: 499, advancing: 212, declining: 280, phase: "lastClose" }, locale: "tr" }),
    "S&P 500 endeksindeki 499 şirketin 212 tanesi son kapanışta yükseldi, 280 tanesi düştü.",
  );
  assert.equal(
    indexSummary({ ...base, breadth: { counted: 499, advancing: 212, declining: 280, phase: "day" }, locale: "tr" }),
    "S&P 500 endeksindeki 499 şirketin 212 tanesi bugünkü seansta artıda, 280 tanesi ekside.",
  );
  assert.match(
    indexSummary({ ...base, breadth: { counted: 499, advancing: 212, declining: 280, phase: "pre-market" }, locale: "tr" }),
    /açılış öncesi işlemlerde artıda/,
  );
  assert.equal(
    indexSummary({ ...base, breadth: { counted: 499, advancing: 212, declining: 280, phase: "lastClose" }, locale: "en" }),
    "212 of the 499 S&P 500 companies rose at the last close and 280 fell.",
  );
});

test("özet: payda eksikse cümle bunu söyler", () => {
  const text = indexSummary({
    name: "Dow Jones",
    members: 30,
    breadth: { counted: 28, advancing: 10, declining: 17, phase: "day" },
    locale: "tr",
  });
  assert.match(text, /değişimi bilinen 28 şirketin 10 tanesi/);
  assert.doesNotMatch(text, /30 şirketin/);
});

test("özet: veri yoksa ya da seans kanıtsızsa SAYI YOK", () => {
  for (const locale of ["tr", "en"] as const) {
    for (const breadth of [null, { counted: 0, advancing: 0, declining: 0, phase: "day" as const }]) {
      const text = indexSummary({ name: "Nasdaq 100", members: 101, breadth, locale });
      assert.match(text, /101/);
      assert.doesNotMatch(text, /yükseldi|düştü|artıda|ekside|rose|fell|are up|are down/);
    }
  }
});
