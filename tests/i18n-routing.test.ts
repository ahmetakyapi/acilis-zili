import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_LOCALE, LOCALES } from "../lib/i18n/config";
import {
  LOCALE_HEADER,
  languageAlternates,
  localeFromHeader,
  splitLocale,
  stripLocale,
  withLocale,
} from "../lib/i18n/routing";

/**
 * Dilin adresteki yeri. Türkçe önekSİZ, İngilizce `/en/...`.
 *
 * Buradaki hata sessizdir: sayfa açılır ama öteki dilde. Yanlış ayrılan
 * önek `/english` gibi bir rotayı yutar; çift önek 404 üretir; eksik önek
 * İngilizce okuyucuyu bağlantıya bastığı anda Türkçeye düşürür.
 */

test("varsayım: varsayılan dil tr, önekli tek dil en", () => {
  assert.equal(DEFAULT_LOCALE, "tr");
  assert.deepEqual([...LOCALES], ["tr", "en"]);
});

/* ---- splitLocale ---- */

test("splitLocale: /en kök sayfadır", () => {
  assert.deepEqual(splitLocale("/en"), { locale: "en", path: "/" });
});

test("splitLocale: /en/ da kök sayfadır", () => {
  assert.deepEqual(splitLocale("/en/"), { locale: "en", path: "/" });
});

test("splitLocale: /en/piyasalar önek ve yol olarak ayrılır", () => {
  assert.deepEqual(splitLocale("/en/piyasalar"), { locale: "en", path: "/piyasalar" });
  assert.deepEqual(splitLocale("/en/hisse/NVDA"), { locale: "en", path: "/hisse/NVDA" });
});

test("splitLocale: /english önek DEĞİL", () => {
  assert.deepEqual(splitLocale("/english"), { locale: null, path: "/english" });
  assert.deepEqual(splitLocale("/english/kurs"), { locale: null, path: "/english/kurs" });
  assert.deepEqual(splitLocale("/enerji"), { locale: null, path: "/enerji" });
  assert.deepEqual(splitLocale("/en-US/piyasalar"), { locale: null, path: "/en-US/piyasalar" });
});

test("splitLocale: önek yoksa dil NULL — 'Türkçe' değil 'adres bir şey söylemiyor'", () => {
  assert.deepEqual(splitLocale("/"), { locale: null, path: "/" });
  assert.deepEqual(splitLocale("/piyasalar"), { locale: null, path: "/piyasalar" });
});

test("splitLocale: önek yalnız BAŞTA aranır", () => {
  assert.deepEqual(splitLocale("/hisse/en"), { locale: null, path: "/hisse/en" });
  assert.deepEqual(splitLocale("/rehber/en/giris"), { locale: null, path: "/rehber/en/giris" });
});

test("splitLocale: önek büyük/küçük harfe duyarlı", () => {
  assert.deepEqual(splitLocale("/EN/piyasalar"), { locale: null, path: "/EN/piyasalar" });
});

test("splitLocale: çift önekte yalnız İLKİ ayrılır", () => {
  assert.deepEqual(splitLocale("/en/en"), { locale: "en", path: "/en" });
  assert.deepEqual(splitLocale("/en/en/piyasalar"), { locale: "en", path: "/en/piyasalar" });
});

test("splitLocale: yolun sonundaki eğik çizgi ve iç bölümler korunur", () => {
  assert.deepEqual(splitLocale("/en/piyasalar/"), { locale: "en", path: "/piyasalar/" });
  assert.deepEqual(splitLocale("/en/bilancolar/NVDA/2026-Q3"), { locale: "en", path: "/bilancolar/NVDA/2026-Q3" });
});

/* ---- withLocale ---- */

test("withLocale: Türkçe öneksiz kalır", () => {
  assert.equal(withLocale("/", "tr"), "/");
  assert.equal(withLocale("/piyasalar", "tr"), "/piyasalar");
});

