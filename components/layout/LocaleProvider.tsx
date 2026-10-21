"use client";

import { createContext, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Kök düzenin SUNUCUDA çözdüğü dil (`getI18n()`), istemci bileşenlerine.
 *
 * Neden gerekli (20 Ekim): `/en/...` proxy'de yeniden yazılıyor ve sunucu
 * çiziminde `usePathname()` yeniden yazılmış yolu (`/piyasalar`) veriyor;
 * dili yalnız adresten okuyan `useLocaleHref` İngilizce sayfayı sunucuda
 * Türkçe sanıyor, `LocaleLink` de bağlantıların önekini siliyordu. Ayrıntı
 * `useLocaleHref.tsx`te.
 *
 * Dil değişimi tam sayfa yüklemesi (`location.assign`, preference-controls),
 * yani değer hiç bayatlamıyor. Kök düzeni olmayan `global-error` bu
 * sağlayıcının dışında; orada kanca adrese düşüyor.
 */
export const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}
