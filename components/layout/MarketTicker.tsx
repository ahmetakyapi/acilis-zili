"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Alt bilgi şeridi — her ekranın en altında duran ince bant.
 *
 * Kayan (marquee) bir şerit değil: kayan yazı okurken gözü sürekli takip
 * etmeye zorluyor. Bunun yerine bir grup değer duruyor, belirli aralıkla
 * yumuşak bir geçişle bir sonraki gruba dönüyor — bakınca okunuyor,
 * bakmayınca rahatsız etmiyor. `prefers-reduced-motion` açıkken geçiş
 * efekti düşer ama döngü sürer.
 */

export type TickerItem = {
  label: string;
  value: string;
  /** Yön rengi için; null ise nötr yazılır. */
  changePct: number | null;
  /** Değişim metni (yüzde ya da puan). */
  change?: string | null;
};

/** Bir seferde gösterilen değer sayısı — dar ekranda ikiye düşer. */
const PAGE_SIZE = 4;
const ROTATE_MS = 6000;
const FADE_MS = 400;

export function MarketTicker({ items }: { items: TickerItem[] }) {
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    if (pageCount <= 1) return;
    const cycle = window.setInterval(() => {
      // Önce söndür, geçiş bitince sıradaki gruba geç ve yeniden yak.
      setVisible(false);
      window.setTimeout(() => {
        setPage((current) => (current + 1) % pageCount);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => window.clearInterval(cycle);
  }, [pageCount]);

  if (items.length === 0) return null;

  const shown = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div
      aria-live="off"
      className="chrome fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+63px)] z-20 border-t lg:bottom-0"
    >
      <div
        className={cn(
          "mx-auto flex h-8 max-w-[1400px] items-center gap-5 overflow-hidden px-[18px] text-[11.5px] transition-opacity motion-reduce:transition-none sm:px-6 xl:px-10",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        {shown.map((item) => (
          <span key={item.label} className="flex shrink-0 items-center gap-1.5">
            <span className="text-muted">{item.label}</span>
            <span className="numeral font-semibold text-body">{item.value}</span>
            {item.change && (
              <span
                className={cn(
                  "numeral",
                  item.changePct === null || item.changePct === 0
                    ? "text-muted"
                    : item.changePct > 0
                      ? "text-up"
                      : "text-down",
                )}
              >
                {item.change}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
