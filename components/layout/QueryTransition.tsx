"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryNavigationRun } from "./RouteProgress";
import { LoadingSurface } from "@/components/ui/LoadingState";

const focusText = (element: Element) => element.textContent?.replace(/[▲▼△▽↑↓]/g, "").trim() ?? "";

/** Keep committed geometry through both network wait and streamed fallbacks.
 * The pending copy is inert, so actions cannot operate on masked stale data.
 * Fast responses never flash a skeleton; keyboard focus returns to the same
 * control when its new result arrives, without moving the viewport. */
export function QueryTransition({ children, label }: { children: ReactNode; label: string }) {
  const run = useQueryNavigationRun();
  const content = useRef<HTMLDivElement>(null);
  const focus = useRef<{ tag: string; text: string } | null>(null);
  const [shownRun, setShownRun] = useState(0);
  const pending = run !== 0 && run === shownRun;

  useEffect(() => {
    const body = content.current;
    const region = body?.parentElement;
    if (!body || !region) return;
    if (run) {
      region.style.minHeight = `${region.getBoundingClientRect().height}px`;
      const timer = window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && body.contains(active)) {
          focus.current = { tag: active.tagName, text: focusText(active) };
        }
        setShownRun(run);
      }, 140);
      return () => window.clearTimeout(timer);
    }

    let frame = 0;
    const observer = new MutationObserver(settle);
    function settle() {
      if (body!.querySelector(".loading-fallback")) return;
      observer.disconnect();
      region!.style.minHeight = "";
      if (!focus.current) return;
      frame = requestAnimationFrame(() => {
        const previous = focus.current;
        focus.current = null;
        if (!previous || document.activeElement !== document.body) return;
        const match = [...body!.querySelectorAll<HTMLElement>("a,button,summary")]
          .find(element => element.tagName === previous.tag && focusText(element) === previous.text);
        match?.focus({ preventScroll: true });
      });
    }
    observer.observe(body, { childList: true, subtree: true });
    settle();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [run]);

  return <div className="query-transition" data-query-transition data-pending={pending || undefined} aria-busy={run !== 0 || undefined}>
    <div ref={content} className="query-content" inert={pending || undefined}>{children}</div>
    {pending && <LoadingSurface label={label} />}
  </div>;
}
