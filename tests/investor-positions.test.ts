import test from "node:test";
import assert from "node:assert/strict";

import tr from "../lib/i18n/dictionaries/tr";
import { positionRowView } from "../components/investors/format";

/* 13F tablosunun kalan satırları istemciye VERİ olarak gidiyor (20 Ekim,
   `PositionsMore`): hücre metinleri sunucuda `positionRowView` ile
   biçimleniyor. Satır çizimi taşınırken kaybolabilecek üç kural burada. */

const t = tr.investors;
const base = {
  cusip: "037833100",
  position: "long",
  issuer: "Apple Inc",
  titleOfClass: "COM",
  amount: 400_000_000,
  amountType: "SH",
  value: 62_100_000_000,
  weight: 0.224,
  prevAmount: 300_000_000,
  prevValue: 50_000_000_000,
  move: "increased" as const,
  changePct: 33.3,
  split: null,
  ticker: "AAPL",
  linkable: true,
  logoUrl: null,
};

test("positionRowView: sıra sıfırdan gelen dizinden, çubuk en büyük ağırlığa göre", () => {
  const row = positionRowView(base, 25, 0.448, true, "tr", t);
  assert.equal(row.rank, 26);
  assert.equal(row.bar, 50);
  assert.equal(row.weight, "%22,4");
  assert.equal(row.move?.tone, "up");
  assert.equal(row.move?.label, t.moveIncreased);
  assert.ok(row.move?.change);
  assert.equal(row.move?.note, null);
});

test("positionRowView: aynı kalan pozisyonda yüzde basılmıyor", () => {
  const row = positionRowView({ ...base, move: "unchanged", changePct: 0 }, 0, 0.448, true, "tr", t);
  assert.equal(row.move?.label, t.moveUnchanged);
  assert.equal(row.move?.change, null);
});

test("positionRowView: ters bölünme oranı tam sayı", () => {
  const row = positionRowView({ ...base, split: 1 / 3 }, 0, 1, true, "tr", t);
  assert.equal(row.move?.note, t.reverseSplitNote.replace("{ratio}", "3"));
  const forward = positionRowView({ ...base, split: 10 }, 0, 1, true, "tr", t);
  assert.equal(forward.move?.note, t.splitNote.replace("{ratio}", "10"));
});

test("positionRowView: karşılaştırma yoksa değişim sütunu hiç yok", () => {
  assert.equal(positionRowView(base, 0, 1, false, "tr", t).move, null);
});
