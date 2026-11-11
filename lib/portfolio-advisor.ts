import "server-only";
import { unstable_cache } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { memberClient } from "@/lib/claude-budget";
import type { Locale } from "@/lib/i18n/config";
import {
  AdvisorSchema,
  advisorInput,
  checkAdvisor,
  monthlyMeasures,
  type AdvisorHorizon,
  type AdvisorText,
  type MonthlyMeasures,
} from "@/lib/portfolio-advisor-model";
import { getUserAnalysis } from "@/lib/portfolio-analysis";
import { noteInput } from "@/lib/portfolio-analysis-note";
import { getPortfolioScan } from "@/lib/portfolio-scan";
import type { ScanRow } from "@/lib/portfolio-scan-model";
import { callClaude, completedDailyBars, insightsConfigured } from "@/lib/stock-insights";

/**
 * PORTFÖY DANIŞMANI — sunucu (11 Kasım). Gerekçe ve hukuki çizgi
 * lib/portfolio-advisor-model.ts başında: YALNIZ site sahibi.
 *
 * Girdi iki hazır kaynaktan, yeni sağlayıcı isteği açmadan: günlük
 * taramanın pozisyon satırları (`getPortfolioScan` — aynı gün zaten
 * önbellekte) ve /portfoy/analiz'in bir yıllık risk ölçüleri
 * (`getUserAnalysis` + `noteInput`, ekranla aynı biçim). Aylıkta ek olarak
 * SPY'nin tamamlanmış barları (S&P 500 karşılaştırması).
 *
 * ÖNBELLEK: günlük — seans + pozisyon parmak izi (her gün bir kez); aylık —
 * takvim ayı + parmak izi (ayda bir kez, pozisyon değişince yeniden). İkisi
 * de sahibin bütçe kimliğiyle (`memberClient`).
 */

export type AdvisorReport = {
  horizon: AdvisorHorizon;
  text: AdvisorText;
  session: string;
  monthly: MonthlyMeasures | null;
  generatedAt: string;
};

