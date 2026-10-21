import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { numbersGroundedAcrossLocales, ungroundedNumbers } from "@/lib/ai-grounding";
import { compareNoteKey, completedCloses, rankByReturn, seriesStats, type SeriesStats } from "@/lib/compare-note-core";
import type { CompareRange } from "@/lib/compare";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getChartBarsMulti } from "@/lib/providers";
import { getRawMetrics } from "@/lib/providers/finnhub-depth";
import { storedMetricsFrom } from "@/lib/scorecard";
import { industryLabel, sectorLabel } from "@/lib/sectors";
import { callClaude, expectedLastSession, remembered, UngroundedError, type InsightText } from "@/lib/stock-insights";
import { formatPercentPlain, formatPercentText, peRatioOf } from "@/lib/utils";

/**
 * CLAUDE KARŞILAŞTIRMA NOTU (18 Ekim, sahibinin isteği) — /karsilastir'da
 * seçili 2–4 hisse ve seçili aralık için kısa bir karşılaştırma: her biri
 * aralıkta nasıl hareket etti, birbirine ve S&P 500'e göre nerede durdu,
 * oynaklık ve en derin düşüş, temel ölçülerden iki-üç karşıtlık.
 *
 * Kalıp hisse notlarıyla AYNI (lib/stock-insights.ts): ortak `callClaude`
 * (model + sunucu tarafı yedek, ortak günlük tavan), `remembered` başarısızlık
 * hafızası, `unstable_cache`, iki dilde biçimlenmiş sayılar ve sayı denetimi
 * (lib/ai-grounding.ts → `numbersGroundedAcrossLocales`); tek sayı tutmazsa
 * not düşer.
 *
 * YAZMA KATMANI (CLAUDE.md "Veri dürüstlüğü" 4):
 * - Barlar `allowCache: false` ile (bayat önbellek kabul edilmez) ve yalnız
 *   TAMAMLANMIŞ seanslar (lib/compare-note-core.ts → `completedCloses`).
 *   Bir sembolün serisi son tamamlanmış seansa ulaşmıyorsa not YAZILMAZ —
 *   eksik sembolü sessizce atıp üç hisselik bir notu dört hisselik ekranın
 *   altına koymak da yanlış olurdu.
 * - Getiri, düşüş, oynaklık, farklar ve sıralama KODDA hesaplanır; Claude
 *   hesap yapmaz.
 * - Ekranın grafiği seans sürerken anlık fiyatı da çiziyor; not son
 *   tamamlanmış seansta biter ve kart penceresini bu yüzden kendisi yazar.
 * - Not dolar bazında: para birimi düğmesi (TL, reel TL) notu değiştirmez,
 *   kart bunu künyesinde söyler.
 *
 * MALİYET: anahtar sıralı semboller + aralık + son tamamlanmış seans
 * (`compareNoteKey`); 36 saat önbellekte. Aynı seçim ve aralığı soran ikinci
 * okur Claude'a gitmez; süreç içinde uçuştaki aynı anahtar da bir kez
 * çağrılır (`remembered`). Tavan hisse notlarıyla ortak (`INSIGHT_DAILY_CAP`).
 */

export type CompareNote = {
  symbols: string[];
  range: CompareRange;
  /** Pencere: en erken serinin ilk ve son noktası (son tamamlanmış seans). */
  from: string;
  to: string;
  /** 5Y haftalık barlarla — kart "haftalık" künyesini basar. */
  weekly: boolean;
  stats: SeriesStats[];
  /** SPY aynı pencerede; seri yoksa null. */
  market: SeriesStats | null;
  text: { tr: InsightText; en: InsightText };
  generatedAt: string;
};

const Lang = z.object({
  summary: z.string(),
  points: z.array(z.object({ title: z.string(), detail: z.string() })),
});
const NoteSchema = z.object({ tr: Lang, en: Lang });

