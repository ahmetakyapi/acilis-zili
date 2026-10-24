import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { adviceMatches } from "@/lib/advice-guard";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { memberClient } from "@/lib/claude-budget";
import type { Locale } from "@/lib/i18n/config";
import type { PortfolioAnalysis } from "@/lib/portfolio-analysis";
import { getUserAnalysis } from "@/lib/portfolio-analysis";
import { sectorLabel } from "@/lib/sectors";
import { callClaude, insightsConfigured } from "@/lib/stock-insights";
import { formatMeasure } from "@/lib/portfolio-risk";
import { formatPercentPlain, formatPercentText } from "@/lib/utils";

/**
 * CLAUDE'UN RİSK OKUMASI (24 Ekim) — /portfoy/analiz'in metin paneli.
 *
 * Portföy notunun (lib/portfolio-note.ts — ağırlık, son beş seans,
 * yaklaşan bilanço) TEKRARI DEĞİL: bu metin risk tarafını anlatır —
 * oynaklık ve beta, yoğunlaşma, korelasyonun anlamı, S&P 500'e göre eksik
 * sektörlerin çeşitlendirmeye etkisi, kur etkisi. Girdi YALNIZ sunucunun
 * deterministik ölçüleri (lib/portfolio-risk.ts), biçimlenmiş hâlde.
 *
 * İKİ SON KONTROL, ikisi de metni düşürür (ölçüler ekranda kalır):
 *  1. Sayı: çıktıdaki her sayı girdide geçer (lib/ai-grounding.ts).
 *  2. Tavsiye: "almalısın / öneririm / you should buy" kalıpları
 *     (lib/advice-guard.ts). Kişiye özel al/sat önerisi SPK lisanslı
 *     yatırım danışmanlığıdır; prompt çizgiyi verir, denetim onu korur.
 *
 * MALİYET portföy notunun kuralı: önbellek okur + seans günü + pozisyon
 * parmak izi + dil; çağrı okurun bütçe kimliğiyle (`memberClient`, günde
 * `MEMBER_DAILY_CALLS`, lib/claude-budget.ts) ve küresel tavandan. Not
 * istemciden, panel görünüme girince istenir; uç oturum ister, botlara kapalı.
 */

export type AnalysisNote = {
  paragraphs: string[];
  session: string;
  generatedAt: string;
};

const LEGAL_TR = `HUKUKİ ÇİZGİ (kesin): Türkiye'de kişiye özel al/sat önerisi SPK lisanslı yatırım danışmanlığıdır ve bu site lisanslı değildir. Bu yüzden:
- Hiçbir hisseyi, fonu ya da sektörü almayı, satmayı, eklemeyi, azaltmayı ÖNERME. "almalısın", "satmalısın", "eklemelisin", "azaltmalısın", "çeşitlendirmelisin", "öneririm", "tavsiye ederim", "düşünebilirsin" gibi kalıplar YASAK; emir kipi yok.
- Ölç, karşılaştır, açıkla: "teknoloji ağırlığı S&P 500'deki payın üstünde" gibi gözlem; "çeşitlendirme genelde portföy oynaklığını düşürür çünkü..." gibi genel mekanizma anlatımı serbest.
- Eksik sektörlerden söz ederken yalnız bunun riski nasıl değiştirdiğini anlat; hangi hisseyi alması gerektiğini söyleme, hisse adı önerme.`;

const LEGAL_EN = `LEGAL LINE (strict): in Türkiye, personalised buy/sell advice is licensed investment advisory (Capital Markets Board) and this site is not licensed. Therefore:
- Never recommend buying, selling, adding or trimming any stock, fund or sector. Phrases like "you should buy/sell/add/trim/diversify", "I recommend", "consider buying" are FORBIDDEN; no imperatives.
- Measure, compare, explain: observations such as "the technology weight is above its S&P 500 share", and general mechanisms such as "diversification usually lowers portfolio volatility because..." are fine.
- When discussing missing sectors, explain only how that affects risk; never say which stock the reader should buy and never name stocks to buy.`;

