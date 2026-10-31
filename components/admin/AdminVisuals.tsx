import type { HealthTone } from "@/components/admin/AdminUI";
import styles from "./AdminVisuals.module.css";

/**
 * Yönetim panelinin çizimleri (31 Ekim) — sayı tek başına durmasın, bir de
 * çizgi olarak okunsun (sahibinin isteği: "admin panelini de çok daha
 * görsel"). Hepsi sunucu bileşeni ve saf SVG/CSS; veri sayfanın zaten
 * okuduğu seriden gelir, uydurma nokta eklenmez.
 *
 * Renk anlam taşır: büyüklük yumuşak mavi (`--primary`), durum yön renkleri
 * (`--up`/`--brass`/`--down`). Degrade yok — veri panelleri taşımaz.
 */

/** Tepe şeridinin sınıfı ve tonu — `AdminPanel` ve `StatBox` aynı jesti paylaşıyor. */
export const TONED = styles.toned;

/**
 * Küçük çizgi — iki ardışık pencere: önceki soluk, güncel mavi.
 *
 * Kutunun "Son 7 Tam Gün" sayısı ile yanındaki yüzde, bu çizginin iki
 * yarısının toplamları; okuyucu yüzdenin NEREDEN geldiğini (tek bir sıçrama
 * mı, düzenli bir artış mı) çizgiden görüyor. Ölçülmemiş günler (`null`)
 * çizilmiyor, sıfır sayılmıyor.
 */
export function Sparkline({
  values,
  split,
  label,
}: {
  values: readonly (number | null)[];
  /** Güncel pencerenin başladığı sıra; öncesi soluk çizilir. */
  split: number;
  /** Ekran okuyucu cümlesi — çizimin söylediği. */
  label: string;
}) {
  const n = values.length;
  const nums = values.filter((v): v is number => v !== null);
  if (n < 2 || nums.length < 2) return null;
  const max = Math.max(...nums, 1);
  /* Üstte ve altta 2 birim pay: çizgi kutunun kenarına yapışmasın. */
  const H = 28;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => H - 2 - (v / max) * (H - 4);

  const path = (from: number, to: number) => {
    let d = "";
    let pen = false;
    for (let i = from; i <= to; i++) {
      const v = values[i];
      if (v === null || v === undefined) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
      pen = true;
    }
    return d;
  };

  const s = Math.min(Math.max(split, 0), n - 1);
  const prev = path(0, s);
  const curr = path(s, n - 1);
  /* Güncel pencerenin altı açık bir alan: göz yüzdenin kapsadığı yeri seçsin. */
  const currPoints = values
    .map((v, i) => (i >= s && v !== null ? [x(i), y(v)] : null))
    .filter((p): p is number[] => p !== null);
  const area =
    currPoints.length > 1
      ? `M${currPoints[0][0]},${H}` +
        currPoints.map(([px, py]) => `L${px.toFixed(2)},${py.toFixed(2)}`).join("") +
        `L${currPoints[currPoints.length - 1][0]},${H}Z`
      : "";
  const lastIndex = values.findLastIndex((v) => v !== null);
  const last = values[lastIndex] as number;

  return (
    <span className={styles.spark} role="img" aria-label={label}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden>
        <line className={styles.sparkTrack} x1="0" x2="100" y1={H - 0.5} y2={H - 0.5} vectorEffect="non-scaling-stroke" />
        {area && <path className={styles.sparkArea} d={area} />}
        <line
          className={styles.sparkSplit}
          x1={x(s)}
          x2={x(s)}
          y1="0"
          y2={H}
          vectorEffect="non-scaling-stroke"
        />
        {prev && <path className={styles.sparkPrev} d={prev} vectorEffect="non-scaling-stroke" />}
        {curr && (
          <path
            className={styles.sparkCurr}
            d={curr}
            vectorEffect="non-scaling-stroke"
            pathLength={1}
          />
        )}
      </svg>
      <span
        aria-hidden
        className={styles.sparkDot}
        style={{ "--x": `${x(lastIndex)}%`, "--y": `${(y(last) / H) * 100}%` } as React.CSSProperties}
      />
    </span>
  );
}

/**
 * Pay halkası — bir bütünün ne kadarı. Yanında yüzde METİN olarak da yazılır
 * (renk ve şekil tek başına bilgi taşımaz); halka yalnızca payın göze
 * hemen oturan hâli.
 */
export function ShareRing({
  value,
  total,
  size = 22,
  stroke = 3.5,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  return (
    <svg className={styles.ring} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
      {share > 0 && (
        <circle
          className={styles.ringFill}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={`${(share * c).toFixed(2)} ${c.toFixed(2)}`}
        />
      )}
    </svg>
  );
}

/** Yoklama şeridinde tonların sırası — sorunlu önce. */
const PULSE_ORDER: readonly HealthTone[] = ["down", "warn", "info", "idle", "ok"];
const PULSE_WORD: Record<HealthTone, string> = {
  down: "Sorunlu",
  warn: "Dikkat",
  info: "Koşullu",
  idle: "Beklemede",
  ok: "Sağlıklı",
};

/**
 * Yoklama şeridi — bütün sağlık yoklamaları, her biri bir parça.
 *
 * "Dikkat İsteyenler" yalnız sorunluları listeliyor; listenin kısalığı
 * "yoklama az" ile "yoklamaların çoğu sağlıklı"yı ayırt etmiyordu. Şerit
 * bütünü gösteriyor: kaç yoklama var, kaçı hangi durumda. Sorunlu parçalar
 * başta, göz önce onlara takılıyor.
 */
export function HealthPulse({ tones, className }: { tones: readonly HealthTone[]; className?: string }) {
  if (tones.length === 0) return null;
  const sorted = [...tones].sort((a, b) => PULSE_ORDER.indexOf(a) - PULSE_ORDER.indexOf(b));
  const counts = PULSE_ORDER.map((tone) => [tone, tones.filter((t) => t === tone).length] as const).filter(
    ([, count]) => count > 0,
  );
  const summary = counts.map(([tone, count]) => `${count} ${PULSE_WORD[tone].toLocaleLowerCase("tr-TR")}`).join(", ");
  return (
    <div className={className}>
      <div className={styles.pulse} role="img" aria-label={`${tones.length} yoklama: ${summary}`}>
        {sorted.map((tone, i) => (
          <i key={i} data-tone={tone} />
        ))}
      </div>
      <p className={styles.pulseLegend} aria-hidden>
        {counts.map(([tone, count]) => (
          <span key={tone}>
            <i data-tone={tone} />
            <b>{count.toLocaleString("tr-TR")}</b> {PULSE_WORD[tone]}
          </span>
        ))}
      </p>
    </div>
  );
}
