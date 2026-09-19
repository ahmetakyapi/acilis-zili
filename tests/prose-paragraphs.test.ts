import test from "node:test";
import assert from "node:assert/strict";

import { proseParagraphs } from "../lib/utils";

/**
 * Okuma metninin paragraflara bölünmesi.
 *
 * Bölme YAZIYA DOKUNMUYOR: yalnızca cümle sınırlarından gruplayıp ayrı
 * paragraflar basıyor. İki tuzak var ve ikisi de teste bağlandı — ondalık
 * ayraç ("1.581,86") bir cümle sonu değildir, ve sondaki tek cümle yetim
 * bir paragraf olarak kalmamalıdır.
 */

const UZUN =
  "Fiyat 1.581,86'daki 20 günlük ortalamanın üzerinde; yapı güçlü. " +
  "Sabahki plan 1.540,56-1.581,86 bandını ve 1.662,27'lik ilk hedefi işaret ediyordu, fiyat ise gün içinde bu hedefin üzerine geçti. " +
  "Bu yüzden bant tamamen yukarı taşındı ve destek hâline gelen 1.662,27'nin çevresine kuruldu. " +
  "RSI ve MACD son kapanışa ait olduğu için bugünkü sıçramayı içermiyor; okuma bu ölçüde geriden geliyor.";

test("kısa metin bölünmez", () => {
  const kisa = "Hacim 20 günlük ortalamanın hafif üstünde.";
  assert.deepEqual(proseParagraphs(kisa), [kisa]);
});

test("uzun metin cümle sınırından bölünür ve tek kelime kaybolmaz", () => {
  const parcalar = proseParagraphs(UZUN);
  assert.ok(parcalar.length >= 2, "uzun metin tek paragraf kalmış");
  assert.equal(parcalar.join(" "), UZUN);
  for (const parca of parcalar) {
    assert.ok(/[.!?]$/.test(parca.trim()), `paragraf cümle ortasında bitmiş: ${parca.slice(-30)}`);
  }
});

test("ondalık ayraç cümle sonu sayılmaz", () => {
  const parcalar = proseParagraphs(UZUN);
  for (const parca of parcalar) {
    assert.ok(!/^\d/.test(parca.trim()), `paragraf sayının ortasından başlamış: ${parca.slice(0, 20)}`);
  }
  /* Sayılar bütün hâlde duruyor. */
  assert.ok(parcalar.join(" ").includes("1.581,86"));
  assert.ok(parcalar.join(" ").includes("1.662,27"));
});

test("yazarın kendi boş satırları korunur", () => {
  const yazilmis = "Birinci paragraf burada.\n\nİkinci paragraf burada.";
  assert.deepEqual(proseParagraphs(yazilmis), ["Birinci paragraf burada.", "İkinci paragraf burada."]);
});
