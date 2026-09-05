"use client";

import { motion } from "motion/react";

/**
 * Sekme alt çizgisi — paylaşılan `layoutId` ile sekmeden sekmeye KAYAR.
 *
 * Eskiden her sekme kendi `border-b-2`sini taşıyordu ve aktif olan pat diye
 * değişiyordu. Çizgi artık tek bir hareketli öğe: aktif sekmenin içinde
 * mutlak konumda duruyor, sekme değişince Motion eski konumdan yeniye
 * yay fiziğiyle taşıyor. Bağlantının kendisi `relative` olmalı.
 *
 * `-bottom-px`: çubuğun 1px alt çizgisiyle üst üste biner, eski border'ın
 * durduğu yerin aynısı — düzen hiç kaymaz.
 *
 * Yay sertliği 500 / sönüm 40: hızlı varır, taşmaz. Sekme bir seçim, bir
 * zıplama değil.
 */
export function TabUnderline({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    />
  );
}
