import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averageMonths,
  HISTORY_FROM,
  NBER_RECESSIONS,
  recessionMonths,
  timelineAt,
  timelineSpans,
} from "../components/probabilities/recession-history";

/* NBER tablosundaki zirveden dibe süreler (ay): 6, 16, 8, 8, 18, 2. */
test("NBER süreleri kaynak tablosuyla aynı", () => {
  assert.deepEqual(NBER_RECESSIONS.map(recessionMonths), [6, 16, 8, 8, 18, 2]);
});

test("ortalama süre tam aya yuvarlanır, boş listede null", () => {
  assert.equal(averageMonths(NBER_RECESSIONS), 10);
  assert.equal(averageMonths([]), null);
});

test("şerit yerleri 0–100 içinde, sıralı ve dip ayı dahil", () => {
  const spans = timelineSpans(NBER_RECESSIONS, HISTORY_FROM, "2027-12");
  assert.equal(spans.length, NBER_RECESSIONS.length);
  for (const s of spans) {
    assert.ok(s.left >= 0 && s.left + s.width <= 100);
    assert.ok(s.width > 0);
  }
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i].left > spans[i - 1].left + spans[i - 1].width);
  /* 1980 Ocak'tan 2027 Aralık sonuna 576 ay; 2020 resesyonu 3 ay (Şubat, Mart, Nisan). */
  const covid = spans.at(-1)!;
  assert.ok(Math.abs(covid.width - (3 / 576) * 100) < 1e-9);
});

test("eksenin başı 0, 2027 Ocak doğru yerde", () => {
  assert.equal(timelineAt(HISTORY_FROM, HISTORY_FROM, "2027-12"), 0);
  assert.ok(Math.abs(timelineAt("2027-01", HISTORY_FROM, "2027-12") - (564 / 576) * 100) < 1e-9);
});

test("başlangıçtan önce biten resesyon şeride girmez, kesişen kırpılır", () => {
  assert.equal(timelineSpans(NBER_RECESSIONS, "1981-01", "2027-12").length, NBER_RECESSIONS.length - 1);
  const clipped = timelineSpans(NBER_RECESSIONS, "1980-04", "2027-12");
  assert.equal(clipped.length, NBER_RECESSIONS.length);
  assert.equal(clipped[0].left, 0);
  /* Nisan–Temmuz 1980: 4 ay kalır. */
  assert.ok(Math.abs(clipped[0].width - (4 / 573) * 100) < 1e-9);
});
