import type { MacroObservation } from "@/lib/providers/types";

/**
 * Sunucuda çizilen mini eğri — istemci JS'i yok.
 * Tek seri olduğu için lejant gerekmez; başlık seriyi adlandırır.
 * Renk nötr mürekkep mavisidir: makro serilerde yön rengi (yeşil/kırmızı)
 * kullanılmaz — enflasyonun düşmesi iyi, istihdamın düşmesi kötüdür; renk
 * yorum dayatmaz, sayı konuşur.
 */
export function Sparkline({
  observations,
  width = 240,
  height = 56,
  title,
}: {
  observations: MacroObservation[];
  width?: number;
  height?: number;
  title: string;
}) {
  if (observations.length < 2) return null;

  const values = observations.map((o) => o.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = observations.map((o, i) => {
    const x = pad + (i / (observations.length - 1)) * innerW;
    const y = pad + innerH - ((o.value - min) / span) * innerH;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Son gözlem işaretçisi — yüzey halkasıyla ayrışır */}
      <circle
        cx={lastX}
        cy={lastY}
        r="4"
        fill="var(--primary)"
        stroke="var(--surface)"
        strokeWidth="2"
      />
    </svg>
  );
}
