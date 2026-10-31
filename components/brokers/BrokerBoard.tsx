"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CostLine } from "@/lib/broker-line";
import {
  CURVE_RANGE,
  crossSentence,
  dodgeLabels,
  dodgeSpans,
  MONTHS,
  YEARLY_FREQUENCIES,
  type FeeCurve,
  type LeaderSegment,
  type YearlyEntry,
  type YearlyFrequency,
} from "@/lib/broker-board";
import { brandVars } from "@/lib/broker-brand";
import { pctDigits } from "@/lib/broker-cards";
import type { brokerCardsTr } from "@/lib/i18n/dictionaries/broker-cards";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import { BrokerMark } from "./BrokerMark";
import { setAmountIndex, useAmountIndex } from "./broker-view-state";
import styles from "./BrokerBoard.module.css";

/**
 * ALIMINA GÖRE KOMİSYON — ÜÇ KART (25 Ekim, kurum logoları turu).
 *
 * Sahibinin itirazı (iki ekran görüntüsü): tam genişlikte 1440 piksel
 * boyunca uzanan ince çizgiler "çok yatay, boş". Aynı hesap üç soruya
 * bölündü ve yan yana duruyor:
 *
 *   a. BU TUTARDA EN UCUZ: kaydırıcı + kürsü. İlk üç kurum logolu, komisyon
 *      ve tutara oranıyla; kalanı küçük liste. Sıra logonun solundaki
 *      rozette (eşit ücret aynı sıra), büyüklük b ve c'de çizgi ve çubukla
 *      okunuyor. Kompakt turda (25 Ekim) renkli basamak blokları kalktı:
 *      sahibi "1., 1., 3." yazan dev blokları garip buldu; yerinde sütunun
 *      dibinde kurum renginde 3 piksellik taban çizgisi. Basamak yüksekliği
 *      büyüklük gibi okunuyordu, oysa sıradan geliyordu; sütunlar artık
 *      okuma sırasıyla soldan sağa 1-2-3.
 *   b. TUTAR BÜYÜDÜKÇE: 100 $ – 50.000 $ boyunca her kurumun eğrisi. İki
 *      eksen de logaritmik: yüzdelik tarife eğik bir doğru, sabit ücret düz
 *      bir çizgi olarak okunuyor; doğrusal eksende 0,30 $ ile 150 $ aynı
 *      grafiğe sığmıyordu (ucuz dört kurum tabana yapışıyordu). Seçili tutar
 *      dikey çizgi; noktalar a kartıyla AYNI sayıdan (`costLine`). Altında
 *      en düşük komisyonun dilim dilim kimde olduğu şeridi ve tek cümle.
 *   c. YILLIK MALİYET: seçili tutarla ayda 1/4/10 alım; komisyon + saklama.
 *
 * RENK KURUMUN KİMLİĞİ, YARGI DEĞİL: çizgi, nokta, çubuk ve kürsü basamağı
 * kurum renginde (`lib/broker-brand.ts`, iki tema ayrı ölçüldü); hiçbir
 * metin kurum renginde değil. En ucuz vurgulanmıyor; sıra bir öneri değil
 * (künye panelin dibinde).
 *
 * HAREKET: girişte eğriler bir kez çiziliyor, çubuklar ve kürsünün tepe şeritleri bir
 * kez büyüyor (`--ease-brand`); tutar değişince noktalar ve çubuklar yeni
 * yerine kayıyor. Hareketi azaltan okuyucuda hepsi son karede (modül CSS'i).
 *
 * GÖRSEL TUR (31 Ekim, sahibinin sözü: "çizgi uçlarındaki logolar
 * çakışıyor"; podyum hiyerarşisi, "En Düşük Komisyon" şeridi):
 *   - kürsü: taban çizgili sütunlar sitenin kart diline geçti (nötr karo,
 *     tepede kurum renginde 3 piksellik şerit); sıra rozeti logonun
 *     yanında yüzmüyor, karonun sol üstünde. Birinci sıra koyu rozet ve
 *     büyük rakamla ayrışıyor, renkle değil (renk kimlik, yargı değil).
 *   - eğri uçları: logolar eğrinin bittiği yerden kurum renginde ince bir
 *     bağlantı çizgisiyle bağlı, uçta küçük bir nokta; grafik 210 → 248
 *     piksel (telefonda 224), aralık 22 → 24. Üç kurum 50.000 $'da aynı
 *     yere çıktığında logolar yine sırayla diziliyor ama hangisinin hangi
 *     çizgi olduğu artık bağlantıdan okunuyor.
 *   - şerit: logo kümeleri dilimin ortasına göre itiliyor (`dodgeSpans`,
 *     dar dilimde üst üste binmiyor), sapan küme diliminin ortasına kısa bir
 *     sapla bağlı; dilim sınırlarının tutarı şeridin altında; seçili tutar
 *     şeritte de işaretli (grafiğin kesik çizgisiyle aynı x); taralı dilimin
 *     anlamı başlığın yanında ("Taralı: Eşit Ücret").
 */

