import {
  MarketTicker,
  type TickerGroup,
  type TickerItem,
} from "./MarketTicker";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import { getUsdTry } from "@/lib/providers/tcmb";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { getI18n } from "@/lib/i18n";
import { formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";

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

/* Etiket vekil fonun sembolünü de taşıyor: şeritteki sayı endeksin
   seviyesi değil o fonun fiyatı (gerekçenin tamamı ana sayfadaki
   `INDEX_LABEL` yorumunda). Şerit yalnızca 1024px üstünde görünüyor, yer
   var. */
const INDEX_LABEL: Record<string, string> = {
  SPY: "S&P 500 · SPY",
  QQQ: "Nasdaq 100 · QQQ",
  DIA: "Dow Jones · DIA",
  IWM: "Russell 2000 · IWM",
};

const YIELD_LABEL: Record<string, string> = {
  "yield-2y": "2Y",
  "yield-10y": "10Y",
  "yield-30y": "30Y",
};

export async function TickerFeed() {
  const { locale, t } = await getI18n();
  const status = await getStatus();

  const [quotes, usdTry, ...yields] = await Promise.all([
    getQuotes([...INDEX_STRIP], status),
    getUsdTry(),
    ...TICKER_YIELDS.map((series) => getSeries(series, 2)),
  ]);

  const indexItems: TickerItem[] = [];
  if (quotes.ok) {
    for (const symbol of INDEX_STRIP) {
      const quote = quotes.data[symbol];
      if (!quote) continue;
      indexItems.push({
        label: INDEX_LABEL[symbol] ?? symbol,
        value: formatPrice(quote.price, locale),
        changePct: quote.changePct,
        change: formatPercent(quote.changePct, locale),
      });
    }
  }

  const yieldItems: TickerItem[] = [];
  TICKER_YIELDS.forEach((series, index) => {
    const result = yields[index];
    if (!result.ok || result.data.latestValue === null) return;
    const latest = result.data.latestValue;
    const prev = result.data.prevValue;
    const delta = prev !== null ? latest - prev : null;
    yieldItems.push({
      label: YIELD_LABEL[series.slug] ?? series.slug,
      /* Tahvil getirisi bir YÜZDE: işaretin yeri dile bağlı ve
         biçimlendiriciden geliyor ("%4,25" / "4.25%"). */
      value: formatPercentPlain(latest, locale, 2),
      changePct: delta,
      change:
        delta === null || delta === 0
          ? null
          : `${delta > 0 ? "▲" : "▼"} ${formatPrice(Math.abs(delta), locale, { digits: 2 })}`,
    });
  });

  /* "2Y" tek başına ne olduğunu söylemiyordu; künye grubun önüne yazılıyor,
     böylece hem etiketler kısa kalıyor hem tahvil oldukları belli oluyor.
     Üç vade tek sayfada duruyor — dar ekranda da bölünmüyorlar. */
  const groups: TickerGroup[] = [];
  if (indexItems.length > 0) {
    groups.push({
      key: "indices",
      items: indexItems,
      narrowSize: 2,
      wideSize: 4,
    });
  }
  if (yieldItems.length > 0) {
    groups.push({
      key: "yields",
      caption: locale === "tr" ? "ABD Tahvili" : "US Treasuries",
      items: yieldItems,
      narrowSize: yieldItems.length,
      wideSize: yieldItems.length,
      hideChangeNarrow: true,
    });
  }

  /* Kur şeridin son grubu. Sitedeki her fiyat dolar; Türkiye'den yatırım
     yapan biri için lira karşılığı getirinin yarısı burada oluşuyor.

     Değişim sütunu YOK ve bu bilinçli: TCMB günde tek bülten yayımlıyor,
     "önceki bültene göre fark" günlük bir hareket değil ve endekslerin
     yanında yüzde olarak durunca öyleymiş gibi okunuyor. Künyede bültenin
     tarihi var — kaynak ne diyorsa o. */
  if (usdTry.ok) {
    groups.push({
      key: "fx",
      caption: locale === "tr" ? "TCMB Kuru" : "TCMB Rate",
      items: [
        {
          label: "USD/TRY",
          value: formatPrice(usdTry.data.selling, locale),
          changePct: null,
          change: null,
        },
      ],
      narrowSize: 1,
      wideSize: 1,
    });
  }

  return (
    <MarketTicker
      groups={groups}
      labels={{ pause: t.nav.tickerPause, resume: t.nav.tickerResume }}
    />
  );
}
