"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Masthead şeridinin taşma güvencesi — "priority+" deseni.
 *
 * Varsayılan yazı boyunda HİÇBİR masaüstü genişliğinde devreye girmez
 * (ölçüm `nav-items.ts` yorumunda). İşi, büyütülmüş yazıda (Chrome "Büyük",
 * 20px kök) ya da ileride uzayan bir çeviride sekmelerin sağdaki araçların
 * ALTINA binmesini engellemek. Sayfa taşmadığı için bu binme hiçbir taşma
 * taramasında görünmüyordu (bkz. nav-items.ts, "SIĞMIYOR" kaydı).
 *
 * GERİ BESLEME DÖNGÜSÜ YOK. Gözlenen öğe ızgaranın `minmax(0,1fr)` hücresi:
 * genişliği içerikten bağımsız, bir sekmeyi gizlemek hücreyi büyütmüyor.
 * Bu yüzden "yeniden gösterme payı" gibi bir sabite gerek kalmıyor.
 *
 * Öncelik DOM'dan okunuyor (`data-strip-rank`, 1 en son taşar): effect'in
 * bağımlılığı yalnızca iki ref ve dizi her çizimde yeniden kurulsa bile
 * gözlemci yeniden bağlanmıyor. Gizlenen sekme `invisible absolute` oluyor,
 * yani genişliği ölçülebilir kalıyor; ayrı bir ölçüm satırı yok.
 *
 * SSR'da küme boş — hidrasyon uyuşmazlığı olmuyor. İlk hesap gözlemcinin
 * ilk geri çağrısında; state yalnızca küme gerçekten değişince yazılıyor.
 */
export function usePriorityStrip(
  navRef: RefObject<HTMLElement | null>,
  moreRef: RefObject<HTMLElement | null>,
): ReadonlySet<string> {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const nav = navRef.current;
    const more = moreRef.current;
    if (!nav || !more || !("ResizeObserver" in window)) return;

    const measure = () => {
      const items = [...nav.querySelectorAll<HTMLElement>("[data-strip-href]")].map((element) => ({
        href: element.dataset.stripHref ?? "",
        rank: Number(element.dataset.stripRank ?? "0"),
        width: element.getBoundingClientRect().width,
      }));
      const available = nav.clientWidth - more.getBoundingClientRect().width;
      let total = items.reduce((sum, item) => sum + item.width, 0);
      const next = new Set<string>();
      for (const item of [...items].sort((a, b) => b.rank - a.rank)) {
        if (total <= available) break;
        next.add(item.href);
        total -= item.width;
      }
      setHidden((previous) =>
        previous.size === next.size && [...next].every((href) => previous.has(href)) ? previous : next,
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    nav.querySelectorAll("[data-strip-href]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [navRef, moreRef]);

  return hidden;
}