export type BrokerBoardLabels = typeof brokerCardsTr.board & {
  amountLabel: string;
  amountValue: string;
  ofTrade: string;
};

export function BrokerBoard({
  lines,
  curves,
  segments,
  yearly,
  locale,
  labels,
}: {
  lines: CostLine[];
  curves: FeeCurve[];
  segments: LeaderSegment[];
  /** `yearly[durak][sıklık]` — sıklık YEARLY_FREQUENCIES sırasıyla. */
  yearly: YearlyEntry[][][];
  locale: "tr" | "en";
  labels: BrokerBoardLabels;
}) {
  const index = useAmountIndex();
  const line = lines[index];
  const usd = useCallback(
    (value: number, digits = 2) => formatPrice(value, locale, { currency: true, digits }),
    [locale],
  );
  const amount = usd(line.amount, 0);

  return (
    <div className={styles.board}>
      <section className={styles.card} data-area="a" aria-labelledby="pano-ucuz">
        <h3 id="pano-ucuz" className={styles.title}>
          {labels.cheapest.title}
        </h3>
        <div className={styles.control}>
          <label htmlFor="broker-amount" className={styles.amountLabel}>
            {labels.amountLabel}
          </label>
          <output htmlFor="broker-amount" className={cn("numeral", styles.amountValue)}>
            {amount}
          </output>
          <input
            id="broker-amount"
            type="range"
            min={0}
            max={lines.length - 1}
            step={1}
            value={index}
            onChange={(event) => setAmountIndex(Number(event.target.value))}
            aria-valuetext={labels.amountValue.replace("{amount}", amount)}
            className={styles.slider}
          />
          <span aria-hidden className={cn("numeral", styles.scaleEnds)}>
            <span>{usd(lines[0].amount, 0)}</span>
            <span>{usd(lines[lines.length - 1].amount, 0)}</span>
          </span>
        </div>
        <Podium line={line} usd={usd} locale={locale} labels={labels} amount={amount} />
      </section>

      <section className={styles.card} data-area="b" aria-labelledby="pano-egri">
        <div className={styles.titleRow}>
          <h3 id="pano-egri" className={styles.title}>
            {labels.curves.title}
          </h3>
          <span className={styles.chip}>{labels.curves.scaleNote}</span>
        </div>
        <CurveChart curves={curves} line={line} lines={lines} segments={segments} usd={usd} locale={locale} labels={labels} />
      </section>

      <section className={styles.card} data-area="c" aria-labelledby="pano-yil">
        <h3 id="pano-yil" className={styles.title}>
          {labels.yearly.title}
        </h3>
        <Yearly entriesByFreq={yearly[index]} usd={usd} amount={amount} labels={labels} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ a. kürsü */

function Podium({
  line,
  usd,
  locale,
  labels,
  amount,
}: {
  line: CostLine;
  usd: (value: number, digits?: number) => string;
  locale: "tr" | "en";
  labels: BrokerBoardLabels;
  amount: string;
}) {
  const top = line.priced.slice(0, 3);
  const rest = line.priced.slice(3);
  const pct = (value: number) =>
    labels.ofTrade.replace("{pct}", formatPercentPlain(value, locale, pctDigits(value)));
  return (
    <>
      <ol className={styles.podium} aria-label={labels.cheapest.podiumLabel.replace("{amount}", amount)}>
        {top.map((entry, i) => (
          <li
            key={i}
            className={cn(styles.step, styles.brand)}
            data-first={entry.rank === 1 || undefined}
            style={{ ...brandVars(entry.id), "--i": i } as React.CSSProperties}
          >
            <span className={cn("numeral", styles.medal)}>
              {labels.cheapest.rank.replace("{rank}", String(entry.rank))}
            </span>
            <span className={styles.stepMark}>
              <BrokerMark id={entry.id} name={entry.name} size="lg" />
            </span>
            <span className={styles.stepName}>{entry.name}</span>
            <span className={cn("numeral", styles.stepFee)}>{usd(entry.fee)}</span>
            <span className={cn("numeral", styles.stepPct)}>{pct(entry.pct)}</span>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <ol className={styles.rest} aria-label={labels.cheapest.restLabel}>
          {rest.map((entry) => (
            <li key={entry.id} className={styles.restRow}>
              <span className={cn("numeral", styles.restRank)}>{entry.rank}</span>
              <BrokerMark id={entry.id} name={entry.name} size="xs" />
              <span className={styles.restName}>{entry.name}</span>
              <span className={cn("numeral", styles.restFee)}>
                {usd(entry.fee)}
                <small>{pct(entry.pct)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/* ------------------------------------------------------------ b. eğriler */

/** Grafik boyu: geniş 248, dar (çizim kutusu < 400 piksel, telefon) 224 —
    logolar sıkışmasın (31 Ekim). 1440'ta kutu ~480, 390'da ~310 piksel. */
const CHART_H_WIDE = 248;
const CHART_H_NARROW = 224;
const NARROW_W = 400;
/** Sağ pay: 14 piksellik bağlantı çizgisi + 20 piksellik logo + 6. */
const M = { top: 12, right: 44, bottom: 24, left: 46 } as const;
/** Uç logoları arası en az aralık: 20 piksellik karo + 4 piksel. */
const LABEL_GAP = 24;
/** Bağlantı çizgisinin dirseği: eğrinin ucundan sağa 6, logoya 14 piksel. */
const LEADER_BEND = 6;
const LEADER_END = 14;
/** Şeritteki logo kümesi: 20 piksellik karo, kümede 2 piksel ara (eski 6
    piksellik bindirme komşu kümeyle çakışma gibi okunuyordu), kümeler arası 6. */
const STRIP_MARK = 20;
const STRIP_INNER = 2;
const STRIP_GAP = 6;
/** Şeridin altındaki sınır tutarları arası en az piksel. */
const STRIP_TICK_GAP = 56;
const X_TICKS = [100, 1_000, 10_000, 50_000] as const;
/** İki x etiketi arası en az piksel; dar grafikte ("10.000 $" ile "50.000 $",
    390'da üst üste biniyordu) ara etiket düşüyor, uçlar kalıyor. */
const X_TICK_GAP = 64;
const Y_TICK_CANDIDATES = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1_000] as const;

function CurveChart({
  curves,
  line,
  lines,
  segments,
  usd,
  locale,
  labels,
}: {
  curves: FeeCurve[];
  line: CostLine;
  lines: CostLine[];
  segments: LeaderSegment[];
  usd: (value: number, digits?: number) => string;
  locale: "tr" | "en";
  labels: BrokerBoardLabels;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  /* Sunucu çiziminde ve ilk karede 460; ölçünce gerçek genişlik. Yükseklik
     sabit: genişlik değişse de kutu zıplamıyor (CLS 0). */
  const [width, setWidth] = useState(460);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const [lo, hi] = CURVE_RANGE;
  const fees = curves.flatMap((curve) => curve.points.map((point) => point.fee));
  const yLo = Math.min(...fees) * 0.75;
  const yHi = Math.max(...fees) * 1.3;
  const plotW = Math.max(width - M.left - M.right, 40);
  const CHART_H = width < NARROW_W ? CHART_H_NARROW : CHART_H_WIDE;
  const plotH = CHART_H - M.top - M.bottom;
  const x = useCallback(
    (amount: number) => M.left + ((Math.log(amount) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * plotW,
    [lo, hi, plotW],
  );
  const y = useCallback(
    (fee: number) => M.top + (1 - (Math.log(fee) - Math.log(yLo)) / (Math.log(yHi) - Math.log(yLo))) * plotH,
    [yLo, yHi, plotH],
  );
  const xTicks = X_TICKS.filter(
    (tick, i) =>
      i === 0 ||
      i === X_TICKS.length - 1 ||
      (x(tick) - x(X_TICKS[i - 1]) >= X_TICK_GAP && x(X_TICKS[X_TICKS.length - 1]) - x(tick) >= X_TICK_GAP),
  );
  const yTicks = Y_TICK_CANDIDATES.filter((tick) => tick >= yLo && tick <= yHi && [1, 10, 100, 1_000].includes(tick));

  const ends = useMemo(() => {
    const targets = curves.map((curve) => y(curve.points[curve.points.length - 1].fee));
    return dodgeLabels(targets, LABEL_GAP, M.top, M.top + plotH);
  }, [curves, y, plotH]);

  const fees0 = new Map(line.priced.map((entry) => [entry.id, entry.fee]));
  const grid = curves[0]?.points.map((point) => point.amount) ?? [];

  /* İşaretçi: dokunma ve basılı sürükleme tutarı seçiyor (kaydırıcının en
     yakın durağı, log uzaklığıyla); fareyle üzerinde gezinmek o tutarın
     ücretlerini ipucunda gösteriyor. Klavye karşılığı kaydırıcı. */
  const amountAt = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = Math.min(Math.max(clientX - rect.left - M.left, 0), plotW);
    return Math.exp(Math.log(lo) + (px / plotW) * (Math.log(hi) - Math.log(lo)));
  };
  const pick = (clientX: number) => {
    const value = amountAt(clientX);
    if (value === null) return;
    let best = 0;
    lines.forEach((candidate, i) => {
      if (Math.abs(Math.log(candidate.amount / value)) < Math.abs(Math.log(lines[best].amount / value))) best = i;
    });
    setAmountIndex(best);
  };
  const onMove = (event: React.PointerEvent) => {
    if (event.buttons === 1) pick(event.clientX);
    if (event.pointerType !== "mouse") return;
    const value = amountAt(event.clientX);
    if (value === null || grid.length === 0) return;
    let best = 0;
    grid.forEach((amount, i) => {
      if (Math.abs(Math.log(amount / value)) < Math.abs(Math.log(grid[best] / value))) best = i;
    });
    setHover(best);
  };

  const listFormat = useMemo(() => new Intl.ListFormat(locale === "en" ? "en" : "tr", { type: "conjunction" }), [locale]);
  const nameOf = useMemo(() => new Map(curves.map((curve) => [curve.id, curve.name])), [curves]);
  const names = useCallback((ids: readonly string[]) => listFormat.format(ids.map((id) => nameOf.get(id) ?? id)), [listFormat, nameOf]);
  const sentence = crossSentence(segments, names, (value) => usd(Math.round(value), 0), labels.curves);

  const hoverAmount = hover !== null ? grid[hover] : null;
  const hoverRows =
    hover !== null
      ? curves
          .map((curve) => ({ id: curve.id, name: curve.name, fee: curve.points[hover]?.fee ?? 0 }))
          .sort((a, b) => a.fee - b.fee)
      : [];

  /* Şerit geometrisi (çizim alanına göre piksel). */
  const segX = segments.map((segment) => {
    const left = x(segment.from) - M.left;
    const right = x(segment.to) - M.left;
    return { left, width: right - left, mid: (left + right) / 2 };
  });
  const groupW = segments.map((segment) => segment.ids.length * STRIP_MARK + (segment.ids.length - 1) * STRIP_INNER);
  const groupAt = dodgeSpans(segX.map((seg) => seg.mid), groupW, STRIP_GAP, 0, plotW);
  const hasTie = segments.some((segment) => segment.ids.length > 1);
  /* İç sınırlar; komşusuna STRIP_TICK_GAP'ten yakın olan düşer, uçlara
     yakın olan da (uç tutarlar grafiğin ekseninde zaten yazılı). */
  const stripTicks: { at: number; value: number }[] = [];
  for (const segment of segments.slice(1)) {
    const at = x(segment.from) - M.left;
    const prev = stripTicks.at(-1)?.at ?? -Infinity;
    if (at - prev >= STRIP_TICK_GAP && at >= STRIP_TICK_GAP / 2 && plotW - at >= STRIP_TICK_GAP / 2) {
      stripTicks.push({ at, value: segment.from });
    }
  }

  return (
    <>
      <div
        ref={wrap}
        className={styles.chartWrap}
        style={{ height: CHART_H }}
        onPointerDown={(event) => pick(event.clientX)}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={width} height={CHART_H} className={styles.chart} role="img" aria-label={labels.curves.chartLabel}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={M.left} x2={M.left + plotW} y1={y(tick)} y2={y(tick)} className={styles.gridLine} />
              <text x={M.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className={styles.tick}>
                {usd(tick, 0)}
              </text>
            </g>
          ))}
          {xTicks.map((tick, i) => (
            <text
              key={tick}
              x={x(tick)}
              y={CHART_H - 6}
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
              className={styles.tick}
            >
              {usd(tick, 0)}
            </text>
          ))}
          <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} className={styles.axis} />
          {curves.map((curve) => (
            <path
              key={curve.id}
              d={curve.points.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.amount).toFixed(1)},${y(point.fee).toFixed(1)}`).join("")}
              pathLength={1}
              className={cn(styles.curve, styles.brand)}
              style={brandVars(curve.id) as React.CSSProperties}
            />
          ))}
          {/* Uç bağlantıları: eğrinin bittiği nokta → dirsek → logo. */}
          {curves.map((curve, i) => {
            const endY = y(curve.points[curve.points.length - 1].fee);
            const x0 = M.left + plotW;
            return (
              <g key={curve.id} className={styles.brand} style={brandVars(curve.id) as React.CSSProperties}>
                <polyline
                  points={`${x0},${endY.toFixed(1)} ${x0 + LEADER_BEND},${endY.toFixed(1)} ${x0 + LEADER_END},${ends[i].toFixed(1)}`}
                  className={styles.leader}
                />
                <circle cx={x0} cy={endY} r={2.5} className={styles.endDot} />
              </g>
            );
          })}
          <line x1={x(line.amount)} x2={x(line.amount)} y1={M.top} y2={M.top + plotH} className={styles.cursor} />
          {hoverAmount !== null && (
            <line x1={x(hoverAmount)} x2={x(hoverAmount)} y1={M.top} y2={M.top + plotH} className={styles.hoverLine} />
          )}
          {curves.map((curve) => {
            const fee = fees0.get(curve.id);
            if (fee === undefined) return null;
            return (
              <g
                key={curve.id}
                className={cn(styles.dotRail, styles.brand)}
                /* Bir ondalık: tarayıcı satır içi stili kısaltıyor; tam kesir
                   hidrasyonda sunucunun yazdığıyla ayrışıyordu (25 Ekim, ölçüldü). */
                style={{
                  ...brandVars(curve.id),
                  transform: `translate(${x(line.amount).toFixed(1)}px, ${y(fee).toFixed(1)}px)`,
                } as React.CSSProperties}
              >
                <circle r={4.5} className={styles.dot} />
              </g>
            );
          })}
        </svg>
        {curves.map((curve, i) => (
          <span key={curve.id} className={styles.endMark} style={{ top: Math.round(ends[i] - 10), left: Math.round(M.left + plotW + LEADER_END + 2) }}>
            <BrokerMark id={curve.id} name={curve.name} size="xs" />
          </span>
        ))}
        {hoverAmount !== null && (
          <div
            aria-hidden
            className={styles.tip}
            data-side={x(hoverAmount) > M.left + plotW / 2 ? "left" : "right"}
            style={{ left: x(hoverAmount) }}
          >
            <b className="numeral">{usd(hoverAmount, 0)}</b>
            {hoverRows.map((row) => (
              <span key={row.id} className={cn(styles.tipRow, styles.brand)} style={brandVars(row.id) as React.CSSProperties}>
                <i aria-hidden className={styles.tipSwatch} />
                <span>{row.name}</span>
                <span className="numeral">{usd(row.fee)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* En düşük komisyonun şeridi: x ekseniyle aynı ölçekte dilimler.
          Üstte logo kümeleri (itilmiş, sapla dilime bağlı), ortada dilim
          bandı ve seçili tutarın işareti, altta dilim sınırlarının tutarı. */}
      <div className={styles.strip}>
        <div className={styles.stripHead}>
          <span className={styles.stripTitle}>{labels.curves.stripTitle}</span>
          {hasTie && (
            <span className={styles.stripKey}>
              <i aria-hidden className={styles.stripKeySwatch} />
              {labels.curves.tieKey}
            </span>
          )}
        </div>
        <div className={styles.stripPlot} style={{ marginLeft: M.left, marginRight: M.right }}>
          <div aria-hidden className={styles.stripMarksRow}>
            {segments.map((segment, i) => {
              const center = segX[i].mid;
              const shift = groupAt[i] - center;
              return (
                <span key={`${segment.from}-${segment.ids.join(",")}`}>
                  <span className={styles.stripGroup} data-tie={segment.ids.length > 1 ? "" : undefined} style={{ left: groupAt[i] - groupW[i] / 2 }}>
                    {segment.ids.map((id) => (
                      <BrokerMark key={id} id={id} name={nameOf.get(id) ?? id} size="xs" />
                    ))}
                  </span>
                  {Math.abs(shift) > 1 && (
                    <svg className={styles.stripStem} style={{ left: Math.min(center, groupAt[i]) - 1, width: Math.abs(shift) + 2 }}>
                      <line
                        x1={shift > 0 ? 1 : Math.abs(shift) + 1}
                        y1={8}
                        x2={shift > 0 ? Math.abs(shift) + 1 : 1}
                        y2={0}
                      />
                    </svg>
                  )}
                </span>
              );
            })}
          </div>
          <ol className={styles.stripBand}>
            {segments.map((segment, i) => {
              const single = segment.ids.length === 1;
              return (
                <li
                  key={`${segment.from}-${segment.ids.join(",")}`}
                  className={cn(styles.stripSeg, single && styles.brand)}
                  data-tie={single ? undefined : ""}
                  style={{ left: segX[i].left, width: segX[i].width, ...(single ? brandVars(segment.ids[0]) : {}) } as React.CSSProperties}
                >
                  <span className="sr-only">
                    {labels.curves.stripLabel
                      .replace("{from}", usd(Math.round(segment.from), 0))
                      .replace("{to}", usd(Math.round(segment.to), 0))
                      .replace("{names}", names(segment.ids))}
                  </span>
                </li>
              );
            })}
            <li aria-hidden className={styles.stripCursor} style={{ left: x(line.amount) - M.left }} />
          </ol>
          <div aria-hidden className={cn("numeral", styles.stripTicks)}>
            {stripTicks.map((tick) => (
              <span key={tick.at} style={{ left: tick.at }}>
                {usd(Math.round(tick.value), 0)}
              </span>
            ))}
          </div>
        </div>
      </div>
      {sentence && <p className={styles.sentence}>{sentence}</p>}
      <p className={styles.hint}>{labels.curves.pick}</p>
    </>
  );
}

/* ------------------------------------------------------------ c. yıllık */

function Yearly({
  entriesByFreq,
  usd,
  amount,
  labels,
}: {
  entriesByFreq: YearlyEntry[][];
  usd: (value: number, digits?: number) => string;
  amount: string;
  labels: BrokerBoardLabels;
}) {
  const [freq, setFreq] = useState<YearlyFrequency>(YEARLY_FREQUENCIES[0]);
  const entries = entriesByFreq[YEARLY_FREQUENCIES.indexOf(freq)] ?? [];
  const max = Math.max(...entries.map((entry) => entry.total), 0);
  const Y = labels.yearly;
  const eur = (value: number) => `${value * MONTHS} €`;

  return (
    <>
      <div className={styles.freqRow}>
        <span className={styles.amountLabel} id="pano-yil-siklik">
          {Y.freqLabel}
        </span>
        <div role="group" aria-labelledby="pano-yil-siklik" className={styles.freq}>
          {YEARLY_FREQUENCIES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={freq === n}
              aria-label={Y.freqAria.replace("{n}", String(n))}
              className={styles.freqButton}
              onClick={() => setFreq(n)}
            >
              <span className="numeral">{Y.freq.replace("{n}", String(n))}</span>
            </button>
          ))}
        </div>
      </div>

      <ol className={styles.bars}>
        {entries.map((entry) => {
          const a = max > 0 ? entry.commission / max : 0;
          const b = max > 0 && entry.custody ? entry.custody / max : 0;
          const custodyNote = entry.custodyFloorEurMonth
            ? Y.custodyFloor.replace("{eur}", eur(entry.custodyFloorEurMonth))
            : entry.custody === null
              ? Y.custodyUnknown
              : entry.custodyFree
                ? Y.custodyFree
                : null;
          return (
            <li key={entry.id} className={cn(styles.barRow, styles.brand)} style={brandVars(entry.id) as React.CSSProperties}>
              <span className="sr-only">
                {Y.rowLabel
                  .replace("{name}", entry.name)
                  .replace("{total}", usd(entry.total))
                  .replace("{commission}", usd(entry.commission))
                  .replace("{custody}", entry.custody === null ? Y.custodyNone : usd(entry.custody))}
              </span>
              <BrokerMark id={entry.id} name={entry.name} size="sm" />
              <span aria-hidden className={styles.barName}>
                {entry.name}
              </span>
              <span aria-hidden className={cn("numeral", styles.barValue)}>
                {usd(entry.total, entry.total >= 100 ? 0 : 2)}
              </span>
              <span aria-hidden className={styles.barTrack}>
                <span className={styles.barA} style={{ "--a": a } as React.CSSProperties} />
                <span className={styles.barB} style={{ "--a": a, "--b": b } as React.CSSProperties} />
              </span>
              {custodyNote && (
                <span aria-hidden className={styles.barNote}>
                  {custodyNote}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.legend} aria-hidden>
        <span>
          <i className={styles.swatchA} />
          {Y.commission}
        </span>
        <span>
          <i className={styles.swatchB} />
          {Y.custody}
        </span>
      </div>
      <p className={styles.assumption}>{Y.assumption.replace("{n}", String(freq)).replace("{amount}", amount)}</p>
    </>
  );
}
