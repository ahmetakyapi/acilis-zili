export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_COOKIE = "az-locale";
export const THEME_COOKIE = "az-theme";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "light";

/**
 * Gömülü parçanın temasını sayfaya taşıyan istek başlığı — proxy yazıyor,
 * `getTheme()` okuyor. Yalnızca `/gomulu/*` isteklerinde ve yalnızca proxy
 * tarafından yazılır (gerekçe `lib/embed.ts`).
 */
export const EMBED_THEME_HEADER = "x-az-embed-theme";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Intl API'lerine verilen tam etiket. */
export const INTL_LOCALE: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
};
