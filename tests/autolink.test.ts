import test from "node:test";
import assert from "node:assert/strict";

import { createAutoLinker, lowerSameLength, type AutoLinkPiece } from "../lib/autolink";

/**
 * Yazı gövdesindeki otomatik bağlantının eşleştiricisi.
 *
 * Yanlış bağlantı hiç bağlantı olmamasından pahalı (gerekçe
 * `lib/autolink.ts` başında); testlerin yarısı bu yüzden bağlanMAması
 * gereken metinler.
 */

const TERMS = [
  { slug: "fk", forms: ["F/K", "fiyat/kazanç oranı"] },
  { slug: "rsi", forms: ["RSI"] },
  { slug: "getiri-egrisi", forms: ["getiri eğrisi"] },
  { slug: "ters-getiri-egrisi", forms: ["ters getiri eğrisi"] },
  { slug: "halka-arz", forms: ["halka arz"] },
  { slug: "likidite", forms: ["likidite"] },
  { slug: "form-4", forms: ["Form 4"] },
  { slug: "tufe", forms: ["TÜFE"] },
  { slug: "piyasa-degeri", forms: ["piyasa değeri"] },
];

const SYMBOLS = new Set(["NVDA", "AMD", "AI", "BRK.B", "A", "ON"]);

function linker(options: { excludeTerm?: string; locale?: string } = {}) {
  return createAutoLinker({
    locale: options.locale ?? "tr",
    terms: TERMS,
    symbols: SYMBOLS,
    excludeTerm: options.excludeTerm,
  });
}

function links(pieces: AutoLinkPiece[]): [string, string][] {
  return pieces
    .filter((piece): piece is { text: string; href: string } => typeof piece !== "string")
    .map((piece) => [piece.text, piece.href]);
}

function joined(pieces: AutoLinkPiece[]): string {
  return pieces.map((piece) => (typeof piece === "string" ? piece : piece.text)).join("");
}

test("metin bölünürken tek harf kaybolmaz", () => {
  const text = "Şirketin F/K'sı yüksek, RSI'ı 70'in üstünde ve (NVDA) yükseliyor.";
  assert.equal(joined(linker().split(text)), text);
});

test("kısaltma kesme işaretli Türkçe ekle bağlanır, ek bağlantının içinde", () => {
  assert.deepEqual(links(linker().split("Hissenin F/K'sı 40.")), [["F/K'sı", "/sozluk/fk"]]);
  assert.deepEqual(links(linker().split("RSI'ın 70'i aşması")), [["RSI'ın", "/sozluk/rsi"]]);
  assert.deepEqual(links(linker().split("RSI’ın kıvrık kesmeyle")), [["RSI’ın", "/sozluk/rsi"]]);
});

test("kısaltma kesmesiz bitişik harfle ya da küçük harfle bağlanmaz", () => {
  assert.deepEqual(links(linker().split("RSIs ve rsi ve FORSI")), []);
  assert.deepEqual(links(linker().split("Form 40 başvurusu")), []);
});

test("küçük harfli biçim ekli hâlini ve cümle başı büyük harfini yakalar", () => {
  assert.deepEqual(links(linker().split("Getiri eğrisinin eğimi")), [
    ["Getiri eğrisinin", "/sozluk/getiri-egrisi"],
  ]);
  assert.deepEqual(links(linker().split("şirketin halka arzından sonra")), [
    ["halka arzından", "/sozluk/halka-arz"],
  ]);
});

test("bileşiğin içindeki kısaltma bağlanmaz", () => {
  const l = createAutoLinker({
    locale: "tr",
    terms: [{ slug: "ufe", forms: ["ÜFE"] }],
    symbols: new Set(),
  });
  assert.deepEqual(links(l.split("Yİ-ÜFE'deki artış ve ABD/ÜFE")), []);
  assert.deepEqual(links(l.split("ABD ÜFE'si")), [["ÜFE'si", "/sozluk/ufe"]]);
});

