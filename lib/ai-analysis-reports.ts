import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { aiAnalysisRequests } from "./schema";
import type { SavedAnalysis } from "./ai-analysis";

/** Sekmedeki geçmiş listesi; daha eskisi yalnız Analizlerim'de (kendi raporları). */
const SYMBOL_HISTORY_LIMIT = 30;
const VERDICTS = ["buy", "hold", "sell", "insufficient"] as const;
export type ReportVerdict = (typeof VERDICTS)[number];

export type ReportSummary = {
  id: string;
  horizon: "short" | "medium";
  locale: "tr" | "en";
  verdict: ReportVerdict;
  score: number | null;
  generatedAt: string;
  /** Okuyanın kendi raporu mu — yalnız rozet; başkasının kimliği hiç çıkmaz. */
  mine: boolean;
};

/**
 * Hissenin TAMAMLANMIŞ raporları, kimin ürettiğinden bağımsız.
 *
 * Rapor üretmek kişiye bağlı (kota, yetki); OKUMAK herkese açık: rapor o
 * anın verisiyle yazılmış tarihli bir belge, üreten kullanıcı hiçbir yerde
 * görünmez (`user_id` yalnız "senin raporun" rozeti için karşılaştırılır).
 * Tablo yoksa (migration uygulanmamış) boş liste.
 */
export async function listSymbolReports(symbol: string, viewerId: string | null): Promise<ReportSummary[]> {
  try {
    const rows = await db.select({
      id: aiAnalysisRequests.id, userId: aiAnalysisRequests.userId, horizon: aiAnalysisRequests.horizon, locale: aiAnalysisRequests.locale,
      verdict: sql<string>`${aiAnalysisRequests.result}->'output'->>'verdict'`,
      score: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'overallScore')::int`,
      generatedAt: sql<string>`${aiAnalysisRequests.result}->>'generatedAt'`,
    }).from(aiAnalysisRequests)
      .where(and(eq(aiAnalysisRequests.symbol, symbol), eq(aiAnalysisRequests.status, "completed")))
      .orderBy(desc(aiAnalysisRequests.createdAt)).limit(SYMBOL_HISTORY_LIMIT);
    return rows.map(row => ({
      id: row.id, horizon: row.horizon === "medium" ? "medium" : "short", locale: row.locale === "en" ? "en" : "tr",
      verdict: VERDICTS.includes(row.verdict as ReportVerdict) ? row.verdict as ReportVerdict : "insufficient",
      score: row.score, generatedAt: row.generatedAt, mine: viewerId !== null && row.userId === viewerId,
    }));
  } catch { return []; }
}

export async function getSymbolReport(symbol: string, id: string): Promise<SavedAnalysis | null> {
  try {
    const [row] = await db.select({ result: aiAnalysisRequests.result }).from(aiAnalysisRequests)
      .where(and(eq(aiAnalysisRequests.id, id), eq(aiAnalysisRequests.symbol, symbol), eq(aiAnalysisRequests.status, "completed"))).limit(1);
    return row?.result ?? null;
  } catch { return null; }
}
