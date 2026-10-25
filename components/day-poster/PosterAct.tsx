"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Posterin bir PERDESİ: ekrana girdiği an `data-in` alır, bir kez.
 * Perdenin içindeki giriş hareketleri (ana sayfa şeridinde binaların
 * ufuktan yükselmesi) CSS'te bu özniteliğe bağlı; kaydırma ele
 * geçirilmiyor, yalnız sıra kaydırmaya bağlanıyor. Hareketi azaltan
 * okuyucuda ve gözlemci yoksa hemen açık. Posterin kendi siluetinin
 * gözlemcisi bileşenin içinde (Skyline.tsx).
 */
export function PosterAct({ act, className, children }: { act: string; className?: string; children: ReactNode }) {
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
