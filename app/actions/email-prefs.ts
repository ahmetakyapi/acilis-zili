"use server";

import { after } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";
import {
  claimSend,
  confirmEmail,
  getEmailPrefs,
  hashEmailToken,
  isUnsubscribeScope,
  reissueConfirmToken,
  unsubscribe,
  writeEmailPref,
  type EmailKind,
  type EmailPrefsView,
} from "@/lib/email-notify";
import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { confirmEmailMessage } from "@/lib/notify-emails";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { emailPrefs, users } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

/**
 * E-posta bildirim tercihleri — Ayarlar → E-posta Bildirimleri
 * (components/notifications/EmailSettings.tsx). Gerekçe lib/email-notify.ts.
 *
 * Satır OTURUMUN hesabına yazılır. Onay postası yanıttan SONRA gider
 * (`after`): Resend'in gecikmesi anahtarı bekletmesin.
 */

export type TokenState = { done: boolean; ok: boolean };

type Result = { ok: boolean; prefs: EmailPrefsView | null; error?: "rate" | "failed" };

async function sessionUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Onay postasını gönderir — bütçe defterinden geçer (kötüye kullanım tavanı). */
async function sendConfirm(userId: string, token: string): Promise<void> {
  const [row] = await db
    .select({ email: users.email, username: users.username, locale: users.locale, alerts: emailPrefs.alerts, weekly: emailPrefs.weekly })
    .from(users)
    .innerJoin(emailPrefs, eq(emailPrefs.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return;
  const locale = isLocale(row.locale) ? row.locale : "tr";
  const claim = await claimSend(userId, "confirm", `confirm:${hashEmailToken(token).slice(0, 32)}`);
  if (claim !== "claimed") return;
  await sendEmail(
    confirmEmailMessage({
      to: row.email,
      username: row.username,
      locale,
      link: `${SITE_URL}${withLocale("/e-posta/onay", locale)}?anahtar=${token}`,
      kinds: { alerts: row.alerts, weekly: row.weekly },
      copy: getDictionary(locale).emailNotify,
    }),
  );
}

export async function setEmailPrefAction(kind: EmailKind, enabled: boolean): Promise<Result> {
  const id = await sessionUser();
  if (!id || !emailConfigured() || (kind !== "alerts" && kind !== "weekly")) return { ok: false, prefs: null, error: "failed" };
  if (!rateLimit(`email-pref:${id}`, 10, 60_000).allowed) return { ok: false, prefs: null, error: "rate" };
  const written = await writeEmailPref(id, kind, enabled === true);
  if (!written.ok) return { ok: false, prefs: null, error: "failed" };
  const token = written.confirmToken;
  if (token) after(() => sendConfirm(id, token));
  const prefs = await getEmailPrefs(id);
  /* Onay postası henüz gitmedi ama yolda; ekran "onay bekleniyor" desin. */
  return { ok: true, prefs: token ? { ...prefs, pending: true } : prefs };
}

/** "Onay Bağlantısını Tekrar Gönder" — saatte üç. */
export async function resendEmailConfirmAction(): Promise<Result> {
  const id = await sessionUser();
  if (!id || !emailConfigured()) return { ok: false, prefs: null, error: "failed" };
  if (!rateLimit(`email-confirm:${id}`, 3, 3_600_000).allowed) return { ok: false, prefs: null, error: "rate" };
  const token = await reissueConfirmToken(id);
  if (!token) return { ok: false, prefs: await getEmailPrefs(id), error: "failed" };
  after(() => sendConfirm(id, token));
  const prefs = await getEmailPrefs(id);
  return { ok: true, prefs: { ...prefs, pending: true } };
}

/** Onay sayfasının düğmesi — GET'te onaylanmaz: bağlantı tarayan güvenlik yazılımları basmasın. */
export async function confirmEmailAction(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const token = formData.get("anahtar");
  if (typeof token !== "string") return { done: true, ok: false };
  if (!rateLimit(await requestKey("email-confirm-page"), 20, 600_000).allowed) return { done: true, ok: false };
  return { done: true, ok: await confirmEmail(token) };
}

/** Çıkış sayfasının düğmesi — girişsiz; anahtar satır başına sabit ve tahmin edilemez. */
export async function unsubscribeAction(_prev: TokenState, formData: FormData): Promise<TokenState> {
  const token = formData.get("anahtar");
  const scope = formData.get("kapsam");
  if (typeof token !== "string" || !isUnsubscribeScope(scope)) return { done: true, ok: false };
  if (!rateLimit(await requestKey("unsub-page"), 20, 600_000).allowed) return { done: true, ok: false };
  return { done: true, ok: await unsubscribe(token, scope) };
}
