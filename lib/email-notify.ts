import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { and, count, eq, gte, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailConfigured, emailProvider, sendEmail, type Email } from "@/lib/email";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { emailLog, emailPrefs, users } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

/**
 * Bildirim postaları — tercih, çift onay, çıkış ve bütçe (16 Ekim).
 * Gerekçe lib/schema.ts → emailPrefs, emailLog.
 *
 * TEK KAPI `sendNotificationEmail`: tercih açık mı, adres onaylı mı, bugünkü
 * bütçe yetiyor mu, bu posta daha önce gitti mi — hepsini o soruyor. Alarm
 * yolu da haftalık özet de buradan geçer; biri kendi başına `sendEmail`
 * çağırsaydı er geç onaysız adrese ya da bütçenin üstünde posta giderdi.
 *
 * PAZAR ÖZETİ VARSAYILAN AÇIK, ONAYSIZ (17 Ekim, sahibinin kararı) — gerekçe
 * `enrollWeeklyDefault`. Alarm postası açık rıza + çift onayla kalıyor.
 *
 * Her şey EN İYİ ÇABA: tablo yoksa ya da yazma düşerse olayın kendisi
 * (alarm tetiği) etkilenmez, posta yalnız gitmez.
 */

export type EmailKind = "alerts" | "weekly";

/** Onay bağlantısının ömrü. */
export const CONFIRM_TTL_MS = 48 * 3600_000;

/**
 * Bildirim postasının günlük tavanı. Resend'in ücretsiz katmanı günde 100;
 * varsayılan 80 şifre sıfırlamaya 20 bırakır. Ücretli plana geçilirse
 * ortamdan yükseltilir.
 */
export function dailyBudget(): number {
  const raw = Number(process.env.EMAIL_DAILY_BUDGET);
  if (Number.isFinite(raw) && raw >= 0 && process.env.EMAIL_DAILY_BUDGET?.trim()) return Math.floor(raw);
  /* Brevo'nun ücretsiz katmanı günde 300 (lib/email.ts); 260 sıfırlamaya pay bırakır. */
  return emailProvider() === "brevo" ? 260 : 80;
}

/** Bir kullanıcıya bir günde giden alarm postası tavanı — oynak günde kutuyu boğmasın. */
export const ALERT_EMAILS_PER_USER_DAY = 12;

/**
 * ONAY POSTASI TAVANLARI (17 Ekim denetimi). Kayıtta adres doğrulanmıyor:
 * hesap başına "Tekrar Gönder" saatte üç olsa da yirmi sahte hesap günlük
 * bütçenin tamamını onay postasına harcayabiliyor (o gün kimseye alarm ve
 * pazar postası gitmezdi), tek hesap da başkasının adresine günde onlarca
 * onay postası yollayabiliyordu. Kullanıcı başına günde 3, bütün onaylar
 * için günde bütçenin dörtte biri.
 */
export const CONFIRM_EMAILS_PER_USER_DAY = 3;
const confirmShare = () => Math.max(5, Math.floor(dailyBudget() / 4));

export type EmailPrefsView = {
  /** false: tablo yok ya da e-posta servisi kapalı — panel basılmaz. */
  available: boolean;
  alerts: boolean;
  weekly: boolean;
  /** Hesabın bugünkü adresi onaylı mı. */
  confirmed: boolean;
  /** Onay bağlantısı gönderildi, süresi dolmadı. */
  pending: boolean;
};

const CLOSED: EmailPrefsView = { available: false, alerts: false, weekly: false, confirmed: false, pending: false };

export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newEmailToken(): string {
  return randomBytes(32).toString("base64url");
}

