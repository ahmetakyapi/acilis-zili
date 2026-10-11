"use client";
import { useEffect, useState } from "react";

/** Geri sayımlar 30 saniyede bir tazelenir: dakika çözünürlüğünde yazılıyorlar, saniyelik çizim boşa iş. */
const TICK_MS = 30_000;

/**
 * Sunucunun "şimdi"siyle başlayan saat: ilk çizim sunucuyla aynı metni
 * basar (hidrasyon uyuşmazlığı yok), takıldıktan sonra istemci saatine geçer.
 */
export function useNow(serverNow: string) {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
