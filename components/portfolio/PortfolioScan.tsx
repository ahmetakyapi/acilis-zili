"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarBlank,
  ChartLineUp,
  ChartPieSlice,
  Newspaper,
  Sparkle,
  SquaresFour,
  TrendUp,
  Warning,
} from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { VerdictPill } from "@/components/ui/VerdictPill";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { PortfolioScan } from "@/lib/portfolio-scan";
import type { PlanAction, ScanFlag, ScanRow, ScanThemeKind } from "@/lib/portfolio-scan-model";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import styles from "./PortfolioScan.module.css";

/**
 * GÜNLÜK PORTFÖY TARAMASI — arayüz (10 Kasım). Gerekçe ve doğruluk kuralları
 * lib/portfolio-scan.ts. İki görünüş, tek istek kalıbı:
 *  - `PortfolioScanPanel`: /portfoy'daki tam panel — başlık ve özet, tema
 *    karoları, pozisyon pozisyon notlar ve sunucunun çizdiği beş seanslık
 *    şerit; site sahibinde ek olarak Kişisel Plan.
 *  - `PortfolioScanBrief`: ana sayfa portföy kartının içindeki özet — başlık,
 *    özet, en çok üç tema, sahipte plan hapları; "Taramanın Tamamı".
 * Panel görünüme yaklaşınca istenir (eski portföy notunun kalıbı); tarama o
 * günün ilk açılışında yazılır, sonrası önbellekten gelir.
 *
 * Ölçüm (geçici önizleme, sahte tarama yanıtı, beş pozisyon + dört plan,
 * iki tema): tam panel 946'da 1.566, 358'de 2.425 piksel; ana sayfa kartı
 * özetle 946'da 948, 350'lik rayda 1.377. Yatay taşma, kutudan taşan öğe
 * ve kırpılan metin 0. Telefonda beş seanslık şerit kendi satırında (önce
 * ölçülerle aynı satırda ~60 piksele iniyordu).
 */

type Labels = Dictionary["portfolioScan"];
type State = { status: "idle" | "loading" | "done" | "failed"; scan?: PortfolioScan };

const THEME_ICONS: Record<ScanThemeKind, typeof Sparkle> = {
  concentration: ChartPieSlice,
  momentum: TrendUp,
  calendar: CalendarBlank,
  technical: ChartLineUp,
  news: Newspaper,
  sector: SquaresFour,
  risk: Warning,
};

/* Plan hapı VerdictPill'in renk dilinde: ekle = al, sat = sat; kâr al ve
   tut nötr (ikisi de pozisyonu taşımaya devam ediyor). */
const ACTION_VERDICT: Record<PlanAction, VerdictKey> = { add: "buy", hold: "hold", trim: "hold", sell: "sell" };

function useScan(locale: Locale) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/portfoy-taramasi?dil=${locale}`)
        .then((response) => response.json() as Promise<{ ok: boolean; scan?: PortfolioScan }>)
        .then((data) => setState(data.ok && data.scan ? { status: "done", scan: data.scan } : { status: "failed" }))
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
  return { ref, state };
}

const sessionDate = (session: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${session}T12:00:00Z`),
  );

const shortDay = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

function stanceWord(stance: VerdictKey, locale: Locale) {
  return locale === "en" ? { buy: "Buy", hold: "Hold", sell: "Sell" }[stance] : { buy: "Al", hold: "Tut", sell: "Sat" }[stance];
}

function FlagChips({ flags, labels, locale }: { flags: ScanFlag[]; labels: Labels; locale: Locale }) {
  if (flags.length === 0) return null;
  return (
    <ul className={styles.flags}>
      {flags.map((flag) => {
        const text =
          flag.kind === "earnings"
            ? labels.flags.earnings.replace("{day}", shortDay(flag.date, locale))
            : flag.kind === "technical"
              ? labels.flags.technical.replace("{stance}", stanceWord(flag.stance, locale))
              : flag.kind === "news"
                ? labels.flags.news.replace("{n}", String(flag.count))
                : flag.kind === "nearHigh"
                  ? labels.flags.nearHigh
                  : labels.flags.nearLow;
        return (
          <li key={flag.kind} className={styles.flag} data-kind={flag.kind} data-stance={flag.kind === "technical" ? flag.stance : undefined}>
            {text}
          </li>
        );
      })}
    </ul>
  );
}

