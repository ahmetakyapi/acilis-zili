"use client";

import { useEffect } from "react";

/**
 * Akışla gelen panelin çapa inişi — adresin `#id`si bu panelse, panel
 * sayfaya indiğinde ona kaydırır.
 *
 * NEDEN GEREKLİ (23 Eylül, önizlemede ölçüldü). Özet'in satırları sorunun
 * giderildiği panele gidiyor (`/admin/sistem#veri`, `#anahtarlar`,
 * `/admin/icerik#eksikler`) ve iki iniş yolu da çapayı kaçırıyordu:
 *   - Yumuşak gezinme: Next çapayı sayfa işlendiği AN arıyor; panel o sırada
 *     Suspense'in arkasında, bulamayınca bölümün başına kaydırıyor. Sayfa
 *     başta kalıyordu — 390'da Veri Sağlığı 1.011, Anahtarlar 1.567 piksel
 *     aşağıda; 1440'ta Anahtarlar 933.
 *   - Doğrudan açılış: tarayıcı çapayı ayrıştırırken arıyor ve akışla gelen
 *     içerik o sırada gizli bir kapta; `scrollY` 0'da kalıyordu (İçerik'in
 *     `#eksikler`i dahil).
 * Yer tutuculara aynı `id`yi vermek yalnızca ilk adımı düzeltirdi: iskeletin
 * boyu gerçeğini tutmadığında (telefonda notlar sarıyor) çapa panel inince
 * yerinden kayıyor, iniş yine kaçıyordu.
 *
 * YALNIZCA BİR KEZ, BAĞLANDIĞINDA. Etki yalnızca `id`ye bağlı: sayfanın
 * tazelenmesi (`router.refresh`) paneli yeniden bağlamıyor, okuru okuduğu
 * yerden çekip çapaya geri götürmüyor. Kaydırma anlık — iniş bir geçiş
 * değil, adresin söylediği yer. Bant payı `html`in `scroll-padding-top`unda
 * (`app/admin/layout.tsx`); `scrollIntoView` onu sayıyor.
 *
 * Karşılaştırma ham: panel çapaları ASCII (`veri`, `anahtarlar`) ve
 * `decodeURIComponent` bozuk bir `%` dizisinde fırlatıp paneli düşürürdü.
 */
export function AnchorLanding({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
