"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  type IChartApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartResponse } from "@/app/api/chart/[symbol]/route";
import type { Bar, ChartRange } from "@/lib/providers/types";
import { CHART_RANGES } from "@/lib/providers/types";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/**
 * Fiyat grafiği — lightweight-charts v5.
 *
 * Midas tarzı okuma: imleç grafikte gezerken üstte sabit bir okuma satırı
 * tarih · fiyat · dönem başından değişimi gösterir; imleç yokken seçili
 * aralığın toplam getirisi ve en düşük/yüksek değerleri okunur. Alan rengi
 * günlük yöne değil, SEÇİLİ ARALIĞIN yönüne göre belirlenir.
 * Renkler DOM'daki CSS değişkenlerinden okunur; tema değişince yeniden boyanır.
 */

type ChartLabels = {
  ranges: Record<ChartRange, string>;
  rangeLabels: Record<ChartRange, string>;
  area: string;
  candles: string;
  periodReturn: string;
  periodHigh: string;
  periodLow: string;
  noData: string;
  failed: string;
};

type PriceChartProps = {
  symbol: string;
  initialRange?: ChartRange;
  locale: Locale;
  labels: ChartLabels;
};

type ChartResult =
  | { key: string; phase: "error"; message: string }
  | { key: string; phase: "ready"; bars: Bar[]; source: string; stale: boolean };

type HoverReading = {
  dateLabel: string;
  price: number;
  changePct: number;
} | null;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function PriceChart({
  symbol,
  initialRange = "1D",
  locale,
  labels,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [mode, setMode] = useState<"area" | "candles">("area");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [hover, setHover] = useState<HoverReading>(null);
  const [themeTick, setThemeTick] = useState(0);

  const requestKey = `${symbol}:${range}`;
  const state = useMemo(
    () =>
      result && result.key === requestKey
        ? result
        : ({ phase: "loading" } as const),
    [result, requestKey],
  );

  // Dönem istatistikleri — başlık satırı ve renk kararı bunlardan gelir.
  const period = useMemo(() => {
    if (state.phase !== "ready" || state.bars.length === 0) return null;
    const bars = state.bars;
    const first = bars[0];
    const last = bars[bars.length - 1];
    const changePct =
      first.open !== 0 ? ((last.close - first.open) / first.open) * 100 : 0;
    let high = -Infinity;
    let low = Infinity;
    for (const bar of bars) {
      if (bar.high > high) high = bar.high;
      if (bar.low < low) low = bar.low;
    }
    return { first, last, changePct, high, low };
  }, [state]);

  const periodTone: "up" | "down" | "flat" = !period
    ? "flat"
    : period.changePct > 0
      ? "up"
      : period.changePct < 0
        ? "down"
        : "flat";

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
    if (!container || state.phase !== "ready" || !period) return;

    const bars = shiftBarsToEt(state.bars);
    const baseline = period.first.open;

    const up = cssVar("--up");
    const down = cssVar("--down");
    const flat = cssVar("--primary");
    const line =
      periodTone === "up" ? up : periodTone === "down" ? down : flat;
    const text = cssVar("--text-muted");
    const grid = cssVar("--chart-grid");

    const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
    const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
      timeZone: "UTC", // barlar zaten ET'ye kaydırıldı
      day: "numeric",
      month: intraday ? "long" : "short",
      year: intraday ? undefined : "numeric",
      hour: intraday ? "2-digit" : undefined,
      minute: intraday ? "2-digit" : undefined,
      hour12: false,
    });

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
        horzLine: { visible: false, labelVisible: false },
      },
      localization: {
        locale: intlLocale,
        priceFormatter: (price: number) =>
          new Intl.NumberFormat(intlLocale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(price),
      },
      handleScale: { axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    if (mode === "area") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: line,
        lineWidth: 2,
        topColor: lineToRgba(line, 0.16),
        bottomColor: lineToRgba(line, 0),
        priceLineVisible: false,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: cssVar("--surface"),
        crosshairMarkerBackgroundColor: line,
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

    // İmleç okuması — Midas tarzı: tarih · fiyat · dönem başından değişim.
    const byTime = new Map(bars.map((bar) => [bar.time, bar]));
    const onCrosshair = (param: MouseEventParams) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const bar = byTime.get(param.time as number);
      if (!bar) {
        setHover(null);
        return;
      }
      setHover({
        dateLabel: dateFormatter.format(new Date(bar.time * 1000)),
        price: bar.close,
        changePct:
          baseline !== 0 ? ((bar.close - baseline) / baseline) * 100 : 0,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chart.timeScale().fitContent();

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
    };
  }, [state, mode, locale, intraday, themeTick, period, periodTone]);

  const toneText =
    periodTone === "up" ? "text-up" : periodTone === "down" ? "text-down" : "text-soft";
  const hoverTone =
    hover && hover.changePct > 0
      ? "text-up"
      : hover && hover.changePct < 0
        ? "text-down"
        : "text-soft";

  return (
    <div>
      {/* Okuma satırı — imleç gezerken nokta okuması, değilse dönem özeti */}
      <div className="flex min-h-[3.25rem] flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
        {hover ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="tote text-2xl">
                {formatPrice(hover.price, locale, { currency: true })}
              </span>
              <span className={cn("numeral text-sm font-semibold", hoverTone)}>
                {formatPercent(hover.changePct, locale)}
              </span>
            </div>
            <span className="numeral text-xs text-muted">{hover.dateLabel}</span>
          </>
        ) : period ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-soft">
                {labels.rangeLabels[range]}
              </span>
              <span className={cn("numeral text-xl font-bold", toneText)}>
                {formatPercent(period.changePct, locale)}
              </span>
            </div>
            <span className="numeral text-xs text-muted">
              {labels.periodLow}{" "}
              <span className="text-soft">{formatPrice(period.low, locale)}</span>
              {"  ·  "}
              {labels.periodHigh}{" "}
              <span className="text-soft">{formatPrice(period.high, locale)}</span>
            </span>
          </>
        ) : (
          <span className="skeleton h-7 w-40" />
        )}
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

      {/* Aralık ve mod seçici — grafiğin altında, Midas düzeni */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        <div className="scroll-x flex gap-1" role="tablist" aria-label="Aralık">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "numeral min-h-[36px] shrink-0 rounded-(--radius-sm) px-2.5 text-xs font-semibold transition-colors",
                range === r
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-primary-wash hover:text-primary",
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
   Ofset gün bazında önbelleklenir.
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
