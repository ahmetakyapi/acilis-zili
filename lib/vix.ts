/**
 * VIX — piyasanın önümüzdeki 30 gün için beklediği oynaklık.
 *
 * Veri FRED'in VIXCLS serisinden geliyor; MACRO_SERIES'e eklenmedi çünkü VIX
 * makro gösterge değil, piyasa ölçüsü — `SeriesRequest` tam olarak bunun
 * için var. FRED kapanış değeri yayımlar ve bir iş günü gecikmeli olabilir;
 * VIX'i gösteren her yüzey gözlemin tarihini yazar, "canlı VIX" iddiası
 * taşımaz.
 *
 * Sabitler bir dönem `components/markets/FearGauge.tsx` içindeydi ve ana
 * sayfa onları bir bileşen dosyasından içe aktarıyordu. Piyasalar ekranının
 * büyük korku kadranı kalkınca (23 Eylül, kapaktaki faiz ve oynaklık
 * ızgarasına indi) bant tanımı iki ekranın ortak sözleşmesi olarak buraya
 * taşındı.
 */

export const VIX_SERIES = { seriesId: "VIXCLS", slug: "vix", units: "lin" };

/** Bantlar piyasa dilindeki yaygın eşikler; uzun dönem ortalaması ~20. */
const BANDS = [
  { max: 15, key: "calm", tone: "up" },
  { max: 20, key: "normal", tone: "flat" },
  { max: 30, key: "tense", tone: "warn" },
  { max: 50, key: "fear", tone: "down" },
  { max: Infinity, key: "panic", tone: "down" },
] as const;

export type VixBand = (typeof BANDS)[number];

/** Eşikler tek yerde: ana sayfa ve piyasalar aynı bandı okuyor. */
export function vixBand(level: number): VixBand {
  return BANDS.find((entry) => level < entry.max) ?? BANDS[BANDS.length - 1];
}
