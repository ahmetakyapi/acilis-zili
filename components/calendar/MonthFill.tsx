"use client";

import { useEffect } from "react";

/* İki kolonlu kapak 768'de başlıyor (CalendarExperience.module.css →
   `.hero`, ≤767 tek kolon). Eşik o kırılımla aynı sayı. */
const WIDE_QUERY = "(min-width: 768px)";

/**
 * Kapağın sol kolonundaki ay listesini, kutusuna SIĞDIĞI KADAR açar.
 *
 * NEDEN FillList DEĞİL (components/earnings/FillList.tsx): yöntem aynı —
 * kutu `contain: size` ile satır boyuna katkı vermiyor, sağ kolonun
 * (sıradaki açıklama kartı) boyuna geriliyor ve sorulan tek soru listenin
 * `scrollHeight` ile `clientHeight` farkı. Ama burada üç şey farklı:
 *   1. Eşik 768 (kapak 768'de iki kolon), analizlerin 1024'ü değil.
 *   2. Satırlar DOM sırasında açılmıyor. Liste kronolojik ama okuyucunun
 *      sorusu "sırada ne var"; açılma sırası `data-rank` (sıradaki, ondan
 *      sonraki, son geçen, ileri kalanlar, en son daha eski geçmişler).
 *   3. "+N Veri Daha" sayacı gizli satır sayısını söylüyor. Sayaç başlık
 *      satırında; dar kutuda satır atlatırsa listenin kutusu değişir ve
 *      gözlemci bir kez daha koşar. Döngü yok: sayaç görünürken her şey
 *      sığarsa sayaç kapanır, kutu büyür, yine sığar; sığmıyorsa sayaç
 *      açılır, kutu küçülür, yine sığmaz.
 *
 * `hidden` yalnızca burada, elle değişiyor; React durumu yok (FillList'in
 * hidrasyon gerekçesi). JavaScript kapalıyken sunucunun taban satırları
 * (`data-base`) ve sunucunun saydığı "+N" kalır.
 */
export function MonthFill() {
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    let frame = 0;

    const fill = (list: HTMLElement) => {
      const rows = [...list.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );
      const ranked = [...rows].sort(
        (a, b) => Number(a.dataset.rank ?? 0) - Number(b.dataset.rank ?? 0),
      );
      for (const row of rows) row.hidden = !row.hasAttribute("data-base");

      /* Yalnız gerilmiş kutuda (kart varken, iki kolonda) anlamlı; kart
         yoksa kutu içeriği kadar uzar ve "sığdığı kadar" hep "hepsi" olurdu. */
      const box = list.closest<HTMLElement>("[data-month]");
      if (wide.matches && box?.dataset.constrained === "true") {
        const overflowing = () => list.scrollHeight > list.clientHeight + 1;
        if (overflowing()) {
          /* En az bir satır kalır (kutunun taban yüksekliği bir satırı
             taşıyor, CSS `.keyBox`). */
          for (let i = ranked.length - 1; i > 0 && overflowing(); i -= 1) {
            ranked[i].hidden = true;
          }
        } else {
          for (const row of ranked) {
            if (!row.hidden) continue;
            row.hidden = false;
            if (overflowing()) {
              row.hidden = true;
              break;
            }
          }
        }
      }

      const hiddenCount = rows.filter((row) => row.hidden).length;
      const more = box?.querySelector<HTMLElement>("[data-month-more]");
      const count = more?.querySelector<HTMLElement>("[data-month-count]");
      if (more && count) {
        count.textContent = String(hiddenCount);
        more.hidden = hiddenCount === 0;
      }
    };

    const lists = () => [...document.querySelectorAll<HTMLElement>("[data-month-list]")];
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => lists().forEach(fill));
    };

    run();

    /* Listenin kutusu kartın boyuyla değişiyor (yazı tipi inince, pencere
       daralınca, geri sayım satır atlayınca). Satır açmak kutuyu
       değiştirmiyor — kutu `contain: size`. */
    const observer = new ResizeObserver(run);
    for (const list of lists()) observer.observe(list);
    wide.addEventListener("change", run);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wide.removeEventListener("change", run);
    };
  }, []);

  return null;
}
