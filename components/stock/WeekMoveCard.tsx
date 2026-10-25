"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { InsightText, MoveInsight } from "@/lib/stock-insights";
import { cn, formatPercent } from "@/lib/utils";
import { cumulativePath, loudestSession, type WeekMove } from "./week-move";
import styles from "./WeekMove.module.css";

/**
 * Bu Hafta Neden Hareket Etti, KOMPAKT (25 Ekim, sahibinin isteği: "Bu
 * Hisseye Sor böyle kocaman olmasına gerek var mı; yanına Bu Hisse Neden
 * Hareket Etti konabilir"). Kart Bu Hisseye Sor ile tek panelin iki
 * kolonu (app/(app)/hisse/[symbol]/_panels/AskMovePanel.tsx).
 *
 * Eski tam genişlik kart (StockInsightCard, kind="move") 1280'de 595,
 * 390'da 824 piksel tutuyordu ve SAYILARI da Claude notuyla birlikte
 * istemciden geliyordu: not yoksa kart yalnız "hazırlanamadı" diyordu.
 * Şimdi sayılar sunucudan (`WeekMove`, components/stock/week-move.ts):
 * büyük değişim, S&P 500 farkı ve beş seansın birikimli çizgisi ilk karede
 * basılı. Not eskisi gibi İSTEMCİDEN ve panel görüş alanına yaklaşınca
 * isteniyor (botlar ve aşağı inmeyen okur Claude çağrısı tetiklemesin; uç
 * da botu geri çeviriyor — app/api/ai/hisse-notu). Notun metni ancak
 * penceresi sunucununkiyle aynıysa basılıyor; değilse yazılamamış sayılır.
 *
 * Maddeler katlı (`details`): özet cümlesi kartın boyunu belirliyor, üç
 * etken isteyene açılıyor. Renk yalnız yönden (up/down); çizgi ince, alan
 * düz ton, degrade yok (CLAUDE.md "grafik dili ince").
 */

type Labels = Dictionary["stockInsight"];
type WeekLabels = Dictionary["stockWeek"];

const X0 = 4;
const X1 = 96;
const xAt = (i: number, n: number) => X0 + (i / Math.max(1, n - 1)) * (X1 - X0);
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : "flat");
/** Hacmi 20 seans ortalamasının bu katını aşan seans işaretli (notla aynı eşik). */
const LOUD_VOLUME = 1.5;
/** Çizginin üst ve altında bırakılan pay, aralığın oranı. */
const PAD_RATIO = 0.14;
const MIN_PAD = 0.2;
/** Notun istendiği uzaklık: görüş alanına bu kadar kala. */
const PREFETCH_MARGIN = "400px 0px";

const nf = (locale: Locale, digits: number) =>
  new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/* ARALIK ELLE KURULUYOR (25 Ekim): `formatRange` sunucuda (Node ICU) ve
   tarayıcıda farklı boşluk basıyordu ("19 – 23" ince boşluklu / düz) ve kart
   artık sunucuda çizildiği için hidrasyon düşüyordu. Ayraç düz tire. */
