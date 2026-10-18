"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import { ChangePill, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { EarningsFigure, EarningsInsight, InsightText, MoveInsight, PreviewInsight } from "@/lib/stock-insights";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import { MoveFilm } from "./MoveFilm";
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
type Insight = MoveInsight | EarningsInsight | PreviewInsight;

const dateFmt = (locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });

function rangeLabel(from: string, to: string, locale: Locale) {
  return dateFmt(locale).formatRange(new Date(`${from}T12:00:00Z`), new Date(`${to}T12:00:00Z`));
}

const weekday = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : "flat");

/**
 * Hareket figürü (17 Ekim, ikinci sürüm — sahibinin isteği "görsel zirve").
 * İlk sürüm gün gün kalın bloklar ve ayrı bir kıyas çizgisiydi; bloklar
 * sıfır çizgisinden kopuk "tablo programı" gibi duruyordu (CLAUDE.md →
 * grafik dili ince). Şimdi üç katman, hepsi GERÇEK sayı:
 *
 * 1. Künye: beş seansın değişimi büyük puntoyla, altında S&P 500 ve
 *    farkı ("Piyasanın 12,62 Puan Altında") — fark ekranda hesaplanır,
 *    Claude'a verilmez (yazma katmanı değil, gösterim).
 * 2. Seyir: hisse ve S&P 500'ün beş seanslık BİRİKİMLİ yolu, ortak ölçek,
 *    sıfır çizgisi kesik. Çizgiler soldan sağa açılarak gelir, altındaki
 *    alan düz ton (degrade yok — veri paneli). Uç noktalarda değer.
 * 3. Gün şeridi: her seansın kendi değişimi sıfır çizgisinden ince şerit;
 *    hacmi 20 seans ortalamasının 1,5 katını aşan gün işaretli. En sert gün
 *    kalın yazılır.
 *
 * Konumlar yüzde: SVG `preserveAspectRatio="none"` ile genişliğe yayılır,
 * çizgi kalınlığı `vector-effect` ile sabit; noktalar ve etiketler HTML
 * (SVG'de esnerlerdi). Renk yalnız işaretten; S&P çizgisi nötr mürekkep.
 */
const X0 = 3;
const X1 = 97;
const xAt = (i: number, n: number) => X0 + (i / Math.max(1, n - 1)) * (X1 - X0);

function cumulative(steps: { changePct: number }[]): number[] {
  const out = [0];
  let level = 1;
  for (const step of steps) {
    level *= 1 + step.changePct / 100;
    out.push((level - 1) * 100);
  }
  return out;
}

