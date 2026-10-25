import test from "node:test";
import assert from "node:assert/strict";

import {
  composeAnalysisLead,
  HEAT_MAX,
  HEAT_MIN,
  heatOf,
  heaviestSector,
  pairScale,
  ratioTo,
  sectorBoard,
  STRIP_MAX,
  weightStrip,
  type LeadFormat,
} from "../components/portfolio/analysis/analysis-visuals";
import { portfolioAnalysisVisualsEn, portfolioAnalysisVisualsTr } from "../lib/i18n/dictionaries/portfolio-analysis-visuals";
import { isAdviceFree } from "../lib/advice-guard";

const trFormat: LeadFormat = {
  percent: (value) => `%${value.toFixed(1).replace(".", ",")}`,
  measure: (value, digits) => value.toFixed(digits).replace(".", ","),
  sector: (key) => (key === "Information Technology" ? "Bilgi Teknolojileri" : key),
  upper: (text) => text.toLocaleUpperCase("tr-TR"),
};
const enFormat: LeadFormat = {
  percent: (value) => `${value.toFixed(1)}%`,
  measure: (value, digits) => value.toFixed(digits),
  sector: (key) => key,
  upper: (text) => text.toLocaleUpperCase("en-US"),
};

const facts = {
  count: 5,
  effective: 2.7,
  largest: { symbol: "MU", weight: 43.4 },
  sector: { key: "Information Technology", portfolio: 97.5, benchmark: 37.8 },
  volatility: { portfolio: 85.2, benchmark: 12.7 },
};

test("ağırlık şeridi: yedi pozisyona kadar hepsi adıyla, fazlası Diğer'de", () => {
  const rows = Array.from({ length: STRIP_MAX }, (_, i) => ({ symbol: `S${i}`, weight: 100 / STRIP_MAX }));
  assert.equal(weightStrip(rows).length, STRIP_MAX);
  assert.ok(weightStrip(rows).every((segment) => segment.symbol !== null));
  const many = Array.from({ length: 10 }, (_, i) => ({ symbol: `S${i}`, weight: 10 }));
  const strip = weightStrip(many);
  assert.equal(strip.length, STRIP_MAX);
  assert.equal(strip.at(-1)!.symbol, null);
  assert.equal(strip.at(-1)!.weight, 40);
  assert.equal(Math.round(strip.reduce((sum, segment) => sum + segment.weight, 0)), 100);
});

test("eş ölçek: iki değer aynı ölçekte, işaret yok sayılır, taban korunur", () => {
  const scale = pairScale(-46.9, -9.1);
  assert.ok(scale.a > scale.b && scale.a < 1);
  assert.equal((scale.a / scale.b).toFixed(4), (46.9 / 9.1).toFixed(4));
  const beta = pairScale(0.8, 1, 1.5);
  assert.equal(beta.max.toFixed(3), (1.5 * 1.15).toFixed(3));
  assert.deepEqual(pairScale(0, 0), { a: 0, b: 0, max: 0 });
});

test("ısı yoğunluğu mutlak değerden ve kontrast tavanında", () => {
  assert.equal(heatOf(0), HEAT_MIN);
  assert.equal(heatOf(1), HEAT_MAX);
  assert.equal(heatOf(-0.6), heatOf(0.6));
  assert.ok(heatOf(5) <= HEAT_MAX);
});

test("en ağır sektör: portföy payı en büyük olan", () => {
  const rows = [
    { sector: "Financials", portfolio: 0, benchmark: 12, diff: -12 },
    { sector: "Information Technology", portfolio: 60, benchmark: 33, diff: 27 },
    { sector: "Health Care", portfolio: 40, benchmark: 10, diff: 30 },
  ];
  assert.equal(heaviestSector(rows)!.key, "Information Technology");
  assert.equal(heaviestSector([{ sector: "X", portfolio: 0, benchmark: 5, diff: -5 }]), null);
});

