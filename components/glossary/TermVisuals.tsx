import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GlyphTile } from "@/components/article/GlyphTile";
import type { GlossaryConcept } from "@/content/glossary/visuals";
import styles from "./Glossary.module.css";

/* ==========================================================================
   Terim sayfasının iki çizimi — ikisi de sunucuda, istemciye JS inmiyor.
   Hareket `MotionExperience`in ortak kalıplarından: çizgiler
   `data-motion-draw="arc"` ile uçtan uca çiziliyor, düğümler
   `data-motion-stagger` ile sırayla geliyor. İlk ekranda kalan çizim
   kıpırdamıyor (kökün kuralı), JavaScript yoksa tam çizili duruyor.
   ========================================================================== */

/** Ağın yatay ve dikey yarıçapı, kabın yüzdesi olarak. */
const NETWORK_RX = 36;
const NETWORK_RY = 37;
/** Tam tur, derece. */
const TURN = 360;

export type NetworkNode = {
  slug: string;
  term: string;
  glyph: string;
  /** Başka kategorideyse onun adı; aynı kategorideyse boş. */
  category: string | null;
};

/**
 * İlişkili terimler AĞ olarak: terim ortada, komşuları çevresinde ve her
 * biri bir çizgiyle bağlı. Çip bulutu "bunlar da var" diyordu; ağ "bunlar
 * BUNA bağlı" diyor, sözlüğün ilişki dizisinin kendisi zaten bu.
 *
 * Yerleşim sunucuda hesaplanıyor: düğümler eşit açılarla dağılıyor ve
 * başlangıç açısı sayıya göre seçiliyor (iki düğüm sağ-sol, dört düğüm
 * köşegen), böylece hiçbir sayıda iki düğüm üst üste binmiyor. 640
 * pikselin altında ağ dikey bir dala dönüyor: uzun adlar ("Seyreltilmiş
 * Hisse Başı Kâr") bir çemberin üstüne telefonda sığmıyor.
 */
