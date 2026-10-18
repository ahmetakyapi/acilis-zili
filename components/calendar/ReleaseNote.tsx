"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { Locale } from "@/lib/i18n/config";
import type { ReleaseNote as Note } from "@/lib/release-notes";
import { cn } from "@/lib/utils";
import styles from "./ReleasedData.module.css";

/**
 * Bir açıklamanın Claude notu — "Son Açıklanan Veriler" kartının alt yarısı.
 * Gerekçe ve doğruluk kuralları lib/release-notes.ts.
 *
 * Hisse ve haber notlarıyla aynı kalıp (components/news/NewsInsight.tsx):
 * not, kart görünüme yaklaşınca İSTENİR (botlar ve aşağı inmeyen okur Claude
 * çağrısı tetiklemesin); iskelet notun ölçülmüş boyunda; yazılamazsa tek
 * cümle. Kart kalkmaz: değerler ve çubuklar notsuz da doğru.
 */

type Labels = { context: string; loading: string; unavailable: string };

export function ReleaseNote({ id, locale, labels }: { id: string; locale: Locale; labels: Labels }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; note?: Note }>({ status: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/veri-notu?id=${encodeURIComponent(id)}`)
        .then((response) => response.json() as Promise<{ ok: boolean; insight?: Note }>)
        .then((data) => setState(data.ok && data.insight ? { status: "done", note: data.insight } : { status: "failed" }))
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
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, state.status]);

  const text = state.note?.text[locale];
  return (
    <div ref={ref} className={styles.note} aria-busy={state.status === "loading" || state.status === "idle"} aria-live="polite">
      {text ? (
        <>
          <p className={styles.noteSummary}>{text.summary}</p>
          {text.context && (
            <p className={styles.noteContext}>
              <span className={styles.noteLabel}>{labels.context}</span>
              {text.context}
            </p>
          )}
        </>
      ) : state.status === "failed" ? (
        <p className={base.failed}>{labels.unavailable}</p>
      ) : (
        <div className={styles.noteLoading}>
          <p className={base.loadingText}>
            <Sparkle className={base.loadingIcon} size={14} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={cn(base.line, "w-[94%]")} />
          <Skeleton className={cn(base.line, "w-[82%]")} />
          <Skeleton className={cn(base.line, "w-[88%]")} />
          <Skeleton className={cn(base.line, "w-[56%]")} />
        </div>
      )}
    </div>
  );
}
