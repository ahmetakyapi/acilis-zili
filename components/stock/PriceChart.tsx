"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartResponse } from "@/app/api/chart/[symbol]/route";
import type { Bar, ChartRange } from "@/lib/providers/types";
import { CHART_RANGES } from "@/lib/providers/types";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/**
 * Fiyat grafiği — lightweight-charts v5.
 *
 * Renkler DOM'daki CSS değişkenlerinden okunur; tema değişince grafik de
 * kendini yeniden boyar. Grafik kütüphanesine hex gömülmez.
 */

type ChartLabels = {
  ranges: Record<ChartRange, string>;
  area: string;
  candles: string;
  noData: string;
  failed: string;
};

type PriceChartProps = {
  symbol: string;
  initialRange?: ChartRange;
  locale: Locale;
  labels: ChartLabels;
  /** Gün içi yükseliyor mu — alan grafiğinin rengi buna göre seçilir. */
  direction: "up" | "down" | "flat";
};

/**
 * Yükleme ayrı bir state değil, türetilmiş bir durumdur: sonuç henüz aktif
 * `symbol:range` anahtarına ait değilse iskelet gösterilir. Böylece fetch
 * effect'i içinde senkron setState gerekmez.
 */
type ChartResult =
  | { key: string; phase: "error"; message: string }
  | { key: string; phase: "ready"; bars: Bar[]; source: string; stale: boolean };

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function PriceChart({
  symbol,
  initialRange = "1D",
  locale,
  labels,
  direction,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [mode, setMode] = useState<"area" | "candles">("area");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [themeTick, setThemeTick] = useState(0);

  const requestKey = `${symbol}:${range}`;
  const state = useMemo(
    () =>
      result && result.key === requestKey
        ? result
        : ({ phase: "loading" } as const),
    [result, requestKey],
  );

  // Tema değişimini izle → grafiği yeniden boya
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Veri çek — setState yalnızca ağ callback'lerinde çağrılır.
  useEffect(() => {
    let cancelled = false;
    const key = `${symbol}:${range}`;

    fetch(`/api/chart/${symbol}?range=${range}`)
      .then((res) => res.json() as Promise<ChartResponse>)
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) {
          setResult({ key, phase: "error", message: labels.failed });
          return;
        }
        if (data.bars.length === 0) {
          setResult({ key, phase: "error", message: labels.noData });
          return;
        }
        setResult({
          key,
          phase: "ready",
          bars: data.bars,
          source: data.source,
          stale: data.stale,
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, phase: "error", message: labels.failed });
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range, labels.failed, labels.noData]);

  const intraday = range === "1D" || range === "1W";

  // Grafiği kur / güncelle
  useEffect(() => {
    const container = containerRef.current;
    if (!container || state.phase !== "ready") return;

    // Eksen etiketleri ET okusun diye zaman değerleri kaydırılır.
    const bars = shiftBarsToEt(state.bars);

    const up = cssVar("--up");
    const down = cssVar("--down");
    const line = direction === "down" ? down : cssVar("--primary");
    const text = cssVar("--text-muted");
    const grid = cssVar("--chart-grid");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: text,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: intraday,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: text, width: 1, style: 3, labelBackgroundColor: line },
        horzLine: { color: text, width: 1, style: 3, labelBackgroundColor: line },
      },
      localization: {
        locale: locale === "tr" ? "tr-TR" : "en-US",
        priceFormatter: (price: number) =>
          new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(price),
      },
    });
    chartRef.current = chart;

    if (mode === "area") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: line,
        lineWidth: 2,
        topColor: `${lineToRgba(line, 0.18)}`,
        bottomColor: `${lineToRgba(line, 0.0)}`,
        priceLineVisible: false,
      });
      series.setData(
        bars.map((bar) => ({
          time: bar.time as UTCTimestamp,
          value: bar.close,
        })),
      );
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        wickUpColor: up,
        wickDownColor: down,
        borderVisible: false,
      });
      series.setData(
        bars.map((bar) => ({
          time: bar.time as UTCTimestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })),
      );
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [state, mode, direction, locale, intraday, themeTick]);

  return (
    <div>
      {/* Aralık ve mod seçici */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="scroll-x flex gap-1" role="tablist" aria-label="Aralık">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "numeral min-h-[36px] shrink-0 rounded-(--radius-sm) px-2.5 text-xs font-medium transition-colors",
                range === r
                  ? "bg-primary-wash text-primary"
                  : "text-muted hover:bg-surface-elevated hover:text-soft",
              )}
            >
              {labels.ranges[r]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["area", "candles"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "min-h-[36px] rounded-(--radius-sm) px-2.5 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-primary-wash text-primary"
                  : "text-muted hover:bg-surface-elevated hover:text-soft",
              )}
            >
              {m === "area" ? labels.area : labels.candles}
            </button>
          ))}
        </div>
      </div>

      {/* Grafik alanı */}
      <div className="relative h-72 w-full sm:h-80">
        {state.phase === "loading" && (
          <div className="skeleton absolute inset-0" aria-hidden />
        )}
        {state.phase === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted">{state.message}</p>
          </div>
        )}
        <div
          ref={containerRef}
          className={cn("h-full w-full", state.phase !== "ready" && "invisible")}
        />
      </div>
    </div>
  );
}

/** "#2f6b41" → "rgba(47,107,65,a)" — alan dolgusu için. */
function lineToRgba(hex: string, alpha: number): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return `rgba(29,90,140,${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},${alpha})`;
}

/* --------------------------------------------------------------------------
   Eksen saatleri New York saati göstermeli.
   lightweight-charts zaman değerlerini UTC olarak basar; bu yüzden her bara
   günün ET ofseti eklenir (DST sınırı grafik içinde değişse bile doğru).
   Ofset gün bazında önbelleklenir — 2000 bar için 2000 Intl çağrısı yapılmaz.
   -------------------------------------------------------------------------- */

const ET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function etOffsetSeconds(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  const parts = ET_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
  );
  return Math.round((asUtc - date.getTime()) / 1000);
}

function shiftBarsToEt(bars: Bar[]): Bar[] {
  let cachedDay = "";
  let cachedOffset = 0;
  return bars.map((bar) => {
    const day = new Date(bar.time * 1000).toISOString().slice(0, 10);
    if (day !== cachedDay) {
      cachedDay = day;
      cachedOffset = etOffsetSeconds(bar.time);
    }
    return { ...bar, time: bar.time + cachedOffset };
  });
}
