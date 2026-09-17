"use client";

import { useEffect, useRef } from "react";

/**
 * Yatay kayan çip şeridi — seçili çipi kendiliğinden görünür alana getirir.
 *
 * Mobilde şerit taşıyor ve seçili çip ekranın dışında kalıyordu. Ölçüldü
 * (390px genişlik, şirketler dizini): "Sağlık" seçiliyken çip 368px, "Medya
 * ve İletişim"de 736px, "Ulaştırma"da 1523px sağda duruyordu. Yani okuyucu
 * bir sektöre süzdüğünde tablo değişiyor ama şeritte hâlâ solda "Tüm
 * Sektörler" görünüyor: hangi filtrenin açık olduğunu ekranda hiçbir şey
 * söylemiyor, üstelik filtreyi kaldırmak için önce onu aramak gerekiyor.
 *
 * `activeKey` sunucudan geliyor — `useSearchParams` yerine bilerek. Şerit
 * `scroll={false}` bağlantılarla geziniyor, yani bileşen örneği gezinme
 * boyunca yaşıyor; etkinin yeniden koşması için değişen bir bağımlılık şart
 * ve seçili çipin kendisi tam olarak o.
 */
export function ChipStrip({
  activeKey,
  className,
  children,
}: {
  /** Seçili çipin anahtarı; değiştiğinde şerit yeniden konumlanır. */
  activeKey: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /* KENAR SOLMASI ŞERİDİN KENDİSİNDE. Eskiden kabın içinde ayrı bir gradyan
     `div` duruyordu ve iki kusuru vardı: `sm:hidden` olduğu için yalnızca
     mobilde çiziliyordu (masaüstünde şerit sarıyordu, taşma yoktu) ve rengi
     sabitti. Şerit her genişlikte tek satıra dönünce masaüstünde de taşabilir
     hâle geldi — 1024'te on iki çip 980 piksellik kaba sığmıyor — ve o
     gradyan orada hiç görünmüyordu. `edge-fade` maskesi hem her genişlikte
     çalışıyor hem kaydırma konumunu okuyor hem de zemin renginden bağımsız
     (gerekçenin tamamı `ScrollEdges` içinde). */
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const mark = () => {
      const max = strip.scrollWidth - strip.clientWidth;
      strip.dataset.edge =
        max <= 1
          ? "none"
          : strip.scrollLeft <= 1
            ? "end"
            : strip.scrollLeft >= max - 1
              ? "start"
              : "both";
    };
    mark();
    strip.addEventListener("scroll", mark, { passive: true });
    const resize = new ResizeObserver(mark);
    resize.observe(strip);
    return () => {
      strip.removeEventListener("scroll", mark);
      resize.disconnect();
    };
  }, []);

  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    // Şerit taşmıyorsa (geniş ekranda sarıyor) kaydıracak bir şey yok.
    if (strip.scrollWidth <= strip.clientWidth) return;
    const active = strip.querySelector<HTMLElement>('[aria-current="true"]');
    if (!active) return;
    /* `scrollIntoView` DEĞİL: o, sayfayı dikeyde de kaydırıyor ve okuyucuyu
       şeride yapıştırıyor. Burada yalnızca şeridin kendi ekseni oynuyor. */
    strip.scrollTo({
      left: Math.max(
        0,
        active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2,
      ),
      behavior: "auto",
    });
  }, [activeKey]);

  return (
    <div ref={ref} className={`edge-fade ${className ?? ""}`}>
      {children}
    </div>
  );
}