/** Sıfırdan iki yana açılan beş seanslık şerit; ölçek panelin en büyük mutlak değeri. */
function FiveBar({ row, scale, locale, labels }: { row: ScanRow; scale: number; locale: Locale; labels: Labels }) {
  const value = row.fiveSession;
  const dir = value === null ? "flat" : directionOf(value);
  const width = value === null ? 0 : Math.min(50, (Math.abs(value) / scale) * 50);
  return (
    <span
      className={styles.five}
      role="img"
      aria-label={labels.fiveAria.replace("{symbol}", row.symbol).replace("{pct}", formatPercent(value, locale, 1))}
    >
      <span className={cn("value-lane", styles.fiveLane)} data-draw>
        <i
          className="value-bar bar-fill"
          data-end="end"
          data-tone={dir === "up" ? "up" : dir === "down" ? "down" : undefined}
          style={(dir === "down" ? { right: "50%", width: `${width}%`, transformOrigin: "right" } : { left: "50%", width: `${width}%` }) as CSSProperties}
        />
        <span className={styles.fiveZero} aria-hidden />
      </span>
      <b className={cn("numeral", styles.fiveValue, value === null ? "text-muted" : directionText(dir))} aria-hidden>
        {formatPercent(value, locale, 1)}
      </b>
    </span>
  );
}

function Pct({ value, locale, digits = 1 }: { value: number | null; locale: Locale; digits?: number }) {
  return <b className={cn("numeral", value === null ? "text-muted" : directionText(directionOf(value)))}>{formatPercent(value, locale, digits)}</b>;
}

function ScanSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.skeleton} aria-hidden>
      <Skeleton className="h-5 w-3/4" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PortfolioScanPanel({ locale, labels }: { locale: Locale; labels: Labels }) {
  const { ref, state } = useScan(locale);
  const scan = state.scan;
  const text = scan?.text ?? null;
  const scale = scan ? Math.max(5, ...scan.rows.map((r) => Math.abs(r.fiveSession ?? 0))) : 5;
  const plans = new Map((scan?.plans ?? []).map((p) => [p.symbol, p]));

  return (
    <Panel ref={ref as never} id="tarama" className={styles.panel} aria-busy={state.status === "loading" || state.status === "idle"}>
      <PanelHeader
        title={labels.title}
        meta={scan ? labels.session.replace("{date}", sessionDate(scan.session, locale)) : undefined}
        action={<Sparkle className={styles.spark} size={18} weight="duotone" aria-hidden />}
      />

      {!scan && state.status !== "failed" && (
        <>
          <p className={styles.loading}>{labels.loading}</p>
          <ScanSkeleton lines={4} />
        </>
      )}
      {state.status === "failed" && <p className={styles.loading}>{labels.unavailable}</p>}

      {scan && (
        <>
          <div className={styles.lead}>
            {text ? (
              <>
                <h3 className={styles.headline}>{text.headline}</h3>
                <p className={styles.summary}>{text.summary}</p>
              </>
            ) : (
              <p className={styles.loading}>{labels.unavailable}</p>
            )}
            <dl className={styles.pulse}>
              <div>
                <dt>{labels.portfolioDay}</dt>
                <dd><ChangePill changePct={scan.portfolio.day} locale={locale} /></dd>
              </div>
              <div>
                <dt>{labels.portfolioFive}</dt>
                <dd><ChangePill changePct={scan.portfolio.fiveSession} locale={locale} /></dd>
              </div>
            </dl>
          </div>

          {text && text.themes.length > 0 && (
            <section aria-label={labels.themesTitle}>
              <ul className={styles.themes}>
                {text.themes.map((theme, i) => {
                  const Icon = THEME_ICONS[theme.kind];
                  return (
                    <li key={i} className={styles.theme} data-kind={theme.kind}>
                      <span className={styles.themeKind}>
                        <Icon size={15} weight="duotone" aria-hidden />
                        {labels.themeKinds[theme.kind]}
                      </span>
                      <h4 className={styles.themeTitle}>{theme.title}</h4>
                      <p className={styles.themeDetail}>{theme.detail}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-label={labels.positionsTitle}>
            <div className={styles.planHead}>
              <h3 className={styles.sectionTitle}>{labels.positionsTitle}</h3>
              {scan.plans && scan.plans.length > 0 && (
                <span className={styles.planBadge}>
                  {labels.plan.title} · {labels.plan.badge}
                </span>
              )}
            </div>
            <div className={styles.colHead} aria-hidden>
              <span />
              <span>{labels.cols.five}</span>
              <span>{labels.cols.day}</span>
              <span>{labels.cols.month}</span>
              <span>{labels.cols.cost}</span>
            </div>
            <ul className={styles.positions}>
              {scan.rows.map((row) => {
                const note = text?.notes[row.symbol];
                const plan = plans.get(row.symbol);
                return (
                  <li key={row.symbol} className={styles.position}>
                    <div className={styles.positionTop}>
                      <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.identity}>
                        <span className={cn("numeral", styles.symbol)}>{row.symbol}</span>
                        <span className={styles.name}>{row.name}</span>
                      </Link>
                      <FiveBar row={row} scale={scale} locale={locale} labels={labels} />
                      <span className={cn(styles.metric, styles.metricDay)}><span className={styles.metricLabel}>{labels.cols.day}</span><Pct value={row.day} locale={locale} digits={2} /></span>
                      <span className={cn(styles.metric, styles.metricMonth)}><span className={styles.metricLabel}>{labels.cols.month}</span><Pct value={row.month} locale={locale} /></span>
                      <span className={cn(styles.metric, styles.metricCost)}><span className={styles.metricLabel}>{labels.cols.cost}</span><Pct value={row.sinceCost} locale={locale} /></span>
                    </div>
                    <FlagChips flags={row.flags} labels={labels} locale={locale} />
                    {note && <p className={styles.note}>{note}</p>}
                    {plan && (
                      <div className={styles.plan}>
                        <div className={styles.planRow}>
                          <VerdictPill verdict={ACTION_VERDICT[plan.action]} label={labels.plan.actions[plan.action]} />
                          {plan.takeProfit && (
                            <span className={styles.level} data-kind="tp">
                              {labels.plan.takeProfit} <b className="numeral">{plan.takeProfit.label}</b>
                            </span>
                          )}
                          {plan.stopLoss && (
                            <span className={styles.level} data-kind="sl">
                              {labels.plan.stopLoss} <b className="numeral">{plan.stopLoss.label}</b>
                            </span>
                          )}
                        </div>
                        <p className={styles.planText}>{plan.rationale}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <div className={styles.foot}>
            {scan.covered < scan.total && (
              <p>{labels.partial.replace("{covered}", String(scan.covered)).replace("{total}", String(scan.total))}</p>
            )}
            <p>{labels.disclosure}</p>
            {scan.plans && scan.plans.length > 0 && <p>{labels.plan.disclosure}</p>}
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

export function PortfolioScanBrief({ locale, labels }: { locale: Locale; labels: Labels }) {
  const { ref, state } = useScan(locale);
  const scan = state.scan;
  const text = scan?.text ?? null;
  if (state.status === "failed" || (scan && !text)) return <div ref={ref} hidden />;
  const plans = (scan?.plans ?? []).slice(0, 4);

  let body: ReactNode;
  if (!scan || !text) {
    body = <ScanSkeleton lines={3} />;
  } else {
    body = (
      <>
        <p className={styles.briefHeadline}>{text.headline}</p>
        <p className={styles.briefSummary}>{text.summary}</p>
        {text.themes.length > 0 && (
          <ul className={styles.briefThemes}>
            {text.themes.slice(0, 3).map((theme, i) => {
              const Icon = THEME_ICONS[theme.kind];
              return (
                <li key={i}>
                  <Icon size={14} weight="duotone" aria-hidden />
                  <span className={styles.briefThemeKind}>{labels.themeKinds[theme.kind]}</span>
                  <span className={styles.briefThemeTitle}>{theme.title}</span>
                </li>
              );
            })}
          </ul>
        )}
        {plans.length > 0 && (
          <div className={styles.briefPlans}>
            <span className={styles.briefPlansHead}>
              {labels.plan.title}
              <span className={styles.planBadge}>{labels.plan.badge}</span>
            </span>
            <ul>
              {plans.map((plan) => (
                <li key={plan.symbol}>
                  <span className={cn("numeral", styles.briefPlanSymbol)}>{plan.symbol}</span>
                  <VerdictPill verdict={ACTION_VERDICT[plan.action]} label={labels.plan.actions[plan.action]} />
                  <span className={styles.briefLevels}>
                    {plan.takeProfit && (
                      <span data-kind="tp">
                        {labels.plan.takeProfit} <b className="numeral">{plan.takeProfit.label}</b>
                      </span>
                    )}
                    {plan.stopLoss && (
                      <span data-kind="sl">
                        {labels.plan.stopLoss} <b className="numeral">{plan.stopLoss.label}</b>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={ref} className={styles.brief} aria-busy={!scan}>
      <div className={styles.briefHead}>
        <span className={styles.briefTitle}>
          <Sparkle size={16} weight="duotone" aria-hidden className={styles.spark} />
          {labels.homeTitle}
        </span>
        {scan && <span className={styles.briefMeta}>{labels.session.replace("{date}", sessionDate(scan.session, locale))}</span>}
      </div>
      {body}
      <Link href="/portfoy#tarama" prefetch={false} className={styles.briefLink}>
        {labels.openFull}
        <ArrowRight size={13} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}