export function looksLikeEmailToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export const getEmailPrefs = cache(async (userId: string): Promise<EmailPrefsView> => {
  if (!emailConfigured()) return CLOSED;
  try {
    const [row] = await db
      .select({
        alerts: emailPrefs.alerts,
        weekly: emailPrefs.weekly,
        confirmedEmail: emailPrefs.confirmedEmail,
        confirmExpiresAt: emailPrefs.confirmExpiresAt,
        email: users.email,
      })
      .from(users)
      .leftJoin(emailPrefs, eq(emailPrefs.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return CLOSED;
    const confirmed = row.confirmedEmail !== null && row.confirmedEmail === row.email;
    return {
      available: true,
      alerts: row.alerts === true,
      /* Satırı olmayan hesap pazar özetine VARSAYILAN AÇIK (enrollWeeklyDefault). */
      weekly: row.weekly ?? true,
      confirmed,
      pending: !confirmed && row.confirmExpiresAt !== null && row.confirmExpiresAt.getTime() > Date.now(),
    };
  } catch {
    return CLOSED;
  }
});

/**
 * Tercihi yazar. Açılan bir anahtar adresi onaysız buluyorsa yeni onay
 * belirteci üretir ve döndürür (çağıran postayı yanıttan sonra gönderir);
 * süresi dolmamış bir onay zaten yoldaysa yenisini üretmez — anahtarı
 * kapatıp açmak kutuyu onay postasıyla doldurmasın.
 */
export async function writeEmailPref(
  userId: string,
  kind: EmailKind,
  enabled: boolean,
  now: Date = new Date(),
): Promise<{ ok: boolean; confirmToken: string | null }> {
  try {
    const [existing] = await db
      .select({
        confirmedEmail: emailPrefs.confirmedEmail,
        confirmExpiresAt: emailPrefs.confirmExpiresAt,
        email: users.email,
      })
      .from(users)
      .leftJoin(emailPrefs, eq(emailPrefs.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!existing) return { ok: false, confirmToken: null };

    const confirmed = existing.confirmedEmail !== null && existing.confirmedEmail === existing.email;
    const pending = existing.confirmExpiresAt !== null && existing.confirmExpiresAt.getTime() > now.getTime();
    /* Onay yalnız ALARM postası için (pazar özeti onaysız gider — enrollWeeklyDefault). */
    const confirmToken = enabled && kind === "alerts" && !confirmed && !pending ? newEmailToken() : null;
    const confirmFields = confirmToken
      ? { confirmTokenHash: hashEmailToken(confirmToken), confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS) }
      : {};

    const toggle = kind === "alerts" ? { alerts: enabled } : { weekly: enabled };
    await db
      .insert(emailPrefs)
      /* Yeni satır pazar özetine açık doğar (varsayılan açık — enrollWeeklyDefault). */
      .values({ userId, weekly: true, ...toggle, unsubToken: newEmailToken(), updatedAt: now, ...confirmFields })
      .onConflictDoUpdate({
        target: emailPrefs.userId,
        set: { ...toggle, updatedAt: now, ...confirmFields },
      });
    /* Okuyucu pazar özeti hakkında KENDİSİ karar verdi: kayıt adımı onun
       seçimini bir daha değiştirmesin. */
    if (kind === "weekly") await markEnrolled(userId, now);
    return { ok: true, confirmToken };
  } catch {
    return { ok: false, confirmToken: null };
  }
}

/** Onay postası için yeni belirteç — "Tekrar Gönder". Onaylıysa null. */
export async function reissueConfirmToken(userId: string, now: Date = new Date()): Promise<string | null> {
  try {
    const token = newEmailToken();
    const rows = await db
      .update(emailPrefs)
      .set({
        confirmTokenHash: hashEmailToken(token),
        confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
        updatedAt: now,
      })
      .where(
        and(
          eq(emailPrefs.userId, userId),
          eq(emailPrefs.alerts, true),
          sql`${emailPrefs.confirmedEmail} is distinct from (select ${users.email} from ${users} where ${users.id} = ${userId})`,
        ),
      )
      .returning({ userId: emailPrefs.userId });
    return rows.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** Onay bağlantısının sahibi — sayfa açılırken geçerliliği sormak için. */
export async function confirmTokenValid(token: string, now: Date = new Date()): Promise<boolean> {
  if (!looksLikeEmailToken(token)) return false;
  try {
    const [row] = await db
      .select({ userId: emailPrefs.userId })
      .from(emailPrefs)
      .where(and(eq(emailPrefs.confirmTokenHash, hashEmailToken(token)), gte(emailPrefs.confirmExpiresAt, now)))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Onayı uygular: belirteç tek kullanımlık, onaylanan adres hesabın O ANKİ
 * adresi. Tek sorgu — iki sekmeden aynı anda basılsa da biri kazanır.
 */
export async function confirmEmail(token: string, now: Date = new Date()): Promise<boolean> {
  if (!looksLikeEmailToken(token)) return false;
  try {
    const rows = await db
      .update(emailPrefs)
      .set({
        confirmedEmail: sql`(select ${users.email} from ${users} where ${users.id} = ${emailPrefs.userId})`,
        confirmedAt: now,
        confirmTokenHash: null,
        confirmExpiresAt: null,
        updatedAt: now,
      })
      .where(and(eq(emailPrefs.confirmTokenHash, hashEmailToken(token)), gte(emailPrefs.confirmExpiresAt, now)))
      .returning({ userId: emailPrefs.userId });
    return rows.length > 0;
  } catch {
    return false;
  }
}

export type UnsubscribeScope = EmailKind | "all";

export function isUnsubscribeScope(value: unknown): value is UnsubscribeScope {
  return value === "alerts" || value === "weekly" || value === "all";
}

/** Girişsiz çıkış — postadaki bağlantı ve `List-Unsubscribe-Post`. */
export async function unsubscribe(token: string, scope: UnsubscribeScope, now: Date = new Date()): Promise<boolean> {
  return (await unsubscribeResult(token, scope, now)) === "ok";
}

/** Aynı iş, sonucu adıyla: tanınmayan anahtar ile veritabanı hatası ayrı (tek tıkla uç 404 / 503). */
export async function unsubscribeResult(token: string, scope: UnsubscribeScope, now: Date = new Date()): Promise<"ok" | "unknown" | "error"> {
  if (!looksLikeEmailToken(token)) return "unknown";
  const set =
    scope === "all" ? { alerts: false, weekly: false } : scope === "alerts" ? { alerts: false } : { weekly: false };
  try {
    const rows = await db
      .update(emailPrefs)
      .set({ ...set, updatedAt: now })
      .where(eq(emailPrefs.unsubToken, token))
      .returning({ userId: emailPrefs.userId });
    if (rows[0] && scope !== "alerts") await markEnrolled(rows[0].userId, now);
    return rows.length > 0 ? "ok" : "unknown";
  } catch {
    return "error";
  }
}

/** Onay postası gitmediyse bekleyen onayı geri al: Ayarlar "onay bekleniyor" demesin, sonraki dokunuş yeni bağlantı üretsin. */
export async function abandonConfirm(userId: string, tokenHash: string): Promise<void> {
  try {
    await db
      .update(emailPrefs)
      .set({ confirmTokenHash: null, confirmExpiresAt: null })
      .where(and(eq(emailPrefs.userId, userId), eq(emailPrefs.confirmTokenHash, tokenHash)));
  } catch {
    /* tablo yok */
  }
}

export async function unsubscribeTokenValid(token: string): Promise<boolean> {
  if (!looksLikeEmailToken(token)) return false;
  try {
    const [row] = await db
      .select({ userId: emailPrefs.userId })
      .from(emailPrefs)
      .where(eq(emailPrefs.unsubToken, token))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}

export type Recipient = {
  userId: string;
  email: string;
  username: string;
  locale: Locale;
  unsubToken: string;
};

function toRecipient(row: { userId: string; email: string; username: string; locale: string; unsubToken: string }): Recipient {
  return { ...row, locale: isLocale(row.locale) ? row.locale : "tr" };
}

const recipientColumns = {
  userId: users.id,
  email: users.email,
  username: users.username,
  locale: users.locale,
  unsubToken: emailPrefs.unsubToken,
};

/** Tercihi açık VE adresi onaylı alıcı; değilse null. */
export async function deliverableRecipient(userId: string, kind: EmailKind): Promise<Recipient | null> {
  if (!emailConfigured()) return null;
  try {
    const [row] = await db
      .select(recipientColumns)
      .from(emailPrefs)
      .innerJoin(users, eq(users.id, emailPrefs.userId))
      .where(and(eq(emailPrefs.userId, userId), eq(emailPrefs[kind], true), eq(emailPrefs.confirmedEmail, users.email)))
      .limit(1);
    return row ? toRecipient(row) : null;
  } catch {
    return null;
  }
}

/**
 * Haftalık özetin alıcıları — tercih açık. ADRES ONAYI ARANMAZ (17 Ekim,
 * sahibinin kararı): pazar özeti bütün üyelere varsayılan açık; okuyucu
 * postadaki tek tıkla çıkışla ya da Ayarlar'dan kapatır. Alarm postası
 * onaylı adres istemeye devam ediyor (`deliverableRecipient`).
 */
export async function weeklyRecipients(): Promise<Recipient[] | null> {
  try {
    const rows = await db
      .select(recipientColumns)
      .from(emailPrefs)
      .innerJoin(users, eq(users.id, emailPrefs.userId))
      .where(and(eq(emailPrefs.weekly, true), isNotNull(users.email)));
    return rows.map(toRecipient);
  } catch {
    return null;
  }
}

/** Varsayılan açılışın defter işareti — bir kez yazılır, budanmaz, bütçeye sayılmaz. */
export const ENROLL_KIND = "enroll";
const enrollKey = (userId: string) => `weekly-default:${userId}`;

async function markEnrolled(userId: string, now: Date): Promise<void> {
  await db
    .insert(emailLog)
    .values({ userId, kind: ENROLL_KIND, dedupeKey: enrollKey(userId), sentAt: now })
    .onConflictDoNothing({ target: emailLog.dedupeKey });
}

/**
 * PAZAR ÖZETİ VARSAYILAN AÇIK (17 Ekim, sahibinin kararı: "şu an aktif
 * olarak her kullanıcıya ekleyelim, isterse ayarlardan kapatsın").
 *
 * Her hesap HAYATINDA BİR KEZ kaydedilir: tercih satırı yoksa `weekly: true`
 * ve çıkış anahtarıyla açılır, varsa (yalnız alarmı açmış hesaplarda
 * `weekly` varsayılanı false'tu) true yapılır; defterine `enroll` işareti
 * düşer. İşaret sayesinde özeti kapatan okuyucu bir sonraki pazar yeniden
 * açılmaz. Yeni üyeler ilk pazar koşusunda kaydedilir. Migration yok:
 * işaret var olan `email_log` tablosunda (budama ve bütçe onu dışlıyor).
 */
export async function enrollWeeklyDefault(now: Date = new Date()): Promise<number | null> {
  try {
    const pending = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`not exists (select 1 from ${emailLog} where ${emailLog.dedupeKey} = 'weekly-default:' || ${users.id}::text)`)
      .limit(5000);
    for (const { id } of pending) {
      await db
        .insert(emailPrefs)
        .values({ userId: id, weekly: true, unsubToken: newEmailToken(), updatedAt: now })
        .onConflictDoUpdate({ target: emailPrefs.userId, set: { weekly: true, updatedAt: now } });
      await markEnrolled(id, now);
    }
    return pending.length;
  } catch {
    return null;
  }
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type ClaimResult = "claimed" | "duplicate" | "budget" | "user-cap" | "unavailable";

/**
 * Gönderimi SAHİPLENİR: bütçe ve kullanıcı tavanı yetiyorsa defter satırını
 * yazar. Satır önce yazılır ki aynı anda koşan iki tarama aynı postayı iki
 * kez göndermesin (benzersiz `dedupeKey` — ikincisi "duplicate" alır).
 */
export async function claimSend(
  userId: string,
  kind: "confirm" | "alert" | "weekly",
  dedupeKey: string,
  now: Date = new Date(),
): Promise<ClaimResult> {
  try {
    const since = startOfUtcDay(now);
    const [today] = await db
      .select({ n: count() })
      .from(emailLog)
      .where(and(gte(emailLog.sentAt, since), ne(emailLog.kind, ENROLL_KIND)));
    if ((today?.n ?? 0) >= dailyBudget()) return "budget";
    if (kind === "confirm") {
      const [mine] = await db
        .select({ n: count() })
        .from(emailLog)
        .where(and(eq(emailLog.userId, userId), eq(emailLog.kind, "confirm"), gte(emailLog.sentAt, since)));
      if ((mine?.n ?? 0) >= CONFIRM_EMAILS_PER_USER_DAY) return "user-cap";
      const [all] = await db
        .select({ n: count() })
        .from(emailLog)
        .where(and(eq(emailLog.kind, "confirm"), gte(emailLog.sentAt, since)));
      if ((all?.n ?? 0) >= confirmShare()) return "budget";
    }
    if (kind === "alert") {
      const [mine] = await db
        .select({ n: count() })
        .from(emailLog)
        .where(and(eq(emailLog.userId, userId), eq(emailLog.kind, "alert"), gte(emailLog.sentAt, since)));
      if ((mine?.n ?? 0) >= ALERT_EMAILS_PER_USER_DAY) return "user-cap";
    }
    const rows = await db
      .insert(emailLog)
      .values({ userId, kind, dedupeKey, sentAt: now })
      .onConflictDoNothing({ target: emailLog.dedupeKey })
      .returning({ id: emailLog.id });
    return rows.length > 0 ? "claimed" : "duplicate";
  } catch {
    return "unavailable";
  }
}

/** Gönderim düştüyse sahiplenmeyi geri al — sonraki koşu yeniden denesin. */
export async function releaseSend(dedupeKey: string): Promise<void> {
  try {
    await db.delete(emailLog).where(eq(emailLog.dedupeKey, dedupeKey));
  } catch {
    /* defter yok */
  }
}

/** Postadaki çıkış bağlantısı — `kind` yalnız o postayı, `all` ikisini kapatır. */
export function unsubscribeUrl(recipient: Pick<Recipient, "unsubToken" | "locale">, scope: UnsubscribeScope): string {
  const prefix = recipient.locale === "en" ? "/en" : "";
  return `${SITE_URL}${prefix}/e-posta/ayril?anahtar=${recipient.unsubToken}&kapsam=${scope}`;
}

/** RFC 8058 tek tıkla çıkış ucu — posta istemcisinin "Abonelikten Çık" düğmesi. */
export function oneClickUrl(recipient: Pick<Recipient, "unsubToken">, scope: UnsubscribeScope): string {
  return `${SITE_URL}/api/e-posta/ayril?anahtar=${recipient.unsubToken}&kapsam=${scope}`;
}

/**
 * Bildirim postasını gönderir: sahiplen → gönder → düşerse geri al.
 * `build` alıcıyı alır ve postayı kurar (dil, çıkış bağlantısı alıcıya bağlı).
 */
export async function sendNotificationEmail(
  recipient: Recipient,
  kind: "alert" | "weekly",
  dedupeKey: string,
  build: (recipient: Recipient) => Email,
): Promise<ClaimResult | "sent" | "failed"> {
  /* Posta SAHİPLENMEDEN ÖNCE kurulur (17 Ekim denetimi): şablon beklenmedik
     veride fırlatınca defter satırı kalıyor, alıcı o haftanın bütün tekrar
     koşularında "duplicate" sayılıp postasız kalıyordu. */
  const email = build(recipient);
  const claim = await claimSend(recipient.userId, kind, dedupeKey);
  if (claim !== "claimed") return claim;
  const scope: UnsubscribeScope = kind === "alert" ? "alerts" : "weekly";
  const message: Email = {
    ...email,
    headers: {
      ...email.headers,
      "List-Unsubscribe": `<${oneClickUrl(recipient, scope)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
  /* Alarm yeniden tetiklenmez: geçici bir servis hatası (5xx, zaman aşımı)
     o postayı sonsuza kadar kaybettirirdi. Bir kez, kısa bir aradan sonra
     yeniden denenir; haftalık posta zaten sonraki saatlik koşuda tamamlanıyor. */
  let ok = await sendEmail(message);
  if (!ok && kind === "alert") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ok = await sendEmail(message);
  }
  if (!ok) {
    await releaseSend(dedupeKey);
    return "failed";
  }
  return "sent";
}

/** Veri dışa aktarımı (KVKK) — tercih satırı; yoksa ya da tablo yoksa null. */
export async function exportEmailPrefs(
  userId: string,
): Promise<{ alerts: boolean; weekly: boolean; confirmedEmail: string | null; confirmedAt: string | null } | null> {
  try {
    const [row] = await db
      .select({ alerts: emailPrefs.alerts, weekly: emailPrefs.weekly, confirmedEmail: emailPrefs.confirmedEmail, confirmedAt: emailPrefs.confirmedAt })
      .from(emailPrefs)
      .where(eq(emailPrefs.userId, userId))
      .limit(1);
    return row ? { ...row, confirmedAt: row.confirmedAt?.toISOString() ?? null } : null;
  } catch {
    return null;
  }
}

/** Günlük cron adımı: 90 günden eski defter satırlarını siler. */
export async function pruneEmailLog(now: Date = new Date()): Promise<string> {
  try {
    const cutoff = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
    /* Kayıt işareti budanmaz: silinirse özeti kapatan okuyucu yeniden açılırdı. */
    const rows = await db
      .delete(emailLog)
      .where(and(lt(emailLog.sentAt, cutoff), ne(emailLog.kind, ENROLL_KIND)))
      .returning({ id: emailLog.id });
    return String(rows.length);
  } catch {
    return "atlandı: email_log tablosu yok";
  }
}
