"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Sayfa görüntülemesini bildirir. Hiçbir şey çizmez, hiçbir şey beklemez.
 *
 * `sendBeacon` seçildi çünkü isteği tarayıcıya DEVREDER: sayfa o sırada
 * kapanıyor ya da başka bir yere gidiliyor olsa bile istek gider ve
 * okuyucunun gezinmesini bir milisaniye bile geciktirmez. `fetch` yalnızca
 * beacon desteklenmediğinde devreye giriyor.
 *
 * AYNI YOL İKİ KEZ SAYILMAZ. App Router aynı yol için bileşeni yeniden
 * bağlayabiliyor (tema değişimi, arama kutusunun kapanması, `router.refresh`)
 * ve her birinde yeni bir görüntüleme yazılsaydı ana sayfa gerçek sayısının
 * katlarını gösterirdi. Son bildirilen yol bir ref'te tutuluyor.
 *
 * ÇEREZ YOK, KİMLİK YOK. Gövdede yalnızca yol, yönlendiren ve dil var;
 * ziyaretçi ayrımı sunucuda günlük dönen bir özetle yapılıyor ve o özet geri
 * döndürülemiyor. Gerekçenin tamamı `lib/schema.ts` içindeki `pageViews`
 * yorumunda.
 */

export function ViewBeacon({ locale }: { locale: string }) {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({
      path: pathname,
      /* İlk girişte dış yönlendiren, site içi gezinmede kendi adresimiz —
         sunucu kendi alan adını zaten eliyor. */
      referrer: document.referrer || null,
      locale,
    });

    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon?.("/api/olcum", blob)) return;
    } catch {
      /* sendBeacon bazı tarayıcılarda tür kısıtı yüzünden atıyor — altta
         fetch var, sessizce oraya düşülüyor. */
    }

    void fetch("/api/olcum", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {
      /* Ölçüm kaybı okuyucuyu ilgilendirmez. */
    });
  }, [pathname, locale]);

  return null;
}
