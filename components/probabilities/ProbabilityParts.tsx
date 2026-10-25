import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react/dist/ssr";
import { etParts } from "@/lib/market-hours";
import { percentShares, wholePercent, type FedSide, type PathStep } from "@/lib/probabilities";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { INTL_LOCALE } from "@/lib/i18n/config";
import {
  averageMonths,
  HISTORY_FROM,
  NBER_RECESSIONS,
  recessionMonths,
  timelineAt,
  timelineSpans,
  type Recession,
} from "./recession-history";
import styles from "./Probabilities.module.css";

/**
 * Olasılıklar sayfasının çizim parçaları — sunucu bileşenleri, istemci JS'i
 * yok (çizgi hariç: o `ProbabilityLine`, okuma katmanı için istemcide).
 */

/** Tam sayı yüzde, dile göre (%94 / 94%); 0 ve 100'e yuvarlanmaz (wholePercent). */
export function pct(p: number, locale: Locale): string {
  return formatPercentPlain(wholePercent(p), locale, 0);
}

/** Yüzde puanı değişimi: "+4" / "−2" / null. */
export function signedPoints(n: number, locale: Locale): string {
  const body = formatPrice(Math.abs(n), locale, { digits: 0 });
  return n > 0 ? `+${body}` : n < 0 ? `−${body}` : body;
}