function rangeLabel(from: string, to: string, locale: Locale) {
  const tag = locale === "en" ? "en-US" : "tr-TR";
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  const full = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", timeZone: "UTC" });
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${full.format(a)} - ${full.format(b)}`;
  const month = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" }).format(b);
  return locale === "en" ? `${month} ${a.getUTCDate()}-${b.getUTCDate()}` : `${a.getUTCDate()}-${b.getUTCDate()} ${month}`;
}

const weekday = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function WeekMoveCard({
  week,
  noteEnabled,
  locale,
  labels,
  copy,
}: {
  week: WeekMove;
  /** Claude anahtarı var mı (sunucuda `insightsConfigured`). Yoksa not alanı hiç yok. */
  noteEnabled: boolean;
  locale: Locale;
  labels: Labels;
  copy: WeekLabels;
}) {
  const { symbol } = week;
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; text?: InsightText; explained?: MoveInsight["explained"] }>({
    status: noteEnabled ? "idle" : "failed",
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !noteEnabled || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/hisse-notu?sembol=${encodeURIComponent(symbol)}&tur=hareket`)
        .then((response) => response.json() as Promise<{ ok: boolean; insight?: MoveInsight }>)
        .then((data) => {
          const insight = data.ok ? data.insight : undefined;
          /* Aynı pencere değilse not başka bir haftayı anlatıyor (seans
             bu arada kapandı): basılmaz, kart haftanın verisiyle kalır. */
          setState(
            insight && insight.kind === "move" && insight.to === week.to
              ? { status: "done", text: insight.text[locale], explained: insight.explained }
              : { status: "failed" },
          );
        })
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
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [symbol, noteEnabled, state.status, week.to, locale]);

  const stock = cumulativePath(week.sessions);
  const market = week.marketSessions?.length === week.sessions.length ? cumulativePath(week.marketSessions) : null;
  const all = [...stock, ...(market ?? []), 0];
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  const pad = Math.max((hi - lo) * PAD_RATIO, MIN_PAD);
  const top = hi + pad;
  const bottom = lo - pad;
  const yAt = (v: number) => ((top - v) / (top - bottom)) * 100;
  const n = stock.length;
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${xAt(i, n).toFixed(2)} ${yAt(v).toFixed(2)}`).join(" ");
  const zeroY = yAt(0);
  const area = `${path(stock)} L${xAt(n - 1, n).toFixed(2)} ${zeroY.toFixed(2)} L${xAt(0, n).toFixed(2)} ${zeroY.toFixed(2)} Z`;
  const stockTone = tone(week.changePct);
  const loudest = loudestSession(week.sessions);
  const gap = week.marketPct !== null ? week.changePct - week.marketPct : null;
  const gapText =
    gap === null
      ? null
      : Math.abs(gap) < 0.05
        ? labels.inlineMarket
        : (gap > 0 ? labels.aboveMarket : labels.belowMarket).replace("{pts}", nf(locale, 2).format(Math.abs(gap)));
  const text = state.text;

  return (
    <section ref={ref} className={styles.card} aria-labelledby={titleId} aria-busy={state.status === "loading" || state.status === "idle"}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {labels.moveTitle}
        </h2>
        {state.explained ? (
          <span className={styles.badge} data-explained={state.explained}>
            {labels.explained[state.explained]}
          </span>
        ) : noteEnabled ? (
          <Sparkle className={styles.icon} size={17} weight="duotone" aria-hidden />
        ) : null}
      </div>
      <p className={styles.window}>{labels.window.replace("{range}", rangeLabel(week.from, week.to, locale))}</p>

      <div className={styles.figure}>
        <div className={styles.lead}>
          <p className={styles.caption}>{labels.compare}</p>
          <p className={cn("numeral", styles.big)} data-tone={stockTone}>
            {formatPercent(week.changePct, locale, 2)}
          </p>
          {week.marketPct !== null && (
            <p className={styles.market}>
              <span>
                S&amp;P 500{" "}
                <b className="numeral" data-tone={tone(week.marketPct)}>
                  {formatPercent(week.marketPct, locale, 2)}
                </b>
              </span>
              {gapText && (
                <span className={styles.gap} data-tone={gap === null ? "flat" : tone(gap)}>
                  {gapText}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Mini çizgi: beş seansın birikimli yolu, S&P kesik nötr çizgi.
            Sayılar HTML'de (altta gün gün), SVG yalnız çizim. */}
        <figure className={styles.spark} aria-label={labels.pathTitle}>
          <div className={styles.plot}>
            <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <line x1="0" x2="100" y1={zeroY} y2={zeroY} className={styles.zero} vectorEffect="non-scaling-stroke" />
              <path d={area} className={styles.area} data-tone={stockTone} />
              {market && <path d={path(market)} className={styles.marketLine} vectorEffect="non-scaling-stroke" />}
              <path d={path(stock)} className={styles.stockLine} data-tone={stockTone} vectorEffect="non-scaling-stroke" />
            </svg>
            <span
              className={styles.endDot}
              data-tone={stockTone}
              style={{ left: `${xAt(n - 1, n)}%`, top: `${yAt(stock[n - 1]!)}%` } as CSSProperties}
              aria-hidden
            />
          </div>
          <ol className={styles.days}>
            {week.sessions.map((session, i) => (
              <li
                key={session.date}
                style={{ left: `${xAt(i + 1, n)}%` } as CSSProperties}
                title={(session.volumeRatio ?? 0) >= LOUD_VOLUME ? labels.highVolume : undefined}
              >
                <span className={styles.dayName}>{weekday(session.date, locale)}</span>
                <span className={cn("numeral", styles.dayValue)} data-tone={tone(session.changePct)} data-loudest={i === loudest || undefined}>
                  {formatPercent(session.changePct, locale, 1)}
                </span>
                {(session.volumeRatio ?? 0) >= LOUD_VOLUME && (
                  <span className={styles.volume}>{labels.volumeTimes.replace("{x}", nf(locale, 1).format(session.volumeRatio!))}</span>
                )}
              </li>
            ))}
          </ol>
          <ul className={styles.legend} aria-hidden>
            <li data-series="stock" data-tone={stockTone}>{symbol}</li>
            {market && <li data-series="market">S&amp;P 500</li>}
          </ul>
        </figure>
      </div>

      {noteEnabled && (
        <div className={styles.note} data-state={state.status} aria-live="polite">
          {state.status === "done" && text ? (
            <>
              <p className={styles.summary}>{text.summary}</p>
              {text.points.length > 0 && (
                <details className={styles.points}>
                  <summary>
                    {copy.points.replace("{n}", String(text.points.length))}
                    <span aria-hidden className={styles.plus}>+</span>
                  </summary>
                  <ol>
                    {text.points.map((point, index) => (
                      <li key={index}>
                        <p className={styles.pointTitle}>{point.title}</p>
                        <p className={styles.pointDetail}>{point.detail}</p>
                        {point.source && (
                          <a href={point.source.url} target="_blank" rel="noreferrer noopener" className={styles.source}>
                            {point.source.source ?? labels.source}
                            <ArrowUpRight size={12} weight="bold" aria-hidden />
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <p className={styles.disclosure}>{labels.disclosure}</p>
            </>
          ) : state.status === "failed" ? (
            <p className={styles.failed}>{copy.dataOnly}</p>
          ) : (
            <>
              <p className={styles.loading}>
                <Sparkle className={styles.loadingIcon} size={14} weight="fill" aria-hidden />
                {labels.loading}
              </p>
              <Skeleton className={cn(styles.line, "w-[94%]")} />
              <Skeleton className={cn(styles.line, "w-[82%]")} />
              <Skeleton className={cn(styles.line, "w-[64%]")} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
