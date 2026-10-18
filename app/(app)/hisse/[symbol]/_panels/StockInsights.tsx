import { StockInsightCard } from "@/components/stock/StockInsightCard";
import type { Dictionary, Locale } from "@/lib/i18n";
import { insightsConfigured, latestReportedEarnings, upcomingEarnings } from "@/lib/stock-insights";

/**
 * Claude notlarının yeri (17 Ekim). Not istemcide istenir
 * (components/stock/StockInsightCard.tsx); burada yalnız panelin basılıp
 * basılmayacağı: anahtar yoksa hiçbiri, bilanço notu yalnız son 10 günde
 * gerçekleşeni düşmüş bir bilanço varsa — boş bir "bilanço notu" paneli
 * basıp sonra kaldırmak sayfayı zıplatırdı.
 */
export function MoveInsight({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  if (!insightsConfigured()) return null;
  return <StockInsightCard symbol={symbol} kind="move" locale={locale} labels={t.stockInsight} />;
}

export async function EarningsInsight({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  if (!insightsConfigured()) return null;
  const row = await latestReportedEarnings(symbol);
  if (row) return <StockInsightCard symbol={symbol} kind="earnings" locale={locale} labels={t.stockInsight} />;
  /* Açıklanmış bilanço yoksa ve on gün içinde açıklanacaksa önizleme
     (18 Ekim) — aynı yerde: bilanço çıkınca not onun yerini alır. */
  const next = await upcomingEarnings(symbol);
  if (!next) return null;
  return <StockInsightCard symbol={symbol} kind="preview" locale={locale} labels={t.stockInsight} />;
}
