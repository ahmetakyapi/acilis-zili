"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionPreference } from "./useMotionPreference";

/** Oynamak için figürün bu kadarı ekranda olmalı. */
const THRESHOLD = 0.4;

/**
 * Açıklayıcı figürü GÖRÜNÜNCE bir kez oynatır (12 Ekim; motion-film
 * `aciklayici-figur.md`).
 *
 * Sunucu SON KAREYİ basar: JS yoksa, hareket azaltılmışsa ya da figür ilk
 * ekrandaysa okuyucu hep bitmiş figürü görür, hiçbir şey sıçramaz. Yalnız
 * figür ekranın ALTINDAYKEN kap `data-armed` alır: CSS animasyonları ilk
 * karede DURAKLATILMIŞ bekler (görünmeyen yerde). Görünce `data-play` gelir
 * ve oynar. `InView`dan (components/ai) farkı bu: orada taban durum boş,
 * burada taban durum figürün kendisi.
 *
 * Öznitelikler React durumuna değil doğrudan DOM'a yazılıyor: figür
 * yeniden çizilmiyor, sunucu HTML'i olduğu gibi kalıyor. Gözlemci girdilerin
 * EN YENİSİNİ okur (anatomy notu: eskisine bakan döngü ekranda donar).
 */
export function PlayOnView({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || typeof IntersectionObserver === "undefined") return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    node.dataset.armed = "";
    const observer = new IntersectionObserver((entries) => {
      if (!entries[entries.length - 1].isIntersecting) return;
      node.dataset.play = "";
      observer.disconnect();
    }, { threshold: THRESHOLD });
    observer.observe(node);
    return () => {
      observer.disconnect();
      // Tercih oynarken değişirse son kareye dön.
      delete node.dataset.armed;
      delete node.dataset.play;
    };
  }, [reduced]);

  return <div ref={ref} className={className}>{children}</div>;
}
