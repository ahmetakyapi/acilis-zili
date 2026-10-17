"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import { ChangePill, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { EarningsFigure, EarningsInsight, InsightText, MoveInsight } from "@/lib/stock-insights";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./StockInsightCard.module.css";

/**
 * Hisse sayfasının Claude notu (17 Ekim) — "Bu Hafta Neden Hareket Etti"
 * ya da son bilançonun kısa notu. Gerekçe lib/stock-insights.ts.
 *
 * Not, panel görünüme yaklaşınca İSTENİR (botlar ve sayfayı açıp aşağı
 * inmeyen okur Claude çağrısı tetiklemesin). İskelet notun ölçülmüş
 * boyunda: içerik gelince sayfa zıplamasın. Not yazılamazsa (sağlayıcı
 * düşmüş, veri bayat, günlük tavan dolmuş) tek cümle der; panel kalkmaz,
 * çünkü kalkması altındaki her şeyi yukarı çekerdi.
 *
 * Düzen sitenin sırası: başlık → künye şeridi (dönem, değişim, piyasa) →
 * metin → maddeler → künye (Claude ile yazıldı) panelin İÇİNDE, hairline'la.
 */

type Labels = Dictionary["stockInsight"];
type Insight = MoveInsight | EarningsInsight;

const dateFmt = (locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });

function rangeLabel(from: string, to: string, locale: Locale) {
  return dateFmt(locale).formatRange(new Date(`${from}T12:00:00Z`), new Date(`${to}T12:00:00Z`));
}

const weekday = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : "flat");

/**
 * Hareket figürü — iki çizgi, ikisi de GERÇEK sayı (CLAUDE.md
 * "karşılaştırılan büyüklük bir de çizgi olarak okunur"): solda beş
 * seansın gün gün adımı (sıfır çizgisinden yukarı/aşağı), sağda hissenin
 * ve S&P 500'ün beş seanslık değişimi ORTAK ölçekte. Renk yalnız işaretten.
 */
