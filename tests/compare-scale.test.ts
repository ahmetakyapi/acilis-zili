import test from "node:test";
import assert from "node:assert/strict";

import { scaleRatios } from "../lib/compare";

/**
 * Karşılaştırma tablosundaki ölçek çubuğunun oranları.
 *
 * Çubuk, sayının yanında duran İKİNCİ bir iddia: uzunluk yanlışsa okuyucu
 * sıralamayı yanlış okur ve sayıya hiç bakmaz. Dört değişmez var ve dördü
 * de ekranda görülebilecek bir hataya karşılık geliyor:
 *
 *  1. Tek değer bir karşılaştırma değil — çubuk hiç basılmaz. (Basılsaydı
 *     tek sembolde her satır tam dolu çıkar, "en büyük bu" diye okunurdu.)
 *  2. Tavan satırın en büyük MUTLAK değeri; en büyük hep 1.
 *  3. Eksi bir değer varsa ölçek işaretli — sıfır ortada ve işaret korunur.
 *  4. Boş hücre boş kalır; hepsi sıfırsa çubuk yok (bölme sıfıra düşerdi).
 */

test("tek değerde çubuk basılmaz", () => {
  const { ratios } = scaleRatios([4.2, null, null, null]);
  assert.deepEqual(ratios, [null, null, null, null]);
});

test("işaretsiz satırda en büyük tam dolu, ötekiler oranında", () => {
  const { signed, ratios } = scaleRatios([53.15, 173.16, 87.56, 29.46]);
  assert.equal(signed, false);
  assert.equal(ratios[1], 1);
  assert.ok(Math.abs(ratios[0]! - 53.15 / 173.16) < 1e-12);
  /* Sıra sayının sırasıyla aynı. */
  assert.ok(ratios[3]! < ratios[0]! && ratios[0]! < ratios[2]!);
});

test("eksi bir değer varsa ölçek işaretli ve yön korunur", () => {
  const { signed, ratios } = scaleRatios([1.84, -2.41, 0.62, 4.12]);
  assert.equal(signed, true);
  assert.equal(ratios[3], 1);
  assert.ok(ratios[1]! < 0, "eksi değer artıya dönmüş");
  assert.ok(Math.abs(ratios[1]! + 2.41 / 4.12) < 1e-12);
});

test("boş hücre boş kalır, hepsi sıfırsa çubuk yok", () => {
  const { ratios } = scaleRatios([12, null, 6, 0]);
  assert.equal(ratios[1], null);
  assert.equal(ratios[3], 0);
  assert.deepEqual(scaleRatios([0, 0, 0]).ratios, [null, null, null]);
});