const SYSTEM = `You write a short, neutral comparison note for Açılış Zili (a Turkish site for individual investors following US stocks) on its compare screen, where a reader has put 2–4 stocks side by side over a chosen period.

Return tr / en, each with:
- summary: at most 3 sentences, at most 60 words — how the stocks moved over the period against each other and, if supplied, against the S&P 500.
- points: 3–4 points, each title at most 6 words, detail at most 32 words. One point on the path (volatility and the deepest drawdown, if supplied); two or three points contrasting the companies on the supplied fundamentals (valuation, growth, margins, balance sheet) or their sectors. Pick contrasts where the supplied figures actually differ.

Rules:
- Use ONLY the supplied JSON. Never invent figures, dates, prices, events, causes, guidance or analyst views. If a field is null or missing, it is unknown; do not mention it.
- Numbers: copy them exactly as formatted in the input for that language (each number is given as {tr, en}). Do not compute anything (no differences, ratios, sums, averages or rankings of your own): the differences and the ranking you may need are supplied.
- Describe, do not judge: never say which stock is better, cheaper in a recommending sense, or which to buy, sell or hold. No predictions of price direction, no "opportunity", no targets. A higher multiple or volatility is a fact to state, not a verdict.
- Plain, calm newspaper prose; no exclamation marks, emoji or hype. Refer to companies by name or symbol.
- If a stock's series starts later than the period (seriesStart differs from the window), say its figures cover a shorter span.
- Write the "tr" object in natural, everyday Turkish financial language as used in Turkish financial media (getiri, oynaklık, en derin düşüş, F/K, gelir büyümesi, net kâr marjı). Point titles are short labels in Title Case (Turkish: "Değerlemede Belirgin Fark"; conjunctions ve/ile lowercase). Summaries are normal sentences.
- Write the "en" object in plain English with the same content.`;

