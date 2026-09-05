"use client";

import { LayoutGroup, MotionConfig } from "motion/react";

/**
 * Motion'ın tek kök sağlayıcısı — `(app)/layout.tsx`te, kalıcı kabukta.
 *
 * `reducedMotion="user"`: işletim sistemi "hareketi azalt" diyorsa Motion
 * dönüşüm ve düzen animasyonlarını kapatır, yalnızca opaklık kalır. CSS
 * tarafındaki `prefers-reduced-motion` bloğunun karşılığı; ikisi birlikte
 * §6.B'yi tamamlıyor.
 *
 * `LayoutGroup`: `layoutId` paylaşan öğelerin ad alanı. Sekme alt çizgisi
 * üç ayrı sayfada üç ayrı ağaçta basılıyor; App Router eski sayfayı kaldırıp
 * yenisini aynı commit'te bağladığı için Motion, aynı `layoutId`nin son
 * ölçülen konumunu bu kalıcı grup içinde hatırlıyor ve oradan kaydırıyor.
 * Sağlayıcı sayfa ağacının DIŞINDA durmalı, yoksa her gezinmede sıfırlanır.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>{children}</LayoutGroup>
    </MotionConfig>
  );
}
