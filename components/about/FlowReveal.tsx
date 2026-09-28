"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/**
 * Akış diyagramını ADIM ADIM açan kap (Hakkında → veri ve yazı akışları).
 *
 * `MotionExperience`in kademeli girişi bir liste için yazılmış: adımlar
 * 28 milisaniye arayla geliyor ve bir akışta bu, sıranın kendisini
 * göstermiyor, hepsi aynı anda beliriyor. Burada her adım ve aradaki
 * bağlantı çizgisi kendi sırasında (`--step`, CSS) açılıyor: okuyucu önce
 * kaynağı, sonra kapıları, sonra ekranı görüyor, yani anlatılan yolu.
 *
 * SUNUCU HTML'İ TAM GÖRÜNÜR. Kap yalnızca hidratasyondan sonra ve yalnızca
 * ilk ekranın ALTINDAYSA giriş pozuna alınıyor (`data-armed`); ilk ekrandaki
 * akış kıpırdamıyor (kökün kuralı, PremiumMotion → "İLK EKRAN"). JavaScript
 * yoksa ya da hareket azaltılmışsa hiçbir şey gizlenmiyor.
 *
 * ATLANAN AKIŞ DA AÇILIR. Gözlemcinin kökü yukarı doğru çok uzatılmış
 * (`PASSED_MARGIN_PX`): End tuşuyla ya da tek bir uzun kaydırmayla üstünden
 * atlanan kap da "kesişiyor" sayılıyor ve açılıyor. `Reveal` bunun için bir
 * kaydırma dinleyicisi taşıyor; burada dinleyici yok.
 */

/** Görüş alanının üstünde kalan her şeyi "görüldü" saymaya yeten pay. */
const PASSED_MARGIN_PX = 100_000;
/** Kabın bu kadarı görüş alanına girmeden oynamıyor (alt pay, yüzde). */
const ENTRY_INSET = "-18%";
/** İlk ekrandan sayılan pay: kap bu çizginin üstündeyse hiç hazırlanmıyor. */
const FIRST_SCREEN_SHARE = 0.9;

export function FlowReveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced || !("IntersectionObserver" in window)) return;
    if (element.getBoundingClientRect().top < window.innerHeight * FIRST_SCREEN_SHARE) return;

    element.dataset.armed = "";
    const play = () => {
      element.dataset.play = "";
      observer.disconnect();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) play();
      },
      { rootMargin: `${PASSED_MARGIN_PX}px 0px ${ENTRY_INSET} 0px`, threshold: 0 },
    );
    observer.observe(element);
    /* Klavyeyle içine gelinen akış beklemeden açılır. */
    element.addEventListener("focusin", play);
    return () => {
      observer.disconnect();
      element.removeEventListener("focusin", play);
      delete element.dataset.armed;
      delete element.dataset.play;
    };
  }, [reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
