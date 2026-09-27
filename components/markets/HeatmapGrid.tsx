"use client";

import { useEffect, useRef, type ReactNode, type FocusEvent, type PointerEvent } from "react";

/** Server-rendered cells; one delegated Escape handler for the whole map.
 * Dismissal lasts until the pointer/focus leaves the cell, so a still-hovered
 * tile cannot immediately reopen its card after Escape. */
export function HeatmapGrid({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const grid = ref.current;
      if (!grid) return;
      const cells = grid.querySelectorAll<HTMLElement>("[data-heat-cell]:hover, [data-heat-cell]:focus-visible");
      cells.forEach((cell) => cell.setAttribute("data-heat-dismissed", ""));
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);

  const position = (event: PointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const cell = event.target.closest<HTMLElement>("[data-heat-cell]");
    if (!cell || !ref.current?.contains(cell)) return;
    if (event.relatedTarget instanceof Node && cell.contains(event.relatedTarget)) return;
    const card = cell.querySelector<HTMLElement>("[data-heat-card]");
    if (!card || getComputedStyle(card).display === "none") return;
    const top = Math.max(12, ...Array.from(document.querySelectorAll("header.chrome"), (header) => header.getBoundingClientRect().bottom + 12));
    const rect = cell.getBoundingClientRect();
    const above = rect.top - top;
    const below = window.innerHeight - 80 - rect.bottom;
    cell.dataset.heatSide = above < card.offsetHeight + 8 && below > above ? "below" : "above";
  };

  const reset = (event: PointerEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const cell = event.target.closest<HTMLElement>("[data-heat-cell]");
    if (!cell || !ref.current?.contains(cell)) return;
    if (event.relatedTarget instanceof Node && cell.contains(event.relatedTarget)) return;
    cell.removeAttribute("data-heat-dismissed");
  };

  return <div ref={ref} className={className} data-motion-stagger onPointerOver={position} onFocus={position} onPointerOut={reset} onBlur={reset}>
    {children}
  </div>;
}
