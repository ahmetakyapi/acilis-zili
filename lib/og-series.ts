import {
  displayBasis,
  etParts,
  quoteBasis,
  type DisplayBasis,
  type MarketStatus,
} from "@/lib/market-hours";
import type { Bar, Quote } from "@/lib/providers/types";
import { displayZone, formatInZone, zoneDateKey, zoneTag } from "@/lib/session-clock";
import { formatEtDateCompact } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

/* ==========================================================================
   Hisse paylaşım kartının verisi — saf, React'siz (24 Ekim)

   Kart bir kez çizilip WhatsApp'ta, X'te günlerce dolaşıyor: içindeki fiyat
   paylaşıldığı anda bile "şimdi" değil, ertesi gün düpedüz eski. Bu yüzden
   kart iki şeyi kendi üstünde yazıyor (CLAUDE.md "Veri dürüstlüğü" 2 ve 4):
   fiyatın HANGİ SEANSI anlattığı (`displayBasis` — ekrandaki şirket
   kartıyla aynı karar) ve işlemin tarihi ile saati. Testler:
   `tests/og-series.test.ts`.
   ========================================================================== */

/**
 * Mini grafiğin kapanış serisi — son barın kapanışı BAŞLIKTAKİ fiyat.
 *
 * Kural 3 (aynı sayı iki yerde duruyorsa aynı kaynaktan): kartın sağ
 * üstündeki fiyat kotasyondan, çizginin ucu barlardan geliyordu ve seans
 * içinde ikisi ayrışıyor (gün barı 15 dakika gecikmeli, kotasyon gerçek
 * zamanlı katmanla tamamlanmış — `overlayRealtime`). Kotasyonun işlem günü
 * son barın günüyse ucu kotasyon alıyor; daha yeniyse (açılış öncesinde
 * gün barı henüz yok) uç ekleniyor; daha eskiyse seri olduğu gibi kalıyor.
 */
export function ogCloseSeries(
  bars: readonly Pick<Bar, "time" | "close">[],
  quote: Pick<Quote, "price" | "tradedAt"> | null | undefined,
): number[] {
  const closes = bars.map((bar) => bar.close);
  if (!quote?.tradedAt || bars.length === 0) return closes;
  const lastDay = etParts(new Date(bars[bars.length - 1].time * 1000)).dateStr;
  const quoteDay = etParts(quote.tradedAt).dateStr;
  if (quoteDay === lastDay) closes[closes.length - 1] = quote.price;
  else if (quoteDay > lastDay) closes.push(quote.price);
  return closes;
}

/** Serinin başından sonuna yüzde değişim; hesaplanamıyorsa null. */
export function seriesChangePct(series: readonly number[]): number | null {
  if (series.length < 2 || series[0] === 0) return null;
  return ((series[series.length - 1] - series[0]) / Math.abs(series[0])) * 100;
}

export type OgBasisLabels = {
  session: string;
  sessionClose: string;
  preMarket: string;
  afterHours: string;
  lastClose: string;
  lastPrice: string;
};

/**
 * Fiyatın künyesi: "24 Eki · Seans Kapanışı · 23:00 TR".
 *
 * Tarih ve saat İŞLEMİN anı, kartın çizildiği an değil: hafta sonu çizilen
 * kart cuma kapanışını cuma tarihiyle söylüyor. Saat okuyucunun duvar
 * saatiyle (TR'de İstanbul, EN'de New York — `lib/session-clock.ts`), yanında
 * dilim künyesi. İşlem anı yoksa künye yalnız esasın adı: uydurma saat yok.
 * `live` yön renginin açık olup olmadığı — ekrandaki şirket kartıyla aynı
 * kural: "Son Kapanış" ve "Son Fiyat" bugünü anlatmıyor, renk taşımıyor.
 */
export function ogQuoteStamp(
  quote: Pick<Quote, "tradedAt">,
  stale: boolean,
  status: MarketStatus,
  locale: Locale,
  labels: OgBasisLabels,
): { text: string; basis: DisplayBasis; live: boolean } {
  const basis = displayBasis(quoteBasis(quote, status), stale, status);
  const name = {
    session: labels.session,
    sessionClose: labels.sessionClose,
    "pre-market": labels.preMarket,
    "after-hours": labels.afterHours,
    lastClose: labels.lastClose,
    lastPrice: labels.lastPrice,
  }[basis];
  const live = basis !== "lastClose" && basis !== "lastPrice";
  if (!quote.tradedAt) return { text: name, basis, live };
  /* Gün de saatle AYNI dilimden: akşam seansındaki 19:59 ET işlemi
     İstanbul'da ertesi günün 02:59'u; ET günüyle TR saatini yan yana
     yazmak bir gün kaydırırdı. */
  const zone = displayZone(locale);
  const day = formatEtDateCompact(zoneDateKey(quote.tradedAt, zone), locale);
  const clock = `${formatInZone(quote.tradedAt, zone)} ${zoneTag(locale).primary}`;
  return { text: `${day} · ${name} · ${clock}`, basis, live };
}
