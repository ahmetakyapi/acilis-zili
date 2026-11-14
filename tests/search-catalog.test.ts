import test from "node:test";
import assert from "node:assert/strict";

import {
  SITE_CAPS,
  SITE_KINDS,
  foldWords,
  indexSite,
  searchSite,
  type SiteEntry,
} from "../lib/search-catalog";
import { highlightRange } from "../lib/search-highlight";

/**
 * ⌘K katalog araması (14 Kasım) — gerekçe `lib/search-catalog.ts`.
 * Üç sözleşme: Türkçe harf katlama (aksansız ve büyük harfli yazım aynı
 * kaydı bulur), sıra (tam > önek > kelime başı > içerir; başlık eşanlamlının
 * önünde) ve tür başına tavan.
 */

const entry = (
  kind: SiteEntry["kind"],
  title: string,
  keywords: string[] = [],
  extra: Partial<SiteEntry> = {},
): SiteEntry => ({
  kind,
  href: `/${kind}/${foldWords(title).replaceAll(" ", "-")}`,
  title,
  detail: "",
  keywords,
  ...extra,
});

const CATALOG = indexSite([
  entry("page", "Sözlük", ["terimler", "ne demek"]),
  entry("page", "Takvim", ["ekonomik takvim", "halka arz"]),
  entry("page", "Vergi Hesaplayıcı", ["vergi", "stopaj"]),
  entry("page", "Risk Masası", ["rejim"], { gate: "risk" }),
  entry("page", "Hisse Tarayıcı", ["screener", "süzgeç"]),
  entry("page", "Piyasalar", ["ısı haritası", "endeksler"]),
  entry("glossary", "Fiyat/Kazanç Oranı (F/K)", ["F/K", "fiyat/kazanç"]),
  entry("glossary", "Faiz"),
  entry("glossary", "Faiz Dışı Gelir"),
  entry("glossary", "Reel Faiz"),
  entry("glossary", "İstihdam Raporu", ["tarım dışı istihdam"]),
  entry("glossary", "Temettü Verimi"),
  entry("glossary", "Stopaj", ["kaynakta kesinti"]),
  entry("glossary", "Göreceli Güç Endeksi (RSI)", ["RSI"]),
  entry("theme", "Yapay Zekâ", ["Artificial Intelligence"]),
  entry("theme", "Yarı İletkenler", ["Semiconductors"]),
  entry("investor", "Warren Buffett", ["Buffett", "Berkshire Hathaway"]),
  entry("investor", "Cathie Wood", ["Wood", "ARK Invest"]),
]);

const titles = (query: string, options?: Parameters<typeof searchSite>[2]) =>
  searchSite(CATALOG, query, options).groups.flatMap((group) => group.hits.map((hit) => hit.title));

test("katlama: Türkçe harfler, büyük İ/I ve ayraçlar", () => {
  assert.equal(foldWords("Sözlük"), "sozluk");
  assert.equal(foldWords("İSTİHDAM"), "istihdam");
  assert.equal(foldWords("ISI HARİTASI"), "isi haritasi");
  assert.equal(foldWords("ısı haritası"), "isi haritasi");
  assert.equal(foldWords("Yapay Zekâ"), "yapay zeka");
  assert.equal(foldWords("Fiyat/Kazanç Oranı (F/K)"), "fiyat kazanc orani f k");
  /* İngilizce metin de aynı kuralla: Türkçe küçültmenin "I" → "ı" tuzağı
     noktalıya inerek kapanıyor. */
  assert.equal(foldWords("Index"), "index");
  assert.equal(foldWords("  "), "");
});

test("aksansız ve büyük harfli sorgu aynı kaydı bulur", () => {
  assert.deepEqual(titles("sozluk"), ["Sözlük"]);
  assert.deepEqual(titles("SÖZLÜK"), ["Sözlük"]);
  assert.deepEqual(titles("istihdam"), ["İstihdam Raporu"]);
  assert.deepEqual(titles("İSTİHDAM"), ["İstihdam Raporu"]);
  assert.deepEqual(titles("ISTIHDAM"), ["İstihdam Raporu"]);
  assert.deepEqual(titles("isi haritasi"), ["Piyasalar"]);
  assert.deepEqual(titles("ISI HARİTASI"), ["Piyasalar"]);
  assert.deepEqual(titles("yapay zeka"), ["Yapay Zekâ"]);
  assert.deepEqual(titles("yari iletken"), ["Yarı İletkenler"]);
});

test("ayraçlı kısaltma bitişik de ayraçlı da bulunur", () => {
  assert.equal(titles("fk")[0], "Fiyat/Kazanç Oranı (F/K)");
  assert.equal(titles("f/k")[0], "Fiyat/Kazanç Oranı (F/K)");
  assert.equal(titles("F/K")[0], "Fiyat/Kazanç Oranı (F/K)");
  assert.equal(titles("riskmasasi")[0], "Risk Masası");
});

test("sıra: tam > önek > kelime başı; eşitlikte kısa başlık önde", () => {
  /* "faiz": Faiz tam, Faiz Dışı Gelir önek, Reel Faiz kelime başı. */
  assert.deepEqual(titles("faiz"), ["Faiz", "Faiz Dışı Gelir", "Reel Faiz"]);
  /* "fai": ikisi önek (kısa olan önde), biri kelime başı. */
  assert.deepEqual(titles("fai"), ["Faiz", "Faiz Dışı Gelir", "Reel Faiz"]);
});