test("uzun devam başka bir kelimedir — eşleşmez", () => {
  assert.deepEqual(links(linker().split("likiditesizlikten korkma")), []);
  assert.deepEqual(links(linker().split("çoklikidite")), []);
});

test("İ/I harfleri indeksleri kaydırmaz", () => {
  const text = "İSTANBUL'da İki şirketin piyasa değeri";
  assert.equal(lowerSameLength(text, "tr").length, text.length);
  assert.deepEqual(links(linker().split(text)), [["piyasa değeri", "/sozluk/piyasa-degeri"]]);
});

test("her hedef yazı boyunca yalnızca ilk geçtiği yerde bağlanır", () => {
  const l = linker();
  assert.deepEqual(links(l.split("F/K ve yine F/K")), [["F/K", "/sozluk/fk"]]);
  assert.deepEqual(links(l.split("ikinci paragrafta F/K")), []);
});

test("uzun eşleşme kısayı yutar; kullanılmış uzun eşleşme alanını korur", () => {
  const l = linker();
  assert.deepEqual(links(l.split("ters getiri eğrisi resesyon habercisi")), [
    ["ters getiri eğrisi", "/sozluk/ters-getiri-egrisi"],
  ]);
  /* İkinci geçişte uzun terim artık bağlanmıyor ama içindeki kısa terime
     de bağlantı düşmüyor. */
  assert.deepEqual(links(l.split("yine ters getiri eğrisi")), []);
  assert.deepEqual(links(l.split("düz getiri eğrisi")), [
    ["getiri eğrisi", "/sozluk/getiri-egrisi"],
  ]);
});

test("kendi sözlük sayfasında terim kendine bağlanmaz", () => {
  assert.deepEqual(links(linker({ excludeTerm: "fk" }).split("F/K ve RSI")), [
    ["RSI", "/sozluk/rsi"],
  ]);
});

test("yazarın kendi bağlantısı hedefi tüketir", () => {
  const l = linker();
  l.claim("/hisse/NVDA");
  l.claim("/sozluk/rsi");
  assert.deepEqual(links(l.split("Nvidia (NVDA) ve RSI")), []);
});

test("sembol yalnızca açık kalıpta ve bilinen kümede", () => {
  assert.deepEqual(links(linker().split("Nvidia (NVDA) ile $AMD")), [
    ["NVDA", "/hisse/NVDA"],
    ["$AMD", "/hisse/AMD"],
  ]);
  /* Düz büyük harfli kelime sembol sayılmaz. */
  assert.deepEqual(links(linker().split("NVDA ve AMD bugün")), []);
  /* Bilinmeyen sembol. */
  assert.deepEqual(links(linker().split("(ZZZQ) ve $ZZZQ")), []);
  /* Sınıflı hisse. */
  assert.deepEqual(links(linker().split("Berkshire (BRK.B)")), [["BRK.B", "/hisse/BRK.B"]]);
});

test("tek harf ve parantezde yaygın kısaltma sembol sayılmaz", () => {
  assert.deepEqual(links(linker().split("madde (A) ve $A")), []);
  assert.deepEqual(links(linker().split("yapay zekâ (AI) ve yarı iletken (ON)")), []);
  /* `$` kalıbı açık bir niyet: orada kısaltma listesi uygulanmıyor. */
  assert.deepEqual(links(linker().split("$AI hissesi")), [["$AI", "/hisse/AI"]]);
});

test("para tutarı ve kelime içi dolar sembol değildir", () => {
  assert.deepEqual(links(linker().split("5$ ve US$NVDA ve $5")), []);
});

test("İngilizcede yalnızca çoğul eki kabul edilir", () => {
  const l = createAutoLinker({
    locale: "en",
    terms: [{ slug: "getiri-egrisi", forms: ["yield curve"] }, { slug: "straddle", forms: ["straddle"] }],
    symbols: new Set(),
  });
  assert.deepEqual(links(l.split("Yield curves inverted")), [["Yield curves", "/sozluk/getiri-egrisi"]]);
  assert.deepEqual(links(l.split("straddled the line")), []);
});
