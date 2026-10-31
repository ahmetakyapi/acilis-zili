import test from "node:test";
import assert from "node:assert/strict";

import {
  composeAnalysisFacts,
  effectivePips,
  fillParts,
  HEAT_MAX,
  HEAT_MIN,
  heatOf,
  heaviestSector,
  leadText,
  pairScale,
  PIP_MAX,
  ratioTo,
  sectorBoard,
  STRIP_MAX,
  weightStrip,
  type LeadFact,
  type LeadFormat,
} from "../components/portfolio/analysis/analysis-visuals";
import { portfolioAnalysisVisualsEn, portfolioAnalysisVisualsTr } from "../lib/i18n/dictionaries/portfolio-analysis-visuals";
import { isAdviceFree } from "../lib/advice-guard";

const trFormat: LeadFormat = {
  percent: (value) => `%${value.toFixed(1).replace(".", ",")}`,
  measure: (value, digits) => value.toFixed(digits).replace(".", ","),
  sector: (key) => (key === "Information Technology" ? "Bilgi Teknolojileri" : key),
};
const enFormat: LeadFormat = {
  percent: (value) => `${value.toFixed(1)}%`,
  measure: (value, digits) => value.toFixed(digits),
  sector: (key) => key,
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

const texts = (list: LeadFact[]) => list.map(leadText);

test("kısa okumalar: ölçülerden kurulur, iki dilde, sayı kalın parça", () => {
  assert.deepEqual(texts(composeAnalysisFacts(facts, portfolioAnalysisVisualsTr.lead, trFormat)), [
    "Bilgi Teknolojileri: portföyde %97,5, S&P 500'de %37,8.",
    "5 pozisyon, eşit ağırlıklı 2,7 pozisyon gibi dağılıyor.",
    "Geçen yılki oynaklık S&P 500'ün 6,7 katı.",
  ]);
  assert.deepEqual(texts(composeAnalysisFacts(facts, portfolioAnalysisVisualsEn.lead, enFormat)), [
    "Information Technology: 97.5% of the portfolio, 37.8% of the S&P 500.",
    "5 positions spread like 2.7 equal-weight positions.",
    "Last year's volatility was 6.7 times the S&P 500's.",
  ]);
  const sector = composeAnalysisFacts(facts, portfolioAnalysisVisualsTr.lead, trFormat)[0]!;
  assert.deepEqual(
    sector.parts.filter((part) => part.strong).map((part) => part.text),
    ["Bilgi Teknolojileri", "%97,5", "%37,8"],
  );
});

test("kısa okumalar: eksik veri o cümleyi düşürür, tek pozisyon kendi kalıbında", () => {
  const bare = { ...facts, sector: null, volatility: null };
  assert.deepEqual(texts(composeAnalysisFacts(bare, portfolioAnalysisVisualsTr.lead, trFormat)), [
    "5 pozisyon, eşit ağırlıklı 2,7 pozisyon gibi dağılıyor.",
  ]);
  const single = { ...bare, count: 1, effective: 1 };
  assert.deepEqual(texts(composeAnalysisFacts(single, portfolioAnalysisVisualsTr.lead, trFormat)), ["Portföy tek pozisyon: MU."]);
  /* S&P oynaklığı sıfırsa oran basılmaz. */
  const flat = { ...facts, volatility: { portfolio: 10, benchmark: 0 } };
  assert.ok(!texts(composeAnalysisFacts(flat, portfolioAnalysisVisualsTr.lead, trFormat)).join(" ").includes("katı"));
});

test("şablon parçaları: tanınmayan yer tutucu düz metin kalır", () => {
  assert.deepEqual(fillParts("{a} ve {b}", { a: "X" }), [
    { text: "X", strong: true },
    { text: " ve ", strong: false },
    { text: "{b}", strong: false },
  ]);
});

test("etkin pozisyon kutuları: tam kutular, kesirli son kutu, tavan", () => {
  assert.deepEqual(effectivePips(5, 2.7)!.map((value) => Number(value.toFixed(2))), [1, 1, 0.7, 0, 0]);
  assert.deepEqual(effectivePips(3, 3), [1, 1, 1]);
  /* Etkin sayı pozisyon sayısını aşamaz; eksi ya da sıfır pozisyon boş. */
  assert.deepEqual(effectivePips(2, 5), [1, 1]);
  assert.equal(effectivePips(0, 0), null);
  assert.equal(effectivePips(PIP_MAX + 1, 4), null);
  assert.equal(effectivePips(PIP_MAX, 4)!.length, PIP_MAX);
});

test("okumalar ve görsel künyeler öneri kipi taşımaz (SPK çizgisi)", () => {
  for (const [dict, locale, format] of [
    [portfolioAnalysisVisualsTr, "tr", trFormat],
    [portfolioAnalysisVisualsEn, "en", enFormat],
  ] as const) {
    assert.ok(isAdviceFree(texts(composeAnalysisFacts(facts, dict.lead, format)).join(" "), locale));
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
  /* Okumadaki "6,7 katı" kartın "6,7 Kat"ıyla aynı oran. */
  assert.ok(texts(composeAnalysisFacts(facts, portfolioAnalysisVisualsTr.lead, trFormat)).join(" ").includes("6,7 katı"));
});
