import { SKY_MODES, type SkyLayout, type SkyRow, type SkyStock } from "@/lib/day-skyline";
import { cn } from "@/lib/utils";
import styles from "./SkyMarks.module.css";

/**
 * Siluetin çatı etiketleri — sayfanın etkileşimli sahnesi (`Skyline.tsx`)
 * ve ana sayfanın şeridi (`SkylineStrip.tsx`) AYNI çizimi kullanıyor. Düz
 * modül (`"use client"` değil): sunucuda da istemcide de çiziliyor.
 *
 * Etiketin yeri ve ölçüsü yerleşimden (`placeLabels`, lib/day-skyline.ts):
 * kutular birbirine ve binalara binmiyor. Burada yalnız kutunun içi:
 * yuvarlak logo (depodaki 128 piksellik webp, `public/logos/`), altında
 * sembol ve yüzde. Logosu depoda olmayan şirkette sembolün iki harfi.
 */

/** Logonun kırpma çemberi — `objectBoundingBox`: her logoya tek tanım. */
export function SkyDefs({ layout, row, rowIndex }: { layout: SkyLayout; row: SkyRow; rowIndex: number }) {
  if (row.labels.length === 0) return null;
  return (
    <defs>
      <clipPath id={clipId(layout, rowIndex)} clipPathUnits="objectBoundingBox">
        <circle cx={0.5} cy={0.5} r={0.5} />
      </clipPath>
    </defs>
  );
}

/** Kimlik düzen ve sıra başına: telefonda üç sıra üç ayrı SVG. */
const clipId = (layout: SkyLayout, rowIndex: number) => `sky-logo-${layout.mode}-${rowIndex}`;

/** Sembolün baş harfleri — logo yoksa. */
const INITIALS = 2;

export function SkyLabels({
  layout,
  row,
  rowIndex,
  stocks,
  logos,
  pct,
  className,
}: {
  layout: SkyLayout;
  row: SkyRow;
  rowIndex: number;
  stocks: SkyStock[];
  logos: Record<string, string>;
  pct?: (value: number) => string;
  className?: string;
}) {
  if (row.labels.length === 0) return null;
  const mode = SKY_MODES[layout.mode];
  const r = mode.logo / 2;
  const full = mode.label === "full";
  return (
    <g className={cn(styles.labels, className)}>
      {row.labels.map((label) => {
        const stock = stocks[label.i];
        const cx = label.x + label.w / 2;
        const logo = logos[stock.symbol];
        const tone = stock.change > 0 ? styles.up : stock.change < 0 ? styles.down : styles.flat;
        return (
          <g key={label.i} className={styles.label} data-sky-label="">
            {label.leader && (
              <line
                className={styles.leader}
                x1={label.leader.x1}
                y1={label.leader.y1}
                x2={label.leader.x2}
                y2={label.leader.y2}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle className={styles.ring} cx={cx} cy={label.y + r} r={r + 0.8} />
            {logo ? (
              <image
                href={logo}
                x={cx - r}
                y={label.y}
                width={mode.logo}
                height={mode.logo}
                clipPath={`url(#${clipId(layout, rowIndex)})`}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : (
              <text className={styles.initials} x={cx} y={label.y + r} fontSize={mode.logo * 0.38} dy="0.35em" textAnchor="middle">
                {stock.symbol.slice(0, INITIALS)}
              </text>
            )}
            {full && (
              <>
                <text className={styles.symbol} x={cx} y={label.y + mode.logo + 2 + mode.font * 0.95} fontSize={mode.font} textAnchor="middle">
                  {stock.symbol}
                </text>
                {pct && (
                  <text className={cn(styles.value, tone)} x={cx} y={label.y + mode.logo + 2 + mode.font * 2.1} fontSize={mode.font} textAnchor="middle">
                    {pct(stock.change)}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