const both = (format: (locale: "tr" | "en") => string) => ({ tr: format("tr"), en: format("en") });
const pct = (value: number, digits = 2) => both((l) => formatPercentText(value, l, digits));
const plainPct = (value: number, digits = 1) => both((l) => formatPercentPlain(value, l, digits));
const num = (value: number, digits: number, l: "tr" | "en") =>
  new Intl.NumberFormat(l === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const points = (value: number) => both((l) => `${num(Math.abs(value), 2, l)} ${l === "tr" ? "puan" : "points"}`);
const multiple = (value: number) => both((l) => (l === "tr" ? `${num(value, 1, l)} kat` : `${num(value, 1, l)}x`));
const day = (date: string) =>
  both((l) =>
    new Intl.DateTimeFormat(l === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${date}T12:00:00Z`),
    ),
  );

const MARKET = "SPY";

type Built = { key: string; input: string; meta: Omit<CompareNote, "text" | "generatedAt"> };

async function build(symbols: string[], range: CompareRange): Promise<Built | null> {
  const [status, expected] = await Promise.all([getStatus(), expectedLastSession()]);
  const weekly = range === "5Y";
  const wanted = symbols.includes(MARKET) ? symbols : [...symbols, MARKET];
  const [bars, daily, names, ...metrics] = await Promise.all([
    getChartBarsMulti(wanted, range, status, { allowCache: false }),
    /* 5Y'nin son yarım haftası yerine son tamamlanmış seansın kapanışı. */
    weekly ? getChartBarsMulti(wanted, "1M", status, { allowCache: false }) : Promise.resolve({} as Awaited<ReturnType<typeof getChartBarsMulti>>),
    getSymbolNames(symbols),
    ...symbols.map((symbol) => getRawMetrics(symbol)),
  ]);

  const statsOf = (symbol: string) => {
    const closes = completedCloses(bars[symbol], expected, { weekly, daily: daily[symbol] });
    return closes ? seriesStats(symbol, closes, weekly) : null;
  };
  const stats = symbols.map(statsOf);
  if (stats.some((s) => s === null)) return null;
  const list = stats as SeriesStats[];
  const market = statsOf(MARKET);
  const from = list.reduce((min, s) => (s.from < min ? s.from : min), list[0]!.from);
  const ranked = rankByReturn(list);
  const best = list.find((s) => s.symbol === ranked[0])!;
  const worst = list.find((s) => s.symbol === ranked[ranked.length - 1])!;

  const payload = {
    window: { range, firstPoint: day(from), lastCompletedSession: day(expected), weeklyBars: weekly },
    sp500: market
      ? {
          proxy: "SPY",
          periodReturn: pct(market.returnPct),
          deepestDrawdown: pct(market.drawdownPct, 1),
          annualizedVolatility: market.volatilityPct === null ? null : plainPct(market.volatilityPct),
        }
      : null,
    rankingByReturn: ranked,
    bestMinusWorst: ranked.length > 1 ? { best: best.symbol, worst: worst.symbol, gap: points(best.returnPct - worst.returnPct) } : null,
    stocks: list.map((s, i) => {
      const meta = names[s.symbol];
      const metric = metrics[i];
      const raw = metric?.ok ? metric.data : null;
      const m = raw ? storedMetricsFrom(raw) : null;
      const forwardPe = raw && typeof raw.forwardPE === "number" && Number.isFinite(raw.forwardPE) && raw.forwardPE > 0 ? raw.forwardPE : null;
      /* F/K yalnız dolarla raporlayanda ve son TAMAMLANMIŞ kapanıştan
         (yazma katmanı): ADR'de hisse başı kâr ana borsanın parasında. */
      const usd = !meta?.currency || meta.currency === "USD";
      const lastClose = completedCloses(bars[s.symbol], expected, { weekly, daily: daily[s.symbol] })!.at(-1)!.close;
      const pe = usd && m ? peRatioOf(lastClose, m.epsTTM) : null;
      const vsMarket = market && market.from === s.from ? s.returnPct - market.returnPct : null;
      const fundamentals = m
        ? Object.fromEntries(
            Object.entries({
              trailingPE: pe === null ? null : multiple(pe),
              forwardPE: forwardPe === null ? null : multiple(forwardPe),
              revenueGrowthYoY: m.revenueGrowthTTMYoy === null ? null : pct(m.revenueGrowthTTMYoy, 1),
              epsGrowthYoY: m.epsGrowthTTMYoy === null ? null : pct(m.epsGrowthTTMYoy, 1),
              operatingMargin: m.operatingMarginTTM === null ? null : pct(m.operatingMarginTTM, 1),
              netMargin: m.netProfitMarginTTM === null ? null : pct(m.netProfitMarginTTM, 1),
              returnOnEquity: m.roeTTM === null ? null : pct(m.roeTTM, 1),
              debtToEquity: m.debtToEquity === null ? null : both((l) => num(m.debtToEquity!, 2, l)),
            }).filter(([, value]) => value !== null),
          )
        : {};
      return {
        symbol: s.symbol,
        company: meta?.name ?? s.symbol,
        sector: meta?.sector ? { tr: sectorLabel(meta.sector, "tr"), en: sectorLabel(meta.sector, "en") } : null,
        industry: meta?.industry ? { tr: industryLabel(meta.industry, "tr"), en: industryLabel(meta.industry, "en") } : null,
        seriesStart: s.from === from ? null : day(s.from),
        periodReturn: pct(s.returnPct),
        vsSp500: vsMarket === null ? null : { position: Math.abs(vsMarket) < 0.005 ? "inline" : vsMarket > 0 ? "above" : "below", gap: points(vsMarket) },
        deepestDrawdown: { value: pct(s.drawdownPct, 1), troughSession: day(s.troughDate) },
        annualizedVolatility: s.volatilityPct === null ? null : plainPct(s.volatilityPct),
        fundamentals: Object.keys(fundamentals).length > 0 ? { basis: "trailing twelve months", ...fundamentals } : null,
      };
    }),
  };

  return {
    key: compareNoteKey(symbols, range, expected),
    input: JSON.stringify(payload),
    meta: { symbols, range, from, to: expected, weekly, stats: list, market },
  };
}

const toText = (lang: z.infer<typeof Lang>): InsightText => ({
  summary: lang.summary.trim(),
  points: lang.points.slice(0, 4).map((p) => ({ title: p.title.trim(), detail: p.detail.trim(), source: null })),
});

/** `symbols` sıralı ve tekrarsız gelir (`noteSymbols`, lib/compare-note-core.ts);
    `client` anonim isteğin bütçe kimliği (lib/stock-insights.ts → callClaude).
    UÇUŞ TEK KATMAN (20 Ekim): önünde ayrı bir `inflight` haritası vardı;
    `remembered` aynı anahtarı (`compare:{key}`) zaten paylaştırıyor, dış
    katman ise ilk okurun pay reddini katılanlara null diye geçiriyordu —
    `remembered`ın katılana kendi kimliğiyle yeniden deneme hakkını atlatarak. */
export async function getCompareNote(symbols: string[], range: CompareRange, client?: string): Promise<{ note: CompareNote | null; key: string | null }> {
  let built: Built | null;
  try {
    built = await build(symbols, range);
  } catch {
    return { note: null, key: null };
  }
  if (!built) return { note: null, key: null };
  const b = built;
  const note = await remembered("compare", b.key, async () => {
    const cached = await unstable_cache(
      async (): Promise<CompareNote> => {
        const out = await callClaude(SYSTEM, NoteSchema, b.input, client);
        if (!out) throw new Error("no-output");
        const text = { tr: toText(out.tr), en: toText(out.en) };
        const all = [text.tr, text.en].flatMap((t) => [t.summary, ...t.points.flatMap((p) => [p.title, p.detail])]).join(" ");
        if (!numbersGroundedAcrossLocales(all, b.input)) throw new UngroundedError(ungroundedNumbers(all, b.input));
        return { ...b.meta, text, generatedAt: new Date().toISOString() };
      },
      ["compare-note-v2", b.key],
      { revalidate: 36 * 3600, tags: ["stock-insight"] },
    )();
    /* Figürün sayıları her istekte aynı seans barlarından (hisse notuyla aynı). */
    return { ...cached, ...b.meta };
  });
  return { note, key: b.key };
}
