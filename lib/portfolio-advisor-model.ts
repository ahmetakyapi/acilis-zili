import { z } from "zod";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { pickFollowUps } from "@/lib/portfolio-question-core";
import type { Locale } from "@/lib/i18n/config";
import type { ScanRow } from "@/lib/portfolio-scan-model";
import { weightedChange } from "@/lib/portfolio-scan-model";
import { formatPercentPlain, formatPercentText } from "@/lib/utils";

/**
 * PORTFÖY DANIŞMANI — saf hesap (11 Kasım, sahibinin isteği: "buraya güzel
 * Claude analiz yazalım, hem günlük hem aylık… bana özel olacağı için bana
 * danışmanlık yapsın, ana sayfaya da özet bilgiler yazsın").
 *
 * YALNIZ SİTE SAHİBİ. Kişiye özel al/sat önerisi SPK'ya göre lisanslı
 * yatırım danışmanlığıdır; site bunu üyelere vermez (onlara /portfoy/analiz'de
 * tavsiyesiz "Claude'un Risk Okuması" — lib/portfolio-analysis-note.ts).
 * Danışman yalnız `role = admin` oturumunda yazılır (lib/portfolio-advisor.ts).
 * Tavsiye denetimi bu metinde bilerek kapalı, SAYI denetimi açık: modelin
 * yazdığı her sayı girdide geçer. Hedef ağırlık konuşabilsin diye girdide
 * sabit bir başvuru listesi var (`REFERENCE_WEIGHTS`); model "MU'yu %25'e"
 * diyebilir, "%23'e" diyemez.
 *
 * İKİ UFUK. Günlük: son tamamlanmış seans, beş seans, teknik görüş,
 * bilanço takvimi ve bir yıllık risk ölçüleri. Aylık: son 21 seansta
 * portföyün getirisi S&P 500'e (SPY) karşı, getiriye katkı yapan ve
 * götüren pozisyonlar (ağırlık × değişim; sunucu hesabı), yoğunlaşma.
 */

export const ADVISOR_HORIZONS = ["daily", "monthly"] as const;
export type AdvisorHorizon = (typeof ADVISOR_HORIZONS)[number];

/** Hedef ağırlık başvuruları — modelin önerebileceği tek ağırlıklar. */
export const REFERENCE_WEIGHTS = [5, 10, 15, 20, 25, 30] as const;

export type MonthlyMeasures = {
  portfolio: number | null;
  sp500: number | null;
  /** Ağırlık × 21 seanslık değişim, puan (yüzde puanı). Büyükten küçüğe. */
  contributions: { symbol: string; points: number; month: number }[];
};

/** Son 21 seansın ölçüleri. `spyCloses` tamamlanmış seans kapanışları, eskiden yeniye. */
export function monthlyMeasures(rows: readonly ScanRow[], spyCloses: readonly number[]): MonthlyMeasures {
  const measured = rows.filter((r) => r.month !== null);
  const weight = measured.reduce((sum, r) => sum + r.weight, 0);
  const portfolio = weight > 0 ? measured.reduce((sum, r) => sum + r.month! * r.weight, 0) / weight : null;
  const sp500 =
    spyCloses.length > 21 && spyCloses[spyCloses.length - 22]! > 0
      ? ((spyCloses[spyCloses.length - 1]! - spyCloses[spyCloses.length - 22]!) / spyCloses[spyCloses.length - 22]!) * 100
      : null;
  const contributions = measured
    .map((r) => ({ symbol: r.symbol, points: (r.month! * r.weight) / (weight || 1), month: r.month! }))
    .sort((a, b) => b.points - a.points);
  return { portfolio, sp500, contributions };
}

export const ADVISOR_ACTIONS = ["trim", "add", "diversify", "hedge", "hold", "watch"] as const;
export type AdvisorActionKind = (typeof ADVISOR_ACTIONS)[number];

export const AdvisorSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  actions: z.array(
    z.object({
      kind: z.enum(ADVISOR_ACTIONS),
      symbol: z.string().nullable(),
      title: z.string(),
      detail: z.string(),
    }),
  ),
  risks: z.array(z.object({ title: z.string(), detail: z.string() })),
  outlook: z.string(),
  /** Sohbeti başlatan 2–3 soru (11 Kasım): Claude'un okura sorduğu ya da okurun sorabileceği. */
  followUps: z.array(z.string()),
});
export type AdvisorOutput = z.infer<typeof AdvisorSchema>;

export type AdvisorText = {
  headline: string;
  summary: string;
  actions: { kind: AdvisorActionKind; symbol: string | null; title: string; detail: string }[];
  risks: { title: string; detail: string }[];
  outlook: string;
  followUps: string[];
};

/**
 * Modele giden girdi. `risk` lib/portfolio-analysis-note.ts → `noteInput`un
 * ürettiği biçimlenmiş ölçüler (ekranla aynı biçimlendiriciler); burada
 * pozisyon satırları ve (aylıkta) 21 seans ölçüleri eklenir.
 */
