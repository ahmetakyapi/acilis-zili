/**
 * Sunucuda çizilen mini eğri — istemci JS'i yok.
 * Tek seri olduğu için lejant gerekmez; başlık seriyi adlandırır.
 */

type Point = { value: number };

export function Sparkline({
  points,
  width = 240,
  height = 56,
  title,
  /** Token adı: nötr seriler "primary", fiyat yönü için "up"/"down". */
  tone = "primary",
  strokeWidth = 2,
  showLastDot = true,
  className,
}: {
  points: Point[];
  width?: number;
  height?: number;
  title: string;
  tone?: "primary" | "up" | "down" | "flat";
  strokeWidth?: number;
  showLastDot?: boolean;
  className?: string;
}) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pad = strokeWidth + 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * innerW;
    const y = pad + innerH - ((p.value - min) / span) * innerH;
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const stroke =
    tone === "up"
      ? "var(--up)"
      : tone === "down"
        ? "var(--down)"
        : tone === "flat"
          ? "var(--flat)"
          : "var(--primary)";

  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={title}
      preserveAspectRatio="none"
    >
      <title>{title}</title>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showLastDot && (
        <circle
          cx={lastX}
          cy={lastY}
          r={strokeWidth + 1.5}
          fill={stroke}
          stroke="var(--surface)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
