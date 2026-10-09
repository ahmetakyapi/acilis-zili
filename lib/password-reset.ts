import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResets } from "@/lib/schema";
import { escapeHtml, type Email } from "@/lib/email";

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
 * RENKLER BURADA SABİT, bilerek: e-posta istemcileri CSS değişkeni ve
 * `<style>` bloğunu güvenilir okumuyor; satır içi değer tek taşınabilir yol.
 * Değerler açık temanın tokenlarıyla aynı (app/globals.css). */
export function resetEmail(input: {
  to: string;
  username: string;
  link: string;
  copy: { subject: string; greeting: string; body: string; button: string; ignore: string; signature: string };
}): Email {
  const greeting = input.copy.greeting.replace("{username}", input.username);
  const text = [greeting, "", input.copy.body, "", input.link, "", input.copy.ignore, "", input.copy.signature].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f1b2d">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e8ef;border-radius:14px;padding:28px">
<p style="margin:0 0 14px;font-size:16px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#3b4a5e">${escapeHtml(input.copy.body)}</p>
<p style="margin:0 0 22px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#1268c9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:11px 18px;border-radius:10px">${escapeHtml(input.copy.button)}</a></p>
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#5b6b80">${escapeHtml(input.copy.ignore)}</p>
<p style="margin:18px 0 0;font-size:13px;color:#5b6b80">${escapeHtml(input.copy.signature)}</p>
</div></body></html>`;
  return { to: input.to, subject: input.copy.subject, text, html };
}
