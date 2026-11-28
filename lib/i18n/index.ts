import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  EMBED_THEME_HEADER,
  INTL_LOCALE,
  LOCALE_COOKIE,
  THEME_COOKIE,
  isLocale,
  isTheme,
  type Locale,
  type Theme,
} from "./config";
import { LOCALE_HEADER, localeFromHeader } from "./routing";
import tr from "./dictionaries/tr";
import en from "./dictionaries/en";

export type Dictionary = typeof tr;

const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * Server Component / Route Handler içinde aktif dili okur.
 *
 * SIRA ÖNEMLİ: önce ADRES, sonra çerez.
 *
 * Adres tek gerçek kaynak — `/en/piyasalar` her istemcide İngilizce açılmalı,
 * ziyaretçinin çerezi ne derse desin. Paylaşılan bir bağlantının alıcının
 * tercihine göre başka dilde açılması tam olarak düzeltilen sorundu.
 * Dili proxy bir istek başlığıyla taşıyor (lib/i18n/routing.ts).
 *
 * Önek yoksa çerez okunur: yıllardır İngilizce tercihiyle gezen biri
 * önekSİZ adreslerde varsayılana düşmesin diye.
 */
/**
 * İSTEMCİ BAĞLANTIYI KESTİKTEN SONRAKİ RENDER (28 Kasım). Next, bağlantı
 * kapanınca kalan Suspense parçalarını "after" evresinde render ediyor ve
 * orada `headers()`/`cookies()` hata atıyor ("used `headers()` inside
 * `after()`"). Yönetimdeki hata listesinin tepesi buydu: yığın
 * `CompanyCards` gibi dili soran bileşenlerden `getLocale`e iniyordu ve
 * kaynak 26 Kasım'dan beri gelen, yanıtı beklemeden kopan bot istekleriydi
 * (lib/bot-guard.ts). Yanıt çoktan gitmiş olduğu için o render'ın dili
 * hiçbir okura ulaşmıyor; YALNIZ bu hata varsayılana düşer. Derlemenin
 * dinamik işaret hatası ve diğerleri aynen yükselir (yutulursa sayfa yanlış
 * yerde statikleşirdi).
 */
function isAfterPhaseError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("inside `after()`");
}

export async function getLocale(): Promise<Locale> {
  try {
    const headerStore = await headers();
    const fromPath = localeFromHeader(headerStore.get(LOCALE_HEADER));
    if (fromPath) return fromPath;

    const store = await cookies();
    const value = store.get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch (error) {
    if (isAfterPhaseError(error)) return DEFAULT_LOCALE;
    throw error;
  }
}

export async function getTheme(): Promise<Theme> {
  try {
    /* Gömülü parça temayı adresten alır (proxy başlığa çeviriyor); başka
       sitenin çerçevesine çerez gitmiyor. Gerekçe `lib/embed.ts`. */
    const embedded = (await headers()).get(EMBED_THEME_HEADER);
    if (isTheme(embedded)) return embedded;

    const store = await cookies();
    const value = store.get(THEME_COOKIE)?.value;
    return isTheme(value) ? value : DEFAULT_THEME;
  } catch (error) {
    /* Gerekçe `getLocale`in üstünde. */
    if (isAfterPhaseError(error)) return DEFAULT_THEME;
    throw error;
  }
}

/** Sayfaların çoğu ikisini birlikte ister. */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

export { INTL_LOCALE, DEFAULT_LOCALE };
export type { Locale };
