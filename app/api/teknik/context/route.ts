import { NextResponse } from "next/server";
import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEventsBetween, getStatus, getSymbolNames } from "@/lib/data";
import { ET_ZONE, SESSION_BOUNDS, addEtDays } from "@/lib/market-hours";
import { earningsCalendar } from "@/lib/schema";
import { TR_ZONE, clockOf, formatInZone, timePair } from "@/lib/session-clock";
import {
  SLOT_RANK,
  TECHNICAL_CRON,
  TECHNICAL_SYMBOLS,
  currentSlot,
  isTechnicalSlot,
  slotInstant,
} from "@/lib/technical";
import {
  getPreviousEditions,
  getTechnicalSnapshots,
  snapshotForApi,
} from "@/lib/technical-data";

/**
 * Teknik analiz rutini için bağlam paketi.
 *
 * Rutin bu ucu çeker ve üç soruyu cevaplar:
 *   1. Şu an hangi analizin sırası — açılış öncesi mi, seans içi mi, hiç mi?
 *   2. On iki hissenin göstergeleri ne diyor?
 *   3. Bir önceki analizde ne demiştim?
 *
 * GÖSTERGELER BURADA HESAPLANIYOR, rutin yalnızca okuyor. Talimatı
 * docs/claude-rutinler.md § 5'te; neden böyle olduğu `lib/technical.ts`
 * başındaki yorumda.
 *
 * `?slot=premarket|midsession` elle deneme için: saatinin dışında koşturulan
 * bir rutin de hangi yayını yazacağını bilsin. İşlem günü olmayan bir günde
 * yine de `slot: null` döner — tatilde yazılan analiz olmayan bir seansı
 * anlatırdı.
 */

/** Yaklaşan bilanço bu kadar gün içindeyse rutine söyleniyor. */
const EARNINGS_HORIZON_DAYS = 45;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const override = url.searchParams.get("slot");
  const status = await getStatus();
  const sessionDate = status.etDate;
  /* GEÇERSİZ KILMA YALNIZCA YAZILABİLECEK SLOTA. Yazma ucu yeni kaydı
     yalnızca şu anki ya da daha erken slota kabul ediyor (bkz.
     saveTechnicalBatch); bağlam bir dönem işlem günü boyunca her saatte
     her slotu veriyordu ve kapanıştan sonra "premarket" isteyen rutin,
     yazılamayacak bir yayının bağlamını alıyordu. */
  const live = status.tradingToday ? currentSlot(status) : null;
  const slot =
    live !== null && isTechnicalSlot(override) && SLOT_RANK[override] <= SLOT_RANK[live]
      ? override
      : live;
  const now = new Date();

  /* Saatler iki dilde: rutin Türkçe metinde TR saatini, İngilizcede NY
     saatini yazıyor. İkisi de o günün tarihiyle hesaplanıyor. */
  const open = timePair(sessionDate, clockOf(SESSION_BOUNDS.regularOpen), "tr");
  const close = timePair(sessionDate, clockOf(status.closeMinutes), "tr");
  const session = {
    date_et: sessionDate,
    state: status.session,
    trading_today: status.tradingToday,
    holiday: status.holiday
      ? { name: status.holiday.nameTr, early_close_et: status.holiday.earlyCloseEt }
      : null,
    slot,
    now: { tr: formatInZone(now, TR_ZONE), et: formatInZone(now, ET_ZONE) },
    open: { tr: open.primary, et: open.secondary },
    close: { tr: close.primary, et: close.secondary },
    /* Bir sonraki yayının saati — rutin "sıradaki güncelleme" demek
       isterse uydurmasın. */
    schedule: {
      cron_utc: TECHNICAL_CRON,
      premarket: {
        tr: formatInZone(slotInstant(sessionDate, "premarket"), TR_ZONE),
        et: formatInZone(slotInstant(sessionDate, "premarket"), ET_ZONE),
      },
      midsession: {
        tr: formatInZone(slotInstant(sessionDate, "midsession"), TR_ZONE),
        et: formatInZone(slotInstant(sessionDate, "midsession"), ET_ZONE),
      },
    },
  };

  if (!slot) {
    return NextResponse.json({
      session,
      symbols: [],
      note: "Bugün yazılacak teknik analiz yok: piyasa kapalı ya da ana seans bitti.",
    });
  }

  const symbols = [...TECHNICAL_SYMBOLS];
  const [snapshots, names, previous, upcoming, events] = await Promise.all([
    getTechnicalSnapshots(symbols, status),
    getSymbolNames(symbols),
    getPreviousEditions(symbols, { sessionDate, slot }),
    db
      .select({
        symbol: earningsCalendar.symbol,
        reportDate: earningsCalendar.reportDate,
        hour: earningsCalendar.hour,
      })
      .from(earningsCalendar)
      .where(
        and(
          inArray(earningsCalendar.symbol, symbols),
          gte(earningsCalendar.reportDate, sessionDate),
          lte(earningsCalendar.reportDate, addEtDays(sessionDate, EARNINGS_HORIZON_DAYS)),
        ),
      )
      .orderBy(asc(earningsCalendar.reportDate))
      .catch(() => []),
    getEventsBetween(sessionDate, sessionDate),
  ]);

  const nextEarnings = new Map<string, { date: string; hour: string | null }>();
  for (const row of upcoming) {
    if (!nextEarnings.has(row.symbol)) {
      nextEarnings.set(row.symbol, { date: row.reportDate, hour: row.hour });
    }
  }

  return NextResponse.json({
    session,
    quote: snapshots.quote,
    /* Günün YÜKSEK önemli verileri — "dikkat edilecekler" satırı bunları
       tarihiyle yazsın, hafızadan değil. */
    events_today: events
      .filter((event) => event.importance === "high")
      .map((event) => ({
        time_et: event.eventTimeEt,
        time_tr: event.eventTimeEt
          ? timePair(sessionDate, event.eventTimeEt, "tr").primary
          : null,
        title_tr: event.titleTr,
        title_en: event.titleEn,
        forecast: event.forecast,
        previous: event.previous,
      })),
    symbols: symbols.map((symbol) => {
      const snapshot = snapshots.bySymbol[symbol] ?? null;
      const prev = previous[symbol];
      return {
        symbol,
        name: names[symbol]?.name ?? null,
        /* Bar gelmediyse gösterge de yok ve yazma ucu o sembolü
           reddedecek; rutin baştan atlasın. */
        data_ok: snapshot !== null && snapshot.price !== null,
        indicators: snapshot ? snapshotForApi(snapshot) : null,
        earnings_next: nextEarnings.get(symbol) ?? null,
        previous: prev
          ? {
              session_date: prev.sessionDate,
              slot: prev.slot,
              stance: prev.stance,
              entry_low: prev.entryLow,
              entry_high: prev.entryHigh,
              stop: prev.stop,
              targets: prev.targets,
              supports: prev.supports,
              resistances: prev.resistances,
              headline: prev.copy.tr.headline,
            }
          : null,
      };
    }),
  });
}
