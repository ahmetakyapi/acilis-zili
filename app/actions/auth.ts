"use server";

import { hash } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users, watchlists } from "@/lib/schema";
import { getDictionary, getLocale } from "@/lib/i18n";

export type AuthFormState = {
  error?: string;
  field?: "username" | "email" | "password" | "passwordConfirm" | "form";
};

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

  redirect("/favoriler");
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = getDictionary(locale).auth.errors;

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

  redirect("/");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
