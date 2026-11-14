import { createHash } from "node:crypto";

/**
 * Kişisel Claude notlarının ortak etiketi ve günlük kimliği (14 Kasım
 * güvenlik denetimi).
 *
 * ETİKET. Portföyden ve takip listesinden türeyen notlar `unstable_cache`te
 * durur; veritabanı hesabı CASCADE ile temizler ama önbellek kaydı kalırdı.
 * Kişisel sonuç veren her önbellek kendi etiketinin YANINA `user:<kimlik>`
 * taşır, hesap silinince `revalidateTag` o etiketi düşürür
 * (app/actions/auth.ts → deleteAccountAction). Etiket önbellek anahtarına
 * girmez (anahtar geri çağrının metni + keyParts): eklemek var olan kaydı
 * ıskalatmaz. Yeni kişisel önbellek açan, etiketi de ekler
 * (`tests/user-tag.test.ts` listeyi kaynaktan denetler).
 *
 * GÜNLÜK. Not düşünce yazılan satır kullanıcı kimliğini ve düşen metnin
 * parçalarını (kaynaksız sayılar, tavsiye kalıbına takılan ifade)
 * basıyordu: sunucu günlüğü önbellekten ve veritabanından uzun yaşar,
 * hesap silinince de temizlenmez. Kimlik yerine kısa özeti, hata yerine
 * yalnız nedenin KODU yazılır.
 */

export const userCacheTag = (userId: string) => `user:${userId}`;

/** Kimliğin günlükteki karşılığı: SHA-256'nın ilk sekiz karakteri — aynı hesabın satırları eşleşir, kimlik okunmaz. */
export const userLogId = (userId: string) => createHash("sha256").update(userId).digest("hex").slice(0, 8);

/**
 * Hatanın günlüğe yazılabilir nedeni. Denetimler nedeni "kod (ayrıntı)"
 * biçiminde fırlatır (`ungrounded (12,5 %3)`, `advice (… | …)`); ayrıntı
 * notun metnidir, atılır. Veritabanı hatasının metni sorguyu ve
 * parametrelerini (kullanıcı kimlikleri) taşır: yalnız türü yazılır.
 */
export function logReason(error: unknown): string {
  if (!(error instanceof Error)) return "?";
  if (error.message.startsWith("Failed query")) return "db";
  return (error.message.split(" (")[0] ?? "").slice(0, 80) || "?";
}
