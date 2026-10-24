"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import styles from "./Story.module.css";

/**
 * Hikâye destesi — kartlar yatay bir şeritte, kaydırarak ya da oklarla.
 *
 * OTOMATİK İLERLEME YOK (sahibinin kuralı): zamanlayıcı, ilerleme çubuğu,
 * "sonraki karta geçiliyor" yok. Okur kendi hızında geçiyor; JS kapalıyken
 * şerit yine kaydırılıyor (`scroll-snap`), oklar yalnızca kolaylık.
 *
 * Kartlar sunucuda çiziliyor ve `children` olarak geliyor (CLAUDE.md
 * "Sunucu bileşeni istemci sağlayıcıya `children` olarak geçebilir");
 * istemcide yalnız hangi kartın önde olduğu ve okların durumu yaşıyor.
 *
 * Kaydırma `scrollTo({ behavior })` ile — hareketi azaltan okurda anında
 * (`prefers-reduced-motion`), CSS'teki `scroll-behavior` de aynı kuralla.
 */
export function StoryDeck({
  children,
  label,
  prevLabel,
  nextLabel,
}: {
  children: ReactNode;
  label: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const total = Children.count(children);
  const [active, setActive] = useState(0);

  /* Öndeki kart: şeridin sol kenarına en yakın kartın sırası. Kaydırma
     olayı karede bir kez okunuyor (rAF), her pikselde değil. */
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const cards = Array.from(node.children) as HTMLElement[];
      const origin = cards[0]?.offsetLeft ?? 0;
      const left = node.scrollLeft;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - origin - left);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      /* Şeridin sonuna gelindiyse son kart önde sayılır: geniş ekranda son
         kartlar sol kenara hiç gelemiyor (kaydırma tavanı), en yakın kart
         ölçüsü orada ileri okun hiç kapanmamasına yol açardı. */
      const atEnd = left >= node.scrollWidth - node.clientWidth - 2;
      setActive(atEnd ? cards.length - 1 : best);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      node.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const go = useCallback((index: number) => {
    const node = track.current;
    const card = node?.children[index] as HTMLElement | undefined;
    const first = node?.children[0] as HTMLElement | undefined;
    if (!node || !card || !first) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* Konum ilk karta göre: `offsetLeft`in neye göre ölçüldüğü (şerit mi,
       üst öğe mi) farkı değiştirmiyor. */
    node.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  }, []);

  /* Bir kart ileri/geri — ölçü o anki kaydırma konumu, `active` değil:
     şeridin sonunda `active` son kartı gösterirken bir geri, kaydırma
     tavanının gerisindeki ilk kart olmalı (yoksa ok tıklamayı yutardı). */
  const step = useCallback(
    (direction: 1 | -1) => {
      const node = track.current;
      if (!node) return;
      const cards = Array.from(node.children) as HTMLElement[];
      const origin = cards[0]?.offsetLeft ?? 0;
      const left = node.scrollLeft;
      const offsets = cards.map((card) => card.offsetLeft - origin);
      const target =
        direction === 1
          ? offsets.findIndex((offset) => offset > left + 2)
          : offsets.findLastIndex((offset) => offset < left - 2);
      if (target >= 0) go(target);
    },
    [go],
  );

  return (
    <div className={styles.deck}>
      <div
        ref={track}
        className={styles.track}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
      >
        {children}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => step(-1)}
          aria-label={prevLabel}
          aria-disabled={active === 0}
        >
          <CaretLeft size={18} weight="bold" aria-hidden />
        </button>
        <span className={styles.dots} aria-hidden>
          {Array.from({ length: total }, (_, index) => (
            <span key={index} className={styles.dot} data-active={index === active || undefined} />
          ))}
        </span>
        <button
          type="button"
          className={styles.arrow}
          onClick={() => step(1)}
          aria-label={nextLabel}
          aria-disabled={active === total - 1}
        >
          <CaretRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
