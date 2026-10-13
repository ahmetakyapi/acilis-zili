import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import {
  getEventsBetween,
  getHolidays,
  getMacroRows,
  getSymbolNames,
  weekAnchor,
} from "@/lib/data";
import { getChartBars, getQuotes } from "@/lib/providers";
import {
  addEtDays,
  getMarketStatus,
  isTradingDay,
  prevTradingDay,
  todayEt,
  type MarketHoliday,
} from "@/lib/market-hours";
import { INDEX_STRIP } from "@/db/seed/symbols";
import {
  EMPTY_MOVE,
  closeToClose,
  pctChange,
  rangeCovering,
  type IndexMove,
} from "@/lib/brief-indices";
import { fillEventActuals } from "@/lib/calendar-sync";
import { getEarningsWithOverrides, sourceFields } from "@/lib/earnings-overrides";

/**
 * Bülten için ham veri paketi.
 *
 * Kullanıcının kendi Claude ajanı bu ucu çeker, yazıyı yazar ve
 * POST /api/brief ile geri gönderir. Bu uç veri sunar, yorum içermez.
 *
 * Parametreler:
 *   ?date=YYYY-MM-DD   dönemin tarihi (yoksa bugünün ET tarihi)
 *   ?period=weekly     o tarihi kapsayan haftanın (Pzt–Cum) paketi
 *
 * Geçmiş bir tarih istendiğinde endeks hareketi CANLI kotasyondan değil, o
 * güne/haftaya ait bar kapanışlarından türetilir — arşiv yazısının rakamı
 * bugünün fiyatı olamaz. `retrospective: true` ajana metnin sesini söyler.
 *
 * Yüzde HER YOLDA kapanıştan kapanışa (`lib/brief-indices.ts`); yanında
 * `prev_price` ve `prev_date` var ki rutin hesabı denetleyebilsin.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** O günün tatil kaydı — yarım gün de kayıt, `early_close_et` dolu. */
