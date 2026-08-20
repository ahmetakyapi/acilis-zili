import type { ChartRange } from "./providers/types";
import type { Dictionary } from "./i18n";

/**
 * Grafik etiketleri — sözlükten bileşene köprü.
 *
 * NEDEN AYRI BİR DOSYA: bu eşleme bir süre `components/stock/PriceChart.tsx`
 * içinde duruyordu ve o dosya `"use client"` ile başlıyor. Bir istemci
 * modülünden dışa aktarılan fonksiyon sunucuda ÇAĞRILAMAZ — yalnızca bileşen
 * olarak render edilebilir ya da props olarak geçirilebilir. Sunucu bileşeni
 * olan hisse sayfası ve `::: grafik` bloğu onu çağırdığı anda React
 * fırlatıyordu:
 *
 *   Attempted to call chartLabels() from the server but chartLabels is on
 *   the client.
 *
 * Hata Suspense sınırının içinde oluştuğu için yukarı, sayfa seviyesindeki
 * hata sınırına kadar çıkıyor ve BÜTÜN şirket detay sayfası "Bir şeyler ters
 * gitti" ekranına dönüşüyordu. Ekranda sağlayıcı hatası gibi göründüğü için
 * de yanıltıcıydı.
 *
 * Eşleme tek yerde durmalı (grafiği iki yer kuruyor: hisse detay sayfası ve
 * yazıların içine gömülen blok) ama o yer istemci modülü OLMAMALI. Burası
 * saf TypeScript: her iki taraftan da güvenle çağrılır.
 */

export type ChartLabels = {
  ranges: Record<ChartRange, string>;
  rangeLabels: Record<ChartRange, string>;
  area: string;
  candles: string;
  /** Aralık ve mod düğmelerinin grup adları — ekran okuyucu için. */
  rangeGroup: string;
  modeGroup: string;
  periodReturn: string;
  periodHigh: string;
  periodLow: string;
  noData: string;
  failed: string;
  sessionPre: string;
  sessionRegular: string;
  sessionAfter: string;
  sessionOvernight: string;
  sessionOvernightNote: string;
};

export function chartLabels(t: Dictionary): ChartLabels {
  return {
    ranges: t.chart.ranges,
    rangeLabels: t.chart.rangeLabels,
    area: t.chart.area,
    rangeGroup: t.chart.rangeGroup,
    modeGroup: t.chart.modeGroup,
    candles: t.chart.candles,
    periodReturn: t.chart.periodReturn,
    periodHigh: t.chart.periodHigh,
    periodLow: t.chart.periodLow,
    noData: t.chart.noChartData,
    failed: t.data.failed,
    sessionPre: t.chart.sessionPre,
    sessionRegular: t.chart.sessionRegular,
    sessionAfter: t.chart.sessionAfter,
    sessionOvernight: t.chart.sessionOvernight,
    sessionOvernightNote: t.chart.sessionOvernightNote,
  };
}