function MoveFigure({ insight, locale, labels }: { insight: MoveInsight; locale: Locale; labels: Labels }) {
  const maxStep = Math.max(...insight.sessions.map((s) => Math.abs(s.changePct)), 0.01);
  const rows = [
    { label: insight.symbol, value: insight.changePct, strong: true },
    ...(insight.marketPct !== null ? [{ label: "S&P 500", value: insight.marketPct, strong: false }] : []),
  ];
  const maxWeek = Math.max(...rows.map((r) => Math.abs(r.value)), 0.01);
  return (
    <div className={styles.figure}>
      <figure className={styles.days} aria-label={labels.daily}>
        <figcaption className={styles.caption}>{labels.daily}</figcaption>
        <div className={styles.dayBars}>
          {insight.sessions.map((session, i) => {
            const h = Math.max(4, (Math.abs(session.changePct) / maxStep) * 100);
            return (
              <div key={session.date} className={styles.day} style={{ "--i": i } as CSSProperties}>
                <span className={styles.dayValue} data-tone={tone(session.changePct)}>
                  {formatPercent(session.changePct, locale, 1)}
                </span>
                <div className={styles.dayTrack}>
                  <div className={styles.dayHalf} data-side="up">
                    {session.changePct > 0 && <i className={styles.dayBar} data-tone="up" style={{ height: `${h}%` }} />}
                  </div>
                  <div className={styles.dayHalf} data-side="down">
                    {session.changePct <= 0 && <i className={styles.dayBar} data-tone={tone(session.changePct)} style={{ height: `${h}%` }} />}
                  </div>
                </div>
                <span className={styles.dayLabel}>{weekday(session.date, locale)}</span>
              </div>
            );
          })}
        </div>
      </figure>
      <figure className={styles.compare} aria-label={labels.compare}>
        <figcaption className={styles.caption}>{labels.compare}</figcaption>
        {rows.map((row, i) => {
          const w = Math.max(2, (Math.abs(row.value) / maxWeek) * 50);
          return (
            <div key={row.label} className={styles.compareRow} style={{ "--i": i } as CSSProperties}>
              <span className={cn(styles.compareLabel, row.strong && styles.compareStrong)}>{row.label}</span>
              <div className={styles.compareTrack}>
                <i
                  className={styles.compareBar}
                  data-tone={tone(row.value)}
                  style={row.value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                />
              </div>
              <span className={styles.compareValue} data-tone={tone(row.value)}>
                {formatPercent(row.value, locale, 2)}
              </span>
            </div>
          );
        })}
      </figure>
    </div>
  );
}

/** Bilanço figürü — her ölçüde beklenti ve gerçekleşen, kendi ölçeğinde iki çizgi. */
function EarningsFigureView({ insight, locale, labels }: { insight: EarningsInsight; locale: Locale; labels: Labels }) {
  const items = [
    insight.eps && { key: "eps", label: labels.eps, figure: insight.eps, format: (v: number) => formatPrice(v, locale, { currency: true }) },
    insight.revenue && {
      key: "revenue",
      label: labels.revenue,
      figure: insight.revenue,
      format: (v: number) =>
        locale === "tr" ? `${(v / 1e9).toFixed(2).replace(".", ",")} Mr $` : `$${(v / 1e9).toFixed(2)}B`,
    },
  ].filter(Boolean) as { key: string; label: string; figure: EarningsFigure; format: (v: number) => string }[];
  if (items.length === 0) return null;
  return (
    <div className={styles.figure} data-kind="earnings">
      {items.map((item, i) => {
        const scale = Math.max(Math.abs(item.figure.actual), Math.abs(item.figure.estimate), 1e-9);
        const verdict = item.figure.direction;
        return (
          <figure key={item.key} className={styles.metric} style={{ "--i": i } as CSSProperties}>
            <figcaption className={styles.metricHead}>
              <span className={styles.metricLabel}>{item.label}</span>
              <span className={styles.verdict} data-verdict={verdict}>
                {labels.verdict[verdict]}
                {item.figure.ratio !== null && ` ${formatPercent(item.figure.ratio * 100, locale, 1)}`}
              </span>
            </figcaption>
            {(
              [
                [labels.estimate, item.figure.estimate, "estimate"],
                [labels.actual, item.figure.actual, verdict],
              ] as const
            ).map(([label, value, kind], j) => (
              <div key={label} className={styles.metricRow} style={{ "--j": j } as CSSProperties}>
                <span className={styles.metricRowLabel}>{label}</span>
                <div className={styles.metricTrack}>
                  <i className={styles.metricBar} data-kind={kind} style={{ width: `${Math.max(3, (Math.abs(value) / scale) * 100)}%` }} />
                </div>
                <span className={styles.metricValue}>{item.format(value)}</span>
              </div>
            ))}
          </figure>
        );
      })}
    </div>
  );
}

export function StockInsightCard({
  symbol,
  kind,
  locale,
  labels,
}: {
  symbol: string;
  kind: "move" | "earnings";
  locale: Locale;
  labels: Labels;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; insight?: Insight }>({ status: "idle" });

  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/hisse-notu?sembol=${encodeURIComponent(symbol)}&tur=${kind === "move" ? "hareket" : "bilanco"}`)
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
  }, [symbol, kind, state.status]);

  const title = kind === "move" ? labels.moveTitle : labels.earningsTitle;
  const insight = state.insight;
  const text: InsightText | undefined = insight ? insight.text[locale] : undefined;

  return (
    <Panel ref={ref} className={styles.card} aria-busy={state.status === "loading" || state.status === "idle"}>
      <PanelHeader
        title={title}
        action={
          insight?.kind === "move" ? (
            <span className={styles.badge} data-explained={insight.explained}>
              {labels.explained[insight.explained]}
            </span>
          ) : (
            <Sparkle className={styles.icon} size={18} weight="duotone" aria-hidden />
          )
        }
      />

      {insight ? (
        <div className={styles.strip}>
          {insight.kind === "move" ? (
            <>
              <span className={styles.stripLabel}>{labels.window.replace("{range}", rangeLabel(insight.from, insight.to, locale))}</span>
              <ChangePill changePct={insight.changePct} locale={locale} />
              {insight.marketPct !== null && (
                <span className={styles.stripMuted}>{labels.market.replace("{pct}", formatPercent(insight.marketPct, locale, 2))}</span>
              )}
            </>
          ) : (
            <>
              <span className={styles.stripLabel}>
                {labels.reported.replace("{date}", dateFmt(locale).format(new Date(`${insight.reportDate}T12:00:00Z`)))}
              </span>
              {insight.reactionPct !== null && (
                <>
                  <span className={styles.stripMuted}>{labels.reaction}</span>
                  <ChangePill changePct={insight.reactionPct} locale={locale} />
                </>
              )}
            </>
          )}
        </div>
      ) : null}

      {state.status === "done" && insight?.kind === "move" && insight.sessions?.length ? (
        <MoveFigure insight={insight} locale={locale} labels={labels} />
      ) : null}
      {state.status === "done" && insight?.kind === "earnings" ? <EarningsFigureView insight={insight} locale={locale} labels={labels} /> : null}

      {state.status === "done" && text ? (
        <div className={styles.body}>
          <p className={styles.summary} style={{ "--i": 0 } as CSSProperties}>{text.summary}</p>
          {text.points.length > 0 && (
            <ol className={styles.points}>
              {text.points.map((point, index) => (
                <li key={index} className={styles.point} style={{ "--i": index + 1 } as CSSProperties}>
                  <span className={styles.pointIndex} aria-hidden>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={styles.pointTitle}>{point.title}</p>
                    <p className={styles.pointDetail}>{point.detail}</p>
                    {point.source && (
                      <a href={point.source.url} target="_blank" rel="noreferrer noopener" className={styles.source}>
                        {point.source.source ?? labels.source}
                        <ArrowUpRight size={12} weight="bold" aria-hidden />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className={styles.disclosure}>{labels.disclosure}</p>
        </div>
      ) : state.status === "failed" ? (
        <p className={styles.failed}>{labels.unavailable}</p>
      ) : (
        <div className={styles.loading} data-kind={kind}>
          <p className={styles.loadingText}>
            <Sparkle className={styles.loadingIcon} size={15} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={cn(styles.line, "w-[92%]")} />
          <Skeleton className={cn(styles.line, "w-[78%]")} />
          <Skeleton className={cn(styles.line, "w-[85%]")} />
          <Skeleton className={cn(styles.line, "w-[60%]")} />
        </div>
      )}
    </Panel>
  );
}
