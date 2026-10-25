import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { adviceMatches } from "@/lib/advice-guard";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { ClaudeBudgetError, memberClient } from "@/lib/claude-budget";
import type { Dictionary } from "@/lib/i18n";
import { sectorLabel } from "@/lib/sectors";
import { callClaude, insightsConfigured } from "@/lib/stock-insights";
import type { MarketDesk } from "./data";
import type { Exposure } from "./exposure";
import { day, num, pct, signedNum, signedPct, type Loc } from "./format";
import { describeCondition, type ConditionLabels } from "./rules";
import type { StoredRule } from "./store";

/**
 * CLAUDE'UN MASA YORUMU (25 Ekim) — "Masayı Yorumla" düğmesi.
 *
 * Yorum ölçüleri, tetiklenen kuralları ve geçmişte benzer rejimlerde SPY'ın
 * GERÇEK davranışını (rejime göre sonraki 20 gün, geriye dönük test)
 * anlatır. İŞLEM ÖNERMEZ: ne pozisyona özel ne genel. Tetiklenen kuralı
 * ve sitenin genel görüşünü ADIYLA aktarabilir ("'Sat Uyarısı' kuralın
 * NVDA için tetiklendi; sitenin genel teknik görüşü "TUT"") ama kendi
 * yargısını eklemez.
 *
 * İKİ SON KONTROL metni düşürür (ölçüler ekranda kalır): sayı
 * (lib/ai-grounding.ts) ve tavsiye kalıbı (lib/advice-guard.ts).
 * Etiketler ve görüşler girdide ve çıktıda TIRNAK içinde: "SAT." gibi
 * çıplak bir görüş sözcüğü emir kipi kalıbına takılırdı; tırnak onu
 * aktarılan bir ad yapar.
 *
 * MALİYET. Önbellek: kullanıcı + seans + girdinin özeti + dil, 24 saat;
 * aynı gün aynı masa ikinci kez yazdırılmaz. Çağrı kullanıcının günlük
 * Claude payından (`memberClient`, lib/claude-budget.ts) ve küresel
 * tavandan. Uç yalnız erişimi olan oturumluya açık, botlara kapalı.
 */

export type DeskNote = { paragraphs: string[]; generatedAt: string };

const LEGAL_TR = `KESİN SINIR: Türkiye'de kişiye özel al/sat önerisi SPK lisanslı yatırım danışmanlığıdır ve bu site lisanslı değildir. Bu yüzden:
- Hiçbir hisseyi, fonu, sektörü ya da pozisyonu almayı, satmayı, eklemeyi, azaltmayı, çıkarmayı, korumayı ya da beklemeyi ÖNERME. "almalısın", "satmalısın", "azaltmalısın", "öneririm", "düşünebilirsin", "fırsat" gibi kalıplar YASAK; emir kipi yok.
- Kullanıcının kural etiketlerini (ör. "Sat Uyarısı") ve sitenin genel görüşlerini (ör. "TUT") yalnız ADLARIYLA, çift tırnak içinde aktar; onlara katılma, karşı çıkma, yorum ekleme.
- Ölç, karşılaştır, açıkla: "VIX 30'un üstünde", "geçmişte Risk Kapalı rejimde SPY'ın sonraki 20 günlük medyan getirisi ..." gibi gözlem ve tarihsel istatistik serbest.`;

const LEGAL_EN = `STRICT LINE: in Türkiye personalised buy/sell advice is licensed investment advisory and this site is not licensed. Therefore:
- Never suggest buying, selling, adding, trimming, exiting, hedging or holding any stock, fund, sector or position. Phrases like "you should", "I recommend", "consider", "opportunity" are FORBIDDEN; no imperatives.
- Quote the user's rule labels (e.g. "Sell Alert") and the site's public views (e.g. "HOLD") only by NAME, in double quotes; do not agree, disagree or add judgement.
- Measure, compare, explain: observations and historical statistics are fine.`;

