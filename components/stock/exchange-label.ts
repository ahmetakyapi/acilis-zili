import type { Locale } from "@/lib/i18n";
import { titleCaseLabel } from "@/lib/utils";

/**
 * BORSA ADI OKUNUR BİÇİMDE (24 Eylül).
 *
 * Sağlayıcı borsayı kendi kayıt adıyla veriyor ve profil kartı onu olduğu
 * gibi basıyordu: NVDA'da "NASDAQ NMS - GLOBAL MARKET", NYSE şirketlerinde
 * "NEW YORK STOCK EXCHANGE, INC.", TSM'de "TAIWAN STOCK EXCHANGE". Kartın
 * öteki satırları Title Case ve kısa; bu satır büyük harfle bağıran bir
 * kurum künyesiydi. Bilinen üç ad okuyucunun kullandığı adla yazılıyor,
 * gerisi Title Case'e çevriliyor (küçültme `tr-TR` ile — `i → İ` tuzağı,
 * CLAUDE.md).
 *
 * NEDEN BU DOSYADA: yalnızca hisse sayfası kullanıyor; `lib/utils.ts`
 * paylaşılan bir dosya ve bu eşleme bir ekranın sözlüğü.
 */
const EXCHANGES: Record<string, { tr: string; en: string }> = {
  "NASDAQ NMS - GLOBAL MARKET": { tr: "Nasdaq", en: "Nasdaq" },
  "NEW YORK STOCK EXCHANGE, INC.": { tr: "NYSE", en: "NYSE" },
  "TAIWAN STOCK EXCHANGE": { tr: "Tayvan Borsası", en: "Taiwan Stock Exchange" },
};

export function exchangeLabel(raw: string | null | undefined, locale: Locale): string | null {
  const key = raw?.trim();
  if (!key) return null;
  const known = EXCHANGES[key.toUpperCase()];
  if (known) return known[locale === "tr" ? "tr" : "en"];
  const lower = key.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US");
  return titleCaseLabel(lower, locale);
}
