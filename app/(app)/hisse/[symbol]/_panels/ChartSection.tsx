import { PriceChartLazy } from "@/components/stock/PriceChartLazy";
import { chartLabels } from "@/lib/chart-labels";
import { getStatus, getHolidays } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBars, getQuote } from "@/lib/providers";
import { closeMinutesFor, etParts } from "@/lib/market-hours";

/* ==========================================================================
   Grafik — yön rengi günün değişiminden gelir
   ========================================================================== */

export async function ChartSection({
  symbol,
  locale,
  t,
  compact = false,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
  compact?: boolean;
}) {
  /* Grafiğin okuma satırı ile sayfa başlığındaki fiyat AYNI kaynaktan gelmeli.
     Eskiden başlık anlık kotasyonu (son işlem), grafik ise son DAKİKA BARININ
     kapanışını yazıyordu; ikisi tanımı gereği farklı sayılar ve ekranda yan
     yana duran iki fiyat birbirini tutmuyordu ($897,75 ile $897,06 gibi).
     Kotasyon buradan geçiriliyor: eğri barlardan çizilmeye devam ediyor, ama
     büyük punto ile yazılan fiyat başlıktakiyle aynı. İkinci çağrı sağlayıcıya
     gitmiyor — aynı önbellek. */
  const status = await getStatus();
  /* Barlar da BURADA çekiliyor. Grafik onları istemciden `/api/chart` ile
     ikinci kez istiyordu: "HTML → JS indir → hidrasyon → fetch → çizim".
     Veri sunucuda zaten erişilebilir ve `/api/chart` yanıtları `no-store`
     olduğu için o istek hiçbir katmanda önbelleğe de girmiyordu. */
  const [result, bars, holidays] = await Promise.all([
    getQuote(symbol, status),
    getChartBars(symbol, "1D", status),
    getHolidays(),
  ]);

  /* KAPANIŞ, ÇİZİLEN GÜNÜN KAPANIŞI — "bugünün" değil.
     Buraya `status.closeMinutes` veriliyordu, yani BUGÜNÜN kapanışı; 1G
     grafiği ise son İŞLEM gününü çiziyor ve ikisi ayrışabiliyor. 28 Kasım
     2026 cumartesi bir hisse sayfası açıldığında `getMarketStatus`
     cumartesi için tatil kaydı bulamıyor ve 16:00 dönüyor, grafik ise 27
     Kasım cumayı (13:00 erken kapanış) çiziyor: gölgeler piyasanın kapalı
     olduğu üç saati ana seans gibi boyuyordu.
     Barlar zaten burada, dolayısıyla çizilecek gün de biliniyor. */
  const grafikGunu = bars.ok && bars.data.length > 0
    ? etParts(new Date(bars.data[0].time * 1000)).dateStr
    : status.etDate;

  return (
    <PriceChartLazy
      symbol={symbol}
      compact={compact}
      locale={locale}
      labels={chartLabels(t)}
      closeMinutes={closeMinutesFor(grafikGunu, holidays)}
      /* Uç ancak çizilen gün BUGÜNÜN seansıysa ve seans açıksa atıyor
         (gerekçe PriceChart → "SERİNİN UCU ATIYOR"). */
      live={status.session !== "closed" && grafikGunu === status.sessionDate}
      quote={
        result.ok
          ? {
              price: result.data.price,
              changePct: result.data.changePct,
              /* İŞLEM ANI DA GİDİYOR. Okuma satırı 1G'nin SON noktasında
                 başlıktaki fiyatı yazıyor (gerekçesi `PriceChart` içinde) ama
                 bunu ancak kotasyon son bardan yeniyse yapmalı; ölçü bu
                 damga. */
              tradedAt: result.data.tradedAt?.toISOString() ?? null,
            }
          : null
      }
      initialBars={
        bars.ok
          ? {
              bars: bars.data,
              prevClose: result.ok ? result.data.prevClose : null,
            }
          : null
      }
    />
  );
}
