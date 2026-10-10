"use client";

import { motion } from "motion/react";
import { SELECTION_TRANSITION } from "@/lib/motion";

/**
 * Sekme alt çizgisi — paylaşılan `layoutId` ile sekmeden sekmeye KAYAR.
 *
 * Eskiden her sekme kendi `border-b-2`sini taşıyordu ve aktif olan pat diye
 * değişiyordu. Çizgi artık tek bir hareketli öğe: aktif sekmenin içinde
 * mutlak konumda duruyor, sekme değişince Motion eski konumdan yeniye
 * ortak seçim eğrisiyle taşıyor. Bağlantının kendisi `relative` olmalı.
 *
 * `-bottom-px`: çubuğun 1px alt çizgisiyle üst üste biner, eski border'ın
 * durduğu yerin aynısı — düzen hiç kaymaz.
 *
 * 280 ms: grafik aralığı ve bölüm diziniyle aynı ritimde hedefe oturur.
 */
export function TabUnderline({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
      transition={SELECTION_TRANSITION}
    />
  );
}
