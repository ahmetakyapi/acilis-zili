"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { NewsBriefing, NewsExplainer } from "@/lib/news-insights";
import { cn } from "@/lib/utils";
import styles from "./NewsInsight.module.css";

/**
 * Haber notları (17 Ekim) — /haberler'de "Günün Gündemi", haber detayında
 * "Bu Haber Ne Anlatıyor". Gerekçe ve doğruluk kuralları lib/news-insights.ts.
 *
 * Hisse notuyla aynı kalıp (components/stock/StockInsightCard.tsx): not,
 * panel görünüme yaklaşınca İSTENİR (botlar ve aşağı inmeyen okur Claude
 * çağrısı tetiklemesin); iskelet notun ölçülmüş boyunda; yazılamazsa tek
 * cümle. Gündem başlıkları habere bağlanır: not okuru haberin kendisine
 * götürür, yerine geçmez.
 */

type Labels = Dictionary["newsInsight"];
type Insight = NewsBriefing | NewsExplainer;

function useInsight<T extends HTMLElement = HTMLElement>(url: string) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; insight?: Insight }>({ status: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(url)
        .then((response) => response.json() as Promise<{ ok: boolean; insight?: Insight }>)
        .then((data) => setState(data.ok && data.insight ? { status: "done", insight: data.insight } : { status: "failed" }))
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
  }, [url, state.status]);
  return { ref, state };
}

function Loading({ text, kind }: { text: string; kind: "briefing" | "explainer" }) {
  return (
    <div className={styles.loading} data-kind={kind}>
      <p className={base.loadingText}>
        <Sparkle className={base.loadingIcon} size={15} weight="fill" aria-hidden />
        {text}
      </p>
      <Skeleton className={cn(base.line, "w-[92%]")} />
      <Skeleton className={cn(base.line, "w-[78%]")} />
      <Skeleton className={cn(base.line, "w-[85%]")} />
      <Skeleton className={cn(base.line, "w-[60%]")} />
    </div>
  );
}

export function NewsBriefingCard({ locale, labels }: { locale: Locale; labels: Labels }) {
  /* İKİ KAPSAM, SEKMELİ (18 Ekim, sahibinin isteği: günlük ve haftalık).
     Alt alta iki gündem sayfayı bir ekran uzatırdı; sekme aynı yeri
     kullanıyor. Haftalık gündem yalnız sekmeye basılınca istenir. */
  const [scope, setScope] = useState<"day" | "week">("day");
  return (
    <Panel className={base.card}>
      <PanelHeader
        title={scope === "week" ? labels.weekTitle : labels.briefingTitle}
        action={
          <div className={styles.scopeTabs} role="tablist" aria-label={labels.scopeLabel}>
            {(["day", "week"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={scope === key}
                className={styles.scopeTab}
                onClick={() => setScope(key)}
              >
                {key === "day" ? labels.tabDay : labels.tabWeek}
              </button>
            ))}
          </div>
        }
      />
      <BriefingBody key={scope} scope={scope} locale={locale} labels={labels} />
    </Panel>
  );
}

function BriefingBody({ scope, locale, labels }: { scope: "day" | "week"; locale: Locale; labels: Labels }) {
  const { ref, state } = useInsight<HTMLDivElement>(`/api/ai/haber-notu?tur=gundem${scope === "week" ? "&kapsam=hafta" : ""}`);
  const briefing = state.insight?.kind === "briefing" ? state.insight : null;
  return (
    <div ref={ref} className={styles.briefingBody} aria-busy={state.status === "loading" || state.status === "idle"}>
      {briefing ? (
        <>
          <p className={styles.window}>{(scope === "week" ? labels.weekWindow : labels.briefingWindow).replace("{n}", String(briefing.considered))}</p>
          <ol className={styles.themes}>
            {briefing.themes.map((theme, i) => {
              /* Konunun şirketleri — logo şeridi (18 Ekim). Yalnız sitede
                 sayfası olan semboller (uç bilinmeyeni süzüyor). */
              const symbols = [...new Set(theme.items.flatMap((item) => item.symbols))].filter((sym) => briefing.logos && sym in briefing.logos).slice(0, 4);
              return (
              <li key={i} className={styles.theme} data-lead={(i === 0 && briefing.themes.length % 2 === 1) || undefined} style={{ "--i": i } as CSSProperties}>
                <div className={styles.themeHead}>
                  <span className={styles.themeIndex} aria-hidden>
                    {i + 1}
                  </span>
                  {symbols.length > 0 && (
                    <span className={styles.logos}>
                      {symbols.map((sym) => (
                        <Link key={sym} href={`/hisse/${sym}`} className={styles.logo} title={sym}>
                          <LogoTile symbol={sym} logoUrl={briefing.logos?.[sym]} size="xs" />
                          <span className={styles.logoSymbol}>{sym}</span>
                        </Link>
                      ))}
                    </span>
                  )}
                  <span className={styles.count}>{labels.storyCount.replace("{n}", String(theme.items.length))}</span>
                </div>
                <div className={styles.themeBody}>
                  <p className={styles.themeTitle}>{theme.title[locale]}</p>
                  <p className={styles.themeSummary}>{theme.summary[locale]}</p>
                  <ul className={styles.items}>
                    {theme.items.map((item) => {
                      const translated = locale === "tr" && item.headlineTr;
                      return (
                        <li key={item.id}>
                          <Link href={`/haberler/${item.id}`} className={styles.item}>
                            <span lang={locale === "tr" && !translated ? "en" : undefined} className={styles.itemHeadline}>
                              {translated ? item.headlineTr : item.headline}
                            </span>
                            {item.source && <span className={styles.itemSource}>{item.source}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
              );
            })}
          </ol>
          <p className={base.disclosure}>{labels.briefingDisclosure}</p>
        </>
      ) : state.status === "failed" ? (
        <p className={base.failed}>{labels.unavailable}</p>
      ) : (
        <Loading text={scope === "week" ? labels.weekLoading : labels.briefingLoading} kind="briefing" />
      )}
    </div>
  );
}

export function NewsExplainerCard({ id, locale, labels }: { id: string; locale: Locale; labels: Labels }) {
  const { ref, state } = useInsight(`/api/ai/haber-notu?id=${encodeURIComponent(id)}`);
  const explainer = state.insight?.kind === "explainer" ? state.insight : null;
  const text = explainer?.text[locale];
  return (
    <Panel ref={ref} className={base.card} aria-busy={state.status === "loading" || state.status === "idle"}>
      <PanelHeader title={labels.explainerTitle} action={<Sparkle className={base.icon} size={18} weight="duotone" aria-hidden />} />
      {text ? (
        <div className={base.body}>
          <p className={base.summary}>{text.summary}</p>
          {text.points.length > 0 && (
            <ol className={base.points}>
              {text.points.map((point, index) => (
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
          <p className={base.disclosure}>{labels.explainerDisclosure}</p>
        </div>
      ) : state.status === "failed" ? (
        <p className={base.failed}>{labels.unavailable}</p>
      ) : (
        <Loading text={labels.explainerLoading} kind="explainer" />
      )}
    </Panel>
  );
}
