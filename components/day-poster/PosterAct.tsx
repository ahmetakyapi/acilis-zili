"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { PosterAct as Act } from "@/lib/day-poster-scene";

/**
 * Posterin bir PERDESİ (`POSTER_ACTS`, lib/day-poster-scene.ts): ekrana
 * girdiği an `data-in` alır, bir kez. Perdenin içindeki giriş hareketleri
 * (genişlik şeridinin dolması, endeks kulvarlarının uzaması) CSS'te bu
 * özniteliğe bağlı; kaydırma ele geçirilmiyor, yalnız sıra kaydırmaya
 * bağlanıyor. Hareketi azaltan okuyucuda ve gözlemci yoksa hemen açık.
 * Sahnenin satırları kendi gözlemcisinde (PosterStage.tsx).
 */
export function PosterAct({ act, className, children }: { act: Act; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const open = () => el.setAttribute("data-in", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      open();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        open();
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-act={act} className={className}>
      {children}
    </div>
  );
}
