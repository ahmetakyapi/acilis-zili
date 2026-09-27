import type { Theme } from "./i18n/config";

/**
 * Gömülü parçaların (`/gomulu/*`) ortak sözleşmesi.
 *
 * Proxy, kök düzen ve iki parça sayfası aynı sabitleri okuyor; yol öneki ya
 * da tema parametresi tek yerde değişsin diye burada. Dosya "use client"
 * DEĞİL: değerler sunucuda gerçek değer olarak okunmalı (CLAUDE.md
 * "İstemci ile sunucu sınırı").
 */

/** Parçaların yol öneki — dil öneksiz. */
export const EMBED_PREFIX = "/gomulu";

/** Parça adresleri — "Sitene Ekle" bölümü ve sitemap dışlaması bunu okur. */
export const EMBED_ROUTES = {
  countdown: `${EMBED_PREFIX}/geri-sayim`,
  earnings: `${EMBED_PREFIX}/bilancolar`,
} as const;

/**
 * TEMA ADRESTEN, ÇEREZDEN DEĞİL.
 *
 * Sitenin teması `az-theme` çerezinde yaşıyor ama başka bir sitenin içindeki
 * çerçeveye o çerez GİTMİYOR (üçüncü taraf bağlamı, SameSite=Lax). Yani
 * parça, gömen sitenin koyu zemininde bile her zaman açık çizilirdi. Tema
 * bu yüzden gömme kodunun içinde, adreste: `?tema=acik|koyu`. Değerler
 * Türkçe çünkü sitenin bütün sorgu parametreleri Türkçe (`tarih`, `tur`).
 */
export const EMBED_THEME_PARAM = "tema";

const EMBED_THEMES: Record<string, Theme> = { acik: "light", koyu: "dark" };

/** `?tema=` değerini temaya çevirir; tanınmayan değer `null` (varsayılan). */
export function embedThemeFromParam(value: string | null | undefined): Theme | null {
  return value && Object.hasOwn(EMBED_THEMES, value) ? EMBED_THEMES[value] : null;
}

/** Yol bir parçaya mı ait — dil öneksiz yol beklenir. */
export function isEmbedPath(path: string): boolean {
  return path === EMBED_PREFIX || path.startsWith(`${EMBED_PREFIX}/`);
}
