"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { DuoLineChart, type DuoChartLabels, type DuoChartPoint } from "@/components/charts/DuoLineChart";
import { useRouteNavigating } from "@/components/layout/RouteProgress";
import { Segment, SegmentItem } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  DEFAULT_THEME_TIMELINE_RANGE,
  isThemeTimelineRange,
  THEME_TIMELINE_RANGES,
  type ThemeTimelineRange,
} from "@/lib/theme-timeline";

/**
 * Temanın zaman çizgisi — aralık seçicili istemci yaprağı (25 Ekim).
 *
 * Üç aralığın noktaları SUNUCUDA hazırlanıp geliyor (etiketler biçimli,
 * cümleler kurulmuş); aralık değişimi ağsız, yalnız seçim.
 *
 * ARALIK ADRESTE (`?aralik=3M`) ve adres TEK DOĞRU KAYNAK — karşılaştırma
 * ekranının kuralı (CompareLive → "BAŞLANGIÇ ARALIĞI ADRESTEN"): sığ
 * güncellemeden sonra geri tuşu eski ağacı yüklüyor ve prop'tan başlayan
 * durum adresle çelişiyordu. Burada durum hiç tutulmuyor; seçili aralık
 * `useSyncExternalStore` ile adresten okunuyor. Sunucu çiziminde ve
 * hidrasyonda varsayılan (1A) — sayfa adresi sunucuda okumuyor, ilk
 * istemci çiziminde adres devreye giriyor.
 *
 * SIĞ GÜNCELLEME (`history.replaceState`, `pushState` değil — aralık bir
 * gezinme değil) uçuştaki gezinmeyi öldürür: gezinme sürerken denetim
 * kapalı (`useRouteNavigating`, CLAUDE.md "Sığ adres güncellemesi").
 */

export type ThemeTimelineView = {
  points: DuoChartPoint[];
  axis: { index: number; label: string }[];
  sentence: string;
  /** Medyana girmeyen üyelerin künyesi; yoksa null. */
  excluded: string | null;
};

const RANGE_EVENT = "az:theme-range";

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(RANGE_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(RANGE_EVENT, callback);
  };
}
function readRange(): ThemeTimelineRange {
  const value = new URLSearchParams(window.location.search).get("aralik");
  return isThemeTimelineRange(value) ? value : DEFAULT_THEME_TIMELINE_RANGE;
}
const serverRange = () => DEFAULT_THEME_TIMELINE_RANGE;

export function ThemeTimelineChart({
  views,
  path,
  benchName,
  medianName,
  title,
  rangeLabel,
  ranges,
  rangeLongs,
  announce,
  chartLabels,
  chartTitle,
  locale,
}: {
  views: Record<ThemeTimelineRange, ThemeTimelineView | null>;
  /** Sayfanın yolu — bağlantının JS'siz düşüşü. */
  path: string;
  benchName: string | null;
  medianName: string;
  title: string;
  rangeLabel: string;
  ranges: Record<ThemeTimelineRange, string>;
  rangeLongs: Record<ThemeTimelineRange, string>;
  /** "{range}" yer tutuculu duyuru. */
  announce: string;
  chartLabels: DuoChartLabels;
  /** "{range}" yer tutuculu grafik adı. */
  chartTitle: string;
  locale: string;
}) {
  const range = useSyncExternalStore(subscribe, readRange, serverRange);
  const navigating = useRouteNavigating();
  const [spoken, setSpoken] = useState("");

  const choose = useCallback(
    (next: ThemeTimelineRange) => {
      const url = new URL(window.location.href);
      if (next === DEFAULT_THEME_TIMELINE_RANGE) url.searchParams.delete("aralik");
      else url.searchParams.set("aralik", next);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      window.dispatchEvent(new Event(RANGE_EVENT));
      setSpoken(announce.replace("{range}", rangeLongs[next]));
    },
    [announce, rangeLongs],
  );

  const available = THEME_TIMELINE_RANGES.filter((key) => views[key] !== null);
  /* Adresteki aralığın serisi kurulamadıysa (ör. yılın ilk günleri YBB)
     ilk kurulabilen aralık gösteriliyor; seçici de onu seçili basıyor. */
  const shown = views[range] ? range : (available[0] ?? range);
  const view = views[shown];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">{title}</h2>
        <span
          className={cn("transition-opacity", navigating && "pointer-events-none opacity-50")}
          aria-busy={navigating || undefined}
        >
          <Segment label={rangeLabel}>
            {available.map((key) => (
              <SegmentItem
                key={key}
                href={key === DEFAULT_THEME_TIMELINE_RANGE ? path : `${path}?aralik=${key}`}
                active={shown === key}
                label={rangeLongs[key]}
                prefetch={false}
                shallow
                disabled={navigating}
                onClick={(event) => {
                  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  if (navigating) return;
                  choose(key);
                }}
              >
                {ranges[key]}
              </SegmentItem>
            ))}
          </Segment>
        </span>
      </div>
      <p role="status" className="sr-only">
        {spoken}
      </p>
      {view ? (
        <>
          <p className="max-w-3xl text-read leading-relaxed text-strong">{view.sentence}</p>
          <DuoLineChart
            /* Aralık değişince grafik yeniden kuruluyor: çizgiler yeni
               şekline tek karede sıçramıyor, soldan çiziliyor. */
            key={shown}
            points={view.points}
            aName={medianName}
            bName={benchName}
            axis={view.axis}
            title={chartTitle.replace("{range}", rangeLongs[shown])}
            locale={locale}
            labels={chartLabels}
          />
          {view.excluded && <p className="text-small leading-relaxed text-muted">{view.excluded}</p>}
        </>
      ) : null}
    </div>
  );
}
