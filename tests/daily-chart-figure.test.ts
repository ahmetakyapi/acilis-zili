import test from "node:test";
import assert from "node:assert/strict";
import { checkChartBlock } from "../lib/daily-chart";
import { barSpan, chartSummary, divergingScale, sectorFundOf, summaryText, type SummaryLabels } from "../lib/daily-chart-figure";
import { dailyChartEn, dailyChartTr } from "../lib/i18n/dictionaries/daily-chart";

/* 23 Ekim'in canlı kaydının şekli: on bir sektör, +2,60 ile −1,92 arası. */
const SECTORS = `::: bar Sektörlerin Günlük Değişimi
Enerji | +2,60
Hammadde | +1,10
Sanayi | +0,84
Finans | +0,51
Sağlık | +0,20
Kamu Hizmetleri | +0,05
Gayrimenkul | -0,12
Temel Tüketim | -0,40
İletişim Hizmetleri | -0,77
İsteğe Bağlı Tüketim | -1,05
Teknoloji | -1,92
:::`;

function block(md: string, locale = "tr") {
  const check = checkChartBlock(md, locale);
  assert.ok(check.ok, check.ok ? "" : check.reason);
  return check.block;
}

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test("divergingScale: karışık işarette sıfır gerçek yerinde, ölçek tek", () => {
  const scale = divergingScale([2.6, -1.92, 0.5]);
  assert.equal(scale.lo, -1.92);
  assert.equal(scale.hi, 2.6);
  near(scale.zero, (1.92 / 4.52) * 100);
  /* Aynı büyüklük iki yönde aynı boy. */
  near(barSpan(1.5, scale).size, barSpan(-1.5, scale).size);
  /* Eksi çubuk sıfırda biter, artı sıfırdan başlar. */
  near(barSpan(-1.92, scale).start, 0);
  near(barSpan(-1, scale).start + barSpan(-1, scale).size, scale.zero);
  near(barSpan(2.6, scale).start + barSpan(2.6, scale).size, 100);
});

test("divergingScale: tek işaretli blok tek yönlü grafiğe döner", () => {
  assert.equal(divergingScale([1, 3, 2]).zero, 0);
  assert.equal(divergingScale([-1, -3]).zero, 100);
  near(barSpan(3, divergingScale([1, 3])).size, 100);
  /* Hepsi sıfır: alan çökmüyor, NaN yok. */
  const flat = divergingScale([0, 0]);
  assert.equal(flat.zero, 0);
  assert.equal(barSpan(0, flat).size, 0);
});

test("sectorFundOf: iki dilde ad, Türkçe büyük harf, eşleşmeyen null", () => {
  assert.equal(sectorFundOf("Enerji"), "XLE");
  assert.equal(sectorFundOf("  energy "), "XLE");
  assert.equal(sectorFundOf("İLETİŞİM HİZMETLERİ"), "XLC");
  assert.equal(sectorFundOf("Consumer Discretionary"), "XLY");
  assert.equal(sectorFundOf("Tüketim"), null);
  assert.equal(sectorFundOf("NVDA"), null);
  assert.equal(sectorFundOf(""), null);
});

test("chartSummary + summaryText: sektör grafiğinin cümlesi bloktaki yazılışla", () => {
  const summary = chartSummary(block(SECTORS));
  assert.deepEqual(summary, {
    kind: "signed",
    total: 11,
    up: 6,
    down: 5,
    top: { name: "Enerji", display: "+2,60" },
    bottom: { name: "Teknoloji", display: "-1,92" },
  });
  assert.equal(
    summaryText(summary!, dailyChartTr.summary),
    "11 kalemin 6 tanesi artıda, 5 tanesi ekside. En yüksek Enerji (+2,60), en düşük Teknoloji (-1,92).",
  );
});

test("chartSummary: uçlar değere göre, satır sırasına göre değil", () => {
  const summary = chartSummary(block("::: bar\nA | -0,5\nB | +3,1\nC | -2,2\n:::"));
  assert.equal(summary?.kind, "signed");
  if (summary?.kind !== "signed") return;
  assert.equal(summary.top.name, "B");
  assert.equal(summary.bottom.name, "C");
});

test("summaryText: hepsi aynı yönde, nötr, pay ve öncesi", () => {
  const labels: SummaryLabels = dailyChartEn.summary;
  const allUp = chartSummary(block("::: bar\nA | +1\nB | +2\n:::", "en"));
  assert.equal(summaryText(allUp!, labels), "All 2 items are up. Highest: B (+2); lowest: A (+1).");
  const allDown = chartSummary(block("::: bar\nA | -1\nB | -2\n:::", "en"));
  assert.match(summaryText(allDown!, labels), /^All 2 items are down\./);
  const neutral = chartSummary(block("::: bar notr Kesinti\nA | 4,1\nB | 9,0\n:::"));
  assert.equal(neutral?.kind, "ranked");
  assert.equal(summaryText(neutral!, dailyChartTr.summary), "En büyük B (9,0), en küçük A (4,1).");
  const share = chartSummary(block("::: pay\nA | %60\nB | %40\n:::"));
  assert.equal(summaryText(share!, dailyChartTr.summary), "En büyük pay A: %60.");
});
