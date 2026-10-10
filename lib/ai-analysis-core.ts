import { z } from "zod";

export const AnalysisInput = z.object({
  requestId: z.uuid(),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,9}$/),
  horizon: z.enum(["short", "medium"]),
  locale: z.enum(["tr", "en"]).default("tr"),
});
const prose = z.string().min(1).max(1800);
export const AnalysisOutput = z.object({
  verdict: z.enum(["buy", "hold", "sell", "insufficient"]),
  overallScore: z.number().int().min(0).max(100),
  technicalScore: z.number().int().min(0).max(100),
  newsScore: z.number().int().min(0).max(100).nullable(),
  summary: prose,
  reasons: z.array(prose).min(1).max(5),
  risks: z.array(prose).min(1).max(5),
  bullScenario: prose,
  bearScenario: prose,
  invalidation: prose,
  news: z.array(z.object({ sourceIndex: z.number().int().min(0), impact: prose })).max(8),
});
export type AnalysisResult = z.infer<typeof AnalysisOutput>;
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
