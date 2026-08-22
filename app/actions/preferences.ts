"use server";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  isLocale,
  isTheme,
} from "@/lib/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Dil tercihini yazar — ve BAŞKA HİÇBİR ŞEY YAPMAZ.
 *
 * Burada bir `refresh()` çağrısı vardı ve zararlıydı: çerez yazıldıktan sonra
 * O ANKİ adresi yeniden getiriyordu. Kullanıcı `/en/piyasalar`dayken Türkçeye
 * geçtiğinde tazeleme hâlâ `/en/...` adresine gidiyor, proxy önek gördüğü
 * için çerezi sessizce `en`e geri yazıyordu (bkz. proxy.ts — "önekli adrese
 * gelmek de bir dil seçimidir").
 *
 * Dili değiştiren iki denetim de artık tam sayfa gezinmesi yapıyor, yani
 * tazelemenin işi zaten yok.
 */
export async function setLocalePreference(value: string) {
  if (!isLocale(value)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax",
  });
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