test("withLocale: İngilizce önek alır; kök /en olur, /en/ değil", () => {
  assert.equal(withLocale("/", "en"), "/en");
  assert.equal(withLocale("/piyasalar", "en"), "/en/piyasalar");
  assert.equal(withLocale("/hisse/NVDA", "en"), "/en/hisse/NVDA");
});

test("withLocale: önekli adres Türkçeye çevrilince önek düşer", () => {
  assert.equal(withLocale("/en", "tr"), "/");
  assert.equal(withLocale("/en/", "tr"), "/");
  assert.equal(withLocale("/en/piyasalar", "tr"), "/piyasalar");
});

test("withLocale: zaten önekli adrese ÇİFT ÖNEK eklenmez", () => {
  assert.equal(withLocale("/en", "en"), "/en");
  assert.equal(withLocale("/en/", "en"), "/en");
  assert.equal(withLocale("/en/piyasalar", "en"), "/en/piyasalar");
});

test("withLocale: art arda uygulamak sonucu değiştirmez", () => {
  for (const href of ["/", "/piyasalar", "/hisse/NVDA?sekme=teknik", "/rehber#faiz"]) {
    for (const locale of LOCALES) {
      const once = withLocale(href, locale);
      assert.equal(withLocale(once, locale), once, `${href} → ${locale}`);
    }
  }
});

test("withLocale: gidiş-dönüş başa döner", () => {
  for (const href of ["/", "/piyasalar", "/hisse/NVDA?sekme=teknik", "/rehber#faiz", "/english"]) {
    assert.equal(withLocale(withLocale(href, "en"), "tr"), href, href);
  }
});

test("withLocale: /english rotası önek sanılıp kırpılmaz", () => {
  assert.equal(withLocale("/english", "tr"), "/english");
  assert.equal(withLocale("/english", "en"), "/en/english");
});

test("withLocale: sorgu korunur", () => {
  assert.equal(withLocale("/giris?sifre=yenilendi", "en"), "/en/giris?sifre=yenilendi");
  assert.equal(withLocale("/giris?sifre=yenilendi", "tr"), "/giris?sifre=yenilendi");
  assert.equal(withLocale("/en/giris?sifre=yenilendi", "tr"), "/giris?sifre=yenilendi");
  assert.equal(withLocale("/en/giris?sifre=yenilendi", "en"), "/en/giris?sifre=yenilendi");
  assert.equal(
    withLocale("/claude/NVDA?odak=teknik&sekme=rapor&rapor=12&yeni=1", "en"),
    "/en/claude/NVDA?odak=teknik&sekme=rapor&rapor=12&yeni=1",
  );
});

test("withLocale: çapa korunur", () => {
  assert.equal(withLocale("/rehber#faiz", "en"), "/en/rehber#faiz");
  assert.equal(withLocale("/en/rehber#faiz", "tr"), "/rehber#faiz");
  assert.equal(withLocale("/rehber?bolum=2#faiz", "en"), "/en/rehber?bolum=2#faiz");
});

test("withLocale: sorgudaki /en/ değeri yola karışmaz", () => {
  assert.equal(withLocale("/giris?donus=/en/portfoy", "tr"), "/giris?donus=/en/portfoy");
  assert.equal(withLocale("/giris?donus=/en/portfoy", "en"), "/en/giris?donus=/en/portfoy");
});

test("withLocale: dış adres, çapa, mailto ve göreli yol olduğu gibi kalır", () => {
  for (const href of [
    "https://example.com/en/x",
    "http://example.com",
    "mailto:merhaba@example.com",
    "tel:+900000000000",
    "#faiz",
    "?sekme=teknik",
    "piyasalar",
    "",
  ]) {
    assert.equal(withLocale(href, "en"), href, href);
    assert.equal(withLocale(href, "tr"), href, href);
  }
});

/* ---- stripLocale ---- */

