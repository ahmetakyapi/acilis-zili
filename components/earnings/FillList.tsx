"use client";

import { useEffect } from "react";

/* Doldurma yalnızca iki kolonlu düzende çalışır; eşik CSS'teki
   `.workspace` kırılımıyla aynı sayı (AnalysisExperience.module.css). */
const WIDE_QUERY = "(min-width: 1024px)";

/**
 * Gerilmiş bir panelin listesini, kendi yüksekliğine SIĞDIĞI KADAR açar.
 *
 * NEDEN FillColumn DEĞİL: o bileşen iki KOLONUN diplerini karşılaştırıp
 * kısa olana satır açıyor. Burada karşılaştırılacak ikinci bir kolon yok:
 * yan panel `contain: size` ile ızgara satırının boyuna hiç katkı vermiyor
 * ve öne çıkan kartın boyuna geriliyor. Sorulacak tek soru "bu liste kendi
 * kutusuna kaç satır sığdırıyor" ve cevabı listenin kendi `scrollHeight` ile
 * `clientHeight` farkı.
 *
 * İKİ YÖNLÜ. Kart kısa kalırsa (filtre, kısa başlık) taban satırlardan
 * sondakiler kapanıyor; kırpılmış yarım satır bırakılmıyor.
 *
 * `hidden` YALNIZCA BURADA, ELLE değişiyor — React durumu yok. FillColumn'un
 * durumla çalışan ilk sürümü sunucu çıktısıyla hidrasyon farkı üretmişti;
 * burada sunucu tabanı basıyor, etki bağlandıktan sonra DOM'a dokunuluyor ve
 * React'ın elindeki öznitelik hiç değişmediği için sonraki çizimler de
 * onunla çatışmıyor.
 *
 * JAVASCRIPT KAPALIYKEN taban satırlar kalır; yedekler `hidden` gelir.
 */
export function FillList() {
  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    let frame = 0;

    const lists = () => [
      ...document.querySelectorAll<HTMLElement>("[data-fill-list]"),
    ];

    const fill = (list: HTMLElement) => {
      const rows = [...list.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );
      /* Ölçü her zaman TABAN DURUMDAN: önceki koşumun açtığı yedekler
         kapanıyor, kapattığı taban satırlar açılıyor. Hepsi tek karede. */
      for (const row of rows) row.hidden = row.hasAttribute("data-fill");

      /* Yalnızca gerilmiş (yüksekliği karttan gelen) listede anlamlı.
         Öne çıkan kart yoksa panel içeriği kadar uzar; orada "sığdığı kadar"
         her zaman "hepsi" olurdu. */
      if (!wide.matches || !list.closest('[data-has-feature="true"]')) return;

      const overflowing = () => list.scrollHeight > list.clientHeight + 1;

      if (overflowing()) {
        for (let i = rows.length - 1; i > 0 && overflowing(); i -= 1) {
          rows[i].hidden = true;
        }
        return;
      }
      for (const row of rows) {
        if (!row.hasAttribute("data-fill")) continue;
        row.hidden = false;
        if (overflowing()) {
          row.hidden = true;
          break;
        }
      }
    };

    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => lists().forEach(fill));
    };

    run();

    /* Listenin kutusu kartın boyuyla değişiyor (yazı tipi inince, pencere
       daralınca, başlık satır atlayınca). Satır açmak kutuyu DEĞİŞTİRMİYOR —
       panel `contain: size` — yani gözlemci kendini tetiklemiyor. */
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
