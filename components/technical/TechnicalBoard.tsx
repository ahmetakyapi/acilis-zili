"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";

/** Native radios own filtering (including before hydration). This layer only
 * animates the change in position: no URL navigation, duplicated filter state,
 * or invented loading delay. Capture before the browser changes :checked. */
export function TechnicalBoard({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMotionPreference();
  useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    let before = new Map<HTMLElement, DOMRect>();
    let animations: Animation[] = [];
    let frame = 0;
    const cells = () => Array.from(root.querySelectorAll<HTMLElement>("[data-verdict]"))
      .filter((element) => element.parentElement?.hasAttribute("data-motion-stagger"));
    const capture = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest("label, input");
      const control = target instanceof HTMLLabelElement ? target.control : target;
      if (!(control instanceof HTMLInputElement) || control.name !== "technical-stance" || !root.contains(control)) return;
      animations.forEach((animation) => animation.cancel());
      animations = [];
      before = new Map(cells().filter((cell) => cell.getClientRects().length).map((cell) => [cell, cell.getBoundingClientRect()]));
    };
    const transition = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.name !== "technical-stance") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        cells().filter((cell) => cell.getClientRects().length).forEach((cell, index) => {
          const old = before.get(cell);
          const next = cell.getBoundingClientRect();
          const dx = old ? old.left - next.left : 0;
          const dy = old ? old.top - next.top : 16;
          // Long jumps are a short entrance; the user should not have to
          // follow a card flying through several screens of content.
          const offset = Math.abs(dy) > window.innerHeight ? 16 : dy;
          const animation = cell.animate([
            { transform: `translate(${dx}px, ${offset}px)`, opacity: old ? 1 : .35 },
            { transform: "none", opacity: 1 },
          ], { duration: 420, delay: Math.min(index * 20, 100), easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
          animation.onfinish = () => animation.cancel();
          animations.push(animation);
        });
        before.clear();
      });
    };
    document.addEventListener("pointerdown", capture, true);
    document.addEventListener("keydown", capture, true);
    root.addEventListener("change", transition);
    return () => {
      document.removeEventListener("pointerdown", capture, true);
      document.removeEventListener("keydown", capture, true);
      root.removeEventListener("change", transition);
      cancelAnimationFrame(frame);
      animations.forEach((animation) => animation.cancel());
    };
  }, [reduced]);
  return <section ref={ref} className={className} aria-labelledby="technical-board">{children}</section>;
}
