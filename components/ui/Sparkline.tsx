/**
 * Sunucuda çizilen mini eğri — istemci JS'i yok.
 * Tek seri olduğu için lejant gerekmez; başlık seriyi adlandırır.
 *
 * HANDOFF §5: çizgi yönün rengini taşır, altında aynı rengin %8–9 opaklıkta
 * alan dolgusu durur. Nokta işareti varsayılan olarak yok — mockup'ta eğri
 * sessiz bir arka plan öğesi, okunacak sayı üstteki fiyattır.
 *
 * SEANS EKSENİ (23 Eylül, `baseline` + `domain`). Ana sayfanın endeks
 * kartlarında çizgi sayıyla ÇELİŞİYORDU: Dow Jones "+%0,11" yeşil yazarken
 * çizgisi sol üstten sağ alta iniyordu (1440, 2x kırpımda ölçüldü). İki
 * sebep vardı. Dikey ölçek yalnızca noktaların kendi en düşüğü ile en
 * yükseğiydi, yani %0,05'lik bir kıpırtı kartın bütün boyunu dolduruyordu;
 * yatay ölçek noktanın SIRASIYDI, zamanı değil, ve ön seansın kırk beş
 * dakikası (2-9 bar) 280 piksele yayılıyordu. Renk ise önceki kapanışa göre
 * yüzdeden geliyordu — şekil başka, renk başka bir şey anlatıyordu.
 *
 * İki isteğe bağlı giriş bunu kuruyor ve verildiklerinde:
 * - x = (zaman − d0) / (d1 − d0): çizgi günün geçen kısmı kadar yer tutar;
 * - dikey ölçek önceki kapanışı da içerir (%8 pay), kapanış kesik bir
 *   `--line-strong` çizgisi olarak durur;
 * - dolgu çizgi ile taban ARASINDA: üstü `--up-wash`, altı `--down-wash`.
 *   Rengi yüzdenin işareti değil şeklin kendisi veriyor; ikisi artık aynı
 *   şeyi söylemek zorunda.
 * - `split` verilirse (açılış zili) ondan önceki çizgi yarı tonda: ön seans
 *   hafif, asıl seans tam — gün akışının seans bandıyla aynı dil.
 * Öteki çağıranlar (makro, piyasalar, favoriler) bu girişleri vermiyor ve
 * eskisi gibi çiziliyor.
 */

type Point = { value: number; /** Unix saniye — yalnızca `domain` ile. */ time?: number };

/** Alan dolgusunun opaklığı — çizgiyi bastırmayacak kadar hafif. */
const AREA_OPACITY = 0.085;
/** Seans ekseninde dikey ölçeğin iki ucundaki pay. */
const BASELINE_PAD = 0.08;
/** Açılış zilinden önceki çizginin tonu. */
const PRE_OPEN_OPACITY = 0.5;

/* Degrade kimliği başlıktan türüyor: bileşen sunucuda da istemcide de
   çiziliyor ve iki tarafta aynı kimliği vermeli (sayfada her başlık tek). */
function idOf(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return `spark-${(hash >>> 0).toString(36)}`;
}

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
  baseline,
  domain,
  split,
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
  /** Önceki kapanış: kesik taban çizgisi ve dolgunun sınırı. */
  baseline?: number | null;
  /** Unix saniye [başlangıç, bitiş]: x ekseni zamana göre kurulur. */
  domain?: [number, number];
  /** Unix saniye: bu andan önceki çizgi yarı tonda (açılış zili). */
  split?: number;
  className?: string;
}) {
  const timed = domain !== undefined && domain[1] > domain[0] && points.every((p) => p.time !== undefined);
  const shown = timed
    ? points.filter((p) => p.time! >= domain![0] && p.time! <= domain![1])
    : points;
  if (shown.length < 2) return null;

  const values = shown.map((p) => p.value);
  const anchored = typeof baseline === "number" && Number.isFinite(baseline);
  const low = Math.min(...values, ...(anchored ? [baseline] : []));
  const high = Math.max(...values, ...(anchored ? [baseline] : []));
  const rawSpan = high - low || Math.abs(high) * 0.001 || 1;
  const pad = anchored ? rawSpan * BASELINE_PAD : 0;
  const min = low - pad;
  const span = rawSpan + pad * 2;

  const inset = strokeWidth + 2;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const xOf = (p: Point, i: number) =>
    inset +
    (timed
      ? ((p.time! - domain![0]) / (domain![1] - domain![0])) * innerW
      : (i / (shown.length - 1)) * innerW);
  const yOf = (value: number) => inset + innerH - ((value - min) / span) * innerH;

  const coords = shown.map((p, i) => [xOf(p, i), yOf(p.value)] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const firstX = coords[0][0];
  const [lastX, lastY] = coords[coords.length - 1];

  const stroke =
    tone === "up"
      ? "var(--up)"
      : tone === "down"
        ? "var(--down)"
        : tone === "flat"
          ? "var(--flat)"
          : "var(--primary)";

  const baseY = anchored ? yOf(baseline) : null;
  /* Taban varken dolgu İKİ poligon: çizginin tabanın üstünde kalan kısmı
     ile altında kalan kısmı. Her biri çizginin y'sini tabana KIRPARAK
     kuruluyor; kırpılmış iz tam olarak çizgi ile taban arasındaki alanı
     çeviriyor, kesişme noktası hesaplamaya gerek kalmıyor. */
  const clampedArea = (keep: (y: number) => number) =>
    `${firstX.toFixed(1)},${baseY!.toFixed(1)} ${coords
      .map(([x, y]) => `${x.toFixed(1)},${keep(y).toFixed(1)}`)
      .join(" ")} ${lastX.toFixed(1)},${baseY!.toFixed(1)}`;
  // Tabansız alan çizginin iki ucundan kutunun dibine iner.
  const area = `${firstX.toFixed(1)},${height} ${line} ${lastX.toFixed(1)},${height}`;

  const splitX =
    timed && split !== undefined && split > domain![0] && split < domain![1]
      ? inset + ((split - domain![0]) / (domain![1] - domain![0])) * innerW
      : null;
  const gradientId = idOf(title);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={title}
      preserveAspectRatio="none"
    >
      <title>{title}</title>
      {splitX !== null && (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
            <stop offset={splitX / width} style={{ stopColor: stroke, stopOpacity: PRE_OPEN_OPACITY }} />
            <stop offset={splitX / width} style={{ stopColor: stroke, stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      )}
      {showArea && anchored && (
        <>
          <polygon className="spark-area" points={clampedArea((y) => Math.min(y, baseY!))} fill="var(--up-wash)" />
          <polygon className="spark-area" points={clampedArea((y) => Math.max(y, baseY!))} fill="var(--down-wash)" />
        </>
      )}
      {showArea && !anchored && (
        <polygon
          className="spark-area"
          points={area}
          fill={stroke}
          opacity={AREA_OPACITY}
        />
      )}
      {anchored && (
        <line
          x1={inset}
          x2={inset + innerW}
          y1={baseY!}
          y2={baseY!}
          stroke="var(--line-strong)"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Çizim animasyonu kırpmayla (globals.css → .spark-line); kesik ve
          `pathLength` kullanılmıyor, ölçeklenen çizgide kesik kısalıyordu. */}
      <polyline
        className="spark-line"
        points={line}
        fill="none"
        stroke={splitX !== null ? `url(#${gradientId})` : stroke}
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