test("tepedeki cümle: ölçülerden kurulur, iki dilde", () => {
  assert.equal(
    composeAnalysisLead(facts, portfolioAnalysisVisualsTr.lead, trFormat),
    "En ağır sektör Bilgi Teknolojileri: portföyde %97,5, S&P 500'de %37,8; 5 pozisyon eşit ağırlıklı 2,7 pozisyon kadar dağınık, geçen yılki oynaklık S&P 500'ün 6,7 katı.",
  );
  assert.equal(
    composeAnalysisLead(facts, portfolioAnalysisVisualsEn.lead, enFormat),
    "The heaviest sector is Information Technology: 97.5% of the portfolio against 37.8% of the S&P 500; 5 positions spread like 2.7 equal-weight positions, and last year's volatility was 6.7 times the S&P 500's.",
  );
});

test("tepedeki cümle: eksik veri o parçayı düşürür, tek pozisyon kendi kalıbında", () => {
  const bare = { ...facts, sector: null, volatility: null };
  assert.equal(composeAnalysisLead(bare, portfolioAnalysisVisualsTr.lead, trFormat), "5 pozisyon eşit ağırlıklı 2,7 pozisyon kadar dağınık.");
  const single = { ...bare, count: 1, effective: 1 };
  assert.equal(composeAnalysisLead(single, portfolioAnalysisVisualsTr.lead, trFormat), "Portföy tek pozisyondan oluşuyor (MU).");
  /* S&P oynaklığı sıfırsa oran basılmaz. */
  const flat = { ...facts, volatility: { portfolio: 10, benchmark: 0 } };
  assert.ok(!composeAnalysisLead(flat, portfolioAnalysisVisualsTr.lead, trFormat).includes("katı"));
});

test("cümle ve görsel künyeler öneri kipi taşımaz (SPK çizgisi)", () => {
  for (const [dict, locale, format] of [
    [portfolioAnalysisVisualsTr, "tr", trFormat],
    [portfolioAnalysisVisualsEn, "en", enFormat],
  ] as const) {
    assert.ok(isAdviceFree(composeAnalysisLead(facts, dict.lead, format), locale));
    const strings = JSON.stringify(dict);
    assert.ok(isAdviceFree(strings, locale), `${locale} künyelerinde öneri kalıbı`);
  }
});

/* Kart panosu (25 Ekim): sektör kartının iki bölümü ve oynaklık oranı. */
test("sektör panosu: portföyde olanlar satır, olmayanlar ızgara, ölçek ortak", () => {
  const rows = [
    { sector: "Financials", portfolio: 0, benchmark: 12.1, diff: -12.1 },
    { sector: "Information Technology", portfolio: 97.5, benchmark: 37.8, diff: 59.7 },
    { sector: "Energy", portfolio: 0, benchmark: 3.8, diff: -3.8 },
    { sector: "Health Care", portfolio: 2.5, benchmark: 9.9, diff: -7.4 },
    { sector: "Unknown", portfolio: 0, benchmark: 0, diff: 0 },
  ];
  const board = sectorBoard(rows);
  assert.deepEqual(board.held.map((row) => row.sector), ["Information Technology", "Health Care"]);
  /* Portföyde olmayanlar S&P 500 payı sırasıyla; iki tarafta da sıfır olan düşer. */
  assert.deepEqual(board.absent.map((row) => row.sector), ["Financials", "Energy"]);
  assert.equal(board.scale, 97.5);
  /* Hiçbir sektör kaybolmuyor: payı olan her satır iki bölümden birinde. */
  assert.equal(board.held.length + board.absent.length, rows.filter((row) => row.portfolio > 0 || row.benchmark > 0).length);
});

test("sektör panosu: boş girdi tek ölçekle döner", () => {
  assert.deepEqual(sectorBoard([]), { held: [], absent: [], scale: 1 });
});

test("oynaklık oranı: cümle ile kart aynı fonksiyon, endeks sıfırsa yok", () => {
  assert.ok(Math.abs((ratioTo(85.2, 12.7) ?? 0) - 6.709) < 0.001);
  assert.equal(ratioTo(10, 0), null);
  assert.equal(ratioTo(10, -1), null);
  assert.equal(ratioTo(Number.NaN, 5), null);
  /* Cümledeki "6,7 katı" kartın "6,7 Kat"ıyla aynı oran. */
  assert.ok(composeAnalysisLead(facts, portfolioAnalysisVisualsTr.lead, trFormat).includes("6,7 katı"));
});
