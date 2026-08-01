"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SESSION_BOUNDS } from "@/lib/market-hours";

/**
 * Gün Şeridi — ürünün imzası.
 *
 * Seans günü tek bir yatay eksendir: 04:00'te başlar, 09:30'da zil çalar,
 * 16:00'da kapanır, 20:00'de biter. Günün ekonomik olayları ve bilanço
 * açıklamaları bu eksene kendi saatlerinde asılır; canlı işaretçi şerit
 * üzerinde gerçek zamanda kayar.
 *
 * HANDOFF §5: AÇILIŞ/KAPANIŞ başlıkları eksenin ALTINDA (56px), olay alt
 * etiketleri 74px'de. Bu ayrım bir çakışma düzeltmesiydi — aynı bandı
 * paylaştırma.
 *
 * Mobilde tamamen ayrı bir düzen render edilir (dikey timeline), aynı
 * bileşeni responsive yapmaya çalışmak yerine.
 */

export type RailEvent = {
  id: string;
  /** ET "HH:mm" */
  timeEt: string;
  title: string;
  importance: "high" | "medium" | "low";
  /** Ekonomik veri mi, bilanço mu — alt etiket buna göre yazılır. */
  kind?: "event" | "earnings";
  /** Kullanıcının takip listesinde mi? Accent dolu nokta alır. */
  watched?: boolean;
  /** Alt satırda görünen sessiz bilgi — "42B · bekl. 65B", "bilanço". */
  detail?: string;
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
    /** Açılışın Türkiye saati ("16:30") — ET/TR farkı DST ile kaydığı için
        sunucuda hesaplanıp geliyor, burada sabitlenmiyor. */
    bellTr: string;
    closeTr: string;
  };
};

const RAIL_START = SESSION_BOUNDS.preMarketOpen; // 04:00
const RAIL_END = SESSION_BOUNDS.afterHoursClose; // 20:00
const RAIL_SPAN = RAIL_END - RAIL_START;

/** Eksenin dikey ölçüleri — mockup 4a'daki mutlak katman. */
const AXIS_TOP = 37;
const AXIS_HEIGHT = 6;
const BOUND_LABEL_TOP = 56;
/** AÇILIŞ/KAPANIŞ etiketinin altındaki saat satırı — HANDOFF §5'e ek.
    Sınırların saatini yazmak istendi; olay etiketleri bu yüzden 74 yerine
    90'da başlıyor ve şerit 16px yükseldi. */
const BOUND_TIME_TOP = 70;
const EVENT_LABEL_TOP = 90;
/** Çakışan alt etiketler bu kadar aşağı kademelenir. */
const ROW_OFFSET = 30;
/** İki olay bu dakikadan yakınsa etiketleri üst üste biner. */
const COLLISION_MINUTES = 70;

function pct(minutes: number): number {
  const clamped = Math.max(RAIL_START, Math.min(RAIL_END, minutes));
  return ((clamped - RAIL_START) / RAIL_SPAN) * 100;
}

