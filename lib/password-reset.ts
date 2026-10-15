import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResets } from "@/lib/schema";
import { escapeHtml, type Email } from "@/lib/email";
import { brandedEmailHtml, emailButton, emailChips, emailText } from "@/lib/email-layout";

/**
 * Şifre sıfırlama bağlantıları — gerekçe `lib/schema.ts` → passwordResets.
 * Eylemler `app/actions/auth.ts` (requestPasswordResetAction,
 * resetPasswordAction).
 */

/** Bağlantının ömrü — e-postayı açıp şifreyi yazmaya yetecek kadar. */
export const RESET_TTL_MS = 30 * 60_000;

/** 32 rastgele bayt, adres için base64url (43 karakter). */
export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Biçim denetimi — veritabanına gitmeden çöp girdiyi eler. */
export function looksLikeResetToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/**
 * Yeni bağlantı üretir ve kaydeder; hesabın kullanılmamış eski
 * bağlantıları siliniyor (aynı anda tek geçerli bağlantı). `null` tablo
 * yok ya da yazma düştü.
 */
export async function issueResetToken(userId: string, now: Date = new Date()): Promise<string | null> {
  const token = newResetToken();
  try {
    await db.batch([
      db.delete(passwordResets).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt))),
      db.insert(passwordResets).values({
        userId,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      }),
    ]);
    return token;
  } catch {
    return null;
  }
}

/** Geçerli (kullanılmamış, süresi dolmamış) bağlantının sahibi — yoksa `null`. */
export async function resetTokenOwner(token: string, now: Date = new Date()): Promise<string | null> {
  if (!looksLikeResetToken(token)) return null;
  try {
    const [row] = await db
      .select({ userId: passwordResets.userId })
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, hashResetToken(token)),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, now),
        ),
      )
      .limit(1);
    return row?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Sıfırlama e-postası — düz metin ve HTML aynı içerik, okuyucunun dilinde.
 *
 * HTML markalı kaptan geçiyor (lib/email-layout.ts — tablo düzeni, satır
 * içi stil, zil GIF'i; gerekçeler orada). Düz metin sürümü aynı sırayı
 * izliyor: HTML'i göstermeyen istemcide de bağlantı ve uyarılar tam.
 */
export function resetEmail(input: {
  to: string;
  username: string;
  link: string;
  lang: "tr" | "en";
  copy: {
    subject: string;
    preheader: string;
    heroTitle: string;
    heroLead: string;
    greeting: string;
    body: string;
    button: string;
    validity: string;
    singleUse: string;
    fallback: string;
    noteTitle: string;
    ignore: string;
    noReply: string;
    signature: string;
    footerHome: string;
    footerPrivacy: string;
  };
}): Email {
  const { copy } = input;
  const greeting = copy.greeting.replace("{username}", input.username);
  const origin = new URL(input.link).origin;
  const prefix = input.lang === "en" ? "/en" : "";
  const text = [
    greeting,
    "",
    copy.body,
    "",
    input.link,
    "",
    `${copy.validity} · ${copy.singleUse}`,
    "",
    copy.ignore,
    "",
    copy.signature,
    "",
    copy.noReply,
  ].join("\n");
  const html = brandedEmailHtml({
    lang: input.lang,
    preheader: copy.preheader,
    heroTitle: copy.heroTitle,
    heroLead: copy.heroLead,
    brandName: copy.signature,
    origin,
    bodyHtml: [
      emailText.greeting(greeting),
      emailText.paragraph(copy.body),
      emailButton(copy.button, input.link),
      `<div style="height:18px;line-height:18px">&nbsp;</div>`,
      emailChips([copy.validity, copy.singleUse]),
      emailText.fallback(copy.fallback, input.link),
      emailText.note(copy.noteTitle, copy.ignore),
      emailText.signature(escapeHtml(copy.signature)),
    ].join("\n"),
    footerLines: [copy.noReply],
    footerLinks: [
      { label: copy.footerHome, href: `${origin}${prefix || "/"}` },
      { label: copy.footerPrivacy, href: `${origin}${prefix}/kvkk` },
    ],
  });
  return { to: input.to, subject: copy.subject, text, html };
}
