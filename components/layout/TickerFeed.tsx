import { MarketTicker, type TickerItem } from "./MarketTicker";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { getI18n } from "@/lib/i18n";
import { formatPercent, formatPrice } from "@/lib/utils";

/**
 * Şeridin verisini toplar. Kabuğun içinde <Suspense> ile sarılıdır — bu
 * istekler sayfanın ilk boyanmasını bekletmez, şerit hazır olunca gelir.
 *
 * İçerik: dört endeks + üç tahvil vadesi. Kotasyonlar zaten önbellekli
 * (`getQuotes`), FRED serileri günlük — şerit ek yük getirmiyor.
 */

const TICKER_YIELDS = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin" },
] as const;

const INDEX_LABEL: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

const YIELD_LABEL: Record<string, string> = {
  "yield-2y": "2Y",
  "yield-10y": "10Y",
  "yield-30y": "30Y",
};

export async function TickerFeed() {
  const { locale } = await getI18n();
  const status = await getStatus();

  const [quotes, ...yields] = await Promise.all([
    getQuotes([...INDEX_STRIP], status),
    ...TICKER_YIELDS.map((series) => getSeries(series, 2)),
  ]);

  const items: TickerItem[] = [];

  if (quotes.ok) {
    for (const symbol of INDEX_STRIP) {
      const quote = quotes.data[symbol];
      if (!quote) continue;
      items.push({
        label: INDEX_LABEL[symbol] ?? symbol,
        value: formatPrice(quote.price, locale),
        changePct: quote.changePct,
        change: formatPercent(quote.changePct, locale),
      });
    }
  }

  TICKER_YIELDS.forEach((series, index) => {
    const result = yields[index];
    if (!result.ok || result.data.latestValue === null) return;
    const latest = result.data.latestValue;
    const prev = result.data.prevValue;
    const delta = prev !== null ? latest - prev : null;
    items.push({
      label: YIELD_LABEL[series.slug] ?? series.slug,
      value: `${formatPrice(latest, locale)}%`,
      changePct: delta,
      change:
        delta === null || delta === 0
          ? null
          : `${delta > 0 ? "▲" : "▼"} ${formatPrice(Math.abs(delta), locale, { digits: 2 })}`,
    });
  });

  return <MarketTicker items={items} />;
}
