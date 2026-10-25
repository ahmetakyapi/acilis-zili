"use client";

import { useMemo, useRef, useState } from "react";
import { duoDomain, duoTicks, gapBands } from "@/lib/duo-chart";
import { cn, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./DuoLineChart.module.css";

/**
 * ÇİFT ÇİZGİ — iki yüzde serisi ve aradaki fark (25 Ekim).
 *
 * Portföyün "Alıştan Bugüne" eğrisi (portföy ↔ aynı günlerde SPY) ve
 * temanın zaman çizgisi (tema medyanı ↔ ölçüt fonu) aynı soruyu soruyor:
 * "ölçütün neresindeyim, ve bu ne zaman açıldı?". İki sayı yan yana
 * yalnızca bugünü söylüyordu; çizgi farkın NE ZAMAN oluştuğunu da söylüyor.
 *
 * RENK YALNIZ YÖNDEN (CLAUDE.md "renk anlam taşır"). A çizgisi mürekkep
 * (`--text-strong`), B kesik ve sönük (`--text-muted`): biri özne, öteki
 * ölçüt; mavi kullanılmıyor çünkü mavi bu sitede etkileşim. Aradaki alan A
 * öndeyken `--up-wash`, gerideyken `--down-wash` — fark alanının rengi
 * farkın işaretidir, değerin kendisi değil.
 *
 * X EKSENİ İNDİS, TAKVİM DEĞİL: her işlem günü eşit genişlikte (fiyat
 * grafiklerinin alışılmış dili); hafta sonları boşluk açmıyor. Tarih
 * etiketleri sunucuda biçimlenip geliyor — profilde YALNIZ AY (KVKK: alış
 * günü gösterilmez, gerekçe app/(app)/u/[username]/page.tsx).
 *
 * OKUMA: imleçle, dokunuşla ve KLAVYEYLE (odaklan, ←/→, Home/End). Okuma
 * ayrı bir `role="status"` bölgesiyle duyuruluyor. Giriş: çizgiler soldan çiziliyor, alan sonra
 * beliriyor (`spark-line`/`spark-area`, globals.css; hareketi azaltana son
 * kare).
 */

export type DuoChartPoint = {
  /** Okuma kartının tarihi — sunucuda biçimlenmiş. */
  label: string;
  a: number;
  b: number | null;
  /** Karttaki ek satırlar (temada günün en iyi/zayıf üyesi). */
  notes?: { label: string; value: number }[];
};

export type DuoChartLabels = {
  /** Fark satırının adı ("Fark"). */
  gap: string;
  /** "{n} Puan" — iki yüzde arasındaki fark yüzde değil puan. */
  points: string;
  /** Okuma yokken lejantın sağındaki ipucu. */
  hint: string;
};

const WIDTH = 720;
/** Çizgi ve işaretin üst/alt payı — kalın çizgi kutudan kırpılmasın. */
const PAD_Y = 6;

export function DuoLineChart({
  points,
  aName,
  bName,
  axis,
  title,
  locale,
  labels,
  height = 200,
  className,
}: {
  points: DuoChartPoint[];
  aName: string;
  bName: string | null;
  /** X eksenindeki tarih etiketleri: nokta indisi + metin. */
  axis: { index: number; label: string }[];
  /** Grafiğin erişilebilir adı. */
  title: string;
  locale: string;
  labels: DuoChartLabels;
  height?: number;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingX = useRef<number | null>(null);

  const n = points.length;
  const hasB = bName !== null && points.some((p) => p.b !== null);

  const geometry = useMemo(() => {
    const domain = duoDomain(points);
    const span = domain.max - domain.min;
    const xOf = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * WIDTH);
    const yOf = (value: number) => PAD_Y + (1 - (value - domain.min) / span) * (height - PAD_Y * 2);
    const line = (pick: (p: DuoChartPoint) => number | null) => {
      let d = "";
      let open = false;
      points.forEach((p, i) => {
        const v = pick(p);
        if (v === null || !Number.isFinite(v)) {
          open = false;
          return;
        }
        d += `${open ? "L" : "M"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`;
        open = true;
      });
      return d;
    };
    const bands = hasB
      ? gapBands(points).map((band) => ({
          sign: band.sign,
          d: `M${band.points
            .map(([x, y]) => `${((n <= 1 ? 0 : x / (n - 1)) * WIDTH).toFixed(2)},${yOf(y).toFixed(2)}`)
            .join("L")}Z`,
        }))
      : [];
    return {
      domain,
      ticks: duoTicks(domain),
      xOf,
      yOf,
      aPath: line((p) => p.a),
      bPath: hasB ? line((p) => p.b) : "",
      bands,
    };
  }, [points, n, height, hasB]);

  if (n < 2) return null;

  const { domain, ticks, xOf, yOf, aPath, bPath, bands } = geometry;
  const shareY = (value: number) => (yOf(value) / height) * 100;
  const last = points[n - 1];
  const reading = active === null ? null : points[active];

  function updateFromClientX(clientX: number) {
    pendingX.current = clientX;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const x = pendingX.current;
      const rect = frameRef.current?.getBoundingClientRect();
      if (x === null || !rect || rect.width === 0) return;
      const f = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
      setActive(Math.round(f * (n - 1)));
    });
  }

  function clearReading() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingX.current = null;
    setActive(null);
  }

  const tone = (value: number | null) =>
    value === null ? "text-muted" : value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted";
  const pointsText = (value: number) =>
    labels.points.replace("{n}", formatPrice(Math.abs(value), locale, { digits: 1 }));
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${pointsText(value)}`;

  const announce = (point: DuoChartPoint) =>
    [
      point.label,
      `${aName} ${formatPercent(point.a, locale, 1)}`,
      hasB && bName ? `${bName} ${point.b === null ? NO_VALUE : formatPercent(point.b, locale, 1)}` : null,
      hasB && bName && point.b !== null ? `${labels.gap} ${signed(point.a - point.b)}` : null,
      ...(point.notes ?? []).map((note) => `${note.label} ${formatPercent(note.value, locale, 1)}`),
    ]
      .filter((part): part is string => part !== null)
      .join(", ");

  return (
    <figure className={cn("flex flex-col gap-2.5", className)}>
      <div
        ref={frameRef}
        className={styles.frame}
        /* BOY DIŞARIDAN DA AYARLANIR (25 Ekim): `--duo-chart-h` verilmezse
           `height`. Portföyde geniş ekranda grafik Getiri paneliyle yan yana
           ve daha kısa (Portfolio.module.css → `.returnsPair`); sunucu
           genişliği bilmediği için boy CSS'te. Çizim `preserveAspectRatio=
           "none"` ve kalemler `non-scaling-stroke`: dikeyde esnemek çizgiyi
           kalınlaştırmıyor, noktalar yüzdeyle (`shareY`) konumlanıyor. */
        style={{ height: `var(--duo-chart-h, ${height}px)` }}
        tabIndex={0}
        role="group"
        aria-label={title}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          updateFromClientX(event.clientX);
        }}
        onPointerDown={(event) => updateFromClientX(event.clientX)}
        onPointerLeave={clearReading}
        onPointerCancel={clearReading}
        onBlur={clearReading}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 5 : 1;
          let next: number | null = null;
          if (event.key === "ArrowLeft") next = Math.max(0, (active ?? n - 1) - step);
          else if (event.key === "ArrowRight") next = Math.min(n - 1, (active ?? -1) + step);
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = n - 1;
          else if (event.key === "Escape") {
            setActive(null);
            return;
          }
          if (next === null) return;
          event.preventDefault();
          setActive(next);
        }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          aria-hidden
          className="block"
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={WIDTH}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke={tick === 0 ? "var(--line-strong)" : "var(--line-soft)"}
              strokeWidth={1}
              strokeDasharray={tick === 0 ? "3 3" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {bands.map((band, i) => (
            <path
              key={i}
              className="spark-area"
              d={band.d}
              fill={band.sign === "up" ? "var(--up-wash)" : "var(--down-wash)"}
            />
          ))}
          {bPath && (
            <path
              className="spark-line"
              d={bPath}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth={1.6}
              strokeDasharray="5 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            className="spark-line"
            d={aPath}
            fill="none"
            stroke="var(--text-strong)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {active !== null && (
            <line
              x1={xOf(active)}
              x2={xOf(active)}
              y1={0}
              y2={height}
              stroke="var(--line-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Noktalar HTML: `preserveAspectRatio="none"` SVG içindeki daireyi
            elipse çeviriyordu. */}
        {active !== null && (
          <>
            <span
              aria-hidden
              className={styles.dot}
              data-series="a"
              style={{ left: `${(xOf(active) / WIDTH) * 100}%`, top: `${shareY(points[active].a)}%` }}
            />
            {points[active].b !== null && (
              <span
                aria-hidden
                className={styles.dot}
                data-series="b"
                style={{ left: `${(xOf(active) / WIDTH) * 100}%`, top: `${shareY(points[active].b as number)}%` }}
              />
            )}
          </>
        )}

        {/* Ölçek etiketleri sağ kenarda, çizginin hemen üstünde. */}
        {ticks.map((tick) => (
          <span
            key={tick}
            aria-hidden
            className={cn("numeral", styles.tick)}
            style={{ top: `${shareY(tick)}%` }}
          >
            {tick === 0 ? "0" : formatPercent(tick, locale, Math.abs(domain.max - domain.min) < 4 ? 1 : 0)}
          </span>
        ))}

        {/* Kart görsel; ekran okuyucuya okumayı aşağıdaki `role="status"`
            söyler (kart `aria-hidden`, iki kez okunmasın). */}
        {reading && active !== null && (
          <div
            aria-hidden
            className={styles.card}
            /* KART KARŞI KÖŞEDE: imleç sağ yarıdaysa sol üstte, sol
               yarıdaysa sağ üstte. İmlecin yanına yaslanan kart 390
               pikselde çerçevenin solundan taşıyordu (ölçüldü); köşede hem
               taşmıyor hem okunan noktanın üstünü örtmüyor. */
            style={active / Math.max(1, n - 1) > 0.5 ? { left: 0 } : { right: 0 }}
          >
            <p className="numeral mb-1 text-nano text-muted">{reading.label}</p>
            <dl className={styles.cardRows}>
              <dt>
                <i aria-hidden data-series="a" className={styles.swatch} />
                {aName}
              </dt>
              <dd className={cn("numeral", tone(reading.a))}>{formatPercent(reading.a, locale, 1)}</dd>
              {hasB && bName && (
                <>
                  <dt>
                    <i aria-hidden data-series="b" className={styles.swatch} />
                    {bName}
                  </dt>
                  <dd className={cn("numeral", tone(reading.b))}>
                    {reading.b === null ? NO_VALUE : formatPercent(reading.b, locale, 1)}
                  </dd>
                  {reading.b !== null && (
                    <>
                      <dt className="text-muted">{labels.gap}</dt>
                      <dd className={cn("numeral", tone(reading.a - reading.b))}>{signed(reading.a - reading.b)}</dd>
                    </>
                  )}
                </>
              )}
              {reading.notes?.map((note) => (
                <div key={note.label} className="contents">
                  <dt className="text-muted">{note.label}</dt>
                  <dd className={cn("numeral", tone(note.value))}>{formatPercent(note.value, locale, 1)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* CANLI BÖLGE AYRI VE HEP DOMDA (25 Ekim): `aria-live` eskiden
          `display: contents` bir sarmalayıcıdaydı; Safari kutusu olmayan
          öğeyi erişilebilirlik ağacından düşürüyor ve okuma hiç
          duyurulmuyordu. Bölge her zaman var, yalnız metni değişiyor. */}
      <p role="status" className="sr-only">
        {reading ? announce(reading) : ""}
      </p>

      {/* Tarih ekseni: etiketler indise göre, uçtakiler kenara yaslı. */}
      <div aria-hidden className={styles.axis}>
        {axis.map((tick) => {
          const share = n <= 1 ? 0 : tick.index / (n - 1);
          return (
            <span
              key={`${tick.index}-${tick.label}`}
              className="numeral"
              data-edge={share < 0.08 ? "start" : share > 0.92 ? "end" : undefined}
              style={{ left: `${share * 100}%` }}
            >
              {tick.label}
            </span>
          );
        })}
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-small">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden data-series="a" className={styles.legendLine} />
          <span className="font-semibold text-strong">{aName}</span>
          <span className={cn("numeral font-bold", tone(last.a))}>{formatPercent(last.a, locale, 1)}</span>
        </span>
        {hasB && bName && (
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden data-series="b" className={styles.legendLine} />
            <span className="font-semibold text-strong">{bName}</span>
            <span className={cn("numeral font-bold", tone(last.b))}>
              {last.b === null ? NO_VALUE : formatPercent(last.b, locale, 1)}
            </span>
          </span>
        )}
        <span className="ml-auto text-tiny text-muted">{labels.hint}</span>
      </figcaption>
    </figure>
  );
}
