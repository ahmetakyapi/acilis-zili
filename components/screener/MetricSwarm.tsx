"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { withLocale } from "@/lib/i18n/routing";
import { fitSwarm, swarmDomain, swarmPosition, type SwarmScale } from "@/lib/tool-visuals";
import { formatMoneyCompact, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./MetricSwarm.module.css";

export type SwarmPoint = { s: string; n: string; v: number };
export type SwarmKind = "ratio" | "percent" | "money";

type Labels = {
  aria: string;
  hint: string;
  median: string;
  universe: string;
  log: string;
  clipped: string;
  missing: string;
  open: string;
};

/** Sunucu ilk kareyi telefona göre basar; istemci gerçek genişliğe göre yeniden kurar. */
const SSR_WIDTH = 340;
/** Noktanın imleçle yakalandığı en uzak mesafe (piksel). */
const PICK_RADIUS = 28;
/** Log ölçek çentik etiketinin uç etiketlerden uzaklığı (yüzde). */
const TICK_EDGE = 14;
/** Balonun yana açılması için gereken yer: en geniş balon + ok payı. */
const TIP_SPACE = 236;
/** Üste açılan balonun yarı genişliği — kenardan içeri itme payı. */
const TIP_HALF = 112;

/** Stil değerleri iki haneye — gerekçe nokta stilinde. */
const round = (n: number) => Math.round(n * 100) / 100;

function formatValue(value: number, kind: SwarmKind, locale: string): string {
  if (!Number.isFinite(value)) return NO_VALUE;
  if (kind === "money") return formatMoneyCompact(value, locale);
  if (kind === "percent") return formatPercent(value, locale, 1);
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * ÖLÇÜ KÜMESİ (25 Ekim görsel turu) — /tarama'da süzgeçten geçen her hisse
 * bir nokta, yatayda seçili ölçünün değeri. Tablo 60 satırı sırayla
 * söylüyordu; kümenin şekli (yığılma nerede, uçta kim var, süzgeç evrenin
 * neresini kesti) hiçbir satırdan okunmuyordu.
 *
 * - Noktalar yumuşak mavi (büyüklük/veri tonu, güncel renk kararı); seçili
 *   nokta doygun mavi — etkileşim rengi yalnız orada.
 * - Doğrusal ölçekte %2–%98 arası çizilir; uçtakiler kenarda BOŞ halka
 *   (F/K 4.500 gibi tek bir değer kümenin tamamını tek piksele ezerdi).
 *   Piyasa değeri log ölçekte, künyesi yazılı.
 * - Klavye: kap tek sekme durağı; oklar değere göre sırada gezer, Enter
 *   hisseyi açar. Dokunuşta balon kalır ve içindeki bağlantı 44 piksel.
 * - Yükseklik SABİT (CSS): sunucu kareyi telefon genişliğine göre basar,
 *   istemci gerçek genişlikte yeniden yerleştirir — kutu oynamaz (CLS 0).
 */
export function MetricSwarm({
  points,
  scale,
  kind,
  universeMedian,
  missing,
  locale,
  labels,
}: {
  points: SwarmPoint[];
  scale: SwarmScale;
  kind: SwarmKind;
  /** Süzgeç evrenin bir kısmını kestiyse evrenin ortancası; değilse null. */
  universeMedian: number | null;
  /** Bu ölçüsü olmayan hisse sayısı — künyede söylenir. */
  missing: number;
  locale: string;
  labels: Labels;
}) {
  const router = useRouter();
  const plotRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; half: number }>({ width: SSR_WIDTH, half: 60 });
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  const sorted = useMemo(() => [...points].sort((a, b) => a.v - b.v || a.s.localeCompare(b.s)), [points]);
  const domain = useMemo(() => swarmDomain(sorted.map((p) => p.v), scale), [sorted, scale]);
  const positions = useMemo(
    () => (domain ? sorted.map((p) => swarmPosition(p.v, domain)) : []),
    [sorted, domain],
  );
  const layout = useMemo(
    () => fitSwarm(positions.map((p) => p.t), box.width, box.half),
    [positions, box.width, box.half],
  );
  const medianValue = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)].v : null;
  const clippedCount = positions.filter((p) => p.clipped).length;

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const half = el.clientHeight / 2;
      if (width > 0) setBox((prev) => (prev.width === width && prev.half === half ? prev : { width, half }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!domain || sorted.length === 0) return null;

  const xPct = (value: number) => swarmPosition(value, domain).t * 100;
  const zeroInside = scale === "linear" && domain.lo < 0 && domain.hi > 0;
  const ticks =
    scale === "log"
      ? Array.from({ length: 18 }, (_, i) => 10 ** (i - 2)).filter((v) => v > domain.lo && v < domain.hi)
      : [];

  function pick(event: PointerEvent<HTMLDivElement>): number | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top - rect.height / 2;
    let best: number | null = null;
    let bestDist = PICK_RADIUS ** 2;
    layout.xs.forEach((x, i) => {
      const d = (x - px) ** 2 + (layout.ys[i] - py) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  function onMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || pinned) return;
    setActive(pick(event));
  }

  function onDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("a")) return;
    const hit = pick(event);
    setActive(hit);
    setPinned(hit !== null && event.pointerType !== "mouse");
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const last = sorted.length - 1;
    const step = (to: number) => {
      event.preventDefault();
      setActive(Math.max(0, Math.min(last, to)));
      setPinned(true);
    };
    if (event.key === "ArrowRight" || event.key === "ArrowUp") step(active === null ? 0 : active + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") step(active === null ? last : active - 1);
    else if (event.key === "Home") step(0);
    else if (event.key === "End") step(last);
    else if (event.key === "Enter" && active !== null) {
      event.preventDefault();
      router.push(withLocale(`/hisse/${sorted[active].s}`, locale === "en" ? "en" : "tr"));
    } else if (event.key === "Escape") {
      setActive(null);
      setPinned(false);
    }
  }

  const current = active !== null ? sorted[active] : null;
  /* Balon yanda sığmazsa noktanın ÜSTÜNE, kenarlardan içeride ortalanır:
     390'da 220 piksellik balon kümenin ortasında iki yana da sığmıyor ve
     sayfayı yatay taşırıyordu. */
  const tipX = active !== null ? layout.xs[active] : 0;
  const tipSide = tipX + TIP_SPACE <= box.width ? "right" : tipX - TIP_SPACE >= 0 ? "left" : "top";
  const tipLeftPx = tipSide === "top" ? Math.min(Math.max(tipX, TIP_HALF), box.width - TIP_HALF) : tipX;
  const tipLeft = (tipLeftPx / Math.max(1, box.width)) * 100;
  const tipTop = active !== null ? layout.ys[active] : 0;

  return (
    <div className={styles.wrap}>
      <div
        ref={plotRef}
        className={styles.plot}
        tabIndex={0}
        role="group"
        aria-label={labels.aria}
        onPointerMove={onMove}
        onPointerLeave={() => !pinned && setActive(null)}
        onPointerDown={onDown}
        onKeyDown={onKey}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setPinned(false);
            setActive(null);
          }
        }}
      >
        <span aria-hidden className={styles.axisLine} />
        {zeroInside && <span aria-hidden className={styles.zero} style={{ left: `${round(xPct(0))}%` }} />}
        {ticks.map((tick) => (
          <span key={tick} aria-hidden className={styles.tick} style={{ left: `${round(xPct(tick))}%` }} />
        ))}
        {medianValue !== null && (
          <span aria-hidden className={styles.median} style={{ left: `${round(xPct(medianValue))}%` }} />
        )}
        {universeMedian !== null && (
          <span aria-hidden className={styles.universe} style={{ left: `${round(xPct(universeMedian))}%` }} />
        )}
        {sorted.map((point, i) => (
          <span
            key={point.s}
            aria-hidden
            className={styles.dot}
            data-clipped={positions[i].clipped || undefined}
            data-active={i === active || undefined}
            style={{
              /* Yuvarlama ŞART: tarayıcı stil özniteliğini dört haneye
                 indiriyor ve uzun ondalık hidrasyonda uyuşmazlık sayılıyordu. */
              left: `${round((layout.xs[i] / Math.max(1, box.width)) * 100)}%`,
              top: `calc(50% + ${round(layout.ys[i])}px)`,
              width: `${round(layout.radius * 2)}px`,
              height: `${round(layout.radius * 2)}px`,
              ["--t" as string]: positions[i].t.toFixed(3),
            }}
          />
        ))}
        {current && (
          <div
            className={styles.tip}
            data-side={tipSide}
            style={{ left: `${round(tipLeft)}%`, top: `calc(50% + ${round(tipTop)}px)` }}
          >
            <span className={styles.tipHead}>
              <b>{current.s}</b>
              <span className="numeral">{formatValue(current.v, kind, locale)}</span>
            </span>
            <span className={styles.tipName}>{current.n}</span>
            <Link href={`/hisse/${current.s}`} prefetch={false} className={styles.tipLink} tabIndex={-1}>
              {labels.open}
            </Link>
          </div>
        )}
      </div>

      <div className={styles.axis} aria-hidden>
        <span className="numeral">{formatValue(domain.lo, kind, locale)}</span>
        {/* Uç etiketlerine binmesin: yalnız ortadaki onda sekizde. */}
        {ticks.filter((tick) => xPct(tick) > TICK_EDGE && xPct(tick) < 100 - TICK_EDGE).map((tick) => (
          <span key={tick} className={`numeral ${styles.tickLabel}`} style={{ left: `${round(xPct(tick))}%` }}>
            {formatValue(tick, kind, locale)}
          </span>
        ))}
        <span className="numeral">{formatValue(domain.hi, kind, locale)}</span>
      </div>

      <p className={styles.legend}>
        {medianValue !== null && (
          <span>
            <i aria-hidden className={styles.legendMedian} />
            {labels.median.replace("{v}", formatValue(medianValue, kind, locale))}
          </span>
        )}
        {universeMedian !== null && (
          <span>
            <i aria-hidden className={styles.legendUniverse} />
            {labels.universe.replace("{v}", formatValue(universeMedian, kind, locale))}
          </span>
        )}
        {scale === "log" && <span>{labels.log}</span>}
      </p>
      <p className={styles.note}>
        {labels.hint}
        {clippedCount > 0 && ` ${labels.clipped.replace("{n}", String(clippedCount))}`}
        {missing > 0 && ` ${labels.missing.replace("{n}", String(missing))}`}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {current ? `${current.s}, ${current.n}: ${formatValue(current.v, kind, locale)}` : ""}
      </p>
    </div>
  );
}
