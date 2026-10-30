import test from "node:test";
import assert from "node:assert/strict";
import {
  expectationReading,
  expectedFromNote,
  parseMoneyFigure,
  reactionRatio,
  reactionScale, robustScale,
  reportLede,
  sourceHost,
  splitPoint,
  type LedeTemplates,
} from "../lib/analysis-visuals";

/* Künyeler 25 Ekim'deki canlı kayıtlardan (META 3Ç 2026, TSLA, ADBE). */

test("para künyesi iki dilde okunur", () => {
  assert.equal(parseMoneyFigure("64,60 Mr $"), 64.6e9);
  assert.equal(parseMoneyFigure("3,83 $"), 3.83);
  assert.equal(parseMoneyFigure("443 Mn $"), 443e6);
  assert.equal(parseMoneyFigure("−2,12 Mr $"), -2.12e9);
  assert.equal(parseMoneyFigure("1.250,5 Mn $"), 1250.5e6);
  assert.equal(parseMoneyFigure("$64.60B"), 64.6e9);
  assert.equal(parseMoneyFigure("$0.94"), 0.94);
  assert.equal(parseMoneyFigure("−$2.12B"), -2.12e9);
  assert.equal(parseMoneyFigure("$1,250.5M"), 1250.5e6);
});

test("para olmayan değer okunmaz", () => {
  assert.equal(parseMoneyFigure("%20,1"), null);
  assert.equal(parseMoneyFigure("2.573 Mn"), null);
  assert.equal(parseMoneyFigure("3,64 Mr kişi"), null);
  assert.equal(parseMoneyFigure(""), null);
  assert.equal(parseMoneyFigure(null), null);
});

test("beklenti yalnız açık sayıdan okunur", () => {
  assert.deepEqual(expectedFromNote("Beklenti 63,4 Mr $ · %1,9 Aştı"), { text: "63,4 Mr $", value: 63.4e9 });
  assert.deepEqual(expectedFromNote("▲ %13 Yıllık · Beklenti 6,69 Mr $"), { text: "6,69 Mr $", value: 6.69e9 });
  assert.deepEqual(expectedFromNote("Estimate $5.46 · 29.9% Below"), { text: "$5.46", value: 5.46 });
  /* Yüzde kalıbından beklenti TÜRETİLMEZ. */
  assert.equal(expectedFromNote("▲ %55 Yıllık · Beklentiyi %5,8 Aştı"), null);
  assert.equal(expectedFromNote("Beklentinin %1 Üzerinde"), null);
  assert.equal(expectedFromNote(null), null);
});

test("beklenti karnesi: META gelir aştı, HBK kaldı", () => {
  const revenue = expectationReading("64,60 Mr $", "Beklenti 63,4 Mr $ · %1,9 Aştı");
  assert.ok(revenue);
  assert.equal(revenue.outcome, "beat");
  assert.ok(Math.abs(revenue.diffPct - 1.89) < 0.01);
  assert.ok(revenue.actualAt > revenue.expectedAt);
  assert.ok(revenue.expectedAt > 0 && revenue.actualAt < 1);

  const eps = expectationReading("3,83 $", "Beklenti 5,46 $ · %29,9 Altında");
  assert.ok(eps);
  assert.equal(eps.outcome, "miss");
  assert.ok(eps.actualAt < eps.expectedAt);
});

test("beklenti karnesi: uyumlu ve okunamayan", () => {
  const same = expectationReading("12,87 Mr $", "Beklenti 12,87 Mr $ · Uyumlu ✓");
  assert.equal(same?.outcome, "inline");
  /* Eşit değerde eksen yine açılıyor, işaretler ortada. */
  assert.ok(same && same.expectedAt > 0.3 && same.expectedAt < 0.7);
  assert.equal(expectationReading("%20,1", "Beklenti 5,46 $"), null);
  assert.equal(expectationReading("3,83 $", "▲ %80 Yıllık"), null);
});

const TR: LedeTemplates = {
  revenueUp: "gelir yıllık {pct} büyüdü",
  revenueDown: "gelir yıllık {pct} geriledi",
  epsBeat: "hisse başı kâr beklentiyi {pct} aştı",
  epsMiss: "hisse başı kâr beklentinin {pct} altında kaldı",
  epsInline: "hisse başı kâr beklentiyle aynı geldi",
  reactionUp: "hisse ilk tepkide {pct} yükseldi",
  reactionDown: "hisse ilk tepkide {pct} düştü",
  reactionFlat: "hisse ilk tepkide yerinde kaldı",
};
const pct = (value: number) => `%${value.toFixed(1).replace(".", ",")}`;

test("tepe cümlesi veriden kurulur", () => {
  assert.equal(
    reportLede({ revenueYoyPct: 26.1, epsSurprisePct: -29.9, reactionPct: 1.8 }, TR, pct, "tr"),
    "Gelir yıllık %26,1 büyüdü, hisse başı kâr beklentinin %29,9 altında kaldı; hisse ilk tepkide %1,8 yükseldi.",
  );
  assert.equal(
    reportLede({ revenueYoyPct: null, epsSurprisePct: null, reactionPct: -4.2 }, TR, pct, "tr"),
    "Hisse ilk tepkide %4,2 düştü.",
  );
  assert.equal(
    reportLede({ revenueYoyPct: -3, epsSurprisePct: 0.01, reactionPct: null }, TR, pct, "tr"),
    "Gelir yıllık %3,0 geriledi, hisse başı kâr beklentiyle aynı geldi.",
  );
  assert.equal(reportLede({ revenueYoyPct: null, epsSurprisePct: null, reactionPct: null }, TR, pct, "tr"), null);
});

test("madde başı yalnız kalıp varsa ayrılır", () => {
  assert.deepEqual(
    splitPoint("Serbest nakit akışı eksi 2,12 milyar dolara döndü; yatırım harcaması faaliyet nakdinden hızlı büyüyor."),
    { lead: "Serbest nakit akışı eksi 2,12 milyar dolara döndü", rest: "Yatırım harcaması faaliyet nakdinden hızlı büyüyor." },
  );
  assert.deepEqual(splitPoint("Stok günü dokuz gün artarak 129'a çıktı."), {
    lead: null,
    rest: "Stok günü dokuz gün artarak 129'a çıktı.",
  });
  /* Çok kısa baş başlık sayılmaz. */
  assert.equal(splitPoint("Not: kısa").lead, null);
});

test("kaynak alan adı", () => {
  assert.equal(sourceHost("https://www.investor.atmeta.com/news/x"), "investor.atmeta.com");
  assert.equal(sourceHost("not a url"), null);
  assert.equal(sourceHost(null), null);
});

test("ortak tepki ölçeği", () => {
  assert.equal(reactionScale([1.8, -4.2, null]), 5);
  assert.equal(reactionScale([12.4, -3]), 15);
  assert.equal(reactionScale([]), 5);
  assert.ok(Math.abs(reactionRatio(-4.2, 5) + 0.84) < 1e-9);
  assert.equal(reactionRatio(30, 15), 1);
});

test("robustScale: tek aykırı ölçeği ezmiyor, boş liste tabana iner", () => {
  const values = [7, 10, 12, 14, 17, 21, 33, 36, 378];
  assert.equal(robustScale(values), 40);
  assert.equal(reactionScale(values), 380);
  assert.equal(robustScale([]), 5);
  assert.equal(robustScale([null, undefined, -3]), 5);
});
