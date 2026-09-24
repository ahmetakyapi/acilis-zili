/**
 * Kahramanın endeks kartları ile alt şerit arasındaki köprü.
 *
 * İkisi aynı dört sembolü aynı biçimleyiciyle basıyor. Kartlar seans içinde
 * `/api/endeks`ten tazelenince (`IndexLive`) biçimlenmiş dizeler bu olayla
 * şeride iletiliyor; şerit kendi ilk paketini bunlarla değiştiriyor ve iki
 * yüzey aynı anda iki farklı fiyat gösteremiyor. Modül ayrı, çünkü şerit her
 * sayfada — kart bileşenini (ve kıvılcım çizgisini) şeridin demetine
 * çekmesin.
 */
export const INDEX_EVENT = "az:index-quotes";

export type IndexTickerPatch = Record<
  string,
  { value: string; change: string; changePct: number | null }
>;
