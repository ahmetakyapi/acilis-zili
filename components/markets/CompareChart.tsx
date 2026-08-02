"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Normalize edilmiş karşılaştırma grafiği.
 *
 * İki hissenin fiyatını aynı eksende çizmek anlamsızdır: 800 dolarlık bir
 * hisse 40 dolarlık bir hissenin yanında düz çizgi gibi görünür. Bu yüzden
 * her seri kendi BAŞLANGICINA göre yüzdeye çevriliyor — hepsi sıfırdan
 * başlıyor ve grafikte okunan tek şey "dönem boyunca kim ne kadar getirdi".
 *
 * Renkler token'lardan gelir, hardcoded hex yok.
 *
 * NEDEN ARTIK İSTEMCİ BİLEŞENİ
 * ----------------------------
 * Önceden sunucuda çizilen saf bir SVG'ydi ve bu bilinçli bir tercihti:
 * istemciye hiç JS inmiyordu. Grafiğin okunabilirliği ise tek bir soruda
 * tıkanıyordu — "peki MAYIS'ta kim öndeydi?". Statik çizgide bunun cevabı
 * yok; sadece dönem sonu farkı okunuyordu, arada ne olduğu değil.
 *
 * Artık imleç grafiğin üzerinde gezerken dikey bir kılavuz çiziliyor ve o
 * ANDAKİ yüzdeler bir kartta sıralanıyor. Bedeli birkaç yüz baytlık
 * etkileşim kodu; karşılığı grafiğin asıl sorusuna cevap verebilmesi.
 *
 * FARKLI UZUNLUKTAKİ SERİLER: her seri kendi uzunluğuyla tüm genişliğe
 * yayılıyor (çizim de böyle yapılıyor), yani i. nokta serilerde aynı tarihe
 * denk gelmeyebilir. Bu yüzden imleç konumu İNDİS olarak değil ORAN olarak
 * yorumlanıyor: her seri kendi dizisinde o orana düşen noktayı gösteriyor.
 * Çizimle birebir tutarlı olan tek yorum bu.
 */

