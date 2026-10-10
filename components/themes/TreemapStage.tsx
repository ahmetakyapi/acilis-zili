"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

/** Görünürlük eşiği haritanın boyunun %20'si yerine sabit 24px pay alır.
 * Klavye odağı, End ile atlanan bölüm ve çalışma anında değişen hareket
 * tercihi karoları son hâline alır; tercih geri açılınca yeniden gizlenmez. */
export function TreemapStage({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    let first = true;
    let started = false;

    const stopWatching = () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", passedBy);
    };
    const settle = () => {
      started = true;
      delete stage.dataset.armed;
      delete stage.dataset.play;
      stage.dataset.settled = "";
      stopWatching();
    };
    // End tuşuyla geçilen harita geriye dönülünce yeniden gizlenmez.
    function passedBy() {
      if (frame || started) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (stage!.getBoundingClientRect().bottom < 0) settle();
      });
    }
    const onPreference = () => { if (preference.matches) settle(); };
    stage.addEventListener("focusin", settle);
    preference.addEventListener("change", onPreference);

    if (preference.matches || !("IntersectionObserver" in window)) settle();
    else {
      observer = new IntersectionObserver(([entry]) => {
        if (started) return;
        if (first) {
          first = false;
          if (entry.isIntersecting) {
            started = true;
            stopWatching();
          } else stage.dataset.armed = "";
          return;
        }
        if (!entry.isIntersecting) return;
        started = true;
        stage.dataset.play = "";
        stopWatching();
      }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
      observer.observe(stage);
      window.addEventListener("scroll", passedBy, { passive: true });
    }
    return () => {
      stopWatching();
      stage.removeEventListener("focusin", settle);
      preference.removeEventListener("change", onPreference);
    };
  }, []);

  return <div ref={ref} className={className}>{children}</div>;
}
