/**
 * Profil karosunun SÖZLEŞMESİ: ikon anahtarları, renkler, varsayılanlar.
 *
 * Çizimler `components/brand/AvatarIcon.tsx`te, renklerin kendisi
 * `app/globals.css`te (`--avatar-*`). Bu dosya "use client" değil ve çizim
 * taşımıyor: sunucu eylemi (doğrulama), veri katmanı ve arayüz aynı
 * listeyi okuyor. Kayıtta yalnızca anahtarlar duruyor; bir çizim ya da
 * renk değişirse seçmiş herkeste kendiliğinden değişir.
 *
 * Sıra SEÇİCİNİN sırası. Yeni ikon sona eklenir; bir anahtar silinirse
 * onu seçmiş hesap baş harflere düşer (`isAvatarKey` kayıttaki değeri süzüyor).
 */
export const AVATAR_KEYS = [
  "bell",
  "bull",
  "bear",
  "candles",
  "rocket",
  "compass",
  "trend",
  "coffee",
  "owl",
  "diamond",
  "bolt",
  "shield",
  "crown",
  "globe",
  "target",
  "star",
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

/**
 * Karonun rengi — okuyucunun seçimi.
 *
 * Yeşil ve kırmızı BİLEREK yok: sitede o iki renk yalnızca artı/eksi
 * söylüyor ve kırmızı bir profil karosu "düşüşte" diye okunurdu. Palet
 * markanın mavi ailesinden (mavi, lacivert, turkuaz), bir sıcak tondan
 * (pirinç, mürekkep sahnelerinin kıvılcımı), bir soğuk vurgudan (lavanta)
 * ve iki nötrden (mürekkep, gümüş) oluşuyor.
 */
export const AVATAR_COLORS = [
  "blue",
  "navy",
  "teal",
  "violet",
  "brass",
  "ink",
  "silver",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Renk seçilmemişse ikonun kendi rengi — ilk görünüşte karolar çeşitli. */
export const AVATAR_DEFAULT_COLOR: Record<AvatarKey, AvatarColor> = {
  bell: "blue",
  bull: "brass",
  bear: "ink",
  candles: "navy",
  rocket: "violet",
  compass: "teal",
  trend: "blue",
  coffee: "brass",
  owl: "ink",
  diamond: "teal",
  bolt: "brass",
  shield: "navy",
  crown: "brass",
  globe: "teal",
  target: "violet",
  star: "blue",
};

/** Kayıttaki hâl: ikon yoksa karo baş harfleri basıyor, renk yine geçerli. */
export type Avatar = { icon: AvatarKey | null; color: AvatarColor };

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === "string" && (AVATAR_KEYS as readonly string[]).includes(value);
}

export function isAvatarColor(value: unknown): value is AvatarColor {
  return typeof value === "string" && (AVATAR_COLORS as readonly string[]).includes(value);
}