function parseTime(timeEt: string): number {
  const [h, m] = timeEt.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

/** ET duvar saatini dakikaya çevirir — istemci tarafı tik. */
function readEtMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function DayRail({
  events,
  initialNowMinutes,
  tradingDay,
  closeMinutes,
  labels,
}: DayRailProps) {
  const [nowMinutes, setNowMinutes] = useState(initialNowMinutes);

  // Dakikada bir ET saatini yeniden hesapla — sunucuya gitmeden. İlk eşitleme
  // de zamanlayıcıdan geçer; effect gövdesinde senkron setState zincirleme
  // render'a yol açıyor.
  useEffect(() => {
    const sync = () => setNowMinutes(readEtMinutes());
    const first = window.setTimeout(sync, 0);
    const id = window.setInterval(sync, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  const positioned = useMemo(() => {
    const sorted = [...events]
      .map((event) => ({
        ...event,
        minutes: parseTime(event.timeEt),
        // Yüksek etkili ve takipteki olaylar eksenin ÜSTÜNDE durur; kalabalık
        // alt bandı boşaltmakla kalmaz, önemli olanı da öne çıkarır.
        prominent: event.importance === "high" || Boolean(event.watched),
      }))
      .sort((a, b) => a.minutes - b.minutes);

    // Alt banttaki etiketleri kademelendir — üsttekiler zaten seyrek.
    const result: ((typeof sorted)[number] & { row: number })[] = [];
    let lastBelow = -Infinity;
    let row = 0;
    for (const event of sorted) {
      if (event.prominent) {
        result.push({ ...event, row: 0 });
        continue;
      }
      row = event.minutes - lastBelow < COLLISION_MINUTES ? (row + 1) % 2 : 0;
      lastBelow = event.minutes;
      result.push({ ...event, row });
    }
    return result;
  }, [events]);

  const maxRow = positioned.reduce(
    (max, event) => (event.prominent ? max : Math.max(max, event.row)),
    0,
  );
  // Boş gün notu, sınırların saat satırlarıyla aynı banda düşmesin diye
  // olay bandının bir kademe altına iner; şerit de o kadar yükselir.
  const empty = positioned.length === 0;
  const railHeight = (empty ? 152 : 128) + maxRow * ROW_OFFSET;

  const nowVisible = nowMinutes >= RAIL_START && nowMinutes <= RAIL_END;
  const marketLive =
    tradingDay &&
    nowMinutes >= SESSION_BOUNDS.regularOpen &&
    nowMinutes < closeMinutes;

  const openPct = pct(SESSION_BOUNDS.regularOpen);
  const closePct = pct(closeMinutes);

  return (
    <div className="select-none">
      {/* ================= Masaüstü: yatay eksen ================= */}
      <div
        className="relative hidden sm:block"
        style={{ height: railHeight }}
        aria-hidden
      >
        {/* Taban şerit */}
        <div
          className="absolute inset-x-0 rounded-full bg-surface-elevated"
          style={{ top: AXIS_TOP, height: AXIS_HEIGHT }}
        />
        {/* Ana seans — accent %28 */}
        <div
          className={cn(tradingDay ? "bg-primary/28" : "bg-bar")}
          style={{
            position: "absolute",
            left: `${openPct}%`,
            width: `${closePct - openPct}%`,
            top: AXIS_TOP,
            height: AXIS_HEIGHT,
          }}
        />

        {/* Şu an — 3px accent çizgi */}
        {nowVisible && (
          <div
            className={cn(
              "absolute w-[3px] rounded-full",
              marketLive ? "bg-primary" : "bg-flat",
            )}
            style={{ left: `${pct(nowMinutes)}%`, top: 27, height: 26 }}
            title={labels.now}
          />
        )}

        {/* AÇILIŞ / KAPANIŞ — eksenin altında, olay etiketlerinden ayrı bant.
            Altına iki saat birden yazılır: New York seansın kendi saati,
            Türkiye ise okuyucunun duvar saati. */}
        {[
          {
            key: "open",
            left: openPct,
            label: labels.bell,
            et: formatMinutes(SESSION_BOUNDS.regularOpen),
            tr: labels.bellTr,
          },
          {
            key: "close",
            left: closePct,
            label: labels.close,
            et: formatMinutes(closeMinutes),
            tr: labels.closeTr,
          },
        ].map((bound) => (
          <div
            key={bound.key}
            className="absolute -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `${bound.left}%`, top: BOUND_LABEL_TOP }}
          >
            <div className="plate text-[10.5px] tracking-[0.08em] text-body">
              {bound.label}
            </div>
            <div
              className="numeral text-[10.5px] text-muted"
              style={{ marginTop: BOUND_TIME_TOP - BOUND_LABEL_TOP - 12 }}
            >
              <span className="font-semibold text-body">{bound.et}</span> NY
              <span aria-hidden className="mx-1">
                ·
              </span>
              <span className="font-semibold text-body">{bound.tr}</span> TR
            </div>
          </div>
        ))}

        {positioned.map((event) => {
          const left = `${pct(event.minutes)}%`;
          const high = event.importance === "high";
          return (
            <div key={event.id}>
              {/* Nokta */}
              {event.prominent ? (
                <div
                  className={cn(
                    "absolute size-4 rounded-full",
                    high ? "bg-down" : "bg-primary",
                  )}
                  style={{ left, top: 32, transform: "translateX(-8px)" }}
                />
              ) : (
                <div
                  className="absolute size-3 rounded-full border-2 border-flat bg-page"
                  style={{ left, top: 34, transform: "translateX(-6px)" }}
                />
              )}

              {/* Etiket — önemliler üstte, kalanlar altta */}
              {event.prominent ? (
                <div
                  className="absolute -translate-x-1/2 whitespace-nowrap text-center"
                  style={{ left, top: -2 }}
                >
                  <div
                    className={cn(
                      "text-xs font-bold",
                      high ? "text-down" : "text-primary",
                    )}
                  >
                    <span className="numeral">{event.timeEt}</span> {event.title}
                  </div>
                  {event.detail && (
                    <div className="text-[11px] text-body">{event.detail}</div>
                  )}
                </div>
              ) : (
                <div
                  className="absolute -translate-x-1/2 whitespace-nowrap text-center"
                  style={{ left, top: EVENT_LABEL_TOP + event.row * ROW_OFFSET }}
                >
                  <div className="numeral text-[11.5px] font-semibold text-strong">
                    {event.timeEt}
                  </div>
                  <div className="max-w-32 truncate text-[11px] text-muted">
                    {event.detail ?? event.title}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {empty && (
          <p
            className="absolute inset-x-0 text-center text-xs text-muted"
            style={{ top: EVENT_LABEL_TOP + 28 }}
          >
            {labels.noEvents}
          </p>
        )}
      </div>

      {/* ================= Mobil: dikey timeline ================= */}
      <ul className="sm:hidden">
        {[
          ...positioned,
          ...(nowVisible
            ? [
                {
                  id: "__now",
                  minutes: nowMinutes,
                  timeEt: formatMinutes(nowMinutes),
                  title: labels.now,
                  importance: "low" as const,
                  prominent: false,
                  row: 0,
                  kind: "now" as const,
                  detail: undefined,
                  watched: false,
                },
              ]
            : []),
          {
            id: "__open",
            minutes: SESSION_BOUNDS.regularOpen,
            timeEt: formatMinutes(SESSION_BOUNDS.regularOpen),
            title: labels.bell,
            importance: "low" as const,
            prominent: false,
            row: 0,
            kind: "bound" as const,
            // Soldaki sütun NY saatini yazıyor; Türkiye saati alt satırda.
            detail: `${labels.bellTr} TR` as string | undefined,
            watched: false,
          },
          {
            id: "__close",
            minutes: closeMinutes,
            timeEt: formatMinutes(closeMinutes),
            title: labels.close,
            importance: "low" as const,
            prominent: false,
            row: 0,
            kind: "bound" as const,
            detail: `${labels.closeTr} TR` as string | undefined,
            watched: false,
          },
        ]
          .sort((a, b) => a.minutes - b.minutes)
          .map((entry, index, list) => {
            const isNow = entry.kind === "now";
            const isBound = entry.kind === "bound";
            const high = entry.importance === "high";
            const last = index === list.length - 1;
            return (
              <li key={entry.id} className="flex gap-0">
                <div
                  className={cn(
                    "numeral w-12 shrink-0 pt-px text-[12.5px]",
                    isNow
                      ? "font-bold text-primary"
                      : high
                        ? "font-bold text-down"
                        : isBound
                          ? "font-bold text-strong"
                          : "font-semibold text-body",
                  )}
                >
                  {entry.timeEt}
                </div>
                <div className="relative w-5 shrink-0">
                  {isNow ? (
                    <span className="absolute inset-x-0 top-2 h-0.5 bg-primary" />
                  ) : (
                    <span
                      className={cn(
                        "absolute rounded-full",
                        high || entry.watched
                          ? "left-px top-1 size-3"
                          : "left-0.5 top-[5px] size-[9px]",
                        high
                          ? "bg-down"
                          : entry.watched
                            ? "bg-primary"
                            : isBound
                              ? "bg-strong"
                              : "border-2 border-muted bg-page",
                      )}
                    />
                  )}
                  {!last && (
                    <span className="absolute bottom-[-6px] left-1.5 top-4 w-px bg-line-strong" />
                  )}
                </div>
                <div className={cn(!last && "pb-3.5")}>
                  <div
                    className={cn(
                      "text-[13.5px]",
                      isNow
                        ? "plate text-[10.5px] text-primary"
                        : high
                          ? "font-bold text-strong"
                          : isBound
                            ? "font-bold tracking-[0.03em] text-strong"
                            : "font-medium text-strong",
                    )}
                  >
                    {entry.title}
                  </div>
                  {entry.detail && (
                    <div className="text-[11.5px] text-muted">{entry.detail}</div>
                  )}
                </div>
              </li>
            );
          })}
      </ul>

      {/* Not, çizelgenin ALTINDA durur: üstte olsaydı hemen ardından gelen
          açılış/kapanış satırlarını yalanlıyor gibi okunuyordu. */}
      {positioned.length === 0 && (
        <p className="mt-1 text-xs text-muted sm:hidden">{labels.noEvents}</p>
      )}
    </div>
  );
}
