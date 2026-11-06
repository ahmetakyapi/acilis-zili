"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/**
 * Yenilikler'in çizim sahnesi (6 Kasım): içindeki CSS giriş animasyonu
 * GÖRÜNÜNCE bir kez oynar.
 *
 * `PlayOnView`dan (components/motion) farkı: orada ilk ekrandaki figür hiç
 * oynamaz, burada oynar — Haftalık Akış ve Son Güncellemede sayfanın ana
 * görseli, masaüstünde ilk ekranda ve sayfanın "animasyonlu" sözü onların
 * açılışında (sahibinin isteği). Animasyon CSS'te koşulsuz tanımlı, yani ilk
 * ekrandaki sahne ilk boyamadan itibaren oynar (sunucu HTML'i son kareyi
 * taşır; hareketi azaltan ve JS'siz okur bitmiş çizimi görür, ilk karede
 * opaklık sıfır değil).
 *
 * Sahne ekranın ALTINDAYSA kap `data-armed` alır: CSS animasyonun ADINI
 * değiştirir (aynı kareler, ikinci ad — tarayıcı yeni adı baştan başlatır;
 * kalıp `components/themes/Themes.module.css`) ve `data-play` gelene dek
 * ilk karede duraklatır. Böylece ekran dışında çoktan bitmiş bir animasyon
 * görünmez çizimle değil, okurun önünde oynar. Öznitelikler doğrudan DOM'a
 * yazılır (sunucu HTML'i yeniden çizilmez).
 */
export function SeenStage({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || typeof IntersectionObserver === "undefined") return;
    if (node.getBoundingClientRect().top < window.innerHeight - 24) return;
    node.dataset.armed = "";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1].isIntersecting) return;
        node.dataset.play = "";
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete node.dataset.armed;
      delete node.dataset.play;
    };
  }, [reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