export function TermNetwork({
  center,
  glyph,
  nodes,
}: {
  center: string;
  glyph: string;
  nodes: NetworkNode[];
}) {
  const count = nodes.length;
  const start = count === 2 ? 0 : count === 4 ? -45 : -90;
  const points = nodes.map((_, index) => {
    const angle = ((start + (index * TURN) / count) * Math.PI) / (TURN / 2);
    return { x: 50 + NETWORK_RX * Math.cos(angle), y: 50 + NETWORK_RY * Math.sin(angle) };
  });

  return (
    <div className={styles.network}>
      {/* ÇİZGİLER SVG DEĞİL, KAP BİRİMLİ ŞERİTLER. Esnek bir SVG
          (`preserveAspectRatio="none"`) kalınlığı eksene göre farklı
          geriyordu; `non-scaling-stroke` ise çizimin kesik uzunluğunu
          bozuyor (globals.css → .spark-line). Şerit kabın gerçek ölçüsüyle
          (`cqw`/`cqh`) boylanıp açılanıyor ve `data-motion-draw="line"`
          onu merkezden dışa doğru uzatıyor. */}
      {points.map((point, index) => (
        <span
          key={nodes[index].slug}
          aria-hidden
          className={styles.networkLine}
          data-motion-draw="line"
          style={{ "--dx": (point.x - 50).toFixed(2), "--dy": (point.y - 50).toFixed(2) } as CSSProperties}
        />
      ))}
      <div aria-hidden className={styles.networkCenter}>
        <GlyphTile glyph={glyph} size={40} />
        <span>{center}</span>
      </div>
      <ul className={styles.networkNodes} data-motion-stagger>
        {nodes.map((node, index) => (
          <li
            key={node.slug}
            style={{ "--x": `${points[index].x}%`, "--y": `${points[index].y}%` } as CSSProperties}
          >
            <Link href={`/sozluk/${node.slug}`} prefetch={false} className={styles.networkNode}>
              <span aria-hidden className={styles.networkGlyph}>{node.glyph}</span>
              <span className="min-w-0">
                <span className={styles.networkTerm}>{node.term}</span>
                {node.category && <span className={styles.networkCategory}>{node.category}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kavram çiziminin tuvali (SVG birimi). */
const VIEW_W = 320;
const VIEW_H = 180;

type ConceptLabels = {
  maturity: string;
  yield: string;
  short: string;
  long: string;
  overbought: string;
  oversold: string;
  neutral: string;
};

/**
 * Sayısız kavram çizimi. Eksenlerde değer YOK: bu çizimler bir seriyi değil
 * bir ŞEKLİ gösteriyor (eğri yukarı mı eğimli, aşağı mı; RSI'ın eşikleri
 * nerede). Tek sayılar RSI'ın 0-30-70-100 eşikleri ve onlar tanımın
 * kendisinde yazılı. Altındaki not bunu okuyucuya da söylüyor.
 */
export function ConceptVisual({
  concept,
  focus,
  labels,
  title,
}: {
  concept: GlossaryConcept;
  focus?: "high" | "low";
  labels: ConceptLabels;
  title: string;
}) {
  if (concept === "rsi-bands") {
    /* Ölçek yukarıdan aşağı 100 → 0; bant sınırları eşiklerin yeri. */
    const top = 16;
    const bottom = 156;
    const y = (value: number) => bottom - ((bottom - top) * value) / 100;
    const bands = [
      { from: 70, to: 100, label: labels.overbought, on: focus === "high" },
      { from: 30, to: 70, label: labels.neutral, on: false },
      { from: 0, to: 30, label: labels.oversold, on: focus === "low" },
    ];
    return (
      <svg role="img" aria-label={title} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.concept}>
        {bands.map((band) => (
          <g key={band.from} data-on={band.on || undefined} className={styles.conceptBand}>
            <rect x="34" y={y(band.to)} width="196" height={y(band.from) - y(band.to)} rx="6" />
            {/* Etiket bandın DIŞINDA, sağda: çizgi bandın içinde dolaşıyor
                ve etiketin üstünden geçiyordu. */}
            <text x="240" y={(y(band.to) + y(band.from)) / 2 + 4}>
              {band.label}
            </text>
          </g>
        ))}
        {[0, 30, 70, 100].map((tick) => (
          <text key={tick} x="26" y={y(tick) + 4} textAnchor="end" className={styles.conceptTick}>
            {tick}
          </text>
        ))}
        <path
          className={styles.conceptLine}
          d={`M40 ${y(45)} C 60 ${y(20)}, 78 ${y(22)}, 96 ${y(48)} S 134 ${y(88)}, 156 ${y(76)} S 196 ${y(38)}, 224 ${y(56)}`}
          pathLength={1}
          data-motion-draw="arc"
        />
      </svg>
    );
  }

  const inverted = concept === "curve-inverted";
  /* Eğri kısa vadeden uzuna; normalde yükseliyor, tersinde iniyor. */
  const d = inverted
    ? "M44 52 C 90 70, 150 104, 300 116"
    : "M44 132 C 90 84, 150 62, 300 52";
  const dots = inverted ? [[44, 52], [104, 78], [180, 102], [300, 116]] : [[44, 132], [104, 88], [180, 66], [300, 52]];
  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.concept}>
      <path className={styles.conceptAxis} d="M34 14 V150 H306" />
      <text x="40" y="12" className={styles.conceptAxisLabel}>{labels.yield}</text>
      <text x="44" y="170" className={styles.conceptTick}>{labels.short}</text>
      <text x="170" y="170" textAnchor="middle" className={styles.conceptAxisLabel}>{labels.maturity}</text>
      <text x="300" y="170" textAnchor="end" className={styles.conceptTick}>{labels.long}</text>
      <path className={styles.conceptLine} d={d} pathLength={1} data-motion-draw="arc" />
      {dots.map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="4.5" className={`${styles.conceptDot} spark-dot`} />
      ))}
    </svg>
  );
}
