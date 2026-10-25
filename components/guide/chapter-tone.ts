/**
 * Rehber bölümlerinin kimliği — renk ve ikon (25 Ekim, rehberin görsel turu).
 *
 * BÖLÜM BAŞINA BİR RENK, HER YERDE AYNI. Sahibinin sözü: "daha görsel ve
 * iyi olmalı"; 25 Ekim renk kararı: "renk tutarlı bir anlam taşısın, aynı
 * kavram her ekranda aynı renkte". Bölüm rengi bir KİMLİK: yol haritasındaki
 * durak, bölüm başlığının kuralı, yazı kartının seviye noktaları, yazı
 * sayfasındaki "Rehberdeki Yerin" şeridi ve önceki/sıradaki kartı aynı
 * tonu taşıyor. Okuyucu "Pozisyon ve Risk"in mor olduğunu bir kez
 * görüyor, sonra her yerde tanıyor.
 *
 * PİRİNÇ YOK (25 Ekim, sahibinin kararı): ilk turda 2. bölüm `--chart-b`
 * (pirinç) almıştı; sitede pirinç "TUT" görüşü demek (`--verdict-hold`),
 * "Pozisyon ve Risk" bir tavsiye gibi okunabilirdi. Yön renkleri
 * (yeşil/kırmızı) de aynı nedenle dışarıda. Kalan tonlar: grafik serileri
 * mavi, mor, teal (`--chart-a`, `--chart-c`, `--chart-d`; gerekçe
 * app/globals.css → "Grafik serileri") ve pay dilimlerinin en koyusu
 * `--share-1` (açıkta lacivert #0a4d9e, koyuda buz mavisi #9adcff).
 * `--share-1` mavinin ailesinden ama açıklığı ayrı (açıkta 1,68:1, koyuda
 * 2,28:1 fark); yan yana düşmesin diye son bölüme verildi, mavi ilk bölümde.
 *
 * Ölçülen kontrast (WCAG oranı, kart zemini `--premium-surface` / sayfa
 * zemini `--page-bg`), çizim için eşik 3:1, 25 px kalın numara için 3:1:
 *   açık  mavi 4,87/4,61 · mor 5,62/5,33 · teal 4,97/4,71 · lacivert 8,18/7,75
 *   koyu  mavi 5,13/5,72 · mor 6,17/6,87 · teal 6,51/7,25 · buz 11,71/13,04
 * Renk YALNIZ çizimde (ikon, halka, şerit, kural) ve büyük bölüm
 * numarasında; küçük metin hep metin renginde kalıyor.
 *
 * Düz modül (`"use client"` değil): sunucu sayfası da istemci yol haritası
 * da aynı eşlemeyi okur. İkonlar `dist/ssr` sürümünden — bağlam (context)
 * kullanmadıkları için iki tarafta da çizilir.
 */
import { createElement, type CSSProperties } from "react";
import type { Icon, IconProps } from "@phosphor-icons/react";
import { Bank, BookOpenText, Buildings, Scales } from "@phosphor-icons/react/dist/ssr";

export const CHAPTER_TONES = {
  temel: "var(--chart-a)",
  strateji: "var(--chart-c)",
  sirket: "var(--chart-d)",
  makro: "var(--share-1)",
} as const;

export const CHAPTER_ICONS: Record<keyof typeof CHAPTER_TONES, Icon> = {
  temel: BookOpenText,
  strateji: Scales,
  sirket: Buildings,
  makro: Bank,
};

/** Bilinmeyen anahtar (ileride eklenen bölüm) sitenin mavisine düşer. */
export function chapterTone(key: string): string {
  return CHAPTER_TONES[key as keyof typeof CHAPTER_TONES] ?? "var(--primary-soft)";
}

export function chapterIcon(key: string): Icon {
  return CHAPTER_ICONS[key as keyof typeof CHAPTER_ICONS] ?? BookOpenText;
}

/**
 * Bölümün ikonunu çizer. Çağıranda `const Icon = chapterIcon(key)` ile
 * render sırasında bileşen seçmek `react-hooks/static-components`a takılıyor
 * (her render'da "yeni" bileşen sayılır, durumu sıfırlanabilir); seçim burada,
 * tek yerde yapılıyor.
 */
export function ChapterIcon({ chapter, ...props }: { chapter: string } & IconProps) {
  return createElement(chapterIcon(chapter), props);
}

/** `--ch` özelliği — bölümün kabına verilir, içindeki her çizim onu okur. */
export function chapterToneStyle(key: string): CSSProperties {
  return { "--ch": chapterTone(key) } as CSSProperties;
}
