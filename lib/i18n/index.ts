import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
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
export async function getLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromPath = localeFromHeader(headerStore.get(LOCALE_HEADER));
  if (fromPath) return fromPath;

  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** Sayfaların çoğu ikisini birlikte ister. */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

export { INTL_LOCALE, DEFAULT_LOCALE, DEFAULT_THEME };
export type { Locale, Theme };