const SYSTEM = {
  tr: `Açılış Zili'nin Risk Masası'nı sade Türkçeyle anlatıyorsun. 3 ya da 4 kısa paragraf yaz (her biri en çok 70 kelime): bugünün rejimi ve hangi girdilerin puan yazdığı; oynaklık göstergeleri (VIX, VXN, vade eğrisi, kredi farkı, genişlik) ne söylüyor; geçmişte aynı rejimde SPY'ın sonraki 20 gününün dağılımı ve ilgili sinyallerin geriye dönük test sonuçları; portföy maruziyeti ve varsa tetiklenen kurallar. Veri yoksa o konuyu atla.

${LEGAL_TR}

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, olay ya da sebep yazma, hesap yapma. Sayıları verilen biçimde aynen yaz.
- Tarihsel istatistiği tahmin gibi anlatma: "geçmişte" de, "olacak" deme. Fiyat yönü tahmini yok.
- Sakin, günlük Türkçe; "sen" diye hitap edebilirsin. Ünlem, emoji, başlık ve madde işareti yok.`,
  en: `You explain Açılış Zili's Risk Desk in plain English. Write 3 or 4 short paragraphs (each at most 70 words): today's regime and which inputs scored points; what the volatility gauges (VIX, VXN, term structure, credit spread, breadth) say; how SPY's next 20 sessions were distributed in the same regime in the past and the backtest results of relevant signals; the portfolio exposure and any triggered rules. Skip a topic when its data is missing.

${LEGAL_EN}

Rules:
- Use ONLY the data given; no number, date, event or cause that is not given, no computation. Copy numbers exactly as formatted.
- Do not present historical statistics as a forecast: say "in the past", never "will". No price predictions.
- Calm, plain English; address the reader as "you". No exclamation marks, emoji, headings or bullet points.`,
} as const;

const Schema = z.object({ paragraphs: z.array(z.string()) });
const MAX_PARAGRAPHS = 4;
const TOP_POSITIONS = 6;

export type TriggeredRule = { rule: StoredRule; symbols: string[] };

/** Biçimlenmiş girdi — sayılar ekrandakiyle aynı biçimlendiricilerden. */
export function noteInput(
  desk: MarketDesk,
  exposure: Exposure | null,
  triggered: readonly TriggeredRule[],
  t: Dictionary["riskDesk"],
  locale: Loc,
): string | null {
  if (!desk.today) return null;
  const view = (v: "buy" | "hold" | "sell") =>
    locale === "en" ? { buy: "BUY", hold: "HOLD", sell: "SELL" }[v] : { buy: "AL", hold: "TUT", sell: "SAT" }[v];
  const regimeName = (r: string | null) => (r ? t.regime[r as "riskOn"] : null);
  const gauge = (key: string) => desk.gauges.find((g) => g.key === key);
  const labels = t.conditions as ConditionLabels;
  return JSON.stringify({
    session: day(desk.session, locale),
    regime: {
      name: regimeName(desk.today.regime),
      points: `${desk.today.points} / ${desk.today.max}`,
      sessionsInRegime: desk.streak?.sessions ?? null,
      inputs: desk.today.components.map((c) => ({
        input: t.regime.components[c.key],
        value: c.key === "term" ? num(c.value, locale) : c.key === "vixChange" || c.key === "trend" ? signedPct(c.value, locale) : c.key === "credit" ? signedNum(c.value, locale) : num(c.value, locale, 1),
        points: c.points,
        scoring: t.regime.rules[c.key],
      })),
      howRegimeIsScored: t.regime.explain,
    },
    gauges: {
      vix: num(gauge("vix")?.value, locale),
      vxn: num(gauge("vxn")?.value, locale),
      vixToVix3m: num(gauge("term")?.value, locale),
      highYieldSpread: num(gauge("credit")?.value, locale),
      highYieldSpread20dChange: signedNum(gauge("credit")?.change, locale),
      breadthAbove200: pct(gauge("breadth")?.value, locale),
      spyVs200Day: signedPct(gauge("spy200")?.value, locale),
    },
    pastSameRegime: desk.forward.map((f) => ({
      regime: regimeName(f.regime),
      days: f.days,
      next20MedianReturn: signedPct(f.median, locale),
      next20MeanReturn: signedPct(f.mean, locale),
      shareNegative: pct(f.negativeShare, locale),
      shareSawDropOf5pct: pct(f.drawdownShare, locale),
    })),
    backtest: desk.backtest
      ? {
          window: `${day(desk.backtest.from, locale)} – ${day(desk.backtest.to, locale)}`,
          baseHitRate: pct(desk.backtest.base.hitRate, locale),
          signals: desk.backtest.signals
            .filter((s) => s.scored > 0)
            .map((s) => ({
              signal: t.backtest.signals[s.key],
              triggers: s.triggers,
              next20Median: signedPct(s.longMedian, locale),
              hitRate: pct(s.hitRate, locale),
              trueToday: s.activeNow,
            })),
        }
      : null,
    portfolio: exposure
      ? {
          weightedBeta: num(exposure.beta?.value, locale),
          weightedVolatility20d: pct(exposure.vol20?.value, locale),
          weightBelow200Day: pct(exposure.below[200].weight, locale),
          largestSector: exposure.sectors[0]
            ? { sector: sectorLabel(exposure.sectors[0].sector, locale) ?? t.positions.unclassified, weight: pct(exposure.sectors[0].weight, locale) }
            : null,
          positions: exposure.positions.slice(0, TOP_POSITIONS).map((p) => ({
            symbol: p.symbol,
            weight: pct(p.weight, locale),
            beta: num(p.beta, locale),
            volatility20d: pct(p.vol20, locale),
            sitePublicTechnicalView: p.technical ? `"${view(p.technical.verdict)}"` : null,
            sitePublicEarningsView: p.earnings ? `"${view(p.earnings.verdict)}"` : null,
          })),
        }
      : null,
    triggeredRules: triggered.map(({ rule, symbols }) => ({
      label: `"${rule.label}"`,
      conditions: rule.conditions.map((c) => describeCondition(c, labels, locale)),
      symbols,
    })),
  });
}

