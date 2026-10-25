import Link from "next/link";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import type { Dictionary } from "@/lib/i18n";
import type { Gauge, IndexRow, MarketDesk } from "@/lib/risk/data";
import type { Exposure, PositionRow } from "@/lib/risk/exposure";
import { day, fill, num, pct, rounded, signedNum, signedPct, type Loc } from "@/lib/risk/format";
import { COMPONENT_KEYS, REGIMES, type Component, type Regime } from "@/lib/risk/regime";
import { BREADTH_ABOVE_200, MA_WINDOWS, TERM_RATIO, VIX_LEVEL } from "@/lib/risk/thresholds";
import { sectorLabel } from "@/lib/sectors";
import styles from "./RiskDesk.module.css";

/**
 * Risk Masası panelleri — sunucuda çizilir, istemci JS'i yok (kural kurucu
 * ve yorum düğmesi hariç, onlar kendi dosyalarında). Her panelin h2'si
 * `PanelHeader`; renk anlamı RiskDesk.module.css başındaki notta.
 */

type T = Dictionary["riskDesk"];
type Common = { t: T; locale: Loc };

const PERCENT = 100;

/* ------------------------------------------------------------------ rejim */

function componentValue(c: Component, locale: Loc): string {
  switch (c.key) {
    case "vixLevel":
      return num(c.value, locale, 2);
    case "vixChange":
    case "trend":
      return signedPct(c.value, locale);
    case "term":
      return num(c.value, locale, 2);
    case "vxnRatio":
      return num(c.value, locale, 0);
    case "breadth":
      return pct(c.value, locale);
    case "credit":
      return signedNum(c.value, locale);
  }
}

/**
 * Rejim — KOMPAKT KART (25 Ekim, kart düzeni). Yedi girdi tek satırlık
 * çipler (ad, değer, ton noktası); her girdinin eşiği ve rejimin kuralı
 * "Nasıl Hesaplanır" katlamasında. Önceki uzun listede her girdi iki satır
 * açıklama taşıyordu ve kart 1440'ta 540 piksel uzuyordu.
 */
