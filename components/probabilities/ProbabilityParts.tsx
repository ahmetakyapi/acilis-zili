import type { CSSProperties } from "react";
import { etParts } from "@/lib/market-hours";
import { percentShares, wholePercent, type FedSide, type PathStep } from "@/lib/probabilities";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
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

export type StackSegment = { key: string; label: string; p: number };

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
 * `legend="scale"` (Fed): künye beş eşit sütunlu bir ölçek, her sütunda
 * kısa ad ve altında sayı; sıra çubuğun sırası. Beş uzun ad ("25 bp'den
 * Büyük İndirim") iki-üç satıra dökülüp kartı uzatıyordu.
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
        <ul className={styles.scale} aria-hidden style={{ "--cols": segments.length } as CSSProperties}>
          {segments.map((s) => (
            <li key={s.key} data-tone={s.key} data-lead={lead === s.key || undefined}>
              <span><i />{s.label}</span>
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
  sides: Record<FedSide, string>;
};

/**
 * Beklenen faiz patikası. Sütun başına toplantı; ilk sütun bugün.
 * Noktanın dikey yeri beklenen düzey (ölçek patikanın kendi aralığı ve
 * bugün, iki yanda pay): mutlak ölçek değil, YÖN ve büyüklük karşılaştırması
 * için — her noktanın üstünde sayısı yazılı, okunan şey o.
 */
export function RatePath({
  steps,
  current,
  locale,
  dateOf,
  labels,
}: {
  steps: PathStep[];
  /** Bugünkü hedef aralığın ortası (%); yoksa patika bp değişimi olarak çizilir. */
  current: number | null;
  locale: Locale;
  dateOf: (iso: string | null) => string;
  labels: PathLabels;
}) {
  if (steps.length === 0) return null;
  const level = (step: PathStep | null) => (current === null ? (step ? step.cumulativeBps : 0) : step ? step.expectedMid ?? current : current);
  const values = [level(null), ...steps.map(level)];
  const low = Math.min(...values);
  const high = Math.max(...values);
  /* Aralık çok darsa (hepsi "sabit") nokta kutunun ortasında düz durur;
     en az 25 bp'lik (ya da 0,25 puan) bir pencere, tek indirimin boyu. */
  const minSpan = current === null ? 25 : 0.25;
  const span = Math.max(high - low, minSpan);
  const center = (high + low) / 2;
  /* Üstte daha geniş pay: noktanın üstündeki sayı kutudan çıkmasın
     (ölçüldü: 0,62 payla en yüksek noktanın künyesi başlığa değiyordu). */
  const top = center + span * 0.85;
  const bottom = center - span * 0.6;
  const yOf = (value: number) => ((top - value) / (top - bottom)) * 100;
  const format = (value: number) =>
    current === null
      ? labels.bps.replace("{n}", `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPrice(Math.abs(value), locale, { digits: 0 })}`)
      : formatPercentPlain(value, locale, 2);
  const cols = steps.length + 1;
  const points = values.map((value, i) => `${((i + 0.5) / cols) * 100},${yOf(value)}`).join(" ");
  const bp = (value: number) =>
    labels.bps.replace("{n}", `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPrice(Math.abs(value), locale, { digits: 1 })}`);

  return (
    <div className={styles.path} role="group" aria-label={labels.aria}>
      <div className={styles.pathWrap}>
      <svg className={styles.pathLine} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <line x1="0" x2="100" y1={yOf(values[0])} y2={yOf(values[0])} vectorEffect="non-scaling-stroke" />
        <polyline points={points} className="spark-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <ol className={styles.pathGrid} style={{ "--cols": cols } as CSSProperties}>
        <li className={styles.pathCol} data-today tabIndex={0} aria-label={`${labels.today}: ${format(values[0])}`}>
          <div className={styles.pathPlot}>
            <span className={styles.pathDot} style={{ top: `${yOf(values[0])}%` }} />
            <span className={`${styles.pathValue} numeral`} style={{ top: `${yOf(values[0])}%` }}>{format(values[0])}</span>
          </div>
          {/* Bugünün olasılığı yok: yığının yeri boş tutulur (hiza). */}
          <span className={styles.pathStack} data-empty aria-hidden />
          <span className={styles.pathDate}>{labels.today}</span>
        </li>
        {steps.map((step, i) => {
          const value = values[i + 1];
          const date = dateOf(step.strikeAt);
          const sides = SIDES.map((side) => `${labels.sides[side]} ${pct(step.sides[side], locale)}`).join(", ");
          return (
            <li
              key={step.eventTicker}
              className={styles.pathCol}
              data-thin={step.liquidity === "thin" || undefined}
              tabIndex={0}
              aria-label={`${date}: ${labels.expected} ${format(value)}; ${sides}${step.liquidity === "thin" ? `; ${labels.thin}` : ""}`}
            >
              <div className={styles.pathPlot}>
                <span className={styles.pathDot} style={{ top: `${yOf(value)}%` }} />
                <span className={`${styles.pathValue} numeral`} style={{ top: `${yOf(value)}%` }}>{format(value)}</span>
              </div>
              <span className={styles.pathStack} aria-hidden data-motion-draw="bar">
                {SIDES.map((side) =>
                  step.sides[side] >= 0.005 ? <span key={side} data-tone={side} style={{ flexGrow: step.sides[side], flexBasis: 0 }} /> : null,
                )}
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
