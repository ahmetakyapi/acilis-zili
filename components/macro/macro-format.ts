import { formatPercentPlain, formatPrice } from "@/lib/utils";

/**
 * Makro değer biçimi: sunucu (kartların ilk çizimi) ve istemci (yuvarlanan
 * rakamın ara kareleri) AYNI kuraldan okusun diye tek yerde ve "use client"
 * değil.
 *
 * İŞARET BURADA (28 Eylül). Sayfa yüzdeli serileri `formatPercentPlain` ile
 * basıyordu ve o fonksiyon değerin MUTLAK değerini yazıyor ("plain": işareti
 * çağıran koyar). Perakende satışların aylık değişimi ya da enflasyonun
 * geçmiş gözlemleri eksiye düştüğünde ekran "%0,50" yazardı; grafiğin
 * geçmiş okumasında bu zaten oluyordu (RSAFS'nin eksi ayları artı
 * görünüyordu). Eksi işareti artık yüzdenin önünde.
 */
export type MacroValueFormat = {
  locale: string;
  percent: boolean;
  digits: number;
  /** Yüzde dışı serilerin birimi ("bin", "Puan"); yüzdede boş. */
  unit: string;
};

export function formatMacroValue(value: number | null, format: MacroValueFormat): string {
  if (value === null) return formatPrice(null, format.locale);
  if (format.percent) {
    const sign = value < 0 && Math.abs(value) >= 10 ** -format.digits / 2 ? "-" : "";
    return `${sign}${formatPercentPlain(value, format.locale, format.digits)}`;
  }
  return `${formatPrice(value, format.locale, { digits: format.digits })} ${format.unit}`.trimEnd();
}
