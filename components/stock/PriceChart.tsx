"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
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
 *
 * Dokunmatikte okuma tek DOKUNUŞLA açılır ve parmağı kaldırınca durur.
 * Kütüphanenin kendi davranışı "basılı tut + sürükle"ydi; parmak kalkınca
 * okuma kayboluyordu, yani telefonda bir saatin fiyatını görmek mümkün
 * değildi. İmleç konumu bu yüzden elle sürülüyor (`setCrosshairPosition`)
 * ve grafiğin dışına dokunulunca temizleniyor. Bunun bedeli: grafik artık
 * kaydırılmıyor/yakınlaştırılmıyor — sürükleme okuma demek. Aralık zaten
 * alttaki 1G/1H/1A düğmeleriyle seçiliyor, kaydırmaya ihtiyaç yok.
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
  sessionPre: string;
  sessionRegular: string;
  sessionAfter: string;
  sessionOvernight: string;
  sessionOvernightNote: string;
};

/** Gün içi seans bölgesi — gölge + etiket olarak çizilir. */
type SessionZone = {
  key: "pre" | "after";
  left: number;
  width: number;
  label: string;
};

type PriceChartProps = {
  symbol: string;
  initialRange?: ChartRange;
  locale: Locale;
  labels: ChartLabels;
};