const SYSTEM = {
  tr: `Açılış Zili'nde okurun KENDİ PORTFÖYÜNÜN risk ölçülerini sade Türkçeyle anlatıyorsun. 3 ya da 4 kısa paragraf yaz (her biri en çok 60 kelime): portföyün risk profili (oynaklık, beta, en büyük düşüş; S&P 500 ile karşılaştır), yoğunlaşma riski (en büyük pozisyon, ilk beşin payı, etkin pozisyon sayısı ne anlama gelir), korelasyon (birlikte hareket eden pozisyonlar çeşitlendirmeyi neden zayıflatır), S&P 500'e göre eksik ve ağır sektörlerin çeşitlendirmeye etkisi, ve kur etkisi (dolar getirisi ile lira getirisi farkı; veri varsa mutlaka değin). Veri yoksa o konuyu atla.

${LEGAL_TR}

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay ya da sebep yazma, hesap yapma. Sayıyı verilen biçimde aynen yaz: yuvarlama, aralığa çevirme ("%9 ile %12 arası" değil, "%9,0 ile %12,1").
- Ölçüler "bugünkü ağırlıklarla geçen yıl" hesaplandı; okurun gerçek geçmiş getirisi gibi anlatma.
- Fiyat yönü tahmini yok. Sakin, günlük Türkçe; "sen" diye hitap edebilirsin. Ünlem, emoji, başlık ve madde işareti yok.`,
  en: `You explain the risk measures of the reader's OWN PORTFOLIO on Açılış Zili in plain English. Write 3 or 4 short paragraphs (each at most 60 words): the risk profile (volatility, beta, maximum drawdown; compare with the S&P 500), concentration risk (largest position, share of the top five, what the effective number of positions means), correlation (why positions that move together weaken diversification), how sectors missing or overweight versus the S&P 500 affect diversification, and the currency effect (dollar return versus lira return; always cover it when given). Skip a topic when its data is missing.

${LEGAL_EN}

Rules:
- Use ONLY the data given; no number, date, event or cause that is not given, no computation. Copy numbers exactly as formatted: no rounding, no ranges (not "9% to 12%" but "9.0% and 12.1%").
- The measures apply today's weights to the past year; do not describe them as the reader's actual past return.
- No price predictions. Calm, plain English; address the reader as "you". No exclamation marks, emoji, headings or bullet points.`,
} as const;

const Schema = z.object({ paragraphs: z.array(z.string()) });
const MAX_PARAGRAPHS = 4;
const TOP_SECTORS = 3;
const TOP_PAIRS_IN_NOTE = 3;