test("stripLocale: önek varsa düşer, yoksa adres aynen döner", () => {
  assert.equal(stripLocale("/en"), "/");
  assert.equal(stripLocale("/en/"), "/");
  assert.equal(stripLocale("/en/piyasalar"), "/piyasalar");
  assert.equal(stripLocale("/piyasalar"), "/piyasalar");
  assert.equal(stripLocale("/"), "/");
  assert.equal(stripLocale("/english"), "/english");
});

test("stripLocale: iki dildeki aynı sayfa aynı yola iner (aktif gezinme karşılaştırması)", () => {
  for (const path of ["/", "/piyasalar", "/hisse/NVDA"]) {
    assert.equal(stripLocale(withLocale(path, "en")), stripLocale(withLocale(path, "tr")), path);
  }
});

/* ---- languageAlternates ---- */

test("languageAlternates: varsayılan olarak iki dil de yazılır", () => {
  assert.deepEqual(languageAlternates("/piyasalar"), { tr: "/piyasalar", en: "/en/piyasalar" });
});

test("languageAlternates: kök sayfa", () => {
  assert.deepEqual(languageAlternates("/"), { tr: "/", en: "/en" });
});

test("languageAlternates: önekli girdi önce arındırılır, çift önek çıkmaz", () => {
  assert.deepEqual(languageAlternates("/en/piyasalar"), { tr: "/piyasalar", en: "/en/piyasalar" });
  assert.deepEqual(languageAlternates("/en"), { tr: "/", en: "/en" });
  assert.deepEqual(languageAlternates("/en/"), { tr: "/", en: "/en" });
});

test("languageAlternates: yalnız GERÇEKTEN var olan diller yazılır", () => {
  assert.deepEqual(languageAlternates("/mercek/faiz-karari", ["tr"]), { tr: "/mercek/faiz-karari" });
  assert.deepEqual(languageAlternates("/mercek/faiz-karari", ["en"]), { en: "/en/mercek/faiz-karari" });
  assert.deepEqual(languageAlternates("/en/mercek/faiz-karari", ["tr"]), { tr: "/mercek/faiz-karari" });
});

test("languageAlternates: boş dil listesi boş nesne", () => {
  assert.deepEqual(languageAlternates("/piyasalar", []), {});
});

test("languageAlternates: /english önek sanılmaz", () => {
  assert.deepEqual(languageAlternates("/english"), { tr: "/english", en: "/en/english" });
});

/* ---- localeFromHeader, LOCALE_HEADER ---- */

test("localeFromHeader: bilinen diller geçer", () => {
  assert.equal(localeFromHeader("en"), "en");
  assert.equal(localeFromHeader("tr"), "tr");
});

test("localeFromHeader: bilinmeyen, boş ya da biçimi bozuk değer NULL", () => {
  for (const value of [null, undefined, "", "de", "EN", "en-US", " en", "en,tr", "english"]) {
    assert.equal(localeFromHeader(value), null, String(value));
  }
});

test("LOCALE_HEADER: proxy ile getLocale'in ortak başlık adı", () => {
  assert.equal(LOCALE_HEADER, "x-az-locale");
});

/* 14 Kasım: QA turunun kırmızı gördüğü girdiler; düzeltmeyle birlikte kalıcı. */
test("kök adrese yapışan sorgu ve çapa öneki bozmaz", () => {
  assert.equal(withLocale("/?q=1", "en"), "/en?q=1");
  assert.equal(withLocale("/en?q=1", "tr"), "/?q=1");
  assert.equal(withLocale("/en?q=1", "en"), "/en?q=1");
  assert.equal(withLocale("/en#ust", "tr"), "/#ust");
  assert.equal(withLocale("/en#ust", "en"), "/en#ust");
  assert.equal(withLocale("/#ust", "en"), "/en#ust");
  assert.equal(withLocale("/en/piyasalar?endeks=dow#tablo", "tr"), "/piyasalar?endeks=dow#tablo");
});

test("protokol göreli adres dış adrestir, boş yol köktür", () => {
  assert.equal(withLocale("//example.com/x", "en"), "//example.com/x");
  assert.deepEqual(languageAlternates(""), { tr: "/", en: "/en" });
});
