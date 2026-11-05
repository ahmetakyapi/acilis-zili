import { cn } from "@/lib/utils";
import styles from "./MiniGauges.module.css";

/**
 * KÜÇÜK ÖLÇÜ ÇİZİMLERİ — kartların gösterge şeridi için ortak dil
 * (5 Kasım 2026, sahibinin isteği: "her kart çok daha görsel, design system
 * ile ortak").
 *
 * Teknik kartın göstergeleri üç kıl çizgiydi: RSI 30/70 çentikli bir çizgi
 * üstünde nokta, hacim 1× çentikli bir ölçek. Okunuyordu ama "veri bir
 * çizimle okunur" kuralının en zayıf yeriydi — 2 piksellik çizgi kartın
 * dibinde bir ayraç gibi duruyordu. Sitenin kendi çizim dilinden iki ilke:
 *
 *  · `ArcGauge` — yarım HALKA (puan halkasının kardeşi, `ring-fill`):
 *    kulvar `--line-soft`, eşik bölgeleri kendi yön tonunun yıkamasında,
 *    değer 5 piksellik şeritle çiziliyor ve ucunda nokta. Görünüme girince
 *    halka gibi sıfırdan değerine dolar (MotionExperience `.ring-fill`i
 *    izliyor); hareketi azaltana son hâl.
 *  · `StepBars` — BASAMAK ÇUBUKLARI: oran eşiklere göre kaç basamak
 *    yaktıysa o kadar dolu. Ölçeğin ortası (1×, "olağan") üçüncü basamak.
 *
 * Renk anlam taşır: değer şeridi nötr mürekkep; yalnız eşik aşılınca yön
 * rengine döner (çağıran `tone` verir). Çizimler `aria-hidden` — sayının
 * kendisi ve sözel karşılığı yanında metin olarak duruyor.
 */

type Tone = "up" | "down" | "primary" | "muted" | undefined;

/** Yarım halkada kesir → nokta (merkez 32,31; yarıçap 25). */
const R = 25;
const CX = 32;
const CY = 31;
function point(fraction: number): [number, number] {
  const angle = Math.PI * (1 - fraction);
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)];
}
function arc(from: number, to: number): string {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
/** Yarım halkanın uzunluğu — çizilme animasyonunun ölçüsü. */
const HALF = Math.PI * R;

export function ArcGauge({
  value,
  min = 0,
  max = 100,
  low,
  high,
  tone,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  /** Alt eşik (RSI'da 30): altı yükseliş yıkamasıyla. */
  low?: number;
  /** Üst eşik (RSI'da 70): üstü düşüş yıkamasıyla. */
  high?: number;
  tone?: Tone;
  className?: string;
}) {
  const span = max - min || 1;
  const f = Math.min(1, Math.max(0, (value - min) / span));
  const lowF = low === undefined ? null : (low - min) / span;
  const highF = high === undefined ? null : (high - min) / span;
  const [dx, dy] = point(f);
  const length = HALF * f;
  return (
    <svg viewBox="0 0 64 36" className={cn(styles.arc, className)} data-tone={tone} aria-hidden>
      <path d={arc(0, 1)} className={styles.arcTrack} />
      {lowF !== null && <path d={arc(0, lowF)} className={styles.arcZoneLow} />}
      {highF !== null && <path d={arc(highF, 1)} className={styles.arcZoneHigh} />}
      {f > 0.004 && (
        <path
          d={arc(0, f)}
          className={cn("ring-fill", styles.arcValue)}
          style={{
            strokeDasharray: `${length.toFixed(2)} ${HALF.toFixed(2)}`,
            ["--ring-circumference" as string]: `${length.toFixed(2)}`,
          }}
        />
      )}
      <circle cx={dx} cy={dy} r={3.6} className={cn("spark-dot", styles.arcDot)} />
    </svg>
  );
}

/** Varsayılan eşikler: 0,4× · 0,8× · 1,2× · 1,8× · 2,5× — üçüncüsü "olağan". */
const DEFAULT_STEPS = [0.4, 0.8, 1.2, 1.8, 2.5];

export function StepBars({
  value,
  steps = DEFAULT_STEPS,
  tone,
  className,
}: {
  value: number;
  steps?: readonly number[];
  tone?: Tone;
  className?: string;
}) {
  const lit = steps.filter((step) => value >= step).length;
  const width = steps.length * 7 - 3;
  return (
    <svg viewBox={`0 0 ${width} 20`} className={cn(styles.bars, className)} data-tone={tone} aria-hidden>
      {steps.map((step, index) => {
        const h = 6 + index * 3.5;
        return (
          <rect
            key={step}
            x={index * 7}
            y={20 - h}
            width={4}
            height={h}
            rx={1.5}
            className={index < lit ? styles.barOn : styles.barOff}
            style={{ animationDelay: `${index * 60}ms` }}
          />
        );
      })}
    </svg>
  );
}
