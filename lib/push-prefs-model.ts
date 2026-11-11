/**
 * PUSH TÜR TERCİHLERİ — saf model (11 Kasım). Saklama lib/push-prefs.ts,
 * tablo gerekçesi lib/schema.ts → pushPreferences.
 *
 * Tercih CİHAZ değil HESAP başına (notification_prefs'teki bilanço
 * hatırlatmasıyla aynı ilke): içeriğe dair bir seçim, gönderim zaten
 * hesabın bütün abone cihazlarına gidiyor.
 *
 * VARSAYILANLAR — satır yokken okunan değer:
 * - `price` (fiyat ve yüzde alarmı) AÇIK: tablo gelmeden önce cihazını
 *   açan herkes alarm push'u alıyordu; tercih ekranı geldi diye sessizce
 *   kesilmesin.
 * - `weekly` (cuma portföy özeti) KAPALI: yeni bir push türü okura sormadan
 *   telefonunu öttürmesin. Tek istisna site sahibi (`users.role =
 *   'admin'`): özelliği o istedi, varsayılanı açık.
 */

export const PUSH_KINDS = ["price", "weekly"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export type PushPrefs = Record<PushKind, boolean>;

export function isPushKind(value: unknown): value is PushKind {
  return typeof value === "string" && (PUSH_KINDS as readonly string[]).includes(value);
}

export function defaultPushPref(kind: PushKind, role: string | null | undefined): boolean {
  if (kind === "price") return true;
  return role === "admin";
}

/** Saklı satırlar + varsayılan → bütün türlerin değeri. Bilinmeyen tür satırı yok sayılır. */
export function resolvePushPrefs(
  rows: readonly { kind: string; enabled: boolean }[],
  role: string | null | undefined,
): PushPrefs {
  const out = Object.fromEntries(PUSH_KINDS.map((kind) => [kind, defaultPushPref(kind, role)])) as PushPrefs;
  for (const row of rows) if (isPushKind(row.kind)) out[row.kind] = row.enabled === true;
  return out;
}
