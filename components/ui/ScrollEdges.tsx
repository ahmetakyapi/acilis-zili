"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Yatay kayan kabın kenarını soldurur — hangi yönde devam ettiğine göre.
 *
 * NEDEN VAR: depoda "devamı var" işareti olarak ince bir kaydırma çubuğu
 * seçilmişti (`.scroll-x-hint`) ve gerekçesi üç ayrı yerde yazılı — hisse
 * grafiğinin aralık şeridi, karşılaştırma grafiği, bilanço tablosu. Ölçümler
 * de telefonda yapılmıştı ("390px telefonda kap 352px, içerik 1180px").
 * Ama İNCE ÇUBUK TELEFONDA YOK: iOS ve Android'de kaydırma çubuğu bir
 * kaplama ve yalnızca parmak kaydırırken beliriyor, duruşta hiç çizilmiyor.
 * Yani kusurun ölçüldüğü ekranda çare hiç görünmüyordu. Bugün ölçülen hâli:
 * 390'da bilanço şeridi 1494, bülten arşivi 1208, analiz tablosu 508 piksel
 * içeriği hiçbir işaret vermeden saklıyor.
 *
 * Solma maske ile yapılıyor, renkli bir perdeyle değil: kabın ALTINDAKİ
 * rengi bilmek gerekmiyor. Depoda bunun tersi bir kez denendi — şirketler
 * sayfasındaki sektör şeridi `--page-bg`ye solan bir gradyan taşıyordu ama
 * kartın zemini `--premium-surface`ti ve solma, kartın üstüne serilmiş
 * yabancı renkte bir perdeye dönüşüyordu.
 *
 * Yön kaydırma konumundan: başta yalnız sağ, sonda yalnız sol, ortada iki
 * kenar solar; taşma yoksa maske hiç uygulanmaz ("none"). Aynı mantık
 * masthead sekmelerinde de var (`PremiumMotion` → `markEdges`); orası tek
 * kullanımlık yazılmıştı, burası paylaşılan hâli.
 *
 * `data-edge` yalnızca istemcide yazılıyor: JavaScript kapalıyken maske hiç
 * olmuyor ve kap her zamanki gibi kayıyor — bir gerileme değil, bugünkü
 * durumun aynısı.
 *
 * SABİT ETİKET SÜTUNU VARSA SOL KENAR SOLMAZ (`fixedStart`). Maske kabın
 * tamamına uygulanıyor, yapışkan hücreler dahil: sağa kaydırılmış bir
 * tabloda sol 34 piksel, yani tam da yerinde kalan etiket sütununun başı
 * soluyordu — "Kaydırma saklanmaz" kuralının okunur tutmak istediği sütun
 * (CLAUDE.md). Oradaki kaydırma zaten görünür: kayan hücreler sabit sütunun
 * opak zemininin ALTINA giriyor. Yalnızca sağ uç "devamı var" der.
 */
export function ScrollEdges({
  as: Tag = "div",
  className,
  children,
  fixedStart = false,
  ...rest
}: {
  /** Kabın etiketi — liste kaplarında `ul` gerekiyor. */
  as?: "div" | "ul" | "ol";
  className?: string;
  children: ReactNode;
  /** Solda yapışkan bir sütun var — yalnızca sağ kenar solar. */
  fixedStart?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mark = () => {
      const max = el.scrollWidth - el.clientWidth;
      const edge =
        max <= 1
          ? "none"
          : el.scrollLeft <= 1
            ? "end"
            : el.scrollLeft >= max - 1
              ? "start"
              : "both";
      el.dataset.edge = fixedStart
        ? edge === "start"
          ? "none"
          : edge === "both"
            ? "end"
            : edge
        : edge;
    };
    mark();
    el.addEventListener("scroll", mark, { passive: true });
    const resize = new ResizeObserver(mark);
    resize.observe(el);
    /* İçerik akışla gelebiliyor (şeritler Suspense'in altında): kap aynı
       boyda kalıp içi değişince ResizeObserver ateşlenmiyor. */
    const mutate = new MutationObserver(mark);
    mutate.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", mark);
      resize.disconnect();
      mutate.disconnect();
    };
  }, [fixedStart]);

  return (
    <Tag ref={ref as never} className={cn("edge-fade", className)} {...rest}>
      {children}
    </Tag>
  );
}
