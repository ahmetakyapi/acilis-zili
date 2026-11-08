import test from "node:test";
import assert from "node:assert/strict";
import { fallbackDraft, fallbackDrafts, type FallbackContext, type FallbackRow } from "../lib/daily-chart-fallback";
import { bodyProblem, checkChartBlock, groundingSource, signedPct } from "../lib/daily-chart";
import { ungroundedNumbers } from "../lib/ai-grounding";

/* Günün Grafiği'nin yedeği (lib/daily-chart-fallback.ts): şablon, yazma
   yolunun kurallarını (tek blok, 50–160 kelime) ve sayı denetimini
   KENDİSİ geçmeli — uç bu taslağı aynı denetimlerden geçirip yazıyor. */

const SECTORS: [string, string, string, number][] = [
  ["XLK", "Teknoloji", "Technology", 1.234],
  ["XLF", "Finans", "Financials", 0.41],
  ["XLV", "Sağlık", "Health Care", -0.2],
  ["XLY", "İsteğe Bağlı Tüketim", "Consumer Discretionary", 0.88],
  ["XLP", "Temel Tüketim", "Consumer Staples", -0.55],
  ["XLE", "Enerji", "Energy", -1.876],
  ["XLI", "Sanayi", "Industrials", 0.12],
  ["XLB", "Hammadde", "Materials", 0.05],
  ["XLU", "Kamu Hizmetleri", "Utilities", -0.31],
  ["XLRE", "Gayrimenkul", "Real Estate", 0.66],
  ["XLC", "İletişim Hizmetleri", "Communication Services", 0.97],
];

function row(symbol: string, tr: string, en: string, pct: number | null): FallbackRow {
  return { symbol, name_tr: tr, name_en: en, d1: pct === null ? null : { pct: signedPct(pct) } };
}

function context(overrides: Partial<FallbackContext> = {}, sectorPcts?: (number | null)[]): FallbackContext {
  const sectors = SECTORS.map(([s, tr, en, pct], i) => row(s, tr, en, sectorPcts ? sectorPcts[i] : pct));
  const knownRows = sectors.filter((r) => r.d1 !== null);
  return {
    indices: [
      row("QQQ", "Nasdaq 100", "Nasdaq 100", 0.61),
      row("SPY", "S&P 500", "S&P 500", 0.42),
      row("DIA", "Dow Jones", "Dow Jones", -0.12),
      row("IWM", "Russell 2000", "Russell 2000", 0),
    ],
    sectors,
    sectors_tally: {
      total: sectors.length,
      known: knownRows.length,
      up: knownRows.filter((r) => r.d1!.pct.value > 0).length,
      down: knownRows.filter((r) => r.d1!.pct.value < 0).length,
    },
    breadth: { advancing: 312, declining: 188 },
    movers: {
      gainers: [{ symbol: "SNDK", name: "Sandisk", pct: signedPct(12.3456) }],
      losers: [{ symbol: "ALAB", name: "Astera Labs", pct: signedPct(-19.62) }],
    },
    ...overrides,
  };
}

test("yedek grafik: yazma yolunun blok ve kelime kuralını geçer, iki dilde", () => {
  const drafts = fallbackDrafts(context());
  assert.ok(drafts);
  for (const draft of drafts) {
    const block = checkChartBlock(draft.chart_md, draft.locale);
    assert.ok(block.ok, `${draft.locale}: ${block.ok ? "" : block.reason}`);
    assert.equal(bodyProblem(draft.body_md), null, draft.locale);
    assert.ok(draft.title.length <= 140);
  }
});

test("yedek grafik: her sayı bağlam paketinde geçiyor (uçtaki denetim)", () => {
  const ctx = context();
  for (const draft of fallbackDrafts(ctx)!) {
    const written = [draft.title, draft.chart_md, draft.body_md].join("\n");
    assert.deepEqual(ungroundedNumbers(written, groundingSource({ ...ctx, recent_charts: undefined })), [], draft.locale);
  }
});

test("yedek grafik: sektörler büyükten küçüğe, değer paketteki yazılış", () => {
  const tr = fallbackDraft(context(), "tr")!;
  const lines = tr.chart_md.split("\n");
  assert.equal(lines[0], "::: bar Sektör Fonları, Günlük Değişim %");
  assert.equal(lines[1], "Teknoloji | +1,23");
  assert.equal(lines[lines.length - 2], "Enerji | -1,88");
  assert.equal(tr.title, "Sektörlerde Gün: Teknoloji Önde, Enerji Geride");
  const en = fallbackDraft(context(), "en")!;
  assert.ok(en.chart_md.includes("Technology | +1.23"));
  assert.equal(en.title, "Sectors: Technology Led, Energy Lagged");
});

test("yedek grafik: metin S&P 500 ile açılır, otomatik olduğunu söyler", () => {
  const tr = fallbackDraft(context(), "tr")!;
  assert.ok(tr.body_md.startsWith("S&P 500 günü %0,42 yükselişle kapattı."));
  assert.ok(tr.body_md.includes("Dow Jones −%0,12"));
  assert.ok(tr.body_md.includes("11 sektör fonundan 7 tanesi yükselişte, 4 tanesi düşüşte kapandı."));
  assert.ok(tr.body_md.includes("otomatik derlendi"));
  const en = fallbackDraft(context(), "en")!;
  assert.ok(en.body_md.startsWith("The S&P 500 rose 0.42% on the day."));
  assert.ok(en.body_md.includes("compiled automatically"));
});

test("yedek grafik: tek yönlü günde başlık yönü söyler", () => {
  const allDown = context({}, SECTORS.map(() => -0.5).map((v, i) => v - i / 10));
  assert.match(fallbackDraft(allDown, "tr")!.title, /^Sektörlerde Düşüş Günü: En Sert Düşen /);
  const allUp = context({}, SECTORS.map((_, i) => 0.2 + i / 10));
  assert.match(fallbackDraft(allUp, "en")!.title, /^Broad Gains Across Sectors, Led by /);
});

test("yedek grafik: genişlik ve öne çıkanlar yoksa da 50 kelimeyi geçer", () => {
  const thin = context({ breadth: null, movers: null });
  for (const draft of fallbackDrafts(thin)!) assert.equal(bodyProblem(draft.body_md), null, draft.locale);
});

test("yedek grafik: tek sektör eksikse ya da endeks yoksa yazılmaz", () => {
  const pcts: (number | null)[] = SECTORS.map(([, , , pct]) => pct);
  pcts[3] = null;
  assert.equal(fallbackDrafts(context({}, pcts)), null);
  assert.equal(fallbackDrafts(context({ indices: [] })), null);
});