export type CompareSeries = {
  symbol: string;
  /** Kapanış dizisi; en az iki nokta. */
  closes: number[];
  /** Bar zamanları (unix saniye) — imleç kartındaki tarih için. */
  times?: number[];
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
  locale,
  readingLabel,
}: {
  series: CompareSeries[];
  className?: string;
  title: string;
  locale: string;
  /** İmleç yokken kartın yerinde duran ipucu. */
  readingLabel?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  /** İmlecin genişlik boyunca oranı (0–1); imleç dışarıdaysa null. */
  const [fraction, setFraction] = useState<number | null>(null);

  const usable = useMemo(
    () => series.filter((entry) => entry.closes.length >= 2),
    [series],
  );

  const normalized = useMemo(
    () =>
      usable.map((entry) => {
        const base = entry.closes[0] || 1;
        return {
          symbol: entry.symbol,
          times: entry.times,
          points: entry.closes.map((close) => ((close - base) / base) * 100),
        };
      }),
    [usable],
  );

  const geometry = useMemo(() => {
    const all = normalized.flatMap((entry) => entry.points);
    if (all.length === 0) return null;
    const min = Math.min(...all, 0);
    const max = Math.max(...all, 0);
    const span = max - min || 1;
    return { min, span };
  }, [normalized]);

  if (!geometry || normalized.length === 0) return null;

  const yOf = (value: number) =>
    PAD_Y + (1 - (value - geometry.min) / geometry.span) * (HEIGHT - PAD_Y * 2);
  const zeroY = yOf(0);

  /** Oranı seri dizisindeki en yakın indise çevirir. */
  const indexAt = (entry: { points: number[] }, f: number) =>
    Math.min(
      entry.points.length - 1,
      Math.max(0, Math.round(f * (entry.points.length - 1))),
    );

  /* İmleç okuması: her serinin o orandaki değeri + en uzun serinin tarihi.
     Tarih en çok noktası olan seriden alınır — en ince zaman çözünürlüğü
     onda. */
  const reading =
    fraction === null
      ? null
      : (() => {
          const values = normalized.map((entry, index) => ({
            symbol: entry.symbol,
            color: SERIES_COLORS[index % SERIES_COLORS.length],
            value: entry.points[indexAt(entry, fraction)],
          }));
          const richest = normalized.reduce((best, entry) =>
            entry.points.length > best.points.length ? entry : best,
          );
          const stamp = richest.times?.[indexAt(richest, fraction)];
          return {
            values,
            date: stamp
              ? new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(stamp * 1000))
              : null,
          };
        })();

  function updateFromClientX(clientX: number) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const f = (clientX - rect.left) / rect.width;
    setFraction(Math.min(1, Math.max(0, f)));
  }

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <div className="scroll-x -mx-1 px-1">
        {/* Dokunmatikte de çalışır: parmak sürüklendikçe okuma kayar,
            kalkınca kart kapanır. `touch-pan-y` dikey kaydırmayı bırakır —
            grafiğin üstünde parmak sürüklerken sayfa kilitlenmesin. */}
        <div
          ref={frameRef}
          className="relative min-w-[520px] touch-pan-y"
          onPointerMove={(event) => updateFromClientX(event.clientX)}
          onPointerDown={(event) => updateFromClientX(event.clientX)}
          onPointerLeave={() => setFraction(null)}
          onPointerCancel={() => setFraction(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="100%"
            height={HEIGHT}
            preserveAspectRatio="none"
            role="img"
            aria-label={title}
            className="block w-full"
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

            {fraction !== null && (
              <line
                x1={fraction * WIDTH}
                x2={fraction * WIDTH}
                y1={0}
                y2={HEIGHT}
                stroke="var(--line-strong)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}

            {normalized.map((entry, index) => {
              const step = WIDTH / Math.max(1, entry.points.length - 1);
              const color = SERIES_COLORS[index % SERIES_COLORS.length];
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
                  stroke={color}
                  strokeWidth={1.9}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Kılavuzun her seriyi kestiği nokta — hangi çizginin nerede
                olduğunu kartla eşleştirir. */}
            {fraction !== null &&
              normalized.map((entry, index) => {
                const i = indexAt(entry, fraction);
                const step = WIDTH / Math.max(1, entry.points.length - 1);
                return (
                  <circle
                    key={entry.symbol}
                    cx={i * step}
                    cy={yOf(entry.points[i])}
                    r={3.5}
                    fill="var(--surface)"
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
          </svg>

          {/* Okuma kartı. Konumu imlece göre kayar ama kenarlarda dışarı
              taşmaz: sol yarıdaysa sağa, sağ yarıdaysa sola yaslanır. */}
          {reading && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-(--radius-md) border border-line bg-surface-elevated px-3 py-2 shadow-lg"
              style={
                fraction !== null && fraction > 0.5
                  ? { right: `${(1 - fraction) * 100}%`, marginRight: 10 }
                  : { left: `${(fraction ?? 0) * 100}%`, marginLeft: 10 }
              }
            >
              {reading.date && (
                <p className="numeral mb-1.5 text-[10.5px] text-muted">
                  {reading.date}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {reading.values.map((row) => (
                  <div
                    key={row.symbol}
                    className="flex items-center gap-2 whitespace-nowrap text-[11.5px]"
                  >
                    <span
                      aria-hidden
                      className="block size-2 shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="numeral font-bold text-strong">
                      {row.symbol}
                    </span>
                    <span
                      className={cn(
                        "numeral ml-auto font-semibold",
                        row.value > 0
                          ? "text-up"
                          : row.value < 0
                            ? "text-down"
                            : "text-muted",
                      )}
                    >
                      {row.value > 0 ? "+" : ""}
                      {row.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Künye dönem SONU farkını gösterir; imleç kartı ara anları.
          İkisi birbirinin yerine geçmiyor, biri özet biri detay. */}
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
        {readingLabel && (
          <span className="ml-auto text-[11px] text-muted">{readingLabel}</span>
        )}
      </figcaption>
    </figure>
  );
}
