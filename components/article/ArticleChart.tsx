import Link from "next/link";
import { PriceChartLazy } from "@/components/stock/PriceChartLazy";
import { chartLabels } from "@/lib/chart-labels";
import { getSymbolNames, isKnownSymbol } from "@/lib/data";
import type { ChartRange } from "@/lib/providers/types";
import { getI18n } from "@/lib/i18n";
import { isValidSymbol } from "@/lib/utils";

/**
 * Yazının içine gömülen gerçek fiyat grafiği.
 *
 * Neden stok fotoğraf değil de bu: bir piyasa yazısında en anlamlı görsel,
 * anlatılan hisseye ne olduğudur. Veriyi zaten kendi sağlayıcımızdan
 * çekiyoruz — telif sorunu yok, her açılışta güncel ve yazının iddiasını
 * doğrudan gösteriyor.
 *
 * ARTIK DETAY SAYFASININ GRAFİĞİ. Önceden burada sunucuda çizilen statik bir
 * Sparkline vardı: tek aralık, tek çizgi, okuma yok. Yazıyı okuyan kişi
 * grafikte bir şey görüp "peki üç ay önce neredeydi" diye sorduğunda
 * yapabileceği tek şey hisse sayfasına gidip yazıyı terk etmekti. Aynı
 * bileşen (`PriceChart`) burada da durunca aralık düğmeleri, mum/çizgi
 * seçimi ve imleçle okuma yazının içinde kalıyor — iki ekran arasında
 * grafiğin davranışı da görünüşü de aynı.
 *
 * Bedeli dürüstçe: blok artık istemci tarafında çiziliyor ve veriyi
 * /api/chart üzerinden kendisi çekiyor, yani yazı sayfasına lightweight-charts
 * paketi iniyor. Grafik içeren yazılarda bu takas kabul edildi; grafiği
 * olmayan yazılar hiçbir şey ödemiyor çünkü blok yoksa bileşen de yok.
 *
 * `::: grafik NVDA | 3M | açıklama` sözdizimi değişmedi; aralık artık
 * grafiğin AÇILIŞ aralığı, okuyucu üzerinden değiştirebiliyor.
 */

export async function ArticleChart({
  symbol,
  range,
  caption,
}: {
  symbol: string;
  range: ChartRange;
  caption?: string;
}) {
  const { locale, t } = await getI18n();

  /* Tanınmayan sembolde blok TAMAMEN düşer.
     Eski statik sürüm veri gelmeyince null dönüyordu; PriceChart ise kendi
     hata durumunu çiziyor ve bu, yazının ortasında "veri alınamadı" kutusu
     demek. Mercek yazıları borsada işlem GÖRMEYEN şirketleri de anlatıyor
     (SpaceX gibi) ve orada bir grafik bloğu yanlışlıkla kalmışsa okuyucu
     kırık bir kutu değil, hiçbir şey görmeli. */
  if (!isValidSymbol(symbol) || !(await isKnownSymbol(symbol))) return null;

  const meta = await getSymbolNames([symbol]);
  const name = meta[symbol]?.name;

  return (
    <figure className="flex flex-col gap-0 overflow-hidden rounded-(--radius-lg) border border-line bg-surface">
      {/* Künye grafiğin ÜSTÜNDE: PriceChart kendi okuma satırını en üste
          koyuyor, hangi hisseye baktığını söyleyen satır ondan da önce
          gelmeli. Sembol hisse sayfasına açılır — yazıdan çıkış kapısı
          kapanmıyor, sadece artık zorunlu değil. */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-line px-4 pb-3 pt-4 sm:px-5">
        <Link
          href={`/hisse/${symbol}`}
          className="numeral -my-1.5 inline-flex min-h-8 items-center py-1.5 text-[15px] font-bold tracking-[-0.02em] text-strong transition-colors hover:text-primary"
        >
          {symbol}
        </Link>
        {name && <span className="text-[12.5px] text-muted">{name}</span>}
      </div>

      <div className="px-1 py-1 sm:px-2 sm:py-2">
        <PriceChartLazy
          symbol={symbol}
          initialRange={range}
          locale={locale}
          labels={chartLabels(t)}
        />
      </div>

      {caption && (
        <figcaption className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-muted sm:px-5">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
