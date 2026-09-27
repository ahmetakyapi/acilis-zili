import { EmptyState, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  FEAR_MA_DAYS,
  MIN_COMPONENTS,
  MOMENTUM_MA_DAYS,
  SAFE_HAVEN_DAYS,
  SENTIMENT_BANDS,
  sentimentBand,
  type SentimentKey,
  type SentimentReading,
} from "@/lib/sentiment";
import { getSentiment } from "@/lib/sentiment-data";
import {
  cn,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import styles from "./MarketBoards.module.css";

/**
 * Piyasa Nabzı — bileşik duyarlılık kadranı.
 *
 * Kuralların tamamı `lib/sentiment.ts`te; burası yalnızca çiziyor. İki
 * biçim var: `full` /piyasalar'da kadran + her bileşenin ham değeri ve
 * tarihi + yöntem; `compact` ana sayfaya konabilecek kadar küçük bir özet
 * (kadran, bant adı, bileşen puanları) ve ayrıntıya bağlantı.
 *
 * "Faiz ve Oynaklık" şeridiyle (components/macro/MarketPulse.tsx) AYRI:
 * o şerit ölçülerin kendisini yazıyor (vade faizleri, VIX seviyesi), bu
 * panel onları bir yargıya çeviriyor. VIX tanımı ikisinde de aynı
 * sözleşmeden (`VIX_SERIES`, lib/vix.ts) okunuyor.
 */

const GAUGE = { cx: 100, cy: 100, r: 80, stroke: 14 } as const;
/** Bant yayları arasındaki boşluk, puan cinsinden. */
const GAUGE_GAP = 0.9;
const SCORE_MAX = 100;

function point(score: number, radius: number = GAUGE.r) {
  const angle = Math.PI * (1 - score / SCORE_MAX);
  return {
    x: GAUGE.cx + radius * Math.cos(angle),
    y: GAUGE.cy - radius * Math.sin(angle),
  };
}

function arc(from: number, to: number) {
  const start = point(from);
  const end = point(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${GAUGE.r} ${GAUGE.r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/* Bant renkleri TOKEN'dan: korku `--down`, iştah `--up`, ortası nötr.
   Yoğunluk karışımla — ayrı bir renk ailesi tanımlamadan. */
const BAND_STROKE: Record<(typeof SENTIMENT_BANDS)[number]["key"], string> = {
  extremeFear: "var(--down)",
  fear: "color-mix(in srgb, var(--down) 45%, var(--line-soft))",
  neutral: "var(--line-strong)",
  greed: "color-mix(in srgb, var(--up) 45%, var(--line-soft))",
  extremeGreed: "var(--up)",
};

/** Bant yaylarının uçları — her bant bir öncekinin bittiği yerden başlar. */
const BAND_ARCS = SENTIMENT_BANDS.map((band, index) => {
  const from = index === 0 ? 0 : SENTIMENT_BANDS[index - 1].max;
  const to = Math.min(SCORE_MAX, band.max);
  return {
    key: band.key,
    path: arc(from + (from === 0 ? 0 : GAUGE_GAP / 2), to - (to === SCORE_MAX ? 0 : GAUGE_GAP / 2)),
  };
});

function Gauge({ score, label, size }: { score: number | null; label: string; size: "full" | "compact" }) {
  const marker = score !== null ? point(score) : null;
  return (
    <svg
      viewBox="0 0 200 112"
      className={cn(styles.gauge, size === "compact" && styles.gaugeCompact)}
      role="img"
      aria-label={label}
    >
      {BAND_ARCS.map((band) => (
        <path
          key={band.key}
          d={band.path}
          fill="none"
          strokeWidth={GAUGE.stroke}
          strokeLinecap="butt"
          style={{ stroke: BAND_STROKE[band.key] }}
        />
      ))}
      {marker && (
        <circle
          cx={marker.x}
          cy={marker.y}
          r={GAUGE.stroke / 2 + 3}
          className={styles.gaugeMarker}
        />
      )}
    </svg>
  );
}

function bandLabel(score: number, t: Dictionary) {
  const x = t.marketExtras;
  const labels: Record<(typeof SENTIMENT_BANDS)[number]["key"], string> = {
    extremeFear: x.bandExtremeFear,
    fear: x.bandFear,
    neutral: x.bandNeutral,
    greed: x.bandGreed,
    extremeGreed: x.bandExtremeGreed,
  };
  return labels[sentimentBand(score).key];
}

function componentName(key: SentimentKey, t: Dictionary) {
  const x = t.marketExtras;
  const names: Record<SentimentKey, string> = {
    vix: x.pulseVix,
    momentum: x.pulseMomentum,
    breadth: x.pulseBreadth,
    credit: x.pulseCredit,
    safeHaven: x.pulseSafeHaven,
  };
  return names[key];
}

/** Bileşenin ham okuması — ekranda puanın yanında, sayı olarak. */
function rawReading(reading: SentimentReading, locale: Locale, t: Dictionary) {
  const x = t.marketExtras;
  const two = (value: number) => formatPrice(value, locale, { digits: 2 });
  switch (reading.key) {
    case "vix":
      return x.rawVix
        .replace("{value}", two(reading.value))
        .replace("{average}", reading.reference !== null ? two(reading.reference) : "")
        .replace("{days}", String(FEAR_MA_DAYS));
    case "credit":
      return x.rawCredit
        .replace("{value}", two(reading.value))
        .replace("{average}", reading.reference !== null ? two(reading.reference) : "")
        .replace("{days}", String(FEAR_MA_DAYS));
    case "momentum": {
      const distance = reading.reference ? (reading.value / reading.reference - 1) * SCORE_MAX : null;
      return x.rawMomentum
        .replace("{distance}", formatPercent(distance, locale, 1))
        .replace("{days}", String(MOMENTUM_MA_DAYS));
    }
    case "safeHaven":
      return x.rawSafeHaven
        .replace("{stocks}", formatPercent(reading.value, locale, 1))
        .replace("{bonds}", formatPercent(reading.reference, locale, 1))
        .replace("{days}", String(SAFE_HAVEN_DAYS));
    default:
      return x.rawBreadth.replace("{share}", formatPercentPlain(reading.value, locale, 0));
  }
}

export async function SentimentPulse({
  locale,
  t,
  variant = "full",
}: {
  locale: Locale;
  t: Dictionary;
  variant?: "full" | "compact";
}) {
  const x = t.marketExtras;
  const snapshot = await getSentiment();
  const overall = snapshot.overall;
  const rounded = overall !== null ? Math.round(overall) : null;
  const band = overall !== null ? bandLabel(overall, t) : null;
  const gaugeLabel =
    rounded !== null && band
      ? x.gaugeAria.replace("{score}", String(rounded)).replace("{band}", band)
      : x.pulseInsufficient;

  if (snapshot.readings.length === 0) {
    return (
      <Panel id={variant === "full" ? "piyasa-nabzi" : undefined} className={styles.pulsePanel}>
        <PanelHeader title={x.pulseTitle} />
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      </Panel>
    );
  }

  if (variant === "compact") {
    return (
      <Panel className={styles.pulsePanel}>
        <PanelHeader title={x.pulseTitle} action={<PanelLink href="/piyasalar#piyasa-nabzi">{x.pulseDetails}</PanelLink>} />
        <div className={styles.pulseCompact}>
          <div className={styles.gaugeWrap}>
            <Gauge score={overall} label={gaugeLabel} size="compact" />
            <p className={styles.gaugeReading}>
              <strong className="numeral">{rounded ?? NO_VALUE}</strong>
              <span>{band ?? x.pulseInsufficientShort}</span>
            </p>
          </div>
          <ul className={styles.pulseChips}>
            {snapshot.readings.map((reading) => (
              <li key={reading.key}>
                <span>{componentName(reading.key, t)}</span>
                <b className="numeral">{Math.round(reading.score)}</b>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    );
  }

  return (
    <Panel id="piyasa-nabzi" className={styles.pulsePanel}>
      <PanelHeader title={x.pulseTitle} meta={x.pulseScale} />
      <div className={styles.pulseBody}>
        <div className={styles.gaugeWrap}>
          <Gauge score={overall} label={gaugeLabel} size="full" />
          <p className={styles.gaugeReading}>
            <strong className="numeral">{rounded ?? NO_VALUE}</strong>
            <span>{band ?? x.pulseInsufficientShort}</span>
          </p>
          <p className={styles.gaugeCaption}>
            {x.pulseAverageOf.replace("{n}", String(snapshot.readings.length))}
          </p>
        </div>
        <ul className={styles.pulseList}>
          {snapshot.readings.map((reading) => {
            const score = Math.round(reading.score);
            return (
              <li key={reading.key}>
                <div className={styles.pulseRowHead}>
                  <span className={styles.pulseName}>{componentName(reading.key, t)}</span>
                  <b className="numeral">{score}</b>
                </div>
                {/* Puan rayı: 0 solda (korku), 100 sağda (iştah). Çubuk bir
                    büyüklük, renk yalnızca yarının hangi tarafında olduğu. */}
                <span className={styles.scoreTrack} aria-hidden>
                  <i
                    style={{ width: `${reading.score}%` }}
                    data-side={reading.score >= SCORE_MAX / 2 ? "up" : "down"}
                  />
                </span>
                <p className={styles.pulseRaw}>
                  <span className="numeral">{rawReading(reading, locale, t)}</span>
                  <span aria-hidden> · </span>
                  <span className="numeral">{formatEtDateCompact(reading.date, locale)}</span>
                  {reading.key === "breadth" && snapshot.breadthSession === "extended" && (
                    <>
                      <span aria-hidden> · </span>
                      <span>{x.pulseExtended}</span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.notes}>
        <p>{x.pulseMethod}</p>
        <p>{x.pulseRelative}</p>
        {snapshot.missing.length > 0 && (
          <p>
            {x.pulseMissing.replace(
              "{names}",
              snapshot.missing.map((key) => componentName(key, t)).join(", "),
            )}
            {overall === null && ` ${x.pulseMinimum.replace("{n}", String(MIN_COMPONENTS))}`}
          </p>
        )}
        <p>{x.pulseNoHighsLows}</p>
      </div>
      <p className={styles.sourceLine}>{x.pulseSources}</p>
    </Panel>
  );
}
