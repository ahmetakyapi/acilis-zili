"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartResponse } from "@/app/api/chart/[symbol]/route";
import type { Bar, ChartRange } from "@/lib/providers/types";
import { CHART_RANGES } from "@/lib/providers/types";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { ChartLabels } from "@/lib/chart-labels";
import { SESSION_BOUNDS, etDateTimeToUtc, etParts } from "@/lib/market-hours";
import {
  clockOf,
  displayZone,
  sessionWindows,
  zoneOffsetSeconds,
  zoneTag,
} from "@/lib/session-clock";

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
  /**
   * Sayfa başlığındaki kotasyon — okuma satırı bunu yazar.
   *
   * Eğri barlardan çiziliyor ve barın son kapanışı ile anlık kotasyon
   * tanımı gereği farklı sayılar: biri son tamamlanmış dakikanın kapanışı,
   * diğeri son işlem. Ekranda yan yana duran iki fiyatın birbirini
   * tutmaması ise okuyucu için hata demek. Büyük punto ile yazılan fiyat bu
   * yüzden başlıktakiyle aynı kaynaktan geliyor.
   */
  quote?: { price: number | null; changePct: number | null } | null;
  /**
   * Açılış aralığının barları — SUNUCUDAN.
   *
   * Bunlar olmadan zincir "HTML → JS indir → hidrasyon → fetch → çizim"
   * diye işliyordu: sayfanın en büyük görsel öğesi gereksiz bir gidiş-dönüş
   * kadar geç beliriyordu. Üstelik `/api/chart` yanıtları `no-store` ile
   * yayınlandığı için o istek hiçbir katmanda önbelleğe de girmiyor.
   * Aralık düğmeleri aynı şekilde çalışmaya devam ediyor — effect yalnızca
   * istenen aralık ilk aralıktan farklıysa ağa çıkıyor.
   */
  /**
   * O günün kapanış dakikası (ET gün içi dakika) — yarım günlerde 13:00.
   *
   * Grafiğin seans gölgeleri buna dayanıyor; sunucu `getMarketStatus`ten
   * zaten biliyor. Verilmezse normal kapanışa düşülür.
   */
  closeMinutes?: number;
  /* `source` ve `stale` BİLEREK YOK. Sağlayıcı yanıtı ikisini de taşıyor ve
     bir dönem buraya kadar getiriliyordu — prop tipinde, `ChartResult`ta, ilk
     durumda ve fetch yanıtının setState'inde — ama çizimde hiçbirine
     dokunulmuyordu. Sunucu da her istekte iki alanı boşuna RSC yüküne
     yazıyordu. Damga eklemek de çözüm değil: aynı sembolün künyesi sayfa
     başlığında zaten var, grafiğin altına ikincisini koymak aynı sayıyı iki
     yerde göstermek olurdu. `/api/chart` yanıtı alanları taşımaya devam
     ediyor — orası bir uç nokta sözleşmesi. */
  initialBars?: {
    bars: Bar[];
    prevClose?: number | null;
  } | null;
};

