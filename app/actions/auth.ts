"use server";

import { compare, hash } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users, watchlists } from "@/lib/schema";
import { getDictionary, getLocale } from "@/lib/i18n";
import { rateLimit } from "@/lib/rate-limit";

export type AuthFormState = {
  error?: string;
  field?: "username" | "email" | "password" | "passwordConfirm" | "form";
};

/* --------------------------------------------------------------------------
   Oran sınırı

   Giriş ve kayıt uçlarında hiçbir tavan yoktu: aynı adresten dakikada
   binlerce şifre denemesi ya da binlerce hesap açılışı mümkündü. bcrypt'in
   maliyeti (12 tur) tek başına bir yavaşlatıcı ama ücretsiz bir koruma
   değil — her deneme sunucu işlemcisi harcıyor.

   Sınır bilinçli olarak cömert: yanlış şifreyi üç kez yazan gerçek bir
   kullanıcı hiç fark etmez, kaba kuvvet denemesi ilk dakikada durur.
   Sınırlayıcının dağıtık olmadığı ve neyi çözüp neyi çözmediği
   lib/rate-limit.ts başında yazılı.
   -------------------------------------------------------------------------- */
const SIGN_IN_LIMIT = 10;
const SIGN_UP_LIMIT = 5;
const AUTH_WINDOW_MS = 10 * 60_000;

/**
 * Giriş sonrası dönülecek adres.
 *
 * `devam` parametresi proxy tarafından yazılıyordu ama hiç OKUNMUYORDU:
 * korumalı bir sayfadan giriş yapan kullanıcı işini bitirdiğinde ana
 * sayfaya düşüyordu. Artık okunuyor — ama körlemesine değil.
 *
 * Doğrulama şart: kullanıcıdan gelen bir adrese sorgusuz yönlendirmek açık
 * yönlendirme (open redirect) açığıdır ve kimlik avında kullanılır. Kabul
 * edilen tek biçim, tek eğik çizgiyle başlayan göreli yol. `//baska.site`
 * ve `/\baska.site` protokole göreli adreslerdir ve dışarı çıkarlar; bu
 * yüzden ikinci karakter de kontrol ediliyor.
 */
function safeRedirectTarget(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

async function authRateKey(scope: string): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "bilinmeyen";
  return `${scope}:${ip}`;
}

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

const signUpSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale).auth.errors;

  const limited = rateLimit(
    await authRateKey("signup"),
    SIGN_UP_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limited.allowed) {
    return { error: t.tooManyAttempts, field: "form" };
  }

  const rawUsername = String(formData.get("username") ?? "");
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!usernameSchema.safeParse(rawUsername).success) {
    return { error: t.usernameFormat, field: "username" };
  }
  if (!z.string().email().safeParse(rawEmail.trim().toLowerCase()).success) {
    return { error: t.emailFormat, field: "email" };
  }
  if (password.length < 8) {
    return { error: t.passwordLength, field: "password" };
  }
  if (password !== passwordConfirm) {
    return { error: t.passwordMismatch, field: "passwordConfirm" };
  }

  const parsed = signUpSchema.parse({
    username: rawUsername,
    email: rawEmail,
    password,
  });

  const existing = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(
      or(eq(users.username, parsed.username), eq(users.email, parsed.email)),
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].username === parsed.username
      ? { error: t.usernameTaken, field: "username" }
      : { error: t.emailTaken, field: "email" };
  }

  const passwordHash = await hash(parsed.password, 12);

  try {
    const [created] = await db
      .insert(users)
      .values({
        username: parsed.username,
        email: parsed.email,
        passwordHash,
        locale,
      })
      .returning({ id: users.id });

    // Boş bir uygulamaya düşmemesi için ilk listeyi hazır ver.
    await db.insert(watchlists).values({
      userId: created.id,
      name: locale === "tr" ? "Takip listem" : "My watchlist",
      color: "primary",
      sortOrder: 0,
    });
  } catch {
    return { error: t.generic, field: "form" };
  }

  await signIn("credentials", {
    username: parsed.username,
    password: parsed.password,
    redirect: false,
  });

  const target = safeRedirectTarget(formData.get("devam"));
  redirect(target === "/" ? "/favoriler" : target);
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale).auth.errors;

  const limited = rateLimit(
    await authRateKey("signin"),
    SIGN_IN_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limited.allowed) {
    return { error: t.tooManyAttempts, field: "form" };
  }

  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: t.invalidCredentials, field: "form" };
  }

  try {
    await signIn("credentials", { username, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t.invalidCredentials, field: "form" };
    }
    throw error;
  }

  redirect(safeRedirectTarget(formData.get("devam")));
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/* --------------------------------------------------------------------------
   Hesap silme

   KVKK m. 11 silme hakkının çalışan karşılığı. Ekranda bir onay kutusu değil,
   kullanıcı adını yazdırma var: yanlışlıkla tıklanması mümkün olmayan tek
   desen bu. Şifre de isteniyor — oturum çerezi ele geçirilmiş bir tarayıcı
   hesabı silememeli.

   Silme gerçekten siliyor: users satırı gidince watchlists ve
   watchlist_items ON DELETE CASCADE ile birlikte düşüyor. Yumuşak silme
   (soft delete) bilinçli olarak yok — "sildim" demek, silmek demektir.
   -------------------------------------------------------------------------- */

export type DeleteAccountState = { error?: string };

export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const locale = await getLocale();
  const t = getDictionary(locale).settings;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: t.deleteNotSignedIn };

  const confirmation = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { error: t.deleteNotSignedIn };
  if (confirmation !== user.username) return { error: t.deleteConfirmMismatch };
  if (!password || !(await compare(password, user.passwordHash))) {
    return { error: t.deleteWrongPassword };
  }

  await db.delete(users).where(eq(users.id, userId));

  // signOut yönlendirmeyi kendi atar; buradan sonrası çalışmaz.
  await signOut({ redirectTo: "/" });
  return {};
}
