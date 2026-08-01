"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SESSION_BOUNDS } from "@/lib/market-hours";

/**
 * Gün Şeridi — ürünün imzası.
 *
 * Seans günü tek bir yatay eksendir: 04:00'te başlar, 09:30'da zil çalar,
 * 16:00'da kapanır, 20:00'de biter. Günün ekonomik olayları bu eksene kendi
 * saatlerinde asılır; canlı işaretçi şerit üzerinde gerçek zamanda kayar.
 * Kart ızgarası değil, zaman ekseni — "bugün ne zaman ne olacak" sorusunun
 * kendisi görselleşir.
 */

export type RailEvent = {
  id: string;
  /** ET "HH:mm" */
  timeEt: string;
  title: string;
  importance: "high" | "medium" | "low";
};

type DayRailProps = {
  events: RailEvent[];
  /** ET gün içi dakika — sunucudan gelir, istemcide canlı güncellenir. */
  initialNowMinutes: number;
  /** Bugün seans var mı? Kapalı günde işaretçi ve zil vurgusu sönük kalır. */
  tradingDay: boolean;
  /** Yarım günlerde 13:00 (780). */
  closeMinutes: number;
  labels: {
    bell: string;
    close: string;
    now: string;
    noEvents: string;
  };
};

const RAIL_START = SESSION_BOUNDS.preMarketOpen; // 04:00
const RAIL_END = SESSION_BOUNDS.afterHoursClose; // 20:00
const RAIL_SPAN = RAIL_END - RAIL_START;

function pct(minutes: number): number {
  const clamped = Math.max(RAIL_START, Math.min(RAIL_END, minutes));
  return ((clamped - RAIL_START) / RAIL_SPAN) * 100;
}

function parseTime(timeEt: string): number {
  const [h, m] = timeEt.split(":").map(Number);
  return h * 60 + m;
}

const HOUR_TICKS = [240, 360, 480, 600, 720, 840, 960, 1080, 1200];

export function DayRail({
  events,
  initialNowMinutes,
  tradingDay,
  closeMinutes,
  labels,
}: DayRailProps) {
  const [nowMinutes, setNowMinutes] = useState(initialNowMinutes);

  // Dakikada bir ET saatini yeniden hesapla — sunucuya gitmeden.
  useEffect(() => {
    function tick() {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
      const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
      setNowMinutes(h * 60 + m);
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const positioned = useMemo(() => {
    const sorted = [...events]
      .map((event) => ({ ...event, minutes: parseTime(event.timeEt) }))
      .sort((a, b) => a.minutes - b.minutes);

    // Çakışan olayları dikeyde kademelendir (aynı 40dk penceresi → alt sıra)
    const result: (RailEvent & { minutes: number; row: number })[] = [];
    let lastMinutes = -Infinity;
    let row = 0;
    for (const event of sorted) {
      row = event.minutes - lastMinutes < 40 ? (row + 1) % 3 : 0;
      lastMinutes = event.minutes;
      result.push({ ...event, row });
    }
    return result;
  }, [events]);

  const nowVisible = nowMinutes >= RAIL_START && nowMinutes <= RAIL_END;
  const marketLive =
    tradingDay &&
    nowMinutes >= SESSION_BOUNDS.regularOpen &&
    nowMinutes < closeMinutes;

  return (
    <div className="select-none">
      {/* Olay etiketleri — şeridin üstünde */}
      <div className="relative h-24 sm:h-20">
        {positioned.length === 0 && (
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-muted">
            {labels.noEvents}
          </p>
        )}
        {positioned.map((event) => (
          <div
            key={event.id}
            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-1"
            style={{ left: `${pct(event.minutes)}%`, marginBottom: `${event.row * 26}px` }}
          >
            <span
              className={cn(
                "max-w-28 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium sm:max-w-40",
                event.importance === "high"
                  ? "border-transparent bg-down-wash text-impact-high"
                  : event.importance === "medium"
                    ? "border-transparent bg-brass-wash text-impact-med"
                    : "border-line bg-surface text-soft",
              )}
              title={`${event.timeEt} ET · ${event.title}`}
            >
              <span className="numeral mr-1">{event.timeEt}</span>
              {event.title}
            </span>
            <span
              aria-hidden
              className={cn(
                "h-2.5 w-px",
                event.importance === "high" ? "bg-impact-high" : "bg-line-strong",
              )}
            />
          </div>
        ))}
      </div>

      {/* Şeridin kendisi */}
      <div className="relative">
        {/* Taban çizgi: seans dışı sönük, ana seans dolgun */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <div
          className={cn(
            "absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full",
            tradingDay ? "bg-primary" : "bg-line-strong",
          )}
          style={{
            left: `${pct(SESSION_BOUNDS.regularOpen)}%`,
            width: `${pct(closeMinutes) - pct(SESSION_BOUNDS.regularOpen)}%`,
          }}
        />

        {/* Saat çentikleri — cetvel motifi */}
        <div className="relative h-8">
          {HOUR_TICKS.map((minutes) => (
            <span
              key={minutes}
              aria-hidden
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-line-strong"
              style={{ left: `${pct(minutes)}%` }}
            />
          ))}

          {/* Açılış zili — pirinç nokta */}
          <span
            className={cn(
              "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              tradingDay ? "bg-brass" : "bg-line-strong",
            )}
            style={{ left: `${pct(SESSION_BOUNDS.regularOpen)}%` }}
            title={`09:30 ET · ${labels.bell}`}
          />
          {/* Kapanış zili */}
          <span
            className={cn(
              "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              tradingDay ? "border-brass bg-transparent" : "border-line-strong bg-transparent",
            )}
            style={{ left: `${pct(closeMinutes)}%` }}
            title={`${labels.close}`}
          />

          {/* Canlı işaretçi */}
          {nowVisible && (
            <span
              className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${pct(nowMinutes)}%` }}
            >
              <span
                className={cn(
                  "size-3 rounded-full border-2 border-(--page-bg)",
                  marketLive ? "bg-brass pulse-live" : "bg-flat",
                )}
                title={labels.now}
              />
            </span>
          )}
        </div>

        {/* Alt saat etiketleri — uç etiketler içe hizalanır, kart taşmaz */}
        <div className="relative h-4 text-[10px] text-muted">
          {[240, 570, closeMinutes, 1200].map((minutes) => {
            const position = pct(minutes);
            return (
              <span
                key={minutes}
                className={cn(
                  "numeral absolute",
                  position > 2 && position < 98 && "-translate-x-1/2",
                  position >= 98 && "-translate-x-full",
                  (minutes === 570 || minutes === closeMinutes) &&
                    "font-semibold text-soft",
                )}
                style={{ left: `${position}%` }}
              >
                {`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
