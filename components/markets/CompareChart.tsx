import { cn } from "@/lib/utils";

/**
 * Normalize edilmiş karşılaştırma grafiği.
 *
 * İki hissenin fiyatını aynı eksende çizmek anlamsızdır: 800 dolarlık bir
 * hisse 40 dolarlık bir hissenin yanında düz çizgi gibi görünür. Bu yüzden
 * her seri kendi BAŞLANGICINA göre yüzdeye çevriliyor — hepsi sıfırdan
 * başlıyor ve grafikte okunan tek şey "dönem boyunca kim ne kadar getirdi".
 *
 * Sunucuda SVG olarak çizilir; istemciye ek JS inmez. Renkler token'lardan
 * gelir, hardcoded hex yok.
 */

export type CompareSeries = {
  symbol: string;
  /** Kapanış dizisi; en az iki nokta. */
  closes: number[];
};

/** Seri renkleri — accent'ten başlayıp ayırt edilebilir dört tona gider. */
const SERIES_COLORS = [
  "var(--primary)",
  "var(--brass)",
  "var(--up)",
  "var(--down)",
];

const WIDTH = 720;
const HEIGHT = 200;
const PAD_Y = 12;

export function CompareChart({
  series,
  className,
  title,
}: {
  series: CompareSeries[];
  className?: string;
  title: string;
}) {
  const usable = series.filter((entry) => entry.closes.length >= 2);
  if (usable.length === 0) return null;

  // Her seri kendi ilk değerine göre yüzdeye çevrilir.
  const normalized = usable.map((entry) => {
    const base = entry.closes[0] || 1;
    return {
      symbol: entry.symbol,
      points: entry.closes.map((close) => ((close - base) / base) * 100),
    };
  });

  const all = normalized.flatMap((entry) => entry.points);
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 0);
  const span = max - min || 1;

  const yOf = (value: number) =>
    PAD_Y + (1 - (value - min) / span) * (HEIGHT - PAD_Y * 2);
  const zeroY = yOf(0);

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="scroll-x -mx-1 px-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
          className="min-w-[520px]"
        >
          {/* Sıfır çizgisi — bütün serilerin ortak başlangıcı. */}
          <line
            x1={0}
            x2={WIDTH}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--line-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {normalized.map((entry, index) => {
            const step = WIDTH / Math.max(1, entry.points.length - 1);
            const d = entry.points
              .map(
                (value, i) =>
                  `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${yOf(value).toFixed(2)}`,
              )
              .join(" ");
            return (
              <path
                key={entry.symbol}
                d={d}
                fill="none"
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={1.9}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
        {normalized.map((entry, index) => {
          const last = entry.points[entry.points.length - 1];
          return (
            <span key={entry.symbol} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="block size-2 rounded-full"
                style={{
                  background: SERIES_COLORS[index % SERIES_COLORS.length],
                }}
              />
              <span className="numeral font-bold text-strong">
                {entry.symbol}
              </span>
              <span
                className={cn(
                  "numeral font-semibold",
                  last > 0 ? "text-up" : last < 0 ? "text-down" : "text-muted",
                )}
              >
                {last > 0 ? "+" : ""}
                {last.toFixed(1)}%
              </span>
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