export function advisorInput(
  horizon: AdvisorHorizon,
  rows: readonly ScanRow[],
  risk: unknown,
  monthly: MonthlyMeasures | null,
  locale: Locale,
  dayLabel: string,
): string {
  const pct = (v: number | null, d = 1) => (v === null ? null : formatPercentText(v, locale, d));
  const share = (v: number) => formatPercentPlain(v, locale, 1);
  const points = (v: number) => `${formatPercentText(v, locale, 1).replace(/[%]/g, "")} ${locale === "en" ? "pts" : "puan"}`;
  const stance = (s: string) => (locale === "en" ? { buy: "BUY", hold: "HOLD", sell: "SELL" } : { buy: "AL", hold: "TUT", sell: "SAT" })[s as "buy"];
  return JSON.stringify({
    horizon: horizon === "daily" ? (locale === "en" ? "daily" : "günlük") : locale === "en" ? "monthly (last 21 sessions)" : "aylık (son 21 seans)",
    session: dayLabel,
    windows: locale === "en" ? ["1 session", "5 sessions", "21 sessions", "1 year"] : ["1 seans", "5 seans", "21 seans", "1 yıl"],
    positionCount: rows.length,
    referenceWeights: REFERENCE_WEIGHTS.map((w) => formatPercentPlain(w, locale, 0)),
    portfolio: {
      lastSession: pct(weightedChange(rows, "day"), 2),
      lastFiveSessions: pct(weightedChange(rows, "fiveSession")),
      ...(monthly ? { last21Sessions: pct(monthly.portfolio), sp500Last21Sessions: pct(monthly.sp500) } : {}),
    },
    positions: rows.slice(0, 15).map((r) => {
      const tech = r.flags.find((f) => f.kind === "technical") as { stance: string } | undefined;
      const earnings = r.flags.find((f) => f.kind === "earnings") as { date: string; timing: string | null } | undefined;
      return {
        symbol: r.symbol,
        name: r.name,
        sector: r.sector,
        weight: share(r.weight),
        lastSession: pct(r.day, 2),
        lastFiveSessions: pct(r.fiveSession),
        last21Sessions: pct(r.month),
        sinceAverageCost: pct(r.sinceCost),
        threeMonthRange: r.flags.some((f) => f.kind === "nearHigh") ? "near-high" : r.flags.some((f) => f.kind === "nearLow") ? "near-low" : "middle",
        siteTechnicalView: tech ? stance(tech.stance) : null,
        earningsDate: earnings ? earnings.date : null,
      };
    }),
    ...(monthly
      ? {
          contributors: monthly.contributions.slice(0, 3).map((c) => ({ symbol: c.symbol, contribution: points(c.points), last21Sessions: pct(c.month) })),
          detractors: monthly.contributions
            .slice(-3)
            .reverse()
            .filter((c) => c.points < 0)
            .map((c) => ({ symbol: c.symbol, contribution: points(c.points), last21Sessions: pct(c.month) })),
        }
      : {}),
    risk,
  });
}

/**
 * Çıktı denetimi: başlık ve özet dolu, eylemler en çok 5, riskler en çok 3;
 * eylemin sembolü girdide olmalı (yoksa sembolsüz kalır). Bütün metin sayı
 * denetiminden geçmezse HİÇ basılmaz.
 */
export function checkAdvisor(out: AdvisorOutput, input: string, symbols: readonly string[], locale: Locale = "tr"): { ok: true; text: AdvisorText } | { ok: false; reason: string } {
  const known = new Set(symbols);
  const text: AdvisorText = {
    headline: out.headline.trim(),
    summary: out.summary.trim(),
    actions: out.actions
      .map((a) => {
        const symbol = a.symbol?.trim().toUpperCase() ?? null;
        return { kind: a.kind, symbol: symbol && known.has(symbol) ? symbol : null, title: a.title.trim(), detail: a.detail.trim() };
      })
      .filter((a) => a.title && a.detail)
      .slice(0, 5),
    risks: out.risks.map((r) => ({ title: r.title.trim(), detail: r.detail.trim() })).filter((r) => r.title && r.detail).slice(0, 3),
    outlook: out.outlook.trim(),
    followUps: [],
  };
  if (!text.headline || !text.summary) return { ok: false, reason: "empty" };
  const all = [text.headline, text.summary, text.outlook, ...text.actions.flatMap((a) => [a.title, a.detail]), ...text.risks.flatMap((r) => [r.title, r.detail])].join(" ");
  const missing = ungroundedNumbers(all, input);
  if (missing.length) return { ok: false, reason: `ungrounded (${missing.join(" ")})` };
  /* Takip soruları ayrı süzülür: tutmayan soru düşer, not kalır. */
  text.followUps = pickFollowUps(out.followUps, input, locale, true);
  return { ok: true, text };
}
