"use client";

import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { splitLocale, withLocale } from "@/lib/i18n/routing";

/**
 * İstemci bileşenlerinde dil ve dil taşıyan bağlantı üretici.
 *
 * Dili ADRESTEN okuyor, bir context'ten değil: proxy önekSİZ adresleri zaten
 * tercih edilen dilin adresine yönlendiriyor (`proxy.ts`), yani adres her
 * zaman doğruyu söylüyor. Bir sağlayıcı ağacı kurmaya gerek yok.
 *
 * `href()` site içi bağlantılara öneki ekler. Öneksiz bir bağlantı da
 * çalışır — proxy onu yönlendirir — ama o fazladan bir gidiş-dönüş demek;
 * en çok tıklanan yerlerde bu köprüden geçmek o turu hiç yaşatmıyor.
 */
export function useLocaleHref(): {
  locale: Locale;
  href: (path: string) => string;
} {
  const pathname = usePathname();
  const locale = splitLocale(pathname ?? "/").locale ?? DEFAULT_LOCALE;
  return { locale, href: (path: string) => withLocale(path, locale) };
}
