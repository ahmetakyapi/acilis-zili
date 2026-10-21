"use client";

import { useContext } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { splitLocale, withLocale } from "@/lib/i18n/routing";
import { LocaleContext } from "./LocaleProvider";

/**
 * İstemci bileşenlerinde dil ve dil taşıyan bağlantı üretici.
 *
 * Dil ÖNCE ADRESTEN, adres bir şey söylemiyorsa KÖK DÜZENİN DİLİNDEN
 * (`LocaleProvider`). Bir dönem yalnız adresten okunuyordu ve "adres her
 * zaman doğruyu söylüyor" deniyordu; sunucu çiziminde söylemiyor: proxy
 * `/en/piyasalar`ı `/piyasalar`a yeniden yazıyor ve `usePathname()` o yolu
 * veriyor (ölçüm `AppShell.tsx`te). Kanca sunucuda "tr" çözüyor, `LocaleLink`
 * de `withLocale(href, "tr")` ile çağıranın koyduğu `/en` önekini bile
 * siliyordu; hidrasyon öznitelik farkını düzeltmediği için canlı /en
 * HTML'indeki iç bağlantıların hiçbiri önek taşımıyordu (20 Ekim, curl).
 *
 * SIRA bilerek böyle: adres önce gelirse iki taraf aynı değeri buluyor —
 * sunucuda önek yok, bağlam "en" diyor; tarayıcıda adres `/en/...` diyor.
 * Bağlam önce gelseydi `/en`e yumuşak bir gezinmede kök düzenin eski dili
 * adresi ezerdi. Önek yokken bağlam ile adres zaten aynı dili söylüyor:
 * proxy öneksiz adresi çerezdeki dile yönlendiriyor (`proxy.ts`).
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
  const fromLayout = useContext(LocaleContext);
  const locale =
    splitLocale(pathname ?? "/").locale ?? fromLayout ?? DEFAULT_LOCALE;
  return { locale, href: (path: string) => withLocale(path, locale) };
}
