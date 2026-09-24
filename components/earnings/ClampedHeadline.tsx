"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import styles from "@/components/earnings/EarningsReport.module.css";

/** Açılıp kapanmanın süresi — sitenin kısa geçişleriyle aynı bant. */
const TOGGLE_MS = 220;

/**
 * Görüş gerekçesi — telefonda dört satır, "Devamını Oku" ile tamamı.
 *
 * NEDEN (24 Eylül): 390 pikselde gerekçe paragrafı 10 satır (245 piksel),
 * 320'de 14 satır tutuyordu ve kapak 1375 piksele uzuyordu; skor halkası
 * ile AL/TUT kararı ilk ekranın altında, sabit sekme çubuğunun arkasında
 * kalıyordu (halkanın üstü 789, çubuk 764). Kırpma yalnızca GÖRÜNÜMDE:
 * metnin tamamı DOM'da, ekran okuyucu ve arama motoru hepsini okuyor.
 * Düğme yalnızca telefonda basılıyor (EarningsReport.module.css); geniş
 * ekranda paragraf zaten sınırlı ölçüde tam görünüyor.
 *
 * Yükseklik 220 ms'de marka eğrisiyle açılıyor; azaltılmış harekette
 * doğrudan son hâl. Metin dört satıra sığıyorsa düğme kendini kaldırıyor.
 */
export function ClampedHeadline({
  text,
  lang,
  moreLabel,
  lessLabel,
  className,
}: {
  text: string;
  lang?: string;
  moreLabel: string;
  lessLabel: string;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const from = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [fits, setFits] = useState(false);
  const reduced = useReducedMotion();

  /* Kırpılmış hâlde taşma yoksa düğme anlamsız. Ölçü yalnızca kapalıyken
     alınıyor; açıkken metin zaten tamamıyla görünür. */
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () => setFits(element.scrollHeight <= element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  useLayoutEffect(() => {
    const element = ref.current;
    const start = from.current;
    from.current = null;
    if (!element || start === null || reduced || !("animate" in element)) return;
    const end = element.getBoundingClientRect().height;
    if (Math.abs(end - start) < 1) return;
    element.animate(
      [{ height: `${start}px`, overflow: "hidden" }, { height: `${end}px`, overflow: "hidden" }],
      { duration: TOGGLE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [expanded, reduced]);

  return (
    <div className={styles.headlineBlock}>
      <p
        ref={ref}
        id={id}
        lang={lang}
        className={className}
        data-expanded={expanded || undefined}
      >
        {text}
      </p>
      {!fits && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className={cn(styles.headlineToggle, "text-small font-bold text-primary-ink")}
          onClick={() => {
            from.current = ref.current?.getBoundingClientRect().height ?? null;
            setExpanded((value) => !value);
          }}
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}