const failures = new Map<string, number>();
const FAILURE_TTL = 20 * 60_000;

async function writeNote(input: string, locale: Loc, client: string): Promise<DeskNote> {
  const out = await callClaude(SYSTEM[locale], Schema, input, client);
  const paragraphs = (out?.paragraphs ?? []).map((p) => p.trim()).filter(Boolean).slice(0, MAX_PARAGRAPHS);
  if (paragraphs.length === 0) throw new Error("no-output");
  const text = paragraphs.join(" ");
  const missing = ungroundedNumbers(text, input);
  if (missing.length) throw new Error(`ungrounded (${missing.join(" ")})`);
  const advice = adviceMatches(text, locale);
  if (advice.length) throw new Error(`advice (${advice.join(" | ")})`);
  return { paragraphs, generatedAt: new Date().toISOString() };
}

export type NoteResult = { ok: true; note: DeskNote } | { ok: false; reason: "off" | "budget" | "failed" | "empty" };

export async function getDeskNote(userId: string, input: string | null, session: string, locale: Loc): Promise<NoteResult> {
  if (!insightsConfigured()) return { ok: false, reason: "off" };
  if (!input) return { ok: false, reason: "empty" };
  const failKey = `${userId}:${locale}`;
  const failed = failures.get(failKey);
  if (failed && Date.now() - failed < FAILURE_TTL) return { ok: false, reason: "failed" };
  const digest = createHash("sha256").update(input).digest("hex").slice(0, 16);
  try {
    const note = await unstable_cache(
      () => writeNote(input, locale, memberClient(userId)),
      ["risk-desk-note-v1", userId, session, digest, locale],
      { revalidate: 24 * 3600, tags: ["risk-desk-note"] },
    )();
    return { ok: true, note };
  } catch (error) {
    if (error instanceof ClaudeBudgetError) return { ok: false, reason: "budget" };
    failures.set(failKey, Date.now());
    console.error(`[risk masası notu] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return { ok: false, reason: "failed" };
  }
}
