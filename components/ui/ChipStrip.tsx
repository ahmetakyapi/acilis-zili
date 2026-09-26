"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

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
type Edge = "none" | "start" | "end" | "both";

/** Bir tıkta kaydırılan pay — şeridin görünen genişliğinin bu kadarı; bir
    önceki görünümden bir-iki çip ekranda kalıyor, göz yerini kaybetmiyor. */
const PAGE_SHARE = 0.72;

export function ChipStrip({
  activeKey,
  className,
  children,
  scrollLabels,
}: {
  /** Seçili çipin anahtarı; değiştiğinde şerit yeniden konumlanır. */
  activeKey: string | null;
  className?: string;
  children: React.ReactNode;
  /** Verilirse şerit taşarken iki yanda yön düğmeleri çıkar. */
  scrollLabels?: { prev: string; next: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<Edge>("none");

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
      const next: Edge =
        max <= 1
          ? "none"
          : strip.scrollLeft <= 1
            ? "end"
            : strip.scrollLeft >= max - 1
              ? "start"
              : "both";
      strip.dataset.edge = next;
      setEdge(next);
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

  /* YÖN DÜĞMELERİ (26 Eylül). Kenar solması "devamı var" diyordu ama çok
     sessizdi: sektör şeridinin sağda sürdüğü fark edilmiyordu (sahibinin
     bildirimi). Şerit taşarken, yalnızca kaydırılabilen yönde yuvarlak bir
     ok beliriyor; basınca şerit bir sayfa kayıyor. Solma yerinde kalıyor,
     düğme onun üstünde. Düğmeler odak sırasının DIŞINDA değil — klavyeyle
     gelen de kaydırabiliyor; ama şerit zaten klavyeyle kayıyor, o yüzden
     yalnızca yardımcı. Taşma yoksa hiç basılmıyor. */
  const page = (dir: 1 | -1) => {
    const strip = ref.current;
    if (!strip) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollBy({ left: dir * strip.clientWidth * PAGE_SHARE, behavior: reduce ? "auto" : "smooth" });
  };
  const canBack = edge === "start" || edge === "both";
  const canForward = edge === "end" || edge === "both";

  return (
    <div className="chip-strip">
      <div ref={ref} className={`edge-fade ${className ?? ""}`}>
        {children}
      </div>
      {scrollLabels && canBack && (
        <button type="button" className="chip-strip-arrow" data-side="start" aria-label={scrollLabels.prev} onClick={() => page(-1)}>
          <CaretLeft weight="bold" size={14} aria-hidden />
        </button>
      )}
      {scrollLabels && canForward && (
        <button type="button" className="chip-strip-arrow" data-side="end" aria-label={scrollLabels.next} onClick={() => page(1)}>
          <CaretRight weight="bold" size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
