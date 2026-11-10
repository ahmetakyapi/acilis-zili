"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import styles from "./DrawOnView.module.css";

/** Panelin üst kenarı ekranın dibinden bu kadar içeri girince çizim başlar. */
const ENTER_PX = 96;

/**
 * ANA SAYFA PANELİNİN VERİ ÇİZİMLERİ GÖRÜNÜNCE OYNAR (10 Kasım, görsel tur).
 *
 * Pano panellerinin çizimleri (ölçü şeridi, kıvılcım çizgisi, kadran yayı,
 * getiri eğrisi, siluet sütunları) düz CSS animasyonu: öğe DOM'a girdiği an
 * başlıyor. Paneller kahramanın, akışın ve bandın ALTINDA; 1440×900'de ilk
 * ekranın dışındalar ve 0,6–0,9 saniyelik çizim kimse görmeden oynayıp
 * bitiyordu (ölçüldü: yüklemeden 150 ms sonra ekran dışındaki 13 ölçü
 * şeridi `running`, 2,6 saniyede hepsi bitmiş). Sektör silueti aynı sorunu
 * 14 Ekim'de `PlayOnView` ile çözmüştü.
 *
 * NEDEN `PlayOnView` DEĞİL. O, figürün %40'ı görününce oynatıyor; ana sayfa
 * panelleri uzun ve boyu veriye bağlı: "Son Bilanço Analizleri" doldurucuyla
 * on altı satıra (~1.280 piksel) açılabiliyor ve 390 piksel yüksekliğindeki
 * yatay telefonda %40 hiç sağlanmaz — şeritler ilk karede (boş) donardı.
 * Burada eşik panelin BOYUNDAN bağımsız: üst kenar ekranın dibinden 96
 * piksel içeri girince. Geri kalan sözleşme aynı (`data-armed` →
 * `data-play`, öznitelik DOM'a yazılır, sunucu son kareyi basar; JS yoksa,
 * hareket azaltılmışsa ya da panel ilk ekrandaysa hiçbir şey duraklamaz).
 * İki ekran aynı ihtiyacı duyarsa `PlayOnView`a eşik seçeneği olarak
 * terfi etmeli (ana oturum, `.claude/rules/hareket.md` kataloğu).
 *
 * KAPSAYICI PANELİN KENDİ SARMALI: ek bir kutu açmıyor; sayfadaki
 * `data-home-section` sarmalının yerine geçiyor ki içi boş kalınca
 * (`:empty`, panel basılmadığında) ızgaradan düşmeye devam etsin.
 * Duraklatılan yalnız ÇİZİM öğeleri (CSS notu): panelin kaydırma güdümlü
 * belirişi ve başlık yükselişi duraklatılırsa yarı saydam kalırdı.
 */
export function DrawOnView({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || typeof IntersectionObserver === "undefined") return;
    if (node.getBoundingClientRect().top < window.innerHeight - ENTER_PX) return;
    node.dataset.armed = "";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1]!.isIntersecting) return;
        node.dataset.play = "";
        observer.disconnect();
      },
      { rootMargin: `0px 0px -${ENTER_PX}px 0px` },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      // Tercih oynarken değişirse son kareye dön.
      delete node.dataset.armed;
      delete node.dataset.play;
    };
  }, [reduced]);

  return (
    <div ref={ref} {...rest} className={[styles.scope, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
