/**
 * Sitenin Claude anahtarı (17 Ekim). Sunucuda tanımlı olan çoğunlukla
 * analiz anahtarı (`CLAUDE_ANALYSIS_API_KEY`, deploy/set-analysis-key.py);
 * genel `ANTHROPIC_API_KEY` varsa o önce. Çeviri ve pazar özeti yorumu
 * buradan okur. Analizin acil durdurması (`CLAUDE_ANALYSIS_DISABLED`) yalnız
 * analize bağlı; çeviri onu dinlemez.
 */
export function claudeKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_ANALYSIS_API_KEY?.trim() || undefined;
}
