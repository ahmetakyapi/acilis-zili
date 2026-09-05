/**
 * Sunucuda çizilen mini eğri — istemci JS'i yok.
 * Tek seri olduğu için lejant gerekmez; başlık seriyi adlandırır.
 *
 * HANDOFF §5: çizgi yönün rengini taşır, altında aynı rengin %8–9 opaklıkta
 * alan dolgusu durur. Nokta işareti varsayılan olarak yok — mockup'ta eğri
 * sessiz bir arka plan öğesi, okunacak sayı üstteki fiyattır.
 */

type Point = { value: number };

/** Alan dolgusunun opaklığı — çizgiyi bastırmayacak kadar hafif. */
const AREA_OPACITY = 0.085;

export function Sparkline({
  points,
  width = 200,
  height = 40,
  title,
  /**
   * Fiyat serileri yön rengini taşır: artıda yeşil, ekside kırmızı, tam
   * yatayda (%0) gri. Bu kural YALNIZCA hisse ve endeks fiyatları için —
   * makro göstergelerinde "yükselmek" iyi haber demek değil, onlar accent
   * mavisiyle çizilir (varsayılan).
   */
  tone = "primary",
  strokeWidth = 2,
  showArea = true,
  showLastDot = false,
  className,
}: {
  points: Point[];
  width?: number;
  height?: number;
  title: string;
  tone?: "primary" | "up" | "down" | "flat";
  strokeWidth?: number;
  showArea?: boolean;
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

  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // Alan, çizginin iki ucundan tabana iner — kapalı bir poligon olur.
  const area = `${pad},${height} ${line} ${(pad + innerW).toFixed(1)},${height}`;

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
      {showArea && (
        <polygon
          className="spark-area"
          points={area}
          fill={stroke}
          opacity={AREA_OPACITY}
        />
      )}
      {/* `pathLength="1"`: uzunluk ölçmeden çizim animasyonu; kural globals.css → .spark-line */}
      <polyline
        className="spark-line"
        pathLength={1}
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showLastDot && (
        <circle
          className="spark-dot"
          cx={lastX}
          cy={lastY}
          r={strokeWidth + 1.5}
          fill={stroke}
          stroke="var(--page-bg)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