export function RegimePanel({ desk, t, locale }: Common & { desk: MarketDesk }) {
  const today = desk.today;
  const regime = today?.regime ?? null;
  const missing = today ? COMPONENT_KEYS.filter((key) => !today.components.some((c) => c.key === key)) : [];
  return (
    <Panel data-regime={regime ?? undefined} aria-labelledby="risk-regime">
      <PanelHeader title={t.regime.title} meta={today ? fill(t.regime.score, { points: today.points, max: today.max }) : undefined} />
      <div className={styles.panelBody}>
        <div className={styles.regimeHead}>
          <p id="risk-regime" className={styles.regimeWord}>
            {regime ? t.regime[regime] : t.regime.none}
          </p>
          {desk.streak && (
            <p className={styles.regimeMeta}>
              <strong>{fill(t.regime.streak, { n: desk.streak.sessions })}</strong> · {fill(t.regime.since, { date: day(desk.streak.since, locale) })}
            </p>
          )}
        </div>
        {today && regime ? (
          <>
            <div className={styles.scale} role="img" aria-label={`${t.regime[regime]} · ${pct(today.share * PERCENT, locale, 0)}`}>
              <div className={styles.scaleLane}>
                {REGIMES.map((r) => (
                  <span key={r} data-regime={r} data-on={r === regime ? "" : undefined} />
                ))}
              </div>
              <span className={styles.scaleMark} style={{ left: `${Math.min(1, today.share) * PERCENT}%` }} />
            </div>
            <div className={styles.scaleTicks} aria-hidden>
              {REGIMES.map((r) => (
                <span key={r}>{t.regime[r]}</span>
              ))}
            </div>
            <ul className={styles.chips}>
              {today.components.map((c) => (
                <li key={c.key} className={styles.chipItem} data-tone={c.points} title={`${t.regime.points[c.points]} · ${t.regime.rules[c.key]}`}>
                  <span className={styles.chipName}>{t.regime.components[c.key]}</span>
                  <b>{componentValue(c, locale)}</b>
                  <span className="sr-only">{t.regime.points[c.points]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.explain}>{t.regime.noneHint}</p>
        )}
        {missing.length > 0 && (
          <p className={styles.foldText}>{fill(t.regime.missing, { list: missing.map((key) => t.regime.components[key]).join(", ") })}</p>
        )}
        <details className={styles.fold}>
          <summary>{t.cards.howTo}</summary>
          <dl className={styles.foldList}>
            {COMPONENT_KEYS.map((key) => (
              <div key={key}>
                <dt>{t.regime.components[key]}</dt>
                <dd>{t.regime.rules[key]}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.foldText}>{t.regime.explain}</p>
        </details>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- göstergeler */

/** Kıvılcım: yumuşak mavi çizgi, eşikler saç teli. Ölçek eşikleri de kapsar. */
function Spark({ values, rules, label }: { values: number[]; rules: readonly number[]; label: string }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 34;
  const all = [...values, ...rules];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {rules.map((r) => (
        <line key={r} className={styles.sparkRule} x1={0} x2={W} y1={y(r)} y2={y(r)} vectorEffect="non-scaling-stroke" />
      ))}
      <path className={styles.sparkLine} d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const GAUGE_RULES: Record<Gauge["key"], readonly number[]> = {
  vix: [VIX_LEVEL.tense, VIX_LEVEL.stress],
  vxn: [],
  term: [TERM_RATIO.tense, TERM_RATIO.stress],
  credit: [],
  breadth: [BREADTH_ABOVE_200.stress, BREADTH_ABOVE_200.tense],
  spy200: [0],
};

function gaugeValue(g: Gauge, locale: Loc): string {
  if (g.value === null) return "";
  if (g.key === "breadth") return pct(g.value, locale);
  if (g.key === "spy200") return signedPct(g.value, locale);
  return num(g.value, locale, 2);
}

/**
 * Ana göstergeler — ALTI KÜÇÜK KART (25 Ekim, kart düzeni): ad ve gözlem
 * günü, büyük sayı, değişim, kıvılcım. Uzun tanımlar ("S&P 500, 30 Günlük
 * Beklenen Oynaklık") "Göstergeler Nasıl Okunur" katlamasında; kartta
 * yalnız okunacak sayı kalıyor.
 */
export function GaugePanel({ desk, t, locale }: Common & { desk: MarketDesk }) {
  const sub: Record<Gauge["key"], string> = {
    vix: t.gauges.vixSub,
    vxn: t.gauges.vxnSub,
    term: t.gauges.termSub,
    credit: t.gauges.creditSub,
    breadth: t.gauges.breadthSub,
    spy200: t.gauges.spy200Sub,
  };
  return (
    <Panel>
      <PanelHeader title={t.gauges.title} meta={day(desk.session, locale)} />
      <div className={styles.panelBody}>
        <div className={styles.gauges}>
          {desk.gauges.map((g) => {
            const rules = GAUGE_RULES[g.key];
            const delta =
              g.value === null
                ? null
                : g.key === "breadth" && desk.breadth
                  ? fill(t.gauges.advDec, { a: desk.breadth.advancing, d: desk.breadth.declining })
                  : g.key === "credit" && g.change !== null
                    ? fill(t.gauges.creditChange, { v: signedNum(g.change, locale) })
                    : g.change !== null
                      ? fill(t.gauges.dayChange, { v: signedNum(g.change, locale) })
                      : null;
            return (
              <div key={g.key} className={styles.gauge} title={sub[g.key]}>
                <span className={styles.gaugeLabel}>
                  {t.gauges[g.key]}
                  {g.date && <span className={styles.gaugeDate}>{day(g.date, locale)}</span>}
                </span>
                {g.value === null ? (
                  <span className={styles.gaugeValue} data-off>
                    {g.date ? t.gauges.stale : t.gauges.unavailable}
                  </span>
                ) : (
                  <span className={styles.gaugeValue}>{gaugeValue(g, locale)}</span>
                )}
                {delta && <span className={styles.gaugeDelta}>{delta}</span>}
                {g.value !== null && (
                  <Spark
                    values={g.spark}
                    rules={rules}
                    label={`${t.gauges[g.key]}${rules.length ? ` · ${fill(t.gauges.laneLabel, { list: rules.map((r) => num(r, locale, r % 1 ? 2 : 0)).join(", ") })}` : ""}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <details className={styles.fold}>
          <summary>{t.cards.gaugesHow}</summary>
          <dl className={styles.foldList}>
            {desk.gauges.map((g) => (
              <div key={g.key}>
                <dt>{t.gauges[g.key]}</dt>
                <dd>{sub[g.key]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- maruziyet */

/** Portföy okunamıyor ya da boşken özet kartlarının yerinde duran panel. */
export function ExposurePanel({ result, t }: Common & { result: { ok: false } | { ok: true; exposure: Exposure | null } }) {
  return (
    <Panel>
      <PanelHeader
        title={t.exposure.title}
        action={
          <Link href="/portfoy" className={`${styles.inlineLink} tap-44`}>
            {t.exposure.link}
          </Link>
        }
      />
      <div className={styles.panelBody}>
        <p className={styles.explain}>{!result.ok ? t.exposure.unavailable : t.exposure.empty}</p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ geçmiş */

type Run = { regime: Regime | null; from: number; to: number };

function runsOf(history: MarketDesk["history"]): Run[] {
  const runs: Run[] = [];
  history.forEach((point, i) => {
    const last = runs[runs.length - 1];
    if (last && last.regime === point.regime) last.to = i;
    else runs.push({ regime: point.regime, from: i, to: i });
  });
  return runs;
}

export function HistoryPanel({ desk, t, locale }: Common & { desk: MarketDesk }) {
  const history = desk.history;
  if (history.length === 0) return null;
  const n = history.length;
  const runs = runsOf(history);
  const years: { label: string; x: number }[] = [];
  history.forEach((point, i) => {
    const year = point.date.slice(0, 4);
    if (i === 0 || history[i - 1]!.date.slice(0, 4) !== year) years.push({ label: year, x: (i / n) * PERCENT });
  });
  /* İlk yıl etiketi bir sonrakine çok yakınsa (yılın son haftaları) düşer. */
  const yearMarks = years.filter((y, i) => i === 0 ? (years[1] ? years[1].x - y.x > 6 : true) : true);
  const counts = new Map<Regime, number>();
  for (const p of history) if (p.regime) counts.set(p.regime, (counts.get(p.regime) ?? 0) + 1);
  const scored = [...counts.values()].reduce((s, v) => s + v, 0);
  const lo = Math.min(0, ...desk.forward.map((f) => f.p10));
  const hi = Math.max(0, ...desk.forward.map((f) => f.p90));
  const pad = (hi - lo) * 0.06 || 1;
  const x = (v: number) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * PERCENT;
  return (
    <Panel>
      <PanelHeader title={t.history.title} meta={fill(t.history.range, { from: day(history[0]!.date, locale), to: day(history[n - 1]!.date, locale), n })} />
      <div className={styles.panelBody}>
        <div className={styles.history}>
          <svg className={styles.band} viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" role="img" aria-label={t.history.title}>
            {runs.map((run) =>
              run.regime ? (
                <rect key={run.from} data-regime={run.regime} x={run.from} y={0} width={run.to - run.from + 1} height={1}>
                  <title>{`${t.regime[run.regime]} · ${fill(t.cards.span, { from: day(history[run.from]!.date, locale), to: day(history[run.to]!.date, locale) })}`}</title>
                </rect>
              ) : null,
            )}
          </svg>
          <div className={styles.years} aria-hidden>
            {yearMarks.map((y) => (
              <span key={y.label} style={{ left: `${y.x}%` }}>
                {y.label}
              </span>
            ))}
          </div>
          <p className={styles.legend}>
            {REGIMES.map((r) => (
              <span key={r} data-regime={r}>
                {t.regime[r]} <b>{pct(scored ? ((counts.get(r) ?? 0) / scored) * PERCENT : 0, locale, 0)}</b>
              </span>
            ))}
          </p>
        </div>

        {desk.forward.length > 0 && (
          <div className={styles.dist}>
            <h3 className={styles.distHead}>{t.history.distTitle}</h3>
            {desk.forward.map((f) => (
              <div key={f.regime} className={styles.distRow} data-regime={f.regime}>
                <span className={styles.distName}>{t.regime[f.regime]}</span>
                <div className={styles.range} role="img" aria-label={`${t.history.axisLabel}: ${signedPct(f.p10, locale)}, ${signedPct(f.median, locale)}, ${signedPct(f.p90, locale)}`}>
                  <span className={styles.rangeLane} />
                  <span className={styles.rangeZero} style={{ left: `${x(0)}%` }} />
                  <span className={styles.rangeSpan} style={{ left: `${x(f.p10)}%`, width: `${x(f.p90) - x(f.p10)}%` }} />
                  <span className={styles.rangeMedian} style={{ left: `${x(f.median)}%` }} />
                </div>
                <p className={styles.distFigures}>
                  <span>
                    {t.history.distMedian} <b>{signedPct(f.median, locale)}</b>
                  </span>
                  <span>
                    {t.history.distMean} <b>{signedPct(f.mean, locale)}</b>
                  </span>
                  <span>
                    {t.history.distRange} <b>{signedPct(f.p10, locale)} / {signedPct(f.p90, locale)}</b>
                  </span>
                  <span>
                    {t.history.distNegative} <b>{pct(f.negativeShare, locale, 0)}</b>
                  </span>
                  <span>
                    {t.history.distDrawdown} <b>{pct(f.drawdownShare, locale, 0)}</b>
                  </span>
                  <span>
                    {t.history.distDays} <b>{f.days}</b>
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
        {desk.breadthSince && <p className={styles.foot}>{fill(t.history.breadthNote, { since: day(desk.breadthSince, locale) })}</p>}
        <p className={styles.foot}>{t.history.distNote}</p>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------------- tablolar */

function Dir({ value, locale }: { value: number | null; locale: Loc }) {
  const shown = value === null ? null : rounded(value, 1);
  return (
    <span className={styles.dir} data-dir={shown === null ? undefined : shown > 0 ? "up" : shown < 0 ? "down" : undefined}>
      {signedPct(value, locale)}
    </span>
  );
}

function Pctile({ value, locale }: { value: number | null; locale: Loc }) {
  if (value === null) return <>{num(null, locale)}</>;
  return (
    <span className={styles.pctile}>
      <span className={styles.lane}>
        <span className={styles.laneFill} style={{ width: `${value}%` }} />
      </span>
      {num(value, locale, 0)}
    </span>
  );
}

/** 50 / 100 / 200 GO'nun üstünde mi altında mı — üç nokta, yön renginde. */
function MaMarks({ row, t }: { row: Pick<IndexRow, "below">; t: T }) {
  const label = MA_WINDOWS.map((w) => `${w}: ${row.below[w] === null ? "–" : row.below[w] ? t.indices.below : t.indices.above}`).join(", ");
  return (
    <span className={styles.marks} role="img" aria-label={label}>
      {MA_WINDOWS.map((w) => (row.below[w] === null ? null : <i key={w} data-above={row.below[w] ? undefined : ""} />))}
    </span>
  );
}

function crossFlags(row: Pick<IndexRow, "cross" | "crossedBelow">, t: T): string[] {
  const flags: string[] = [];
  if (row.cross === "golden") flags.push(t.indices.golden);
  if (row.cross === "death") flags.push(t.indices.death);
  for (const w of [100, 200] as const) if (row.crossedBelow[w]) flags.push(fill(t.indices.crossedBelow, { w }));
  return flags;
}

export function IndexPanel({ desk, t, locale }: Common & { desk: MarketDesk }) {
  if (desk.indices.length === 0) return null;
  const forecasts = desk.indices.filter((row) => row.forecast && (row.symbol === "SPY" || row.symbol === "QQQ"));
  const maxBand = Math.max(...forecasts.map((row) => Math.max(Math.abs(row.forecast!.bandLow), row.forecast!.bandHigh)), 1);
  const bx = (v: number) => ((v + maxBand * 1.1) / (maxBand * 2.2)) * PERCENT;
  return (
    <Panel>
      <PanelHeader title={t.indices.title} meta={day(desk.session, locale)} />
      <div className={styles.panelBody}>
        <ScrollEdges fixedStart className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.indices.symbol}</th>
                <th scope="col">{t.indices.close}</th>
                <th scope="col">{t.indices.atr}</th>
                <th scope="col">{t.indices.atrPct}</th>
                <th scope="col">{t.indices.vol10}</th>
                <th scope="col">{t.indices.vol20}</th>
                <th scope="col">{t.indices.pctile}</th>
                <th scope="col">{t.indices.ma50}</th>
                <th scope="col">{t.indices.ma100}</th>
                <th scope="col">{t.indices.ma200}</th>
                <th scope="col">{t.indices.drawdown}</th>
              </tr>
            </thead>
            <tbody>
              {desk.indices.map((row) => {
                const flags = crossFlags(row, t);
                return (
                  <tr key={row.symbol}>
                    <td>
                      {row.symbol}
                      <MaMarks row={row} t={t} />
                      {flags.map((f) => (
                        <span key={f} className={styles.flag}>
                          {f}
                        </span>
                      ))}
                    </td>
                    <td>{num(row.close, locale)}</td>
                    <td>{num(row.atr, locale)}</td>
                    <td>{pct(row.atrPct, locale, 2)}</td>
                    <td>{pct(row.vol10, locale)}</td>
                    <td>{pct(row.vol20, locale)}</td>
                    <td>
                      <Pctile value={row.vol20Pctile} locale={locale} />
                    </td>
                    {MA_WINDOWS.map((w) => (
                      <td key={w}>
                        <Dir value={row.ma[w].distance} locale={locale} />
                      </td>
                    ))}
                    <td>
                      <Dir value={row.drawdown} locale={locale} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollEdges>
        <p className={styles.foot}>{t.indices.note}</p>

        {forecasts.length > 0 && (
          <div className={styles.forecasts}>
            <div>
              <h3 className={styles.forecastHead}>{t.forecast.title}</h3>
              <p className={styles.ruleMeta}>{t.forecast.hint}</p>
            </div>
            <div className="flex flex-col gap-3">
              {forecasts.map((row) => {
                const f = row.forecast!;
                return (
                  <div key={row.symbol} className={styles.forecast}>
                    <b>{row.symbol}</b>
                    <p className={styles.forecastFigures}>
                      <span>
                        {t.forecast.annualized} <strong>{pct(f.annualized, locale)}</strong>
                      </span>
                      <span>
                        {t.forecast.band} <strong>{signedPct(f.bandLow, locale)} / {signedPct(f.bandHigh, locale)}</strong>
                      </span>
                    </p>
                    <div className={styles.forecastBand} role="img" aria-label={`${row.symbol} ${t.forecast.band}: ${signedPct(f.bandLow, locale)} / ${signedPct(f.bandHigh, locale)}`}>
                      <span className={styles.rangeLane} />
                      <span className={styles.rangeSpan} style={{ left: `${bx(f.bandLow)}%`, width: `${bx(f.bandHigh) - bx(f.bandLow)}%` }} />
                      <span className={styles.rangeZero} style={{ left: `${bx(0)}%` }} />
                    </div>
                    {f.coverage !== null && (
                      <p className={`${styles.ruleMeta} col-start-2`}>
                        {fill(t.forecast.coverage, { n: f.coverageSamples, v: pct(f.coverage, locale, 0) })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={`${styles.foot} md:col-span-2`}>{t.forecast.note}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

const VERDICT_TEXT = { tr: { buy: "AL", hold: "TUT", sell: "SAT" }, en: { buy: "BUY", hold: "HOLD", sell: "SELL" } } as const;

function Views({ row, t, locale }: { row: PositionRow; t: T; locale: Loc }) {
  if (!row.technical && !row.earnings) return <>{num(null, locale)}</>;
  return (
    <span className={styles.verdicts}>
      {row.technical && (
        <Link
          href={row.technical.href}
          className={styles.verdict}
          data-verdict={row.technical.verdict}
          title={`${t.positions.viewTitle} · ${day(row.technical.date, locale)}`}
        >
          {t.positions.technicalShort} {VERDICT_TEXT[locale][row.technical.verdict]}
          <span className="sr-only">
            {" "}· {t.positions.viewTitle} · {day(row.technical.date, locale)}
          </span>
        </Link>
      )}
      {row.earnings && (
        <Link
          href={row.earnings.href}
          className={styles.verdict}
          data-verdict={row.earnings.verdict}
          title={`${t.positions.earningsView} · ${row.earnings.period}`}
        >
          {t.positions.earningsShort} {VERDICT_TEXT[locale][row.earnings.verdict]}
          <span className="sr-only">
            {" "}· {t.positions.earningsView} · {row.earnings.period}
          </span>
        </Link>
      )}
    </span>
  );
}

/**
 * Pozisyon tablosu — kartların altında "Tablo Görünümü" katlamasında
 * (veri kaybolmadı: 50/100 GO uzaklığı, oynaklık ve sektör çubukları
 * kartta yok, burada var). Risk Kapalı sıralaması katlamanın dışında,
 * kartların hemen altında.
 */
export function PositionsDetail({ exposure, regime, t, locale }: Common & { exposure: Exposure; regime: Regime | null }) {
  const byBeta = [...exposure.positions].filter((p) => p.beta !== null).sort((a, b) => b.beta! - a.beta!).slice(0, 5);
  const byVol = [...exposure.positions].filter((p) => p.vol20 !== null).sort((a, b) => b.vol20! - a.vol20!).slice(0, 5);
  return (
    <>
      {regime === "riskOff" && (
        <div className={styles.rankLists}>
          <div className="md:col-span-2">
            <h3 className={styles.forecastHead}>{t.positions.rankTitle}</h3>
            <p className={styles.ruleMeta}>{t.positions.rankNote}</p>
          </div>
          <div>
            <p className={styles.ruleMeta}>{t.positions.rankBeta}</p>
            <ol className={styles.rankList}>
              {byBeta.map((p) => (
                <li key={p.symbol}>
                  <b>{p.symbol}</b>
                  <span>{num(p.beta, locale)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className={styles.ruleMeta}>{t.positions.rankVol}</p>
            <ol className={styles.rankList}>
              {byVol.map((p) => (
                <li key={p.symbol}>
                  <b>{p.symbol}</b>
                  <span>{pct(p.vol20, locale)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      <details className={styles.fold}>
        <summary>{t.cards.tableToggle}</summary>
        <ScrollEdges fixedStart className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.positions.position}</th>
                <th scope="col">{t.positions.weight}</th>
                <th scope="col">{t.positions.beta}</th>
                <th scope="col">{t.positions.atrPct}</th>
                <th scope="col">{t.positions.vol20}</th>
                <th scope="col">{t.positions.pctile}</th>
                <th scope="col">{t.indices.ma50}</th>
                <th scope="col">{t.indices.ma100}</th>
                <th scope="col">{t.indices.ma200}</th>
                <th scope="col">{t.positions.sector}</th>
                <th scope="col" title={t.positions.viewTitle}>
                  {t.positions.view}
                </th>
              </tr>
            </thead>
            <tbody>
              {exposure.positions.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    {row.symbol}
                    <MaMarks row={row} t={t} />
                    <span className={styles.cellSub}>{row.name}</span>
                  </td>
                  <td>{pct(row.weight, locale)}</td>
                  <td>{num(row.beta, locale)}</td>
                  <td>{pct(row.atrPct, locale, 2)}</td>
                  <td>{pct(row.vol20, locale)}</td>
                  <td>
                    <Pctile value={row.vol20Pctile} locale={locale} />
                  </td>
                  {MA_WINDOWS.map((w) => (
                    <td key={w}>
                      <Dir value={row.ma[w].distance} locale={locale} />
                    </td>
                  ))}
                  <td>{sectorLabel(row.sector, locale) ?? t.positions.unclassified}</td>
                  <td>
                    <Views row={row} t={t} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollEdges>
        <div className="mt-3">
          <h3 className={styles.forecastHead}>{t.positions.sectorsTitle}</h3>
          <div className="mt-2">
            {exposure.sectors.map((s) => (
              <div key={s.sector ?? "none"} className={styles.barRow}>
                <span>{sectorLabel(s.sector, locale) ?? t.positions.unclassified}</span>
                <span className={styles.lane}>
                  <span className={styles.laneFill} style={{ width: `${s.weight}%` }} />
                </span>
                <span className={styles.barValue}>{pct(s.weight, locale)}</span>
              </div>
            ))}
          </div>
        </div>
        <p className={styles.foldText}>{t.indices.note}</p>
      </details>
      {exposure.missing.length > 0 && <p className={styles.foot}>{fill(t.positions.missing, { list: exposure.missing.join(", ") })}</p>}
      <p className={styles.foot}>{t.positions.viewNote}</p>
      <p className={styles.foot}>{t.positions.note}</p>
    </>
  );
}

/** İsabet halkası: payın yayı, bütün günlerin tabanı saç teli. */
function HitRing({ hit, base, label }: { hit: number | null; base: number | null; label: string }) {
  const R = 19;
  const tick = base === null ? null : (base / PERCENT) * 2 * Math.PI;
  return (
    <svg className={styles.hitRing} viewBox="0 0 48 48" role="img" aria-label={label}>
      <circle className={styles.hitTrack} cx={24} cy={24} r={R} pathLength={PERCENT} />
      {hit !== null && <circle className={styles.hitFill} cx={24} cy={24} r={R} pathLength={PERCENT} strokeDasharray={`${hit} ${PERCENT}`} />}
      {tick !== null && (
        <line
          className={styles.hitBase}
          x1={24 + (R - 5) * Math.cos(tick)}
          y1={24 + (R - 5) * Math.sin(tick)}
          x2={24 + (R + 5) * Math.cos(tick)}
          y2={24 + (R + 5) * Math.sin(tick)}
        />
      )}
    </svg>
  );
}

/**
 * Geriye dönük test — KÜÇÜK KARTLAR (25 Ekim, kart düzeni): sinyal,
 * tetiklenme, isabet halkası (taban saç teli), 20 günlük medyan. Taban
 * satırı panelin künyesine çıktı; ortalamalar ve 5 günlük sütunlar
 * "Tablo Görünümü"nde.
 */
export function BacktestPanel({ desk, t, locale }: Common & { desk: MarketDesk }) {
  const bt = desk.backtest;
  if (!bt) return null;
  const T = t.cards;
  return (
    <Panel>
      <PanelHeader title={t.backtest.title} meta={fill(t.backtest.range, { from: day(bt.from, locale), to: day(bt.to, locale) })} />
      <div className={styles.panelBody}>
        <p className={styles.ruleMeta}>{fill(T.baseMeta, { v: pct(bt.base.hitRate, locale, 0), m: signedPct(bt.base.longMedian, locale) })}</p>
        <ul className={styles.signals}>
          {bt.signals.map((s) => (
            <li key={s.key} className={styles.signal} data-active={s.activeNow ? "" : undefined}>
              <span className={styles.signalName}>{t.backtest.signals[s.key]}</span>
              <div className={styles.signalBody}>
                <HitRing
                  hit={s.hitRate}
                  base={bt.base.hitRate}
                  label={fill(T.hitRing, { v: pct(s.hitRate, locale, 0), b: pct(bt.base.hitRate, locale, 0) })}
                />
                <div className={styles.signalFigures}>
                  <span>
                    {T.hit} <b>{pct(s.hitRate, locale, 0)}</b>
                  </span>
                  <span>
                    {T.median20} <Dir value={s.longMedian} locale={locale} />
                  </span>
                </div>
              </div>
              <span className={styles.signalMeta}>
                {s.triggers > 0 ? fill(T.triggers, { n: s.triggers }) : T.noTrigger}
                {s.pending > 0 && ` · ${fill(t.backtest.pending, { n: s.pending })}`}
                {s.lastTrigger && ` · ${fill(T.lastTrigger, { date: day(s.lastTrigger, locale) })}`}
              </span>
              {s.activeNow && <span className={styles.flagNow}>{t.backtest.activeNow}</span>}
            </li>
          ))}
        </ul>
        <details className={styles.fold}>
          <summary>{T.tableToggle}</summary>
          <ScrollEdges fixedStart className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t.backtest.signal}</th>
                  <th scope="col">{t.backtest.triggers}</th>
                  <th scope="col">{t.backtest.short}</th>
                  <th scope="col">{t.backtest.shortMedian}</th>
                  <th scope="col">{t.backtest.long}</th>
                  <th scope="col">{t.backtest.longMedian}</th>
                  <th scope="col">{t.backtest.hit}</th>
                  <th scope="col">{t.backtest.last}</th>
                </tr>
              </thead>
              <tbody>
                {[...bt.signals.map((s) => ({ ...s, name: t.backtest.signals[s.key] })), { ...bt.base, key: "base", name: t.backtest.base, triggers: bt.base.scored, lastTrigger: null }].map((s) => (
                  <tr key={s.key}>
                    <td>{s.name}</td>
                    <td>{s.triggers}</td>
                    <td>
                      <Dir value={s.shortMean} locale={locale} />
                    </td>
                    <td>
                      <Dir value={s.shortMedian} locale={locale} />
                    </td>
                    <td>
                      <Dir value={s.longMean} locale={locale} />
                    </td>
                    <td>
                      <Dir value={s.longMedian} locale={locale} />
                    </td>
                    <td>{pct(s.hitRate, locale, 0)}</td>
                    <td>{day(s.lastTrigger, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollEdges>
        </details>
        <p className={styles.foot}>{t.backtest.note}</p>
      </div>
    </Panel>
  );
}
