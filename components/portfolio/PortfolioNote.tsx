"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { PortfolioNote as Note } from "@/lib/portfolio-note";
import { cn } from "@/lib/utils";

/**
 * Portföy notu (18 Ekim) — gerekçe lib/portfolio-note.ts. Hisse notuyla aynı
 * kalıp (components/stock/StockInsightCard.tsx): panel görünüme yaklaşınca
 * istenir, iskelet notun boyunda, yazılamazsa tek cümle.
 */
export function PortfolioNote({ locale, labels }: { locale: Locale; labels: Dictionary["portfolioNote"] }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; note?: Note }>({ status: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/portfoy-notu?dil=${locale}`)
        .then((response) => response.json() as Promise<{ ok: boolean; note?: Note }>)
        .then((data) => setState(data.ok && data.note ? { status: "done", note: data.note } : { status: "failed" }))
        .catch(() => setState({ status: "failed" }));
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [locale, state.status]);

  const note = state.note;
  const date = note
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${note.session}T12:00:00Z`))
    : null;
  return (
    <Panel ref={ref} className={base.card} aria-busy={state.status === "loading" || state.status === "idle"}>
      <PanelHeader
        title={labels.title}
        meta={date ? labels.session.replace("{date}", date) : undefined}
        action={<Sparkle className={base.icon} size={18} weight="duotone" aria-hidden />}
      />
      {note ? (
        <div className={base.body}>
          <p className={base.summary}>{note.summary}</p>
          {note.points.length > 0 && (
            <ol className={base.points}>
              {note.points.map((point, index) => (
                <li key={index} className={base.point} style={{ "--i": index + 1 } as CSSProperties}>
                  <span className={base.pointIndex} aria-hidden>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={base.pointTitle}>{point.title}</p>
                    <p className={base.pointDetail}>{point.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className={base.disclosure}>
            {note.covered < note.total && (
              <>
                {labels.partial.replace("{covered}", String(note.covered)).replace("{total}", String(note.total))}{" "}
              </>
            )}
            {labels.disclosure}
          </p>
        </div>
      ) : state.status === "failed" ? (
        <p className={base.failed}>{labels.unavailable}</p>
      ) : (
        <div className="flex min-h-[300px] flex-col gap-[9px]">
          <p className={base.loadingText}>
            <Sparkle className={base.loadingIcon} size={15} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={cn(base.line, "w-[92%]")} />
          <Skeleton className={cn(base.line, "w-[78%]")} />
          <Skeleton className={cn(base.line, "w-[85%]")} />
          <Skeleton className={cn(base.line, "w-[60%]")} />
        </div>
      )}
    </Panel>
  );
}
