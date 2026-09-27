import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateIsPast,
  formatGuidanceRange,
  guidanceEnds,
  splitLeadingDate,
} from "../lib/earnings-report";

/**
 * Bilanço detayının saf yardımcıları — sayfa panellere bölünürken
 * `lib/earnings-report.ts`e taşındılar. Testler yorumlardaki somut
 * vakaları tutuyor: MU'nun "~21-22 Eylül" tahmini, AMGN/HWM bantları.
 */

test("estimateIsPast: metnin gösterebileceği EN GEÇ gün alınır", () => {
  assert.equal(estimateIsPast("~21-22 Eylül 2026", "2026-09-23"), true);
  assert.equal(estimateIsPast("~21-22 Eylül 2026", "2026-09-22"), false);
  // Gün yoksa ayın sonu: Aralık bitene kadar geçmiş sayılmaz.
  assert.equal(estimateIsPast("~Aralık 2026", "2026-12-31"), false);
  assert.equal(estimateIsPast("Late October 2026", "2026-11-01"), true);
  // Yıl okunamazsa "hayır".
  assert.equal(estimateIsPast("yakında", "2030-01-01"), false);
});

test("splitLeadingDate: yalnızca tarih gibi okunan baş ayrılır", () => {
  assert.deepEqual(splitLeadingDate("Aralık 2026: Yatırımcı günü"), {
    date: "Aralık 2026",
    text: "Yatırımcı günü",
  });
  assert.deepEqual(splitLeadingDate("Q3 FY27: Next report"), {
    date: "Q3 FY27",
    text: "Next report",
  });
  assert.equal(splitLeadingDate("Yapay zekâ: talep güçlü"), null);
});

test("formatGuidanceRange: hane sayısı şirketin verdiği sayıdan çıkar", () => {
  assert.equal(formatGuidanceRange(15.8, 17.08, "$", "tr"), "15,80 – 17,08 $");
  assert.equal(formatGuidanceRange(2.565, 2.585, "Mr $", "tr"), "2,565 – 2,585 Mr $");
  assert.equal(formatGuidanceRange(7, 8.5, "%", "tr"), "%7,0 – %8,5");
  assert.equal(formatGuidanceRange(83, 85, "%", "en"), "83% – 85%");
  // Tek sayı verildiyse tek değer.
  assert.equal(formatGuidanceRange(10.3, 10.3, "Mr $", "tr"), "10,3 Mr $");
});

test("guidanceEnds: iki uçta aynı hane, her uçta birim", () => {
  assert.deepEqual(guidanceEnds(6.8, 6.85, "Mr $", "tr"), ["6,80 Mr $", "6,85 Mr $"]);
});