/** Biçimlenmiş girdi — sayılar ekrandaki biçimle aynı (tek kaynak: aynı biçimlendiriciler). */
export function noteInput(analysis: PortfolioAnalysis, locale: Locale): string | null {
  const risk = analysis.risk;
  if (!risk) return null;
  const plain = (value: number) => formatPercentPlain(value, locale, 1);
  const signed = (value: number) => formatPercentText(value, locale, 1);
  const num2 = (value: number) => formatMeasure(value, locale, 2);
  const num1 = (value: number) => formatMeasure(value, locale, 1);
  const sector = (key: string) => sectorLabel(key, locale) ?? key;
  const c = risk.concentration;
  return JSON.stringify({
    window: locale === "en" ? "past 1 year, today's weights" : "son 1 yıl, bugünkü ağırlıklarla",
    benchmark: "S&P 500",
    positions: risk.total,
    measuredPositions: risk.covered,
    concentration: {
      largest: { symbol: c.largest.symbol, weight: plain(c.largest.weight) },
      top5Share: plain(c.top5Share),
      effectivePositions: num1(c.effectiveCount),
    },
    risk: risk.risk
      ? {
          sessions: risk.risk.sessions,
          volatility: plain(risk.risk.volatility),
          sp500Volatility: plain(risk.risk.benchmarkVolatility),
          beta: num2(risk.risk.beta),
          maxDrawdown: signed(risk.risk.maxDrawdown.depth),
          sp500MaxDrawdown: signed(risk.risk.benchmarkMaxDrawdown),
        }
      : null,
    correlation: risk.correlation
      ? {
          average: num2(risk.correlation.average),
          mostTogether: risk.correlation.top.slice(0, TOP_PAIRS_IN_NOTE).map((p) => ({ pair: `${p.a} / ${p.b}`, correlation: num2(p.value) })),
          leastTogether: risk.correlation.low.map((p) => ({ pair: `${p.a} / ${p.b}`, correlation: num2(p.value) })),
        }
      : null,
    sectors: risk.sectors
      ? {
          overweight: risk.sectors.rows
            .filter((row) => row.diff > 0)
            .sort((a, b) => b.diff - a.diff)
            .slice(0, TOP_SECTORS)
            .map((row) => ({ sector: sector(row.sector), portfolio: plain(row.portfolio), sp500: plain(row.benchmark) })),
          missingOrLight: analysis.gaps.map((gap) => ({ sector: sector(gap.sector), portfolio: plain(gap.portfolio), sp500: plain(gap.benchmark) })),
          unclassified: risk.sectors.unclassified > 0 ? plain(risk.sectors.unclassified) : null,
        }
      : null,
    currency: risk.fx
      ? {
          usdReturn: signed(risk.fx.returnUsd),
          tryReturn: signed(risk.fx.returnTl),
          sp500UsdReturn: signed(risk.fx.benchmarkUsd),
          sp500TryReturn: signed(risk.fx.benchmarkTl),
          usdTryChange: signed(risk.fx.fxChange),
        }
      : null,
  });
}

const failures = new Map<string, number>();
const FAILURE_TTL = 20 * 60_000;

/** Tek çağrı + iki denetim. Önbelleksiz: geçici test yolu ve önbellekli sarmal kullanır. */
export async function writeAnalysisNote(analysis: PortfolioAnalysis, locale: Locale, client?: string): Promise<AnalysisNote> {
  const input = noteInput(analysis, locale);
  if (!input) throw new Error("no-measures");
  const out = await callClaude(SYSTEM[locale], Schema, input, client);
  const paragraphs = (out?.paragraphs ?? []).map((p) => p.trim()).filter(Boolean).slice(0, MAX_PARAGRAPHS);
  if (paragraphs.length === 0) throw new Error("no-output");
  const text = paragraphs.join(" ");
  const missing = ungroundedNumbers(text, input);
  if (missing.length) throw new Error(`ungrounded (${missing.join(" ")})`);
  const advice = adviceMatches(text, locale);
  if (advice.length) throw new Error(`advice (${advice.join(" | ")})`);
  return { paragraphs, session: analysis.input.session, generatedAt: new Date().toISOString() };
}

export async function getAnalysisNote(userId: string, locale: Locale): Promise<AnalysisNote | null> {
  if (!insightsConfigured()) return null;
  const failKey = `${userId}:${locale}`;
  const failed = failures.get(failKey);
  if (failed && Date.now() - failed < FAILURE_TTL) return null;
  const loaded = await getUserAnalysis(userId);
  if (!loaded.ok || !loaded.analysis?.risk) return null;
  const analysis = loaded.analysis;
  try {
    /* v2 (25 Ekim): girdiye aynı pencerenin S&P 500 getirileri girdi. */
    return await unstable_cache(
      () => writeAnalysisNote(analysis, locale, memberClient(userId)),
      ["portfolio-analysis-note-v2", userId, analysis.input.session, analysis.fingerprint, locale],
      { revalidate: 24 * 3600, tags: ["portfolio-analysis-note"] },
    )();
  } catch (error) {
    failures.set(failKey, Date.now());
    console.error(`[portföy analizi notu] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return null;
  }
}
