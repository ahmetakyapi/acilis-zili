"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SESSION_BOUNDS } from "@/lib/market-hours";

/**
 * Gün Şeridi — ürünün imzası.
 *
 * Seans günü tek bir eksendir: 04:00'te başlar, 09:30'da zil çalar, 16:00'da
 * kapanır, 20:00'de biter. Günün ekonomik olayları bu eksene kendi saatlerinde
 * asılır; canlı işaretçi gerçek zamanda kayar.
 *
 * HANDOFF §9: masaüstündeki YATAY şerit ile mobildeki DİKEY zaman çizelgesi
 * ayrı bileşenlerdir — aynı düzeni responsive'le esnetmek yerine iki ayrı
 * düzen basılır. Ortak olan yalnızca saat matematiği ve canlı dakika.
 */

export type RailEvent = {
  id: string;
  /** ET "HH:mm" */
  timeEt: string;
  title: string;
  importance: "high" | "medium" | "low";
};

type RailLabels = {
  bell: string;
  close: string;
  now: string;
  noEvents: string;
};

type DayRailProps = {
  events: RailEvent[];
  /** ET gün içi dakika — sunucudan gelir, istemcide canlı güncellenir. */
  initialNowMinutes: number;
  /** Bugün seans var mı? Kapalı günde işaretçi ve zil vurgusu sönük kalır. */
  tradingDay: boolean;
  /** Yarım günlerde 13:00 (780). */
  closeMinutes: number;
  labels: RailLabels;
};

const RAIL_START = SESSION_BOUNDS.preMarketOpen; // 04:00
const RAIL_END = SESSION_BOUNDS.afterHoursClose; // 20:00
const RAIL_SPAN = RAIL_END - RAIL_START;

/** Konum formülü (HANDOFF §4): (dakika − 240) / 960 × 100% */
function pct(minutes: number): number {
  const clamped = Math.max(RAIL_START, Math.min(RAIL_END, minutes));
  return ((clamped - RAIL_START) / RAIL_SPAN) * 100;
}

function parseTime(timeEt: string): number {
  const [h, m] = timeEt.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

/** ET duvar saatini dakikada bir tazeler — sunucuya gitmeden. */
function useEtMinutes(initial: number): number {
  const [nowMinutes, setNowMinutes] = useState(initial);
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
  return nowMinutes;
}

export function DayRail(props: DayRailProps) {
  const nowMinutes = useEtMinutes(props.initialNowMinutes);
  return (
    <>
      <RailWide {...props} nowMinutes={nowMinutes} />
      <RailTall {...props} nowMinutes={nowMinutes} />
    </>
  );
}

/* ==========================================================================
   Masaüstü — yatay eksen
   ========================================================================== */

function RailWide({
  events,
  tradingDay,
  closeMinutes,
  labels,
  nowMinutes,
}: DayRailProps & { nowMinutes: number }) {
  const positioned = useMemo(() => {
    const sorted = [...events]
      .map((event) => ({ ...event, minutes: parseTime(event.timeEt) }))
      .sort((a, b) => a.minutes - b.minutes);

    // Çakışan olaylar dikeyde kademelenir (aynı 45dk penceresi → üst sıra)
    const result: (RailEvent & { minutes: number; row: number })[] = [];
    let lastMinutes = -Infinity;
    let row = 0;
    for (const event of sorted) {
      row = event.minutes - lastMinutes < 45 ? (row + 1) % 2 : 0;
      lastMinutes = event.minutes;
      result.push({ ...event, row });
    }
    return result;
  }, [events]);

  const nowVisible = nowMinutes >= RAIL_START && nowMinutes <= RAIL_END;

  return (
    <div className="relative hidden h-[150px] select-none md:block">
      {/* Taban çizgi + seans ağırlıkları — çizgi burada mobilyadır */}
      <div className="absolute inset-x-0 top-[104px] border-t border-rule" />
      <div
        className="absolute top-[104px] border-t-[3px] border-rule"
        style={{ left: 0, width: `${pct(SESSION_BOUNDS.regularOpen)}%` }}
      />
      <div
        className={cn(
          "absolute top-[104px] border-t-[3px]",
          tradingDay ? "border-ink" : "border-rule",
        )}
        style={{
          left: `${pct(SESSION_BOUNDS.regularOpen)}%`,
          width: `${pct(closeMinutes) - pct(SESSION_BOUNDS.regularOpen)}%`,
        }}
      />
      <div
        className="absolute top-[104px] border-t-[3px] border-rule"
        style={{ left: `${pct(closeMinutes)}%`, right: 0 }}
      />

      {positioned.length === 0 && (
        <p className="absolute inset-x-0 top-[64px] text-center text-[13px] text-faint">
          {labels.noEvents}
        </p>
      )}

      {/* Olaylar — dikey çizgi + yanında okunan etiket */}
      {positioned.map((event) => {
        const high = event.importance === "high";
        const left = pct(event.minutes);
        // Sağ uçtaki etiketler dışa taşmasın diye içe hizalanır
        const flip = left > 78;
        return (
          <div
            key={event.id}
            className="absolute"
            style={{
              left: `${left}%`,
              top: event.row === 0 ? 54 : 26,
              height: event.row === 0 ? 50 : 78,
            }}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0",
                high ? "border-l-2 border-down" : "border-l border-rule",
              )}
            />
            <div
              className={cn(
                "absolute -top-1 w-[150px] text-[11.5px] leading-[1.35]",
                flip ? "right-2 text-right" : "left-2",
              )}
            >
              <b
                className={cn(
                  "font-semibold",
                  high ? "text-down" : "text-ink",
                )}
              >
                {event.timeEt}
              </b>{" "}
              <span className={high ? "text-down" : "text-body"}>
                {event.title}
              </span>
            </div>
          </div>
        );
      })}

      {/* Açılış zili — mürekkep çentiği ve etiketi */}
      <div
        className="absolute top-[82px] h-[22px]"
        style={{ left: `${pct(SESSION_BOUNDS.regularOpen)}%` }}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 border-l-2",
            tradingDay ? "border-ink" : "border-rule",
          )}
        />
      </div>
      <div
        className="absolute top-[110px] whitespace-nowrap pl-2 text-[14px] font-semibold text-ink"
        style={{ left: `${pct(SESSION_BOUNDS.regularOpen)}%` }}
      >
        09:30 · {labels.bell}
      </div>

      {/* Kapanış zili */}
      <div
        className="absolute top-[110px] -translate-x-full whitespace-nowrap pr-2 text-[13px] text-faint"
        style={{ left: `${pct(closeMinutes)}%` }}
      >
        {hhmm(closeMinutes)} · {labels.close}
      </div>

      {/* Şu an — kesik camgöbeği çizgi */}
      {nowVisible && (
        <div
          className="absolute top-[8px] h-[104px]"
          style={{ left: `${pct(nowMinutes)}%` }}
        >
          <div className="absolute inset-y-0 left-0 border-l border-dashed border-up" />
          <span className="absolute -bottom-[15px] left-[-15px] whitespace-nowrap bg-page px-1 text-[10px] uppercase tracking-[0.1em] text-up">
            {labels.now}
          </span>
        </div>
      )}

      {/* Uç saat etiketleri */}
      <div className="absolute inset-x-0 top-[128px] text-[11.5px] text-faint">
        <span className="numeral absolute left-0">{hhmm(RAIL_START)}</span>
        <span className="numeral absolute right-0">{hhmm(RAIL_END)}</span>
      </div>
    </div>
  );
}