test("sıra: içerir en sonda ve yalnız üç harften itibaren", () => {
  /* "ver": Vergi Hesaplayıcı önek (sayfa), Temettü Verimi kelime başı. */
  assert.deepEqual(titles("ver"), ["Vergi Hesaplayıcı", "Temettü Verimi"]);
  /* "tihda" yalnız kelimenin ortasında: içerir kademesi. */
  assert.deepEqual(titles("tihda"), ["İstihdam Raporu"]);
  /* İki harfte içerir yok: "ih" İstihdam'ın ortasında geçiyor. */
  assert.deepEqual(titles("ih"), []);
  /* İki harfte önek ve kelime başı var: Takvim (başlık önek), Hisse
     Tarayıcı (başlıkta kelime başı), İstihdam Raporu ("tarım dışı…"
     eşanlamlısının öneki, kendi grubunda). */
  assert.deepEqual(titles("ta"), ["Takvim", "Hisse Tarayıcı", "İstihdam Raporu"]);
  /* Tek harfte hiç aranmaz. */
  assert.deepEqual(titles("t"), []);
  assert.deepEqual(titles("   "), []);
});

test("başlık eşanlamlının önünde; eşanlamlı da bulur", () => {
  /* "stopaj": sözlük terimi başlıkta TAM (0), sayfa eşanlamlıda tam (1):
     terimin grubu önde. */
  const result = searchSite(CATALOG, "stopaj");
  assert.deepEqual(result.groups.map((group) => group.kind), ["glossary", "page"]);
  assert.deepEqual(titles("screener"), ["Hisse Tarayıcı"]);
  assert.deepEqual(titles("halka arz"), ["Takvim"]);
  assert.deepEqual(titles("berkshire"), ["Warren Buffett"]);
  assert.deepEqual(titles("artificial"), ["Yapay Zekâ"]);
});

test("gruplar en iyi eşleşmeye göre sıralanır, eşitlikte tür sırası", () => {
  /* "rsi": yalnız sözlük. "buffett": yalnız yatırımcı. */
  assert.deepEqual(searchSite(CATALOG, "rsi").groups.map((group) => group.kind), ["glossary"]);
  assert.deepEqual(searchSite(CATALOG, "buffett").groups.map((group) => group.kind), ["investor"]);
  /* Eşit en iyi puanda SITE_KINDS sırası. */
  const tie = indexSite([entry("investor", "Makro"), entry("theme", "Makro"), entry("page", "Makro")]);
  assert.deepEqual(searchSite(tie, "makro").groups.map((group) => group.kind), ["page", "theme", "investor"]);
  assert.deepEqual([...SITE_KINDS], ["page", "glossary", "theme", "investor"]);
});

test("exact: yalnız başlık ya da eşanlamlı sorgunun kendisiyse", () => {
  assert.equal(searchSite(CATALOG, "takvim").exact, true);
  assert.equal(searchSite(CATALOG, "TAKVİM").exact, true);
  assert.equal(searchSite(CATALOG, "vergi").exact, true); // eşanlamlı tam
  assert.equal(searchSite(CATALOG, "buffett").exact, true);
  assert.equal(searchSite(CATALOG, "fk").exact, true);
  assert.equal(searchSite(CATALOG, "tak").exact, false); // önek yetmez
  assert.equal(searchSite(CATALOG, "ver").exact, false);
  assert.equal(searchSite(CATALOG, "zzzz").exact, false);
});

test("tür başına tavan", () => {
  const many = indexSite([
    ...Array.from({ length: 9 }, (_, i) => entry("glossary", `Faiz Terimi ${i + 1}`)),
    ...Array.from({ length: 9 }, (_, i) => entry("page", `Faiz Sayfası ${i + 1}`)),
    ...Array.from({ length: 9 }, (_, i) => entry("theme", `Faiz Teması ${i + 1}`)),
    ...Array.from({ length: 9 }, (_, i) => entry("investor", `Faiz Yatırımcısı ${i + 1}`)),
  ]);
  const result = searchSite(many, "faiz");
  for (const group of result.groups) {
    assert.equal(group.hits.length, SITE_CAPS[group.kind], group.kind);
  }
  assert.equal(result.groups.length, 4);
  /* Tavan içinde katalog sırası korunur. */
  assert.deepEqual(
    result.groups.find((group) => group.kind === "theme")!.hits.map((hit) => hit.title),
    ["Faiz Teması 1", "Faiz Teması 2", "Faiz Teması 3"],
  );
  /* Çağıran tavanı daraltabilir. */
  const narrow = searchSite(many, "faiz", { caps: { page: 1, glossary: 2, theme: 0, investor: 1 } });
  assert.deepEqual(
    narrow.groups.map((group) => [group.kind, group.hits.length]),
    [["page", 1], ["glossary", 2], ["theme", 0], ["investor", 1]],
  );
});

test("kapılı kayıt `allow` ile süzülür ve tam eşleşme sayılmaz", () => {
  assert.deepEqual(titles("risk masası"), ["Risk Masası"]);
  const closed = searchSite(CATALOG, "risk masası", { allow: (item) => !item.gate });
  assert.deepEqual(closed.groups, []);
  assert.equal(closed.exact, false);
});

test("vurgu: katlanmış eşleşme özgün metnin konumuyla döner", () => {
  const cut = (text: string, term: string) => {
    const range = highlightRange(text, term);
    return range ? text.slice(range[0], range[1]) : null;
  };
  assert.equal(cut("Sözlük", "sozluk"), "Sözlük");
  assert.equal(cut("İstihdam Raporu", "ISTIH"), "İstih");
  assert.equal(cut("Isı Haritası", "isi"), "Isı");
  assert.equal(cut("Fiyat/Kazanç Oranı (F/K)", "fk"), "F/K");
  assert.equal(cut("Yapay Zekâ", "zeka"), "Zekâ");
  assert.equal(cut("NVIDIA", "nvi"), "NVI");
  assert.equal(cut("Takvim", "xyz"), null);
  assert.equal(cut("Takvim", "  "), null);
});