/** ISO anı → ET günü ve saati ("2026-10-28", "14:00"). */
export function etOf(iso: string): { date: string; time: string } {
  const parts = etParts(new Date(iso));
  return { date: parts.dateStr, time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}` };
}

export type StackSegment = { key: string; label: string; p: number; /** Çipin tam adı (imleçte). */ title?: string };

/**
 * Bir yığının dilim yüzdeleri, toplamı 100 (`percentShares`). Büyük sayı
 * ile çubuğun künyesi AYNI sayıyı söylesin diye panel de bunu kullanıyor.
 */
export function shareMap(segments: readonly StackSegment[]): Record<string, number> {
  const shares = percentShares(segments.map((s) => s.p));
  return Object.fromEntries(segments.map((s, i) => [s.key, shares[i]]));
}

/** Pay yüzdesi; sıfıra yuvarlanan ama sıfır olmayan dilim "<%1" / "<1%". */
export function shareText(n: number, locale: Locale, p?: number): string {
  if (n === 0 && p !== undefined && p > 0) return `<${formatPercentPlain(1, locale, 0)}`;
  return formatPercentPlain(n, locale, 0);
}

/**
 * Yığın çubuk — birbirini dışlayan sonuçlar, toplam %100. Sıra çağıranın
 * verdiği sabit sıra (renk varlığa bağlı, büyüklüğe değil). `midline` iki
 * sonuçlu olayda %50 çizgisi: çoğunluğun nerede olduğunu çubuğun kendisi
 * söylesin.
 *
 * `legend="scale"` (Fed): künye tek satır çip dizisi, her çipte işaret,
 * kısa ad ve sayı; sıra çubuğun sırası. Beş uzun ad ("25 bp'den Büyük
 * İndirim") iki-üç satıra dökülüp kartı uzatıyordu; ardından gelen beş
 * sütunlu ölçek de ad ve sayıyı iki satıra bölüyordu ("−50+ bp" üstte, "%1"
 * altta; sahibinin ikinci tur notu: "lejant sıkışık"). Çipte birim yok
 * ("−25"), tam ad imleçte ve çubuğun aria'sında; en olası sonucun çipi
 * kendi tonunun açığında.
 *
 * Çubuk girişte bir kez soldan dolar (CSS, `--ease-brand`, ilk boyamadan);
 * hareketi azaltana son kare.
 */
export function ProbabilityStack({
  segments,
  ariaLabel,
  locale,
  lead,
  midline,
  midlineLabel = true,
  legend = true,
}: {
  segments: StackSegment[];
  ariaLabel: string;
  locale: Locale;
  lead?: string | null;
  midline?: string;
  /** Çentiğin adı çubuğun üstünde mi (kartın künyesi açıklıyorsa hayır). */
  midlineLabel?: boolean;
  legend?: boolean | "scale";
}) {
  const shown = segments.filter((s) => s.p >= 0.005);
  const shares = shareMap(segments);
  return (
    <div className={styles.stack}>
      <div className={styles.stackBar} role="img" aria-label={ariaLabel}>
        <div className={styles.stackTrack}>
          {shown.map((s) => (
            <span key={s.key} data-tone={s.key} style={{ flexGrow: s.p, flexBasis: 0 }} />
          ))}
        </div>
        {midline && (
          <>
            <i className={styles.stackMid} aria-hidden />
            {midlineLabel && <span className={styles.stackMidLabel} aria-hidden>{midline}</span>}
          </>
        )}
      </div>
      {legend === "scale" && (
        <ul className={styles.chips} aria-hidden>
          {segments.map((s) => (
            <li key={s.key} data-tone={s.key} data-lead={lead === s.key || undefined} title={s.title}>
              <i />
              <span>{s.label}</span>
              <b className="numeral">{shareText(shares[s.key], locale, s.p)}</b>
            </li>
          ))}
        </ul>
      )}
      {legend === true && (
        <ul className={styles.legend} aria-hidden>
          {segments.map((s) => (
            <li key={s.key} data-tone={s.key} data-lead={lead === s.key || undefined}>
              <i />
              {s.label} <b className="numeral">{shareText(shares[s.key], locale, s.p)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SIDES: readonly FedSide[] = ["cut", "hold", "hike"];

export type PathLabels = {
  today: string;
  expected: string;
  move: string;
  cumulative: string;
  thin: string;
  bps: string;
  aria: string;
  step: string;
  sides: Record<FedSide, string>;
};

/** Patikanın çizim yüksekliği (piksel): noktalar, sayılar ve bugünkü bant. */
const PATH_PLOT_H = 96;
/** Adım rozetinde "değişmedi" sayılan beklenen hareket (bp). */
const PATH_FLAT_BPS = 0.5;

/**
 * Beklenen faiz patikası. Sütun başına toplantı; ilk sütun bugün.
 *
 * İKİNCİ TUR (25 Ekim, sahibinin notu: "tam genişlik ve yüksek, noktalar ve
 * etiketler dağınık"). Panel 346 → ~230 piksel (ölçüm commit mesajında):
 * - Bugünkü hedef aralık yatay BANT (alt ve üst sınır gerçek ölçekte);
 *   noktanın bandın içinde mi üstünde mi olduğu asıl okuma.
 * - Her noktanın üstünde beklenen düzey, altında toplantının beklenen ADIM
 *   rozeti (indirim mor, artış pirinç; sayı mürekkepte, işaret okla).
 *   Eskiden burada her sütunda 56 piksellik indirim/sabit/artış yığını
 *   vardı; olasılıklar sütunun künyesinde (imleç/odak) kaldı.
 * - Toplantı tarihleri tek eksen satırında; yöntem notu "Nasıl
 *   Hesaplanır" katlamasında.
 * Dikey ölçek patikanın kendi aralığı + bant (mutlak sıfır değil): YÖN ve
 * büyüklük karşılaştırması için; okunan şey noktanın sayısı.
 */
export function RatePath({
  steps,
  current,
  locale,
  dateOf,
  labels,
}: {
  steps: PathStep[];
  /** Bugünkü hedef aralık (%); yoksa patika bp değişimi olarak çizilir. */
  current: { lower: number; upper: number } | null;
  locale: Locale;
  dateOf: (iso: string | null) => string;
  labels: PathLabels;
}) {
  if (steps.length === 0) return null;
  const mid = current ? (current.lower + current.upper) / 2 : null;
  const level = (step: PathStep | null) => (mid === null ? (step ? step.cumulativeBps : 0) : step ? step.expectedMid ?? mid : mid);
  const values = [level(null), ...steps.map(level)];
  const low = Math.min(...values, ...(current ? [current.lower] : []));
  const high = Math.max(...values, ...(current ? [current.upper] : []));
  /* Aralık çok darsa (hepsi "sabit") en az 25 bp'lik (ya da 0,25 puan)
     pencere, tek adımın boyu. Üstte sayı payı, altta küçük pay. */
  const span = Math.max(high - low, mid === null ? 25 : 0.25);
  const top = high + span * 0.42;
  const bottom = low - span * 0.12;
  const yOf = (value: number) => ((top - value) / (top - bottom)) * 100;
  const format = (value: number) =>
    mid === null
      ? labels.bps.replace("{n}", `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPrice(Math.abs(value), locale, { digits: 0 })}`)
      : formatPercentPlain(value, locale, 2);
  const cols = steps.length + 1;
  const points = values.map((value, i) => `${((i + 0.5) / cols) * 100},${yOf(value)}`).join(" ");
  const bp = (value: number, digits = 1) =>
    labels.bps.replace("{n}", `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPrice(Math.abs(value), locale, { digits })}`);

  return (
    <div className={styles.path} role="group" aria-label={labels.aria} style={{ "--plot-h": `${PATH_PLOT_H}px` } as CSSProperties}>
      <svg className={styles.pathLine} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {current ? (
          <rect x="0" width="100" y={yOf(current.upper)} height={yOf(current.lower) - yOf(current.upper)} className={styles.pathBand} />
        ) : (
          <line x1="0" x2="100" y1={yOf(0)} y2={yOf(0)} vectorEffect="non-scaling-stroke" />
        )}
        <polyline points={points} className="spark-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <ol className={styles.pathGrid} style={{ "--cols": cols } as CSSProperties}>
        <li className={styles.pathCol} data-today tabIndex={0} aria-label={`${labels.today}: ${format(values[0])}`}>
          <div className={styles.pathPlot}>
            <span className={styles.pathDot} style={{ top: `${yOf(values[0])}%` }} />
            <span className={`${styles.pathValue} numeral`} style={{ top: `${yOf(values[0])}%` }}>{format(values[0])}</span>
          </div>
          {/* Bugünün adımı yok: rozetin yeri boş tutulur (hiza). */}
          <span className={styles.pathStep} data-empty aria-hidden />
          <span className={styles.pathDate}>{labels.today}</span>
        </li>
        {steps.map((step, i) => {
          const value = values[i + 1];
          const date = dateOf(step.strikeAt);
          const sides = SIDES.map((side) => `${labels.sides[side]} ${pct(step.sides[side], locale)}`).join(", ");
          const move = Math.round(step.moveBps);
          const tone = Math.abs(step.moveBps) < PATH_FLAT_BPS ? "hold" : step.moveBps < 0 ? "cut" : "hike";
          const Icon = tone === "cut" ? ArrowDown : tone === "hike" ? ArrowUp : Minus;
          return (
            <li
              key={step.eventTicker}
              className={styles.pathCol}
              data-thin={step.liquidity === "thin" || undefined}
              tabIndex={0}
              aria-label={`${date}: ${labels.expected} ${format(value)}; ${labels.step.replace("{n}", bp(step.moveBps))}; ${sides}${step.liquidity === "thin" ? `; ${labels.thin}` : ""}`}
            >
              <div className={styles.pathPlot}>
                <span className={styles.pathDot} style={{ top: `${yOf(value)}%` }} />
                <span className={`${styles.pathValue} numeral`} style={{ top: `${yOf(value)}%` }}>{format(value)}</span>
              </div>
              <span className={styles.pathStep} data-tone={tone} aria-hidden>
                <Icon size={10} weight="bold" />
                <b className="numeral">{move > 0 ? `+${move}` : move < 0 ? `−${Math.abs(move)}` : "0"}</b>
                <span className={styles.pathUnit}>{labels.bps.replace("{n}", "").trim()}</span>
              </span>
              <span className={styles.pathDate}>{date}</span>
              <div className={styles.pathTip} aria-hidden>
                <p>{date}</p>
                <dl>
                  <dt>{labels.expected}</dt>
                  <dd>{format(value)}</dd>
                  <dt>{labels.move}</dt>
                  <dd>{bp(step.moveBps)}</dd>
                  <dt>{labels.cumulative}</dt>
                  <dd>{bp(step.cumulativeBps)}</dd>
                  {SIDES.map((side) => (
                    <FragmentRow key={side} label={labels.sides[side]} value={pct(step.sides[side], locale)} />
                  ))}
                </dl>
                {step.liquidity === "thin" && <p className={styles.note}>{labels.thin}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

/* ------------------------------------------------- RESESYON GEÇMİŞİ */

const DECADES = ["1980-01", "1990-01", "2000-01", "2010-01", "2020-01"] as const;
const MONTH_YEAR = new Map<string, Intl.DateTimeFormat>();

function monthYear(ym: string, locale: Locale): string {
  let format = MONTH_YEAR.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" });
    MONTH_YEAR.set(locale, format);
  }
  return format.format(new Date(`${ym}-15T12:00:00Z`));
}

export type HistoryLabels = { title: string; summary: string; span: string; aria: string; next: string };

/**
 * Resesyon kartının zaman şeridi (25 Ekim, ikinci tur): 1980'den 2027
 * sonuna tek kulvar; geçmiş resesyonlar NBER tarihleriyle nötr bloklar
 * (olgu, olasılık değil), en sağda 2027 kesik çerçeveli ve olasılığın
 * renginde, üstünde kadrandaki AYNI pay (aynı sayı iki yerde aynı
 * hesaptan). Bugün ince bir çentik. Bloklar imleçte ve odakta tarihini
 * söyler (`title` + aria); şeridin kendisi tek bir resim olarak okunur.
 */
export function RecessionHistory({
  share,
  nowMonth,
  locale,
  labels,
}: {
  /** 2027 resesyonu payı, metin ("%20"); yoksa null. */
  share: string | null;
  /** Okumanın ayı, "YYYY-MM". */
  nowMonth: string;
  locale: Locale;
  labels: HistoryLabels;
}) {
  const to = "2027-12";
  const spans = timelineSpans(NBER_RECESSIONS, HISTORY_FROM, to);
  const next = { left: timelineAt("2027-01", HISTORY_FROM, to), right: 100 };
  const now = timelineAt(nowMonth, HISTORY_FROM, to);
  const avg = averageMonths(NBER_RECESSIONS);
  const spanText = (r: Recession) =>
    labels.span
      .replace("{from}", monthYear(r.peak, locale))
      .replace("{to}", monthYear(r.trough, locale))
      .replace("{m}", String(recessionMonths(r)));
  const list = NBER_RECESSIONS.map(spanText).join("; ");
  return (
    <section className={styles.history} aria-label={labels.title}>
      <div className={styles.historyHead}>
        <h3>{labels.title}</h3>
        {avg !== null && (
          <span className="numeral">
            {labels.summary.replace("{n}", String(NBER_RECESSIONS.length)).replace("{m}", String(avg))}
          </span>
        )}
      </div>
      <div className={styles.historyTrack} role="img" aria-label={labels.aria.replace("{list}", list)}>
        {spans.map((s) => (
          <span
            key={s.recession.peak}
            className={styles.historySpan}
            title={spanText(s.recession)}
            style={{ left: `${s.left}%`, width: `${s.width}%` }}
          />
        ))}
        <span className={styles.historyNow} style={{ left: `${now}%` }} aria-hidden />
        <span className={styles.historyNext} data-tone="yes" style={{ left: `${next.left}%`, right: 0 }} aria-hidden />
        {share && (
          <span className={`${styles.historyNextLabel} numeral`} aria-hidden>
            {labels.next} <b>{share}</b>
          </span>
        )}
      </div>
      <div className={styles.historyAxis} aria-hidden>
        {DECADES.map((ym) => (
          <span key={ym} className="numeral" style={{ left: `${timelineAt(ym, HISTORY_FROM, to)}%` }}>
            {ym.slice(0, 4)}
          </span>
        ))}
      </div>
    </section>
  );
}