const SYSTEM = {
  tr: `Açılış Zili'nin sahibi için KİŞİSEL PORTFÖY DANIŞMANISIN. Bu metni yalnız portföyün sahibi okuyor ve açıkça senden danışmanlık, net öneri istiyor: neyi azaltmalı, neyi eklemeli, nasıl çeşitlendirmeli, neye dikkat etmeli. Kararsız, kaçamak cümle kurma; gerekçeli ve net ol.

Ufuk girdide (horizon): "günlük" ise son seans ve önümüzdeki günler; "aylık (son 21 seans)" ise son 21 seansın değerlendirmesi, S&P 500 ile karşılaştırma, getiriye katkı yapan ve götüren pozisyonlar ve önümüzdeki ay için yeniden dengeleme.

Çıktı:
- headline: tek cümle, en çok 14 kelime, sonunda nokta yok — günün/ayın en önemli tavsiyesi.
- summary: 2-3 cümle, en çok 60 kelime.
- actions: öncelik sırasıyla 3-5 eylem. kind: trim (azalt / kâr al), add (ekle), diversify (çeşitlendir), hedge (riski sınırla), hold (koru), watch (izle). symbol: ilgili hisse (yoksa null). title: kısa, Title Case, en çok 6 kelime. detail: 2-3 cümle; NEDEN (ölçüler, teknik görüş, ağırlık, risk) ve NASIL (hedef ağırlık yalnız referenceWeights listesinden, örn. "%25'e indir").
- risks: en çok 3 risk (title kısa ve Title Case, detail 1-2 cümle).
- outlook: tek paragraf, en çok 45 kelime — önümüzdeki dönemde neyi izlemeli.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay yazma; hesap yapma (yüzde, fiyat, hedef türetme yok). Sayıyı verilen biçimde aynen yaz. Hedef ağırlık yalnız referenceWeights'ten.
- Risk ölçüleri "bugünkü ağırlıklarla geçen yıl"; gerçek geçmiş getirin gibi anlatma.
- Kesin fiyat tahmini yok ("kesin yükselir" değil). Sakin, net Türkçe; "sen" diye hitap et. Ünlem, emoji, madde işareti yok.`,
  en: `You are the PERSONAL PORTFOLIO ADVISOR for the owner of Açılış Zili. Only the portfolio's owner reads this and explicitly asks you for advice and clear recommendations: what to trim, what to add, how to diversify, what to watch. No hedging boilerplate; be clear and give reasons.

The horizon is in the input: "daily" covers the last session and the days ahead; "monthly (last 21 sessions)" reviews the last 21 sessions versus the S&P 500, the contributors and detractors, and rebalancing for the month ahead.

Output:
- headline: one sentence, at most 14 words, no trailing period: the most important recommendation.
- summary: 2-3 sentences, at most 60 words.
- actions: 3-5 actions in priority order. kind: trim, add, diversify, hedge, hold, watch. symbol: the stock (null if none). title: short, Title Case, at most 6 words. detail: 2-3 sentences: WHY (measures, technical view, weight, risk) and HOW (target weights only from referenceWeights, e.g. "cut to 25%").
- risks: at most 3 (short Title Case title, 1-2 sentence detail).
- outlook: one paragraph, at most 45 words: what to watch next.

Rules:
- Use ONLY the data given; no number, date or event not given; no computation (no derived percentages, prices or targets). Copy numbers exactly as formatted. Target weights only from referenceWeights.
- Risk measures apply today's weights to the past year; do not present them as actual past returns.
- No certain price predictions. Calm, clear English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

const failures = new Map<string, number>();
const FAILURE_TTL = 20 * 60_000;

function dayLabel(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

async function write(horizon: AdvisorHorizon, rows: ScanRow[], risk: unknown, session: string, locale: Locale, client: string): Promise<AdvisorReport> {
  let monthly: MonthlyMeasures | null = null;
  if (horizon === "monthly") {
    const spy = await completedDailyBars("SPY").catch(() => null);
    monthly = monthlyMeasures(rows, (spy ?? []).map((b) => b.close));
  }
  const input = advisorInput(horizon, rows, risk, monthly, locale, dayLabel(session, locale));
  const out = await callClaude(SYSTEM[locale], AdvisorSchema, input, client);
  if (!out) throw new Error("no-output");
  const checked = checkAdvisor(out, input, rows.map((r) => r.symbol));
  if (!checked.ok) throw new Error(checked.reason);
  return { horizon, text: checked.text, session, monthly, generatedAt: new Date().toISOString() };
}

/** Yalnız site sahibinin oturumunda dolu; başka her okurda `null`. */
export async function getAdvisorReport(userId: string, horizon: AdvisorHorizon, locale: Locale): Promise<AdvisorReport | null> {
  if (!insightsConfigured()) return null;
  if ((await getAdmin())?.userId !== userId) return null;
  const [scan, loaded] = await Promise.all([getPortfolioScan(userId, locale), getUserAnalysis(userId)]);
  if (!scan || scan.rows.length === 0) return null;
  const analysis = loaded.ok ? loaded.analysis : null;
  const riskJson = analysis ? noteInput(analysis, locale) : null;
  const risk = riskJson ? JSON.parse(riskJson) : null;
  const fingerprint = analysis?.fingerprint ?? scan.rows.map((r) => `${r.symbol}:${r.weight.toFixed(1)}`).join("|");
  const period = horizon === "daily" ? scan.session : scan.session.slice(0, 7);
  const failKey = `${userId}:${horizon}:${locale}:${period}`;
  const failed = failures.get(failKey);
  if (failed && Date.now() - failed < FAILURE_TTL) return null;
  try {
    return await unstable_cache(
      () => write(horizon, scan.rows, risk, scan.session, locale, memberClient(userId)),
      ["portfolio-advisor-v1", horizon, userId, period, fingerprint, locale],
      { revalidate: horizon === "daily" ? 24 * 3600 : 31 * 24 * 3600, tags: ["portfolio-advisor"] },
    )();
  } catch (error) {
    failures.set(failKey, Date.now());
    console.error(`[portföy danışmanı] ${horizon} ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return null;
  }
}
