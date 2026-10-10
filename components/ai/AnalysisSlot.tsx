import { getDictionary } from "@/lib/i18n";
import { analysisAccess } from "@/lib/ai-analysis-access";
import { AnalysisPanel } from "./AnalysisPanel";

export async function AnalysisSlot({ symbol, locale }: { symbol: string; locale: "tr" | "en" }) {
  if (!process.env.CLAUDE_ANALYSIS_API_KEY || process.env.CLAUDE_ANALYSIS_DISABLED === "1") return null;
  let access;
  try { access = await analysisAccess(); } catch { return null; }
  return access ? <AnalysisPanel key={`${symbol}:${locale}`} symbol={symbol} locale={locale} t={getDictionary(locale).aiAnalysis} /> : null; // Migration/veritabanı yokken ücretsiz ekranlar çalışır.
}
