"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { AnalysisNote as Note } from "@/lib/portfolio-analysis-note";
import { cn, tieFigures } from "@/lib/utils";
import styles from "./Analysis.module.css";

/* İşaret sayıdan kopmasın: "−" satır sonunda, "%16,5" alt satırda kalıyordu
   (390'da ölçüldü). İşaretten sonra kelime birleştirici (U+2060). */
const keepSigns = (text: string) => tieFigures(text.replace(/([\u2212+])(?=[%\d])/g, "$1\u2060"));

/**
 * Claude'un risk okuması (24 Ekim) — gerekçe lib/portfolio-analysis-note.ts.
 * Portföy notunun kalıbı (components/portfolio/PortfolioNote.tsx): panel
 * görünüme yaklaşınca istenir, iskelet metnin boyunda, yazılamazsa tek
 * cümle; ölçüler panelin üstünde zaten eksiksiz.
 */
export function AnalysisNote({
  locale,
  labels,
  disclaimer,
  endpoint = "/api/ai/portfoy-analizi",
}: {
  locale: Locale;
  labels: Dictionary["portfolioAnalysis"]["note"];
  disclaimer: string;
  /** Geçici fixture yolu başka uca bakar; üretimde varsayılan. */
  endpoint?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; note?: Note }>({ status: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`${endpoint}?dil=${locale}`)
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
  }, [endpoint, locale, state.status]);

  const note = state.note;
  return (
    <Panel ref={ref} className={base.card} aria-busy={state.status === "loading" || state.status === "idle"}>
      <PanelHeader title={labels.title} action={<Sparkle className={base.icon} size={18} weight="duotone" aria-hidden />} />
      {note ? (
        <div className={base.body}>
          <div className={styles.paragraphs}>
            {note.paragraphs.map((paragraph, index) => (
              <p key={index}>{keepSigns(paragraph)}</p>
            ))}
          </div>
          <p className={base.disclosure}>
            {labels.disclosure} {disclaimer}
          </p>
        </div>
      ) : state.status === "failed" ? (
        <p className={base.failed}>{labels.unavailable}</p>
      ) : (
        <div className={styles.noteLoading}>
          <p className={base.loadingText}>
            <Sparkle className={base.loadingIcon} size={15} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={cn(base.line, "w-[94%]")} />
          <Skeleton className={cn(base.line, "w-[88%]")} />
          <Skeleton className={cn(base.line, "w-[72%]")} />
          <Skeleton className={cn(base.line, "mt-3 w-[90%]")} />
          <Skeleton className={cn(base.line, "w-[84%]")} />
          <Skeleton className={cn(base.line, "w-[58%]")} />
        </div>
      )}
    </Panel>
  );
}