function holidayOf(date: string, holidays: MarketHoliday[]): MarketHoliday | null {
  return holidays.find((holiday) => holiday.date === date) ?? null;
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period = periodParam === "weekly" ? "weekly" : "daily";
  const dateParam = url.searchParams.get("date");
  const today = todayEt();
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : today;

  const anchor = period === "weekly" ? weekAnchor(date) : date;
  const from = anchor;
  const to = period === "weekly" ? addEtDays(anchor, 4) : anchor;
  // Bugünü kapsamayan her dönem geçmiştir; ses "olacak" değil "oldu".
  const retrospective = to < today;

  const holidays = await getHolidays();
  const status = getMarketStatus(new Date(), holidays);
  const requested = holidayOf(date, holidays);

  const [rawEvents, earnings, macro] = await Promise.all([
    getEventsBetween(from, to),
    /* Elle düzeltilmiş bilanço takvimi (`lib/earnings-overrides.ts`). */
    getEarningsWithOverrides(from, to).catch(() => []),
    getMacroRows(),
  ]);
  /* Açıklanmış ama `actual`ı boş olay: değer olay gününün FRED vintage'ından
     çekilip YAZILIR (gerekçe `fillEventActuals`). Geçmiş tarihli pakette
     cron'un kaçırdığı satırlar da burada dolar. */
  const { events } = await fillEventActuals(rawEvents);

  /* Endeks hareketi: güncel günlükte canlı kotasyon, geri kalan her yerde
     bar kapanışları. Yüzde iki yolda da kapanıştan kapanışa. */
  let indices: ({ symbol: string } & IndexMove)[];
  /** Endeks sayıları bu seansa ait değil — gerekçe aşağıda. */
  let indicesStale = false;

  if (!retrospective && period === "daily") {
    /* BAYAT KOTASYON BÜLTENE GİRMEZ — teknik fotoğraf kuralının ikizi
       (gerekçesi `lib/technical-data.ts` → `getTechnicalSnapshots`).
       Burası ekran değil YAZMA yolu: bu paketten çıkan sayı rutinin yazdığı
       metne geçiyor ve `daily_briefs` içinde kalıcı duruyor. Sağlayıcı
       düştüğünde `getQuotes` Neon önbelleğine düşüyor ve o önbellek ÖNCEKİ
       seansın yüzdelerini taşıyor; bülten "S&P 500 bugün %1,2 yükseldi"
       diye yazar ve o cümle bir daha düzelmez.

       Ekran katmanı bayat veriyi künyesiyle gösterebilir, yazma katmanı
       gösteremez: değer null'a düşüyor ve `indices_stale` rutine neden
       olduğunu söylüyor. Sayı yoksa rutin o cümleyi kurmaz. */
    const quotes = await getQuotes([...INDEX_STRIP], status);
    const usable = quotes.ok && !quotes.stale;
    indicesStale = quotes.ok ? Boolean(quotes.stale) : true;
    indices = INDEX_STRIP.map((symbol) => {
      const quote = usable ? quotes.data[symbol] : null;
      if (!quote) return { symbol, ...EMPTY_MOVE };
      /* Kotasyonun anlattığı gün: son işlemin ET günü; açılıştan önce dünkü
         seans. "Önceki" onun bir önceki işlem günü. */
      const priceDate = quote.tradedAt ? todayEt(quote.tradedAt) : status.sessionDate;
      return {
        symbol,
        price: quote.price,
        price_date: priceDate,
        prev_price: quote.prevClose,
        prev_date: quote.prevClose !== null ? prevTradingDay(priceDate, holidays) : null,
        change_pct: pctChange(quote.price, quote.prevClose),
      };
    });
  } else {
    const range = rangeCovering(from, today);
    indices = await Promise.all(
      INDEX_STRIP.map(async (symbol) => {
        if (!range) return { symbol, ...EMPTY_MOVE };
        const result = await getChartBars(symbol, range, status);
        return { symbol, ...(result.ok ? closeToClose(result.data, from, to) : EMPTY_MOVE) };
      }),
    );
  }

  const meta = await getSymbolNames([
    ...new Set(earnings.map((row) => row.symbol)),
  ]);

  // Bilançolarda öne çıkanlar (piyasa değerine göre) + toplam sayı
  const notable = earnings
    .filter((row) => meta[row.symbol]?.marketCap)
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, period === "weekly" ? 20 : 12)
    .map((row) => ({
      symbol: row.symbol,
      name: meta[row.symbol]?.name ?? null,
      report_date: row.reportDate,
      market_cap_usd: meta[row.symbol]?.marketCap ?? null,
      timing: row.hour,
      eps_estimate: row.epsEstimate,
      eps_actual: row.epsActual,
      revenue_estimate: row.revenueEstimate,
      revenue_actual: row.revenueActual,
      ...sourceFields(row),
    }));

  const weekEvents =
    period === "daily" && !retrospective
      ? await getEventsBetween(addEtDays(date, 1), addEtDays(date, 7))
      : [];

  return NextResponse.json({
    period,
    /** Haftalıkta dönemin pazartesisi — POST'a bu tarih gönderilmeli. */
    brief_date: anchor,
    range_et: { from, to },
    retrospective,
    /* `session` ve `next_open_utc` ŞİMDİYİ anlatıyor; tatil alanları
       İSTENEN tarihi (`date`). Eskiden tatil de şimdiden okunuyordu ve
       geçmiş bir tarihle çağrılınca 7 Eylül İşçi Bayramı "false" dönüyordu.
       `is_holiday` yalnız TAM kapanış; yarım günde `early_close_et` dolu. */
    market: {
      session: status.session,
      date,
      is_holiday: Boolean(requested && !requested.earlyCloseEt),
      is_trading_day: isTradingDay(date, holidays),
      holiday_name: requested?.nameTr ?? null,
      early_close_et: requested?.earlyCloseEt ?? null,
      next_open_utc: status.nextOpen.toISOString(),
    },
    /* Dönemdeki NYSE tatilleri ve yarım günleri — haftalık rutin tatili
       web'den doğrulamasın. Günlükte en çok bir satır. */
    holidays_in_range: holidays
      .filter((holiday) => holiday.date >= from && holiday.date <= to)
      .map((holiday) => ({
        date: holiday.date,
        name: holiday.nameTr,
        name_en: holiday.nameEn,
        early_close_et: holiday.earlyCloseEt,
      })),
    /* `slug` + `forecast`: rutin beklentiyi `/api/takvim/beklenti`ye bu
       anahtarla yazıyor (docs/claude-rutinler.md § 1, adım 1b). */
    economic_events: events.map((event) => ({
      slug: event.slug,
      date_et: event.eventDate,
      time_et: event.eventTimeEt,
      title_tr: event.titleTr,
      title_en: event.titleEn,
      importance: event.importance,
      forecast: event.forecast,
      previous: event.previous,
      actual: event.actual,
      unit: event.unit,
    })),
    economic_events_next_week: weekEvents
      .filter((event) => event.importance === "high")
      .map((event) => ({
        slug: event.slug,
        date_et: event.eventDate,
        time_et: event.eventTimeEt,
        title_tr: event.titleTr,
        importance: event.importance,
        forecast: event.forecast,
        unit: event.unit,
      })),
    earnings: {
      total_count: earnings.length,
      notable,
    },
    indices,
    /* Rutin bu bayrağı görürse endeks cümlesini hiç kurmaz: değerler null
       ve sebebi bu. Alan HER ZAMAN var, yalnızca bayat olduğunda değil —
       eksik bir alan "yok" diye değil "sormamışlar" diye okunuyor. */
    indices_stale: indicesStale,
    macro_latest: macro
      .filter((row) => row.latestValue !== null)
      .map((row) => ({
        title_tr: row.titleTr,
        latest: row.latestValue,
        previous: row.prevValue,
        unit: row.unit,
        period: row.periodLabel,
        next_release: row.nextReleaseAt,
      })),
  });
}