type ChartResult =
  | { key: string; phase: "error"; message: string }
  | {
      key: string;
      phase: "ready";
      bars: Bar[];
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
  quote,
  closeMinutes = SESSION_BOUNDS.regularClose,
  initialBars,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [mode, setMode] = useState<"area" | "candles">("area");
  const [result, setResult] = useState<ChartResult | null>(
    initialBars && initialBars.bars.length > 0
      ? {
          key: `${symbol}:${initialRange}`,
          phase: "ready",
          bars: initialBars.bars,
          prevClose: initialBars.prevClose ?? null,
        }
      : null,
  );
  const [hover, setHover] = useState<HoverReading>(null);
  /* DOKUNULAN OKUMA ARALIKLA BİRLİKTE TEMİZLENİYOR.
     Dokunmatikte okuma tek dokunuşla açılıyor ve grafiğin dışına
     dokunulana kadar EKRANDA KALIYOR (gerekçesi bileşen başında). Ama
     aralık düğmeleri grafiğin dışında değil: okuyucu bir noktaya dokunup
     sonra 1G'den 1A'ya geçtiğinde okuma satırı hâlâ o eski noktayı
     gösteriyor, yani yeni aralığın getirisi ekranda hiç görünmüyordu —
     üstelik gösterilen sayı artık var olmayan bir barın okumasıydı.
     Aralık değişimi okumayı bitirir; grafiğin kendisi zaten yeniden
     kuruluyor ve imleç orada temizleniyor. */
  const [hoverRange, setHoverRange] = useState<ChartRange>(initialRange);
  if (hoverRange !== range) {
    setHoverRange(range);
    if (hover !== null) setHover(null);
  }
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

    /* ELDEKİ ARALIK İÇİN AĞA ÇIKILMIYOR. Açılış aralığının barları
       sunucudan geliyor (`initialBars`) ve `result` onlarla başlatılıyor;
       koşulsuz bir fetch aynı veriyi ikinci kez istemek olurdu.

       `result` bağımlılık listesinde ve bu bir döngü kurmuyor: fetch bittiğinde
       setResult aynı anahtarı yazıyor, effect bir kez daha koşup buradan
       dönüyor. Aralık değiştiğinde anahtar tutmuyor ve istek gidiyor. */
    if (result?.key === key) return;

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
          prevClose: data.prevClose ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, phase: "error", message: labels.failed });
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range, result, labels.failed, labels.noData]);

  const intraday = range === "1D" || range === "1W";

  // Grafiği kur / güncelle
  useEffect(() => {
    const container = containerRef.current;
    if (!container || state.phase !== "ready" || !period) return;

    const zone = displayZone(locale);
    const bars = shiftBarsToZone(state.bars, zone);
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
    /* Eksen biçimlendiricileri — barlar gösterim dilimine kaydırıldığı için
       ikisi de UTC okur. */
    const eksenSaati = new Intl.DateTimeFormat(intlLocale, {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const eksenGunu = new Intl.DateTimeFormat(intlLocale, {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
    const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
      timeZone: "UTC", // barlar zaten gösterim dilimine kaydırıldı
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
        /* GÜN SINIRI ETİKETİ. Kütüphanenin varsayılanı, bir işaret yeni bir
           güne geçtiğinde çıplak ayın gününü basıyor: eksende "21:00" ile
           "02:00" arasında tek başına bir "22" duruyordu ve o sayı ne saat
           ne yüzde ne fiyat — hiçbir komşusuyla aynı dilde değil.
           Gün sınırı gerçek ve gösterilmeli: TR'de gün içi grafik 11:00'de
           açılıp ertesi sabah 03:00'te bitiyor, yani eksenin ortasında
           takvim günü değişiyor. Ama sayının kendisi değil, TARİH yazılmalı.
           Saat işaretleri de aynı elden geçiyor ki iki biçim aynı yerelden
           gelsin.
           `null` dönmek kütüphanenin kendi biçimlendiricisine düşmek demek —
           gün üstü aralıklarda (1A, 3A, 1Y…) varsayılan davranış korunuyor. */
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
          if (!intraday || typeof time !== "number") return null;
          const at = new Date(time * 1000);
          return tickMarkType === TickMarkType.Time ||
            tickMarkType === TickMarkType.TimeWithSeconds
            ? eksenSaati.format(at)
            : eksenGunu.format(at);
        },
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

      /* Okuma DOĞRUDAN yazılıyor, imleç aboneliğinin dönmesi beklenmiyor.
         Telefonda parmağın altındaki fiyat bazen geç yansıyordu: değeri
         yalnızca `subscribeCrosshairMove` besliyordu ve o geri çağrı,
         kütüphane imleci kendi içinde işledikten SONRA — bazen bir sonraki
         karede — geliyordu. Okunacak bar burada zaten belli; state'i beklemek
         için bir sebep yok. Abonelik yine duruyor (fare, klavye, temizleme). */
      setHover({
        dateLabel: dateFormatter.format(new Date(bar.time * 1000)),
        price: bar.close,
        changePct:
          baseline !== 0 ? ((bar.close - baseline) / baseline) * 100 : 0,
      });
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

    /* Seans bölgeleri — yalnızca 1G görünümünde. 04:00-09:30 ön seans,
       16:00-20:00 akşam seansı gölgelenir (ET). Gece seansı (20:00-04:00)
       konsolide tape'te akmaz, lejantta not düşülür.

       Sınırlar ET TAKVİMİNDEN hesaplanır, barların gününü ikiye bölerek
       değil: gösterim dilimi İstanbul olduğunda ABD'nin akşam seansı ertesi
       güne (03:00) taşıyor ve düz bir UTC bölmesi yanlış güne düşüyordu. */
    const etDay = etParts(new Date(state.bars[0].time * 1000)).dateStr;
    const displayTimeOf = (timeEt: string): number => {
      const utcSeconds = Math.floor(
        etDateTimeToUtc(etDay, timeEt).getTime() / 1000,
      );
      return utcSeconds + zoneOffsetSeconds(utcSeconds, zone);
    };

    const updateZones = () => {
      if (range !== "1D" || bars.length === 0) {
        setZones([]);
        return;
      }
      /* SINIRLAR SABİT DİZE DEĞİL, `SESSION_BOUNDS`TAN. Dört saat elle
         yazılıydı ve YARIM GÜNLERDE yanlış yere düşüyordu: Şükran Günü
         ertesi ve 24 Aralık'ta borsa 13:00 ET'de kapanıyor, uzatılmış seans
         da erken bitiyor — grafik ise o günlerde 13:00-16:00 arasını ana
         seans, 16:00-20:00 arasını akşam seansı diye gölgeliyordu, yani
         piyasanın KAPALI olduğu üç saati açık gibi çiziyordu. Kapanış
         sunucudan geliyor (`getMarketStatus` onu zaten hesaplıyor); akşam
         bandı da kapanıştan dört saat sonra bitiyor — `afterHoursClose`
         ile normal kapanış arasındaki farkın aynısı. */
      const closeEt = clockOf(closeMinutes);
      const afterEndMinutes =
        closeMinutes +
        (SESSION_BOUNDS.afterHoursClose - SESSION_BOUNDS.regularClose);
      const bounds = {
        preOpen: displayTimeOf(clockOf(SESSION_BOUNDS.preMarketOpen)),
        bell: displayTimeOf(clockOf(SESSION_BOUNDS.regularOpen)),
        close: displayTimeOf(closeEt),
        afterEnd: displayTimeOf(clockOf(afterEndMinutes)),
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
    closeMinutes,
    intraday,
    themeTick,
    period,
    periodTone,
    range,
    labels.sessionPre,
    labels.sessionAfter,
  ]);

  /* Seans lejantı — okuyucunun saatiyle yazılır, diğer saat alt satırda tek
     bir zincir hâlinde durur. Saatler sabit değil: barın kendi gününden
     hesaplanır, çünkü ABD yaz saati Türkiye'ye göre kayıyor (açılış yazın
     16:30, kışın 17:30). */
  const windows = useMemo(() => {
    if (state.phase !== "ready" || state.bars.length === 0) return null;
    const dayEt = etParts(new Date(state.bars[0].time * 1000)).dateStr;
    /* GÜNÜN KENDİ KAPANIŞI VERİLİYOR. Üçüncü argüman atlanıyordu ve lejant
       yarım günlerde varsayılan 16:00 kapanışını yazıyordu — oysa grafiğin
       hemen üstündeki gölgeler aynı bileşende doğru kapanışı kullanıyor.
       Ekranın iki yarısı aynı gün için iki farklı seans saati söylüyordu. */
    return sessionWindows(dayEt, locale, closeMinutes);
  }, [state, locale, closeMinutes]);

  const sessionName: Record<string, string> = {
    pre: labels.sessionPre,
    regular: labels.sessionRegular,
    after: labels.sessionAfter,
    overnight: labels.sessionOvernight,
  };

  /* Okunan fiyat: kotasyon varsa o, yoksa son barın kapanışı. Yüzde ise
     1G'de doğrudan kotasyonun günlük değişimi — böylece başlıktaki rozetle
     birebir aynı sayı çıkıyor. Diğer aralıklarda dönem getirisi, ama son
     nokta yine kotasyon: eğri barlardan, sayı canlı fiyattan. */
  const shownPrice = quote?.price ?? period?.last.close ?? null;
  const shownChangePct =
    range === "1D" && quote?.changePct !== null && quote?.changePct !== undefined
      ? quote.changePct
      : period && shownPrice !== null && period.baseline !== 0
        ? ((shownPrice - period.baseline) / period.baseline) * 100
        : (period?.changePct ?? null);

  const shownTone: "up" | "down" | "flat" =
    shownChangePct === null || shownChangePct === 0
      ? "flat"
      : shownChangePct > 0
        ? "up"
        : "down";

  const toneText =
    shownTone === "up" ? "text-up" : shownTone === "down" ? "text-down" : "text-soft";
  const hoverTone =
    hover && hover.changePct > 0
      ? "text-up"
      : hover && hover.changePct < 0
        ? "text-down"
        : "text-soft";

  return (
    <div>
      {/* Okuma satırı — imleç gezerken nokta okuması, değilse dönem özeti */}
      <div className="flex min-h-[3.5rem] flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
        {hover ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="tote text-heading sm:text-subdisplay">
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
              {/* FİYAT DAR EKRANDA BURADA YOK — sayfa başlığında 119 piksel
                  yukarıda, aynı sayı, daha büyük puntoyla zaten duruyor.
                  İkisi telefonda üst üste geldiğinde okuyucu hangisinin
                  sayfanın konusu olduğunu ayıramıyordu; üstelik yüzdede sıra
                  tersine dönüyordu: buradaki kopya (18px kalın) başlıktaki
                  rozetten (12px) daha güçlüydü. Geniş ekranda başlıktaki
                  fiyat sağ uçta, ekranın öbür yanında — orada tekrar
                  okunmuyor, kalıyor.
                  YÜZDE HER GENİŞLİKTE KALIYOR ve burası onun asıl yeri:
                  başlıktaki rozet GÜNLÜK değişimi söylüyor, bu ise SEÇİLİ
                  ARALIĞIN getirisi ve aralık düğmeleriyle birlikte
                  değişiyor. */}
              <span className="tote hidden text-heading sm:inline sm:text-subdisplay">
                {formatPrice(shownPrice, locale, { currency: true })}
              </span>
              <span className={cn("numeral text-lg font-bold", toneText)}>
                {formatPercent(shownChangePct, locale)}
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
                className="plate pointer-events-none absolute top-1.5 text-micro"
                style={{ left: zone.left + 6 }}
              >
                {zone.label}
              </span>
            ))}
      </div>

      {/* Seans lejantı — gün içi görünümde günün saat haritası */}
      {/* ---- Seans haritası ----
           ESKİ HÂLİ İKİ SATIRLIK BİR BULMACAYDI. Üstte "Ön Seans 11:00-16:30 ·
           Seans 16:30-23:00 · …" diye dört seans nokta ayraçlarıyla diziliyor,
           altında "ABD saatiyle: 04:00-09:30 · 09:30-16:00 · …" diye dört
           saat aralığı ADSIZ olarak sıralanıyordu. Okuyucu New York saatini
           bulmak için iki satır arasında SIRA SAYARAK eşleştirmek zorundaydı;
           "gece seansı konsolide tape'te akmaz" notu da satırın ucunda beşinci
           bir seans gibi duruyordu.

           Şimdi her seans kendi sütununda ve kendi iki saatini birlikte
           taşıyor: eşleştirme görsel, sayılacak bir şey yok. Soldaki kare
           grafikteki gölgeyle AYNI: ön ve akşam seansı çökük zeminle
           gölgeleniyor, asıl seans açık zeminde ve accent noktayla, gece ise
           kesikli boş kare — çünkü o pencerede veri yok, notu da altında. */}
      {range === "1D" && state.phase === "ready" && windows && (
        /* DAR EKRANDA DÖRT SATIR, DÖRT SÜTUN DEĞİL.
           2×2 ızgarada her hücre üç satır yazı taşıyordu (ad, TR saati, NY
           saati) ve gecenin notu dördüncü satırı ekliyordu: harita 390
           pikselde tek başına 400 piksel, yani grafiğin kendisi kadar yer
           kaplıyordu — oysa burası bir LEJANT, okunacak bir bölüm değil.
           Telefonda her seans tek satıra iniyor: ad solda, TR saati onun
           yanında, NY saati satırın sağ ucunda. Üçü aynı hizada okunuyor ve
           harita 400 pikselden ~110 piksele düşüyor. Geniş ekranda yer var,
           orada eski dört sütunlu düzen duruyor. */
        <div className="mt-3 flex flex-col gap-1 border-t border-line-soft pt-3 sm:grid sm:grid-cols-4 sm:gap-x-4 sm:gap-y-3">
          {windows.map((window) => {
            const shaded = window.key === "pre" || window.key === "after";
            const dark = window.key === "overnight";
            return (
              <div
                key={window.key}
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:flex-col sm:items-stretch sm:gap-1"
              >
                {/* Ad SABİT GENİŞLİKTE (dar ekranda): adlar iki ile on iki
                    karakter arasında değişiyor ve yanlarındaki TR saatleri
                    her satırda başka bir yerden başlıyordu — dört satır bir
                    tablo değil, ayrı ayrı cümleler gibi okunuyordu. Ölçü en
                    uzun ada göre ("Akşam Seansı"). Geniş ekranda ad kendi
                    satırında, orada rezervasyon gereksiz. */}
                <span className="flex w-[108px] shrink-0 items-center gap-1.5 text-tiny font-semibold text-body sm:w-auto">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-[3px] border",
                      window.key === "regular" &&
                        "border-transparent bg-primary",
                      shaded && "border-line bg-surface-sunken",
                      dark && "border-dashed border-line-strong",
                    )}
                  />
                  <span className="truncate">{sessionName[window.key]}</span>
                </span>
                <span className="numeral text-tiny leading-tight text-strong">
                  {window.primary}
                </span>
                <span className="numeral ml-auto text-micro leading-tight text-muted sm:ml-0">
                  {window.secondary} {zoneTag(locale).secondary}
                </span>
                {dark && (
                  /* Not KENDİ SATIRINDA: tek satıra sıkıştırılınca saatleri
                     ikinci satıra itiyordu. */
                  <span className="basis-full text-micro leading-[13px] text-muted sm:basis-auto">
                    {labels.sessionOvernightNote}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Aralık ve mod seçici — grafiğin altında, Midas düzeni */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        {/* SEKME DEĞİL, AÇMA-KAPAMA GRUBU. `role="tablist"` + `role="tab"`
            yazılıydı ama ne `aria-controls` ne de bir `tabpanel` vardı; grafik
            kabı sade bir `div`. Ekran okuyucu "sekme, seçili" diyor, kullanıcı
            ok tuşlarıyla gezmeyi bekliyor ve öyle bir yönetim yok — ARIA sözü
            tutulmuyordu. Aralık seçimi zaten bir sekme değil: aynı grafiğin
            penceresini değiştiriyor. */}
        <div className="scroll-x flex gap-1" role="group" aria-label={labels.rangeGroup}>
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "numeral min-h-11 shrink-0 rounded-(--radius-sm) px-2.5 sm:min-h-[36px] text-xs font-semibold transition-colors",
                range === r
                  ? "bg-primary text-on-primary"
                  : "text-muted hover:bg-primary-wash hover:text-primary-ink",
              )}
            >
              {labels.ranges[r]}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label={labels.modeGroup}>
          {(["area", "candles"] as const).map((m) => (
            <button
              key={m}
              type="button"
              /* Mod düğmelerinde hiç durum yoktu: hangi çizim türünün açık
                 olduğu yalnızca renkle anlatılıyordu. */
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "min-h-11 rounded-(--radius-sm) px-2.5 text-xs font-medium sm:min-h-[36px] transition-colors",
                mode === m
                  ? "bg-primary-wash text-primary-ink"
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
   Eksen saatleri OKUYUCUNUN saatini göstermeli.

   lightweight-charts zaman değerlerini UTC olarak basar; bu yüzden her bara
   günün ofseti eklenir (DST sınırı grafik içinde değişse bile doğru). Ofset
   gün bazında önbelleklenir.

   Hangi dilim: Türkçe okuyanda İstanbul, İngilizcede New York. Sayının
   kendisi değişmiyor, yalnızca eksende hangi duvar saatiyle okunduğu
   değişiyor — "16:30 açılış" Türkiye'de gerçekten 16:30'dur.
   -------------------------------------------------------------------------- */

function shiftBarsToZone(bars: Bar[], zone: string): Bar[] {
  let cachedDay = "";
  let cachedOffset = 0;
  return bars.map((bar) => {
    const day = new Date(bar.time * 1000).toISOString().slice(0, 10);
    if (day !== cachedDay) {
      cachedDay = day;
      cachedOffset = zoneOffsetSeconds(bar.time, zone);
    }
    return { ...bar, time: bar.time + cachedOffset };
  });
}
