"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  isLocale,
  isTheme,
} from "@/lib/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocalePreference(value: string) {
  if (!isLocale(value)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax",
  });
  refresh();
}

export async function setThemePreference(value: string) {
  if (!isTheme(value)) return;
  const store = await cookies();
  store.set(THEME_COOKIE, value, {
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax",
  });
}