function MoveFigure({ insight, locale, labels }: { insight: MoveInsight; locale: Locale; labels: Labels }) {
  const stock = cumulative(insight.sessions);
  const market = insight.marketSessions?.length === insight.sessions.length ? cumulative(insight.marketSessions) : null;
  const all = [...stock, ...(market ?? []), 0];
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  const pad = Math.max((hi - lo) * 0.12, 0.2);
  const top = hi + pad;
  const bottom = lo - pad;
  const yAt = (v: number) => ((top - v) / (top - bottom)) * 100;
  const n = stock.length;
  const path = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${xAt(i, n).toFixed(2)} ${yAt(v).toFixed(2)}`).join(" ");
  const zeroY = yAt(0);
  const area = `${path(stock)} L${xAt(n - 1, n).toFixed(2)} ${zeroY.toFixed(2)} L${xAt(0, n).toFixed(2)} ${zeroY.toFixed(2)} Z`;
  const stockTone = tone(insight.changePct);
  const maxStep = Math.max(...insight.sessions.map((s) => Math.abs(s.changePct)), 0.01);
  const biggest = insight.sessions.reduce((best, s, i) => (Math.abs(s.changePct) > Math.abs(insight.sessions[best]!.changePct) ? i : best), 0);
  const gap = insight.marketPct !== null ? insight.changePct - insight.marketPct : null;
  const gapText =
    gap === null
      ? null
      : Math.abs(gap) < 0.05
        ? labels.inlineMarket
        : (gap > 0 ? labels.aboveMarket : labels.belowMarket).replace(
            "{pts}",
            new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(gap)),
          );

  return (
    <div className={styles.move}>
      <div className={styles.moveHead}>
        <div>
          <p className={styles.caption}>{labels.compare}</p>
          <p className={styles.heroValue} data-tone={stockTone}>
            {formatPercent(insight.changePct, locale, 2)}
          </p>
          {insight.marketPct !== null && (
            <p className={styles.heroSub}>
              <span>
                S&amp;P 500 <b data-tone={tone(insight.marketPct)}>{formatPercent(insight.marketPct, locale, 2)}</b>
              </span>
              {gapText && <span className={styles.gap} data-tone={gap === null ? "flat" : tone(gap)}>{gapText}</span>}
            </p>
          )}
        </div>
        <ul className={styles.legend} aria-hidden>
          <li data-series="stock" data-tone={stockTone}>{insight.symbol}</li>
          {market && <li data-series="market">S&amp;P 500</li>}
        </ul>
      </div>

      <figure className={styles.path} aria-label={labels.pathTitle}>
        <svg className={styles.pathSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <line x1="0" x2="100" y1={zeroY} y2={zeroY} className={styles.zero} vectorEffect="non-scaling-stroke" />
          <path d={area} className={styles.area} data-tone={stockTone} />
          {market && <path d={path(market)} className={styles.marketLine} vectorEffect="non-scaling-stroke" />}
          <path d={path(stock)} className={styles.stockLine} data-tone={stockTone} vectorEffect="non-scaling-stroke" />
        </svg>
        {stock.map((v, i) =>
          i === 0 ? null : (
            <span
              key={i}
              className={styles.dot}
              data-tone={stockTone}
              data-last={i === n - 1 || undefined}
              style={{ left: `${xAt(i, n)}%`, top: `${yAt(v)}%`, "--i": i } as CSSProperties}
            />
          ),
        )}
        {market && (
          <span className={styles.marketDot} style={{ left: `${xAt(n - 1, n)}%`, top: `${yAt(market[n - 1]!)}%` }} />
        )}
      </figure>

      <div className={styles.days} aria-label={labels.daily}>
        {insight.sessions.map((session, i) => {
          const h = Math.max(6, (Math.abs(session.changePct) / maxStep) * 100);
          const loud = (session.volumeRatio ?? 0) >= 1.5;
          return (
            <div key={session.date} className={styles.day} style={{ left: `${xAt(i + 1, n)}%`, "--i": i } as CSSProperties}>
              <span className={styles.dayValue} data-tone={tone(session.changePct)} data-biggest={i === biggest || undefined}>
                {formatPercent(session.changePct, locale, 1)}
              </span>
              <span className={styles.dayLane}>
                <i
                  className={styles.dayBar}
                  data-tone={tone(session.changePct)}
                  data-side={session.changePct >= 0 ? "up" : "down"}
                  style={{ height: `${h / 2}%` }}
                />
              </span>
              <span className={styles.dayLabel}>{weekday(session.date, locale)}</span>
              {loud && (
                <span className={styles.volume} title={labels.highVolume}>
                  {labels.volumeTimes.replace("{x}", new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { maximumFractionDigits: 1 }).format(session.volumeRatio!))}
                </span>
              )}
            </div>
          );
        })}
      </div>
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

/**
 * Önizleme figürü (18 Ekim): solda bu çeyreğin beklentileri, sağda son dört
 * çeyreğin HBK sürprizi — sıfır çizgisinden yukarı (aştı) ya da aşağı
 * (kaçırdı) ince şerit, ortak ölçek; renk yalnız işaretten. Altta son yirmi
 * seansın değişimi. Hepsi gerçek sayı; tahmin yok.
 */
function PreviewFigure({ insight, locale, labels }: { insight: PreviewInsight; locale: Locale; labels: Labels }) {
  const maxRatio = Math.max(...insight.quarters.map((q) => Math.abs(q.ratio ?? 0)), 0.0001);
  const revenue = (v: number) => (locale === "tr" ? `${(v / 1e9).toFixed(2).replace(".", ",")} Mr $` : `$${(v / 1e9).toFixed(2)}B`);
  return (
    <div className={styles.figure} data-kind="preview">
      <div className={styles.previewEstimates}>
        <p className={styles.caption}>{labels.consensus}</p>
        <div className={styles.previewTiles}>
          {insight.epsEstimate !== null && (
            <div className={styles.previewTile} style={{ "--i": 0 } as CSSProperties}>
              <span className={styles.metricRowLabel}>{labels.eps}</span>
              <span className={styles.previewValue}>{formatPrice(insight.epsEstimate, locale, { currency: true })}</span>
            </div>
          )}
          {insight.revenueEstimate !== null && (
            <div className={styles.previewTile} style={{ "--i": 1 } as CSSProperties}>
              <span className={styles.metricRowLabel}>{labels.revenue}</span>
              <span className={styles.previewValue}>{revenue(insight.revenueEstimate)}</span>
            </div>
          )}
          {insight.monthPct !== null && (
            <div className={styles.previewTile} style={{ "--i": 2 } as CSSProperties}>
              <span className={styles.metricRowLabel}>{labels.month}</span>
              <span className={styles.previewValue} data-tone={tone(insight.monthPct)}>{formatPercent(insight.monthPct, locale, 1)}</span>
            </div>
          )}
        </div>
      </div>
      {insight.quarters.length > 0 && (
        <figure className={styles.previewQuarters} aria-label={labels.track}>
          <figcaption className={styles.caption}>{labels.track}</figcaption>
          <div className={styles.quarterRow}>
            {insight.quarters.map((q, i) => {
              const h = q.ratio === null ? 6 : Math.max(6, (Math.abs(q.ratio) / maxRatio) * 100);
              const side = q.direction === "miss" ? "down" : "up";
              return (
                <div key={q.period} className={styles.quarter} style={{ "--i": i } as CSSProperties}>
                  <span className={styles.dayValue} data-tone={q.direction === "beat" ? "up" : q.direction === "miss" ? "down" : "flat"}>
                    {q.ratio === null ? labels.verdict[q.direction] : formatPercent(q.ratio * 100, locale, 1)}
                  </span>
                  <span className={styles.quarterLane}>
                    <i className={styles.dayBar} data-tone={q.direction === "beat" ? "up" : q.direction === "miss" ? "down" : "flat"} data-side={side} style={{ height: `${h / 2}%` }} />
                  </span>
                  <span className={styles.dayLabel}>{q.quarter && q.year ? (locale === "tr" ? `${q.quarter}Ç ${String(q.year).slice(2)}` : `Q${q.quarter} ’${String(q.year).slice(2)}`) : q.period}</span>
                </div>
              );
            })}
          </div>
        </figure>
      )}
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
  kind: "move" | "earnings" | "preview";
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
      fetch(`/api/ai/hisse-notu?sembol=${encodeURIComponent(symbol)}&tur=${kind === "move" ? "hareket" : kind === "earnings" ? "bilanco" : "onizleme"}`)
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

  const title = kind === "move" ? labels.moveTitle : kind === "earnings" ? labels.earningsTitle : labels.previewTitle;
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
            </>
          ) : insight.kind === "preview" ? (
            <>
              <span className={styles.stripLabel}>
                {labels.upcoming.replace("{date}", dateFmt(locale).format(new Date(`${insight.reportDate}T12:00:00Z`)))}
              </span>
              <span className={styles.stripMuted}>{labels.timing[insight.timing]}</span>
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
      {state.status === "done" && insight?.kind === "preview" ? <PreviewFigure insight={insight} locale={locale} labels={labels} /> : null}

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
          {kind === "move" ? (
            <>
              <MoveFilm scenes={labels.film.scenes} sceneLabel={labels.film.scene} />
              {/* Filmin altında notun iskeleti: kutu notun ölçülmüş boyunda
                  kalıyor (telefonda 720), film tek başına ~330 tutuyordu. */}
              <div className={styles.filmLines} aria-hidden>
                <Skeleton className={cn(styles.line, "w-[92%]")} />
                <Skeleton className={cn(styles.line, "w-[78%]")} />
                <Skeleton className={cn(styles.line, "w-[85%]")} />
              </div>
            </>
          ) : (
          <>
          <p className={styles.loadingText}>
            <Sparkle className={styles.loadingIcon} size={15} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={cn(styles.line, "w-[92%]")} />
          <Skeleton className={cn(styles.line, "w-[78%]")} />
          <Skeleton className={cn(styles.line, "w-[85%]")} />
          <Skeleton className={cn(styles.line, "w-[60%]")} />
          </>
          )}
        </div>
      )}
    </Panel>
  );
}
