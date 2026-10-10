import { z } from "zod";
import { etParts } from "./market-hours";
import type { Bar } from "./providers/types";

export const AnalysisInput = z.object({
  requestId: z.uuid(),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,9}$/),
  horizon: z.enum(["short", "medium"]),
  locale: z.enum(["tr", "en"]).default("tr"),
});
const prose = z.string().min(1).max(1800);
/* Açıklamalar JSON şemasıyla modele gider; uzunluk sınırları gevşek tutulur
   (prompt 600 karakter ister), aşan yanıt ücretli çağrıyı boşa düşürmesin. */
export const AnalysisOutput = z.object({
  verdict: z.enum(["buy", "hold", "sell", "insufficient"]).describe("View for the selected horizon; insufficient when evidence cannot support a view."),
  overallScore: z.number().int().min(0).max(100).describe("Technical, business and news evidence combined for the horizon."),
  technicalScore: z.number().int().min(0).max(100).describe("Trend, momentum, volatility and volume."),
  newsScore: z.number().int().min(0).max(100).nullable().describe("Net effect of the cited news; null when no usable news is supplied."),
  summary: prose.describe("Two to four sentences: the view and its main reason."),
  reasons: z.array(prose).min(1).max(5).describe("Two to four concrete supporting points with their numbers."),
  risks: z.array(prose).min(1).max(5).describe("Two to four concrete risks with their numbers."),
  bullScenario: prose.describe("What would have to happen for the positive case, tied to supplied levels."),
  bearScenario: prose.describe("What would have to happen for the negative case, tied to supplied levels."),
  invalidation: prose.describe("Observable conditions that would overturn the view."),
  news: z.array(z.object({
    sourceIndex: z.number().int().min(0).describe("sourceIndex of a supplied news item."),
    impact: prose.describe("How this story bears on the horizon."),
  })).max(8),
});
export type AnalysisResult = z.infer<typeof AnalysisOutput>;
/** Var olmayan ya da tekrarlanan haber atfını atar; haber yoksa haber puanı da yoktur. */
export function repairNewsCitations(output: AnalysisResult, newsCount: number): AnalysisResult {
  const cited = new Set<number>();
  const news = output.news.filter(n => {
    if (n.sourceIndex >= newsCount || cited.has(n.sourceIndex)) return false;
    cited.add(n.sourceIndex);
    return true;
  });
  return { ...output, news, newsScore: newsCount === 0 ? null : output.newsScore };
}
/** Şirket uçları da genel piyasa haberi döndürebilir; yeni olması ilgililik değildir. */
export function companyNewsRelevant(symbol: string, company: string, headline: string, summary: string | null) {
  const brand = company.replace(/\.com\b/gi, "").replace(/\b(incorporated|inc|corporation|corp|ltd|limited|plc|holdings|company|co)\b\.?/gi, "").replace(/\s+/g, " ").trim();
  const first = brand.split(" ")[0];
  const generic = /^(the|bank|american|united|international|first|new|general|applied|advanced)$/i;
  const aliases: Record<string, string[]> = { GOOG: ["Google"], GOOGL: ["Google"], META: ["Facebook", "Instagram"], BRK: ["Berkshire Hathaway"] };
  const names = [...(symbol.length >= 2 ? [symbol] : []), brand, ...(first?.length >= 4 && !generic.test(first) ? [first] : []), ...(aliases[symbol] ?? [])].filter(n => n.length >= 2);
  const text = `${headline} ${summary ?? ""}`;
  return names.some(name => new RegExp(`(^|[^A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i").test(text));
}
export function istanbulDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function remainingAnalyses(limit: number | null, used: number, usedDay: string | null, now = new Date()) {
  return limit === null ? null : Math.max(0, limit - (usedDay === istanbulDay(now) ? used : 0));
}
export function safeSourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

const RECENT_SESSIONS = 10;
const RETURN_WINDOWS = { w1: 5, m1: 21, m3: 63, m6: 126 } as const;
const round2 = (value: number) => Math.round(value * 100) / 100;
const pct = (to: number, from: number) => round2((to / from - 1) * 100);
/** Tek anlık fotoğraf yönü göstermez: son seanslar, dönem getirileri ve 3 aylık bant. Yalnız tamamlanmış barlar. */
export function pricePath(done: readonly Bar[]) {
  const last = done.at(-1);
  if (!last) return null;
  const back = (sessions: number) => done.length > sessions ? pct(last.close, done[done.length - 1 - sessions].close) : null;
  const band = done.slice(-RETURN_WINDOWS.m3);
  const high = Math.max(...band.map(b => b.high));
  const low = Math.min(...band.map(b => b.low));
  return {
    returnsPct: Object.fromEntries(Object.entries(RETURN_WINDOWS).map(([key, n]) => [key, back(n)])) as Record<keyof typeof RETURN_WINDOWS, number | null>,
    range3m: { high: round2(high), low: round2(low), fromHighPct: pct(last.close, high), fromLowPct: pct(last.close, low) },
    recentSessions: done.slice(-RECENT_SESSIONS).map((bar, i, list) => {
      const prev = i > 0 ? list[i - 1].close : done[done.length - RECENT_SESSIONS - 1]?.close;
      return { date: etParts(new Date(bar.time * 1000)).dateStr, close: round2(bar.close), changePct: prev ? pct(bar.close, prev) : null, volume: bar.volume };
    }),
  };
}
