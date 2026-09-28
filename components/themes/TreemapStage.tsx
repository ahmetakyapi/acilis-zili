"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Tema haritasının istemci katmanı — karolar sunucuda çiziliyor; burada
 * yalnızca giriş koreografisinin tetiği var.
 *
 * 1. GİRİŞ KOREOGRAFİSİ görünüme girince. Karolar CSS animasyonuyla
 *    büyükten küçüğe açılıyor (Themes.module.css → `tile-in`). Harita akışla
 *    ekrana indiğinde animasyon zaten oynuyor; ama harita ilk ekranın
 *    altındaysa okuyucu oraya indiğinde çoktan bitmiş oluyor. O durumda
 *    karolar görünmezken `data-armed` ile gizleniyor ve görüş alanına
 *    girince `data-play` ile yeniden oynuyor. Görünürken gizlenmiyor:
 *    ekrandaki haritayı söndürüp yeniden yakmak bir titreme olurdu.
 *    JavaScript yoksa ya da hareket azaltılmışsa karolar yerinde durur.
 * 2. KÜNYE KARTI ARTIK SİTENİN ORTAK ŞİRKET KARTI (28 Eylül). Burada tek ve
 *    paylaşılan bir kart vardı (karo künyesini `data-peek` JSON'unda
 *    taşıyordu; ondan önce her karo kendi kartını sunucuda taşıyordu ve iki
 *    yerleşim × yirmi üye ≈ 420 fazladan DOM düğümü demekti — 4x yavaş
 *    CPU'da Katılım sayfasının TBT'si tek kartla 78'den 65 ms'ye inmişti).
 *    Aynı fikir bütün siteye genişledi: karo yalnızca `data-cc` taşıyor,
 *    kart kabuktaki `CompanyCardHost` (components/ui/CompanyCard.tsx).
 *    Dokunmatikte ilk dokunuş artık kartı açmıyor, şirkete gidiyor —
 *    ortak kartın kuralı; gerekçesi o dosyada.
 */

/** Haritanın bu kadarı görününce koreografi başlar. */
const PLAY_THRESHOLD = 0.2;

export function TreemapStage({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* İlk görünürlük kararını gözlemcinin İLK bildirimi veriyor, bir
       `getBoundingClientRect` değil: hidrasyonun ortasında konum okumak
       yerleşimi zorla hesaplatırdı. */
    let first = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        if (first) {
          first = false;
          if (inView) observer.disconnect();
          else setArmed(true);
          return;
        }
        if (!inView) return;
        setPlay(true);
        observer.disconnect();
      },
      { threshold: PLAY_THRESHOLD },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-armed={armed ? "" : undefined}
      data-play={play ? "" : undefined}
    >
      {children}
    </div>
  );
}
