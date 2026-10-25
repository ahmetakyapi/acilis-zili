"use client";

import { useEffect } from "react";

/**
 * Şeritten ya da kahramandan bir güne atlayınca o günün katlaması AÇILIR
 * (25 Ekim). Temettü günleri artık `details`; hücre `#temettu-<tarih>`
 * çapasına gidiyor ve hedef kapalı bir katlamanın kabıysa okuyucu yalnız
 * özet satırını görüyordu. Tarayıcıların "ata katlamayı aç" davranışı
 * yalnız hedef katlamanın İÇİNDEYKEN çalışıyor; hedef burada kabın kendisi.
 *
 * Yalnız çapa değişiminde ve ilk yüklemede çalışır; JavaScript'siz okuyucu
 * özeti tıklayarak açar (katlama yerel `details`).
 */
export function DividendDayOpener({ prefix }: { prefix: string }) {
  useEffect(() => {
    const openId = (id: string) => {
      if (!id.startsWith(prefix)) return;
      const fold = document.getElementById(id)?.querySelector("details");
      if (fold && !fold.open) fold.open = true;
    };
    const fromHash = () => openId(decodeURIComponent(window.location.hash.slice(1)));
    /* Aynı çapaya ikinci kez basmak `hashchange` üretmiyor (adres
       değişmiyor); tıklama yakalamada, kaydırmadan önce açıyor. */
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(`a[href^="#${prefix}"]`) : null;
      if (link) openId(decodeURIComponent(link.hash.slice(1)));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick, true);
    };
  }, [prefix]);
  return null;
}
