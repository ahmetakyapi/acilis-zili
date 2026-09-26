/**
 * Profil ikonlarının SÖZLEŞMESİ — anahtarlar ve tonlar.
 *
 * Çizimler `components/brand/AvatarIcon.tsx`te; bu dosya "use client"
 * değil ve çizim taşımıyor, çünkü sunucu eylemi (doğrulama), veri katmanı
 * ve arayüz aynı listeyi okuyor. Kayıtta yalnızca anahtar duruyor: bir
 * ikonun çizimi değişirse seçmiş herkeste kendiliğinden değişir.
 *
 * Sıra SEÇİCİNİN sırası. Yeni ikon sona eklenir; bir anahtar silinirse onu
 * seçmiş hesap baş harflere düşer (`isAvatarKey` kayıttaki değeri süzüyor).
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
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

/**
 * Karonun zemini. Üç ton, üçü de temadan: marka mavisi, pirinç (mürekkep
 * sahnelerinin kıvılcımı) ve mürekkep. Yön renkleri (`--up`/`--down`)
 * BİLEREK yok — sitede o iki renk yalnızca artı/eksi söylüyor; kırmızı bir
 * profil karosu "düşüşte" gibi okunurdu.
 */
export type AvatarTone = "primary" | "brass" | "ink";

export const AVATAR_TONE: Record<AvatarKey, AvatarTone> = {
  bell: "primary",
  bull: "brass",
  bear: "ink",
  candles: "ink",
  rocket: "primary",
  compass: "brass",
  trend: "primary",
  coffee: "brass",
  owl: "ink",
  diamond: "primary",
  bolt: "brass",
  shield: "ink",
};

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === "string" && (AVATAR_KEYS as readonly string[]).includes(value);
}
