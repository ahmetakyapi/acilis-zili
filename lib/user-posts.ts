import { z } from "zod";

/**
 * Kullanıcı yazılarının SÖZLEŞMESİ: durum makinesi, sınırlar, slug ve
 * doğrulama şeması. Gerekçe lib/schema.ts → userPosts. Okuma yolu
 * lib/user-post-data.ts, eylemler app/actions/user-posts.ts ve
 * app/actions/moderation.ts.
 *
 * Düz modül ("use client" değil): şema sunucu eyleminde, durum etiketleri
 * istemci listesinde okunuyor (lib/profiles.ts ile aynı sınır kararı).
 */

export type PostStatus = "draft" | "pending" | "published" | "rejected";

export const POST_STATUSES: readonly PostStatus[] = ["draft", "pending", "published", "rejected"];

export function isPostStatus(value: unknown): value is PostStatus {
  return typeof value === "string" && (POST_STATUSES as readonly string[]).includes(value);
}

/** Hesap başına yazı tavanı — döngüyle tabloyu şişirmeye karşı. */
export const MAX_USER_POSTS = 50;

/**
 * Gövde sınırları stories ile aynı (lib/content-write.ts → storyInputSchema):
 * iki içerik türü aynı çizim yolundan geçiyor, aynı ölçüye sığmalı.
 */
export const postInputSchema = z.object({
  title: z.string().trim().min(10).max(160),
  dek: z.string().trim().min(20).max(400),
  body_md: z.string().trim().min(200).max(40_000),
  symbols: z.array(z.string().trim().toUpperCase().min(1).max(12)).max(12).optional(),
});

export type PostInput = z.infer<typeof postInputSchema>;

/**
 * Başlıktan adres parçası. Türkçe harfler çevrilir (İ/ı dahil — düz
 * toLowerCase yasak, toLocaleLowerCase("tr-TR") + eşleme), kalan her şey
 * tireye düşer, sona ÇAKIŞMA EKİ gelir (eylem üretir): slug küresel
 * benzersiz ve bir kez türetilir, başlık sonradan değişse de adres kalır.
 * Çıktı content-write'ın slug desenine uyar: ^[a-z0-9]+(?:-[a-z0-9]+)*$.
 */
const TR_HARF: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

export function postSlug(title: string, suffix: string): string {
  const base = title
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (ch) => TR_HARF[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base ? `${base}-${suffix}` : `yazi-${suffix}`;
}
