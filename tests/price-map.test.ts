import test from "node:test";
import assert from "node:assert/strict";

import { ladderOf, priceMapLayout } from "../lib/technical";

/**
 * Fiyat haritasının yerleşimi.
 *
 * Haritanın okunurluğu üç değişmeze dayanıyor ve üçü de bir ekran
 * görüntüsüyle gelen hatadan doğdu: seviyeler birbirine yapıştığında
 * etiketler itiliyordu, bağ çizgileri yumak oluyordu ve BÖLGELER yanlış
 * satırı sarıyordu (alım bandı "Destek" satırının çevresine oturmuştu).
 *
 * Değişmezler:
 *  1. Sıra korunur — fiyatı yüksek olan yukarıda kalır.
 *  2. İki satır arası en az `gap` piksel; hiçbir etiket ötekinin üstüne
 *     binmez, yani itmeye de gerek kalmaz (`markY === labelY`).
 *  3. Ölçek monoton ve satır yerlerinden geçer: bir bölgenin iki ucu
 *     arasındaki her satır, ekranda da o bölgenin içinde durur.
 */

const OPTS = { height: 420, gap: 46, inset: 22 };

test("seviyeler fiyat sırasında ve en az bir satır aralığıyla yerleşir", () => {
  const levels = ladderOf({
    entryLow: 756.81,
    entryHigh: 778.09,
    stop: 741.04,
    targets: [792.28, 819.87, 859.29],
    supports: [744.98],
    resistances: [789.92],
  });
  const { rungs } = priceMapLayout(levels, 788.34, OPTS);

  assert.ok(rungs.length >= 8);
  for (let i = 1; i < rungs.length; i++) {
    const ust = rungs[i - 1]!;
    const alt = rungs[i]!;
    assert.ok(alt.markY - ust.markY >= OPTS.gap - 0.01, `aralık dar: ${ust.kind}/${alt.kind}`);
    const ustFiyat = "high" in ust && ust.high !== undefined ? ust.high : ust.price;
    const altFiyat = "high" in alt && alt.high !== undefined ? alt.high : alt.price;
    assert.ok(ustFiyat >= altFiyat, `sıra bozuldu: ${ust.kind}/${alt.kind}`);
  }
});

test("etiket işaretle aynı yerde — bağ çizgisine gerek yok", () => {
  const levels = ladderOf({
    entryLow: 100,
    entryHigh: 101,
    stop: 99.5,
    targets: [101.2, 101.4, 130],
    supports: [99.8],
    resistances: [101.1],
  });
  const { rungs } = priceMapLayout(levels, 101.05, OPTS);
  for (const rung of rungs) {
    assert.equal(rung.labelY, rung.markY, `${rung.kind} etiketi kaymış`);
  }
});

test("ölçek monoton ve bölge kendi satırını sarar", () => {
  const entryLow = 756.81;
  const entryHigh = 778.09;
  const stop = 741.04;
  const levels = ladderOf({
    entryLow,
    entryHigh,
    stop,
    targets: [792.28, 819.87, 859.29],
    supports: [744.98],
    resistances: [789.92],
  });
  const { rungs, scale } = priceMapLayout(levels, 788.34, OPTS);

  /* Monotonluk: fiyat düştükçe y büyür. */
  let onceki = -Infinity;
  for (let value = 860; value >= 740; value -= 0.5) {
    const y = scale(value);
    assert.ok(y >= onceki - 0.001, `ölçek ${value} civarında geri döndü`);
    onceki = y;
  }

  /* Alım bölgesi satırı bandın içinde. */
  const entry = rungs.find((rung) => rung.kind === "entry");
  assert.ok(entry);
  const bandTop = scale(entryHigh);
  const bandBottom = scale(entryLow);
  assert.ok(bandTop <= entry.markY && entry.markY <= bandBottom, "bant kendi satırını sarmıyor");

  /* Stopun altındaki hiçbir satır stop çizgisinin üstünde kalmaz. */
  const stopY = scale(stop);
  for (const rung of rungs) {
    const fiyat = "high" in rung && rung.high !== undefined ? rung.high : rung.price;
    if (fiyat < stop) assert.ok(rung.markY > stopY, `${rung.kind} stopun üstünde çizilmiş`);
  }
});
