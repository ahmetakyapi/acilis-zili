import type { CSSProperties } from "react";
import { CHIP_BASELINES, CHIP_GAP, CHIP_LINES, REFLECTION_SCALE, SKY_MODES, cityInk, type SkyLayout, type SkyMode, type SkyRow, type SkyStock } from "@/lib/day-skyline";
import { cn } from "@/lib/utils";
import styles from "./SkyMarks.module.css";

/**
 * Siluetin çizimi — sayfanın büyük sahnesi ve ana sayfanın şeridi AYNI
 * çizimi kullanıyor (`SkyScene.tsx`). Düz modül (`"use client"` değil):
 * sunucuda da istemcide de çiziliyor.
 *
 * ŞEHİR TABLOSU (25 Ekim, "Silüet" turu). Sahibi: "Çok sanatsal,
 * Awwwards'taki ödüllü siteler gibi; sınırları zorla." Sahne bir mürekkep
 * sahnesi sayılıyor (CLAUDE.md "Görsel dil": sahneler sitenin mavi degrade
 * dilinde serbest). Katmanlar, arkadan öne:
 *   - gök ve su HTML'de (`SkyScene.module.css`, `.sky`/`.water`): günün
 *     tonuna göre şafak ya da alacakaranlık, iki temada ayrı;
 *   - suda üç ince dalga çizgisi (durağan);
 *   - YANSIMA: yükselen binaların suya düşen kısa, sönen ikizi (tek yol,
 *     dikey çevrilmiş, `REFLECTION_SCALE`). Düşen binaların yansıması YOK:
 *     göğe çıkar ve "yükseldi" diye okunurdu (veri dürüstlüğü);
 *   - binalar mahalle başına birleşik yollar (`cityInk`), büyüklerde
 *     pencere ritmi (desen), her binanın ucunda ince çatı ışığı;
 *   - ufuk: iki ucu sönen ince ışık hattı;
 *   - çatılarda logo karosu, sembol ve yüzde (`SkyLabels`).
 *
 * Renkler token'dan (`var(--up)`, `--down`, `--primary*`, `--logo-plate`);
 * SVG `stop-color` ve `fill` CSS'ten okunuyor, tema değişince yeniden
 * çizim yok.
 */

/** Kimlik düzen ve sıra başına: telefonda iki-üç sıra ayrı SVG'ler. */
const idOf = (layout: SkyLayout, rowIndex: number, what: string) => `sky-${what}-${layout.mode}-${rowIndex}`;

/** Pencere deseni (birim): 1,4 × 2,2'lik pencere, 3,6 × 5 aralıkla. */
const WIN = { w: 1.4, h: 2.2, dx: 3.6, dy: 5 } as const;
/** Logo karosunun köşe yarıçapı — karonun kesri. */
const TILE_RADIUS = 0.26;
/** Dalga çizgilerinin derinliği (suyun kesri) ve kesik çizgi ritmi. */
const RIPPLES = [
  { at: 0.3, dash: "28 12 6 18" },
  { at: 0.56, dash: "16 22 40 14" },
  { at: 0.82, dash: "8 26 22 30" },
] as const;

export function SkyDefs({ layout, row, rowIndex }: { layout: SkyLayout; row: SkyRow; rowIndex: number }) {
  return (
    <defs>
      {row.labels.length > 0 && (
        <clipPath id={idOf(layout, rowIndex, "tile")} clipPathUnits="objectBoundingBox">
          <rect x={0} y={0} width={1} height={1} rx={TILE_RADIUS} ry={TILE_RADIUS} />
        </clipPath>
      )}
      <pattern id={idOf(layout, rowIndex, "win")} width={WIN.dx} height={WIN.dy} patternUnits="userSpaceOnUse">
        <rect className={styles.window} x={(WIN.dx - WIN.w) / 2} y={1} width={WIN.w} height={WIN.h} />
      </pattern>
      {/* Yansıma: ufukta yön renginin hafif tonu, derinde sıfır. Koordinat
          çevrilmeden önceki uzayda: ufuk 0, çatılar eksi. */}
      <linearGradient id={idOf(layout, rowIndex, "refl")} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={-row.upH}>
        <stop offset={0} className={styles.reflTop} />
        <stop offset={1} className={styles.reflEnd} />
      </linearGradient>
      <linearGradient id={idOf(layout, rowIndex, "hz")} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={layout.width} y2={0}>
        <stop offset={0} className={styles.hzEnd} />
        <stop offset={0.12} className={styles.hzMid} />
        <stop offset={0.88} className={styles.hzMid} />
        <stop offset={1} className={styles.hzEnd} />
      </linearGradient>
    </defs>
  );
}