type ChartResult =
  | { key: string; phase: "error"; message: string }
  | {
      key: string;
      phase: "ready";
      bars: Bar[];
      source: string;
      stale: boolean;
      prevClose: number | null;
    };

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
  const [zones, setZones] = useState<SessionZone[]>([]);

  const requestKey = `${symbol}:${range}`;
  const state = useMemo(
    () =>
      result && result.key === requestKey
        ? result
        : ({ phase: "loading" } as const),
    [result, requestKey],
  );

  // Dönem istatistikleri — başlık satırı ve renk kararı bunlardan gelir.
  // 1G'de baz, TradingView/Midas konvansiyonuyla ÖNCEKİ SEANSIN KAPANIŞIDIR:
  // açılış boşluğu (gap) yüzdeye dahildir. Diğer aralıklarda baz dönem başıdır.
  const period = useMemo(() => {
    if (state.phase !== "ready" || state.bars.length === 0) return null;
    const bars = state.bars;
    const first = bars[0];
    const last = bars[bars.length - 1];
    const baseline =
      range === "1D" && state.prevClose ? state.prevClose : first.open;
    const changePct =
      baseline !== 0 ? ((last.close - baseline) / baseline) * 100 : 0;
    let high = -Infinity;
    let low = Infinity;
    for (const bar of bars) {
      if (bar.high > high) high = bar.high;
      if (bar.low < low) low = bar.low;
    }
    return { first, last, baseline, changePct, high, low };
  }, [state, range]);

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
          prevClose: data.prevClose ?? null,
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
    const baseline = period.baseline;

    const up = cssVar("--up");
    const down = cssVar("--down");
    // Fiyat serisi yön rengini taşır; dönem getirisi tam %0 ise gri kalır —
    // yeşil/kırmızı burada yalnızca gerçekten yön varken konuşur.
    const flat = cssVar("--flat");
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
      /* İmleç arayüz kromudur, yön göstergesi değil: çizgi ve tarih etiketi
         accent maviyle çizilir. Eskiden etiket serinin yön rengini (yeşil/
         kırmızı) alıyordu ve grafiğin üstünde bağımsız bir "yeşil kutu" gibi
         duruyordu — sitenin geri kalanında o renk yalnızca yön söylüyor. */
      crosshair: {
        vertLine: {
          color: cssVar("--primary-faint"),
          width: 1,
          style: 0,
          labelBackgroundColor: cssVar("--primary"),
        },
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
      // Sürükleme okuma yapıyor: kaydırma ve yakınlaştırma tümüyle kapalı.
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel: false,
        pinch: false,
        axisDoubleClickReset: false,
      },
    });
    chartRef.current = chart;

    let series: ISeriesApi<SeriesType>;
    if (mode === "area") {
      series = chart.addSeries(AreaSeries, {
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
      series = chart.addSeries(CandlestickSeries, {
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
    // `param.point` kontrol EDİLMİYOR: imleç elle sürüldüğünde (dokunmatik
    // okuma) o alan gelmeyebiliyor, oysa okunacak bar `time` ile belli.
    const onCrosshair = (param: MouseEventParams) => {
      if (!param.time) {
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

    /* Dokunuşla okuma — imleci x koordinatına en yakın bara oturtur.
       Okumayı `onCrosshair` üstleniyor: `setCrosshairPosition` da aynı
       aboneliği tetikliyor, ikinci bir durum yolu açmaya gerek yok. */
    const readAtClientX = (clientX: number) => {
      if (bars.length === 0) return;
      const rect = container.getBoundingClientRect();
      const logical = chart
        .timeScale()
        .coordinateToLogical(clientX - rect.left);
      if (logical === null) return;
      const index = Math.min(
        bars.length - 1,
        Math.max(0, Math.round(logical)),
      );
      const bar = bars[index];
      chart.setCrosshairPosition(bar.close, bar.time as UTCTimestamp, series);
    };

    let pressed = false;
    let readRaf = 0;

    /* TUZAK: `setCrosshairPosition` çağrısı, grafiğin AYNI olayı kendi
       içinde işlemesinden önce koşuyor. Kütüphane pointerdown'ı işlerken
       imleci kendi hesabına göre yeniden kuruyor ve elle koyduğumuz konumu
       siliyordu — sonuç: tek dokunuşta alttaki tarih beliriyor ama grafik
       üstündeki fiyat işareti yerinde kalıyor, ancak basılı tutup
       kıpırdatınca (yeni pointermove olayları) düzeliyordu.

       Çözüm, okumayı bir sonraki kareye ERTELEYİP tekrar uygulamak: ilk
       çağrı anında tepki verir, rAF'taki ikinci çağrı kütüphanenin kendi
       işlemesinden sonra son sözü söyler. Basılı tutma davranışı
       değişmiyor, pointermove yolu aynen duruyor. */
    const readSticky = (clientX: number) => {
      readAtClientX(clientX);
      cancelAnimationFrame(readRaf);
      readRaf = requestAnimationFrame(() => readAtClientX(clientX));
    };

    const onPointerDown = (event: PointerEvent) => {
      pressed = true;
      readSticky(event.clientX);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (pressed) readAtClientX(event.clientX);
    };
    const onPointerRelease = () => {
      pressed = false;
    };
    /* Fare tarafında bazı tarayıcılar pointerdown'ı grafiğin kendi tıklama
       işleyicisinden SONRA teslim ediyor; click tek dokunuşu ikinci kez
       sabitliyor. Aynı bara ikinci kez yazmak zararsız. */
    const onClick = (event: MouseEvent) => readSticky(event.clientX);
    // Grafiğin dışına dokunulunca okuma kapanır, dönem özetine dönülür.
    const onOutsidePointerDown = (event: PointerEvent) => {
      if (container.contains(event.target as Node)) return;
      chart.clearCrosshairPosition();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("click", onClick);
    window.addEventListener("pointerup", onPointerRelease);
    window.addEventListener("pointercancel", onPointerRelease);
    document.addEventListener("pointerdown", onOutsidePointerDown);

    chart.timeScale().fitContent();

    /* Seans bölgeleri — yalnızca 1G görünümünde. Barlar ET duvar saatine
       kaydırıldığı için gün sınırı düz UTC bölmesiyle bulunur; 04:00-09:30
       ön seans, 16:00-20:00 akşam seansı gölgelenir. Gece seansı (20:00-04:00)
       IEX beslemesinde işlem görmez, lejantta not düşülür. */
    const updateZones = () => {
      if (range !== "1D" || bars.length === 0) {
        setZones([]);
        return;
      }
      const dayStart = Math.floor(bars[0].time / 86400) * 86400;
      const bounds = {
        preOpen: dayStart + 4 * 3600,
        bell: dayStart + 9.5 * 3600,
        close: dayStart + 16 * 3600,
        afterEnd: dayStart + 20 * 3600,
      };
      const paneWidth =
        container.clientWidth - chart.priceScale("right").width();
      const coordFor = (t: number): number => {
        const coord = chart
          .timeScale()
          .timeToCoordinate(t as UTCTimestamp);
        if (coord !== null) return Math.max(0, Math.min(coord, paneWidth));
        // Görünür aralığın dışında — yakın kenara yapıştır.
        const visible = chart.timeScale().getVisibleRange();
        if (!visible) return 0;
        return t <= (visible.from as number) ? 0 : paneWidth;
      };
      const next: SessionZone[] = [];
      const pushZone = (
        key: SessionZone["key"],
        from: number,
        to: number,
        label: string,
      ) => {
        const left = coordFor(from);
        const width = coordFor(to) - left;
        if (width > 2) next.push({ key, left, width, label });
      };
      pushZone("pre", bounds.preOpen, bounds.bell, labels.sessionPre);
      pushZone("after", bounds.close, bounds.afterEnd, labels.sessionAfter);
      setZones(next);
    };

    const raf = requestAnimationFrame(updateZones);
    chart.timeScale().subscribeVisibleTimeRangeChange(updateZones);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(readRaf);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("click", onClick);
      window.removeEventListener("pointerup", onPointerRelease);
      window.removeEventListener("pointercancel", onPointerRelease);
      document.removeEventListener("pointerdown", onOutsidePointerDown);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateZones);
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
    };
  }, [
    state,
    mode,
    locale,
    intraday,
    themeTick,
    period,
    periodTone,
    range,
    labels.sessionPre,
    labels.sessionAfter,
  ]);

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
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="text-sm text-soft">
                {labels.rangeLabels[range]}
              </span>
              <span className="tote text-2xl">
                {formatPrice(period.last.close, locale, { currency: true })}
              </span>
              <span className={cn("numeral text-lg font-bold", toneText)}>
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

      {/* Grafik alanı — yükseklik kasten cömert: yanındaki künye kartı daha
          uzun olduğu için grafik kartının altında ölü boşluk kalıyordu ve
          gün içi hareket 288px'e sıkışınca düzleşiyordu. */}
      <div className="relative h-[300px] w-full sm:h-[430px]">
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
        {/* Seans gölgeleri — 1G görünümünde ön/akşam seansları ayrışır */}
        {state.phase === "ready" &&
          zones.map((zone) => (
            <div
              key={zone.key}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 border-line-soft"
              style={{
                left: zone.left,
                width: zone.width,
                background: "var(--surface-sunken)",
                opacity: 0.38,
                borderLeftWidth: zone.key === "after" ? 1 : 0,
                borderRightWidth: zone.key === "pre" ? 1 : 0,
              }}
            />
          ))}
        {state.phase === "ready" &&
          zones
            .filter((zone) => zone.width > 56)
            .map((zone) => (
              <span
                key={`${zone.key}-label`}
                aria-hidden
                className="plate pointer-events-none absolute top-1.5 text-[8px]"
                style={{ left: zone.left + 6 }}
              >
                {zone.label}
              </span>
            ))}
      </div>

      {/* Seans lejantı — gün içi görünümde günün saat haritası (ET) */}
      {range === "1D" && state.phase === "ready" && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            {labels.sessionPre}
            <span className="numeral">04:00–09:30</span>
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1 font-medium text-soft">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {labels.sessionRegular}
            <span className="numeral">09:30–16:00</span>
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            {labels.sessionAfter}
            <span className="numeral">16:00–20:00</span>
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            {labels.sessionOvernight}
            <span className="numeral">20:00–04:00</span>
          </span>
          <span className="basis-full sm:basis-auto">
            {labels.sessionOvernightNote}
          </span>
        </div>
      )}

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
                  ? "bg-primary text-on-primary"
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
