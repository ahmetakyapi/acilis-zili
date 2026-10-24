"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/* ==========================================================================
   Adım kipi — `::: akis adim` ve `::: oncesi adim` (24 Ekim)

   Akışın halkaları okuyucu kaydırdıkça SIRAYLA yanar; öncesi bloğu "önce"
   hâliyle girer, okuma hattını geçince "sonra"ya döner. Sözdizimi ve
   gerekçe `parse-blocks.ts` → `STEP_FLAG`.

   KAYDIRMA KAÇIRILMIYOR. Blok sabitlenmiyor (sticky/pin yok), kaydırma
   hızı değişmiyor, sayfa yüksekliği bir piksel bile artmıyor: yalnız
   halkaların renk durumu kaydırma konumundan OKUNUYOR. Okuyucu hızla
   geçerse her şey bir anda yanar; geri çıkarsa sönen halka geri söner
   (durum konumun işlevi, geçmişin değil).

   TABAN SON HÂL. Sunucu bütün halkaları yanmış, öncesi bloğunu "sonra"
   hâliyle basar; JS kapalıyken, hareket azaltılmışken ya da blok ilk
   ekranda duruyorken okuyucu hep tam içeriği görür. Kap ancak ilk ekranın
   ALTINDAYSA `data-armed` alır — `PlayOnView` ile aynı kural: ilk ekranda
   hidratasyonla bir şeyin sönmesi, okuyucuya sayfa titriyor gibi görünür
   (bkz. `MotionExperience`, "İLK EKRAN HİDRATASYONDA KIMILDAMAZ").

   Durum React'e değil DOM özniteliklerine yazılıyor: içerik sunucu
   bileşeni, yeniden çizilmiyor; stil `ArticleEditorial.module.css` →
   ADIM KİPİ.
   ========================================================================== */

/**
 * Okuma hattı — görüş alanının üstünden bu oranda. Halka (ya da öncesi
 * paneli) üst kenarıyla bu hattı geçince "ulaşılmış" sayılır. %62:
 * telefonda (844 boy) 523. piksel, başparmağın kaydırdığı bölgenin hemen
 * üstü; geniş ekranda (900) 558 — blok ekranın ortasına gelmeden yanmaya
 * başlıyor, yani son halka ekrandan çıkmadan yanmış oluyor.
 */
const READ_LINE = 0.62;

export function StepMode({
  kind,
  className,
  children,
}: {
  kind: "flow" | "shift";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || typeof IntersectionObserver === "undefined") return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    const targets =
      kind === "flow"
        ? Array.from(node.querySelectorAll<HTMLElement>('[data-part="step"]'))
        : Array.from(node.querySelectorAll<HTMLElement>('[data-part="panel"]'));
    if (targets.length === 0) return;

    const reached = new Map<Element, boolean>(targets.map((target) => [target, false]));
    const paint = () => {
      if (kind === "shift") {
        node.dataset.phase = reached.get(targets[0]) ? "after" : "before";
        return;
      }
      /* Ulaşılan SON halka "şimdi"; öncekiler yanmış, sonrakiler bekliyor. */
      let current = -1;
      targets.forEach((target, index) => {
        if (reached.get(target)) current = index;
      });
      targets.forEach((target, index) => {
        target.dataset.step = index < current ? "done" : index === current ? "current" : "next";
      });
    };
    /* Durum konumdan hesaplanıyor, gözlemcinin girdisinden değil: hızlı
       kaydırmada aynı turda birden çok halka hattı geçebiliyor ve girdi
       yalnız DEĞİŞENİ söylüyor. En çok altı kutu, tek okuma turu. */
    const measure = () => {
      const line = window.innerHeight * READ_LINE;
      for (const target of targets) reached.set(target, target.getBoundingClientRect().top < line);
      paint();
    };

    /* Kök kutusu görüş alanının üstünden okuma hattına kadar: halka hattı
       aşağıdan geçince de, ekranın tepesinden çıkınca da gözlemci haber
       veriyor. Tek boşluk SIÇRAMA: içindekiler bağlantısıyla blok tek
       kerede aşağıdan yukarıya geçilirse halka kutuya hiç değmiyor ve
       girdi gelmiyor; `scrollend` o turu yakalıyor (kaydırma bitince bir
       kez, olay başına tek ölçüm — kaydırma boyunca dinleyici çalışmıyor). */
    const observer = new IntersectionObserver(measure, {
      rootMargin: `0px 0px -${Math.round((1 - READ_LINE) * 100)}% 0px`,
      threshold: 0,
    });

    node.dataset.armed = "";
    measure();
    targets.forEach((target) => observer.observe(target));
    window.addEventListener("scrollend", measure, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scrollend", measure);
      /* Tercih okurken değişirse (hareket azaltıldı) son hâle dön. */
      delete node.dataset.armed;
      delete node.dataset.phase;
      targets.forEach((target) => delete target.dataset.step);
    };
  }, [kind, reduced]);

  return (
    /* Kap bloğun KENDİSİ (`data-block`): editoryal stil görsel bloğu
       `.prose > .oku-blok[data-block]` ile yakalıyor, araya sarmalayıcı
       girerse çerçevesini ve boşluğunu kaybederdi. */
    <div ref={ref} className={className} data-block={kind} data-stepped="">
      {children}
    </div>
  );
}