export function SkyCity({
  layout,
  row,
  rowIndex,
  stocks,
  district,
  dimmed,
}: {
  layout: SkyLayout;
  row: SkyRow;
  rowIndex: number;
  stocks: SkyStock[];
  /** Öne çıkan mahalle (adına gelince); ötekiler sönüyor. */
  district?: string | null;
  /** Bir bina etkinken bütün şehir bir kademe sönüyor, etkin bina üstte. */
  dimmed?: boolean;
}) {
  const ink = cityInk(row, stocks);
  return (
    <g className={styles.city} data-dimmed={dimmed || undefined}>
      {RIPPLES.map((ripple) => (
        <line
          key={ripple.at}
          className={styles.ripple}
          x1={0}
          x2={layout.width}
          y1={row.downH * ripple.at}
          y2={row.downH * ripple.at}
          strokeDasharray={ripple.dash}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {ink.reflection && (
        <path
          className={styles.reflection}
          d={ink.reflection}
          transform={`scale(1 ${-REFLECTION_SCALE})`}
          fill={`url(#${idOf(layout, rowIndex, "refl")})`}
        />
      )}
      {ink.districts.map((d) => (
        <g
          key={d.key}
          className={styles.district}
          data-sky-building=""
          data-off={district && district !== d.key ? "" : undefined}
          style={{ "--d": `${d.delay.toFixed(3)}s` } as CSSProperties}
        >
          {d.up && <path className={styles.up} d={d.up} />}
          {d.down && <path className={styles.down} d={d.down} />}
          {d.flat && <path className={styles.flat} d={d.flat} />}
          {d.windows && <path d={d.windows} fill={`url(#${idOf(layout, rowIndex, "win")})`} />}
          {d.roofs && <path className={styles.roof} d={d.roofs} />}
        </g>
      ))}
      <line
        className={styles.horizon}
        x1={0}
        x2={layout.width}
        y1={0}
        y2={0}
        stroke={`url(#${idOf(layout, rowIndex, "hz")})`}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** Sembolün baş harfleri — logo yoksa. */
const INITIALS = 2;
/** Bağ çizgisinin çatıdaki noktası (birim). */
const ANCHOR_R = 2.4;
/** Tam etikette sembol ve yüzdenin taban çizgileri (karonun altından, punto katı). */
const FULL_BASELINES = [0.95, 2.1] as const;

/**
 * Çatı etiketleri. Yeri ve ölçüsü yerleşimden (`placeLabels`,
 * lib/day-skyline.ts): kutular birbirine ve binalara binmiyor, her etiket
 * binasının ekseninde (en çok `LABEL_MAX_SHIFT` kayık). Etiket çatısına
 * oturmuyorsa çatıdan etikete dik bağ çizgisi ve çatıda küçük bir nokta:
 * eskiden `--line-strong` tonunda kıl çizgiydi ve 1440'ta görünmüyordu
 * (sahibi: "Micron sağda ama grafikte solda kalıyor gibi"). Burada yalnız
 * kutunun içi: köşeleri yumuşak logo KAROSU (depodaki 128 piksellik webp,
 * `public/logos/`, zemini `--logo-plate`: koyu temada da beyaz plaka),
 * altında sembol ve yüzde (yön renginde). Logosu depoda olmayan şirkette
 * sembolün iki harfi.
 *
 * TELEFONDA ÇİP (`label: "chip"`, 25 Ekim "Silüet: mobil" turu): karo
 * solda, sembol ve yüzde sağında iki satır. Logo-üstte etiket 58 birim
 * boyundaydı ve telefonun üç sırasında her sıraya iki kat etiket boyu
 * ekliyordu; çip 31 birim, sahne ~%30 alçak. Bedeli en: yan yana iki çip
 * daha geniş aralık istiyor, sığmayan düşüyor (öncelik `labelPicks`).
 */
export function SkyLabels({
  layout,
  row,
  rowIndex,
  stocks,
  logos,
  pct,
  district,
  active,
  muted,
  hideMuted,
}: {
  layout: SkyLayout;
  row: SkyRow;
  rowIndex: number;
  stocks: SkyStock[];
  logos: Record<string, string>;
  pct?: (value: number) => string;
  district?: string | null;
  active?: number | null;
  /** Bir değer etiketinin altında kalan etiketler (o an sönük). */
  muted?: ReadonlySet<number> | null;
  /** Telefonda sönük değil, gizli: etiket ya tam görünür ya hiç. */
  hideMuted?: boolean;
}) {
  if (row.labels.length === 0) return null;
  const mode: SkyMode = SKY_MODES[layout.mode];
  const size = mode.logo;
  const chip = mode.label === "chip";
  const full = mode.label === "full" || chip;
  const radius = size * TILE_RADIUS;
  return (
    <g className={styles.labels}>
      {row.labels.map((label) => {
        const stock = stocks[label.i];
        const cx = label.x + label.w / 2;
        /* Karonun sol üstü ve yazının ekseni/taban çizgileri: çipte karo
           solda dikey ortalı, yazı sağında; tam etikette karo üstte ortalı. */
        const tx = chip ? label.x : cx - size / 2;
        const ty = chip ? label.y + (label.h - size) / 2 : label.y;
        const textX = chip ? label.x + size + CHIP_GAP : cx;
        const anchor = chip ? "start" : "middle";
        const top = chip ? label.y + (label.h - mode.font * CHIP_LINES) / 2 : label.y + size + 2;
        const [line1, line2] = chip ? CHIP_BASELINES : FULL_BASELINES;
        const logo = logos[stock.symbol];
        const tone = stock.change > 0 ? styles.up : stock.change < 0 ? styles.down : styles.flat;
        return (
          <g
            key={label.i}
            className={styles.label}
            data-sky-label=""
            data-off={(district && district !== stock.district) || (!hideMuted && muted?.has(label.i)) ? "" : undefined}
            data-hidden={(hideMuted && muted?.has(label.i)) || undefined}
            data-on={active === label.i || undefined}
          >
            {label.leader && (
              <>
                <line
                  className={styles.leader}
                  x1={label.leader.x1}
                  y1={label.leader.y1}
                  x2={label.leader.x2}
                  y2={label.leader.y2}
                  vectorEffect="non-scaling-stroke"
                />
                <circle className={styles.anchor} cx={label.leader.x1} cy={label.leader.y1} r={ANCHOR_R} />
              </>
            )}
            <g className={styles.mark} data-sky-mark="">
              <rect className={styles.tile} x={tx} y={ty} width={size} height={size} rx={radius} ry={radius} />
              {logo ? (
                <image
                  href={logo}
                  x={tx}
                  y={ty}
                  width={size}
                  height={size}
                  clipPath={`url(#${idOf(layout, rowIndex, "tile")})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text className={styles.initials} x={tx + size / 2} y={ty + size / 2} fontSize={size * 0.36} dy="0.35em" textAnchor="middle">
                  {stock.symbol.slice(0, INITIALS)}
                </text>
              )}
              {full && (
                <text className={styles.symbol} x={textX} y={top + mode.font * line1} fontSize={mode.font} textAnchor={anchor}>
                  {stock.symbol}
                </text>
              )}
              {full && pct && (
                <text className={cn(styles.value, tone)} x={textX} y={top + mode.font * line2} fontSize={mode.font} textAnchor={anchor}>
                  {pct(stock.change)}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
