import { rollingAverage, seriesDomain, seriesPath, seriesY } from "@/components/stock/average-paths";
import type { Dictionary, Locale } from "@/lib/i18n";
import { barDate } from "@/lib/period-returns";
import type { Bar } from "@/lib/providers/types";
import { formatEtDateMedium } from "@/lib/utils";
import craft from "./craft.module.css";

/**
 * Fiyat ve ortalamaların bir yıllık yolu — Hareketli Ortalamalar kartının
 * çizimi (10 Kasım 2026, görsel kalite turu).
 *
 * NEDEN VAR. Kart üç ortalamanın yalnız BUGÜNKÜ değerini yazıyordu: fiyatın
 * 200 günlüğün altına yeni mi indiği, aylardır mı orada olduğu okunmuyordu.
 * Kart ayrıca kolonun kısa parçasıydı ve dibinde 83 piksel (canlıda
 * 80–150) boş zemin kalıyordu. Çizim aynı barlardan kuruluyor (kartın zaten
 * çektiği `getChartBars(symbol, "1Y")`, yeni istek yok) ve artan yeri O
 * alıyor: `flex:1`, yani boşluk esnetilmiyor, çizimle doluyor.
 *
 * DİL. İnce grafik: fiyat en koyu mürekkep, ortalamalar nötr ve çizgi
 * biçimiyle ayrışıyor (düz, kesik, noktalı) — renk yön taşıdığı için
 * ortalamaya renk verilmiyor (yönü cetveldeki çentik ve listedeki yüzde
 * söylüyor). Eksen yok: kesin sayılar altındaki listede; burada yalnız
 * dönemin iki ucu yazılı. Çizim `aria-hidden`.
 *
 * HAREKET. Yollar `spark-line`: görünüme girince soldan bir kez çizilir
 * (`MotionExperience` SVG'yi izler). Sunucu son kareyi basar.
 *
 * `preserveAspectRatio="none"` + `non-scaling-stroke`: kutu hangi boya
 * gerilirse gerilsin çizgi kalınlığı sabit kalır.
 */
const WINDOWS = [50, 100, 200] as const;

export function AveragesChart({ bars, price, locale, t }: { bars: Bar[]; price: number | null; locale: Locale; t: Dictionary }) {
  const closes = bars.map((bar) => bar.close);
  /* Son nokta KOTASYON (kartın "Son Fiyat" satırı ve cetvelle aynı sayı):
     son barın kapanışı ile son işlem tanımı gereği farklı. */
  const priceSeries: number[] = price !== null && closes.length > 0 ? [...closes.slice(0, -1), price] : closes;
  const averages = WINDOWS.map((window) => ({ window, values: rollingAverage(closes, window) }));
  const drawn = averages.filter((a) => a.values.some((v) => v !== null));
  const domain = seriesDomain([priceSeries, ...drawn.map((a) => a.values)]);
  if (!domain || priceSeries.length < 20) return null;
  const last = priceSeries[priceSeries.length - 1]!;
  return (
    <figure className={craft.maChart} aria-hidden>
      <div className={craft.maPlot}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={craft.maSvg}>
          {drawn.map((a) => (
            <path key={a.window} className="spark-line" data-window={a.window} d={seriesPath(a.values, domain)} />
          ))}
          <path className="spark-line" data-price="" d={seriesPath(priceSeries, domain)} />
        </svg>
        <i className={`spark-dot ${craft.maDot}`} style={{ top: `${seriesY(last, domain)}%` }} />
      </div>
      <figcaption className={craft.maCaption}>
        <span className="numeral">{formatEtDateMedium(barDate(bars[0]!), locale)}</span>
        <span className={craft.maLegend}>
          <span data-price="">{t.stockVisuals.maPrice}</span>
          {drawn.map((a) => (
            <span key={a.window} data-window={a.window}>
              {t.stock.movingAverageShort.replace("{n}", String(a.window))}
            </span>
          ))}
        </span>
        <span className="numeral">{formatEtDateMedium(barDate(bars[bars.length - 1]!), locale)}</span>
      </figcaption>
    </figure>
  );
}