/* ==========================================================================
   Mobil — dikey zaman çizelgesi (HANDOFF §6)
   Saat sütunu 56px · nokta rayı 22px · içerik
   ========================================================================== */

function RailTall({
  events,
  tradingDay,
  closeMinutes,
  labels,
  nowMinutes,
}: DayRailProps & { nowMinutes: number }) {
  /* Olaylar ve zil anları tek listede, saate göre sıralı: mobilde gün
     yukarıdan aşağı okunur, "şimdi" nerede olduğun listede görünür. */
  const stops = useMemo(() => {
    const list: {
      key: string;
      minutes: number;
      title: string;
      note?: string;
      kind: "event-high" | "event" | "bell" | "now";
    }[] = events.map((event) => ({
      key: event.id,
      minutes: parseTime(event.timeEt),
      title: event.title,
      kind: event.importance === "high" ? "event-high" : "event",
    }));

    list.push({
      key: "bell-open",
      minutes: SESSION_BOUNDS.regularOpen,
      title: labels.bell,
      kind: "bell",
    });
    list.push({
      key: "bell-close",
      minutes: closeMinutes,
      title: labels.close,
      kind: "bell",
    });

    if (nowMinutes >= RAIL_START && nowMinutes <= RAIL_END) {
      list.push({
        key: "now",
        minutes: nowMinutes,
        title: labels.now,
        kind: "now",
      });
    }

    return list.sort((a, b) => a.minutes - b.minutes);
  }, [events, closeMinutes, nowMinutes, labels]);

  return (
    <div className="select-none md:hidden">
      {events.length === 0 && (
        <p className="pb-3 text-[13px] text-faint">{labels.noEvents}</p>
      )}
      {stops.map((stop, index) => {
        const last = index === stops.length - 1;
        const high = stop.kind === "event-high";
        const now = stop.kind === "now";
        const bell = stop.kind === "bell";

        return (
          <div key={stop.key} className="flex">
            <div
              className={cn(
                "numeral w-14 shrink-0 pt-0.5 text-[14px] font-semibold",
                high ? "text-down" : now ? "text-up" : "text-ink",
              )}
            >
              {hhmm(stop.minutes)}
            </div>

            {/* Nokta rayı — kare işaret + inen çizgi */}
            <div className="relative w-[22px] shrink-0">
              <span
                aria-hidden
                className={cn(
                  "absolute top-[6px]",
                  high
                    ? "left-[2px] size-[11px] bg-down"
                    : now
                      ? "left-[4px] size-[7px] rounded-full bg-up"
                      : bell
                        ? cn(
                            "left-[3px] size-[9px] border",
                            tradingDay ? "border-ink" : "border-rule",
                          )
                        : "left-[4px] size-[7px] bg-faint",
                )}
              />
              {!last && (
                <span
                  aria-hidden
                  className="absolute bottom-[-8px] left-[7px] top-[18px] border-l border-rule"
                />
              )}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
              <p
                className={cn(
                  "text-[15px] leading-[1.35]",
                  high
                    ? "font-semibold text-ink"
                    : now
                      ? "uppercase tracking-[0.08em] text-up"
                      : bell
                        ? "font-semibold text-ink"
                        : "text-body",
                )}
              >
                {stop.title}
              </p>
              {stop.note && (
                <p className="mt-0.5 text-[12.5px] text-faint">{stop.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
