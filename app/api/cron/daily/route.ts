import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyBriefs,
  earningsCalendar,
  economicEvents,
  news as newsTable,
  macroSeries,
} from "@/lib/schema";
import {
  getCompanyNews,
  getEarningsCalendar,
  getMarketNews,
} from "@/lib/providers/finnhub";
import { MACRO_SERIES, getSeries } from "@/lib/providers/fred";
import { getQuotes } from "@/lib/providers";
import { addEtDays, getMarketStatus, todayEt } from "@/lib/market-hours";
import { getEventsBetween, getHolidays, getSymbolNames } from "@/lib/data";
import { buildDailyBrief } from "@/lib/brief";
import { calendarRunwayDays, syncCalendar } from "@/lib/calendar-sync";
import { translatePendingNews, isTranslateConfigured } from "@/lib/translate";
import {
  getEarningsSymbolsMissingProfile,
  getStalestSymbols,
} from "@/lib/data";
import { getCompanyProfile } from "@/lib/providers";
import { symbols as symbolsTable } from "@/lib/schema";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { LOCALES } from "@/lib/i18n/config";

/** Şirket haberi çekilen en büyük şirket sayısı — Finnhub dakikada 60 istek. */
const COMPANY_NEWS_SYMBOLS = 20;

/**
 * Bilanço takvimi kaç gün ileri çekilir.
 *
 * Bilançolar sayfasının "Ay" sekmesi 29 gün gösteriyor ama burası 14 günde
 * duruyordu: aradaki iki hafta boş görünüyordu ve ancak gün gün yaklaştıkça
 * doluyordu. Sayfanın istediğinden bir gün fazlası çekilir ki sınırda boş
 * satır kalmasın. Maliyeti 31 Finnhub isteği — dakikadaki 60 sınırının
 * altında, fonksiyonun 120 sn bütçesine rahat sığıyor.
 */
const EARNINGS_HORIZON_DAYS = 30;

export const maxDuration = 120;

/**
 * Günlük senkron — Vercel Cron her sabah 06:00 ET civarı çağırır.
 * Sıra: bilanço takvimi → haberler → makro seriler → gerçekleşen değerler →
 * günlük özet. Her adım kendi hatasını yutar; biri düşse diğerleri çalışır.
 */
export async function GET(request: Request) {
  /* Eskiden `if (secret && ...)` yazıyordu: CRON_SECRET tanımsızsa koşul hiç
     çalışmıyor ve bu uç herkese açık kalıyordu. Sağlayıcılardan veri çekip
     veritabanına yazan bir uç için kabul edilemez — artık üretimde anahtar
     yoksa istek reddediliyor. */
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const report: Record<string, string | number> = {};
  const today = todayEt();

  /* ---- 1. Bilanço takvimi (bugün → +30 gün) ----
     Finnhub tek yanıtı ~1500 kayıtla keser; geniş aralık limit yüzünden bazı
     günleri düşürür (SNDK böyle kaybolmuştu). Bu yüzden GÜN GÜN çekilir —
     31 istek, 60/dk limitine sığar. Yazım yine toplu upsert'tir.

     Beklenti ve gerçekleşen (epsEstimate/epsActual, revenueEstimate/
     revenueActual) her koşumda ÜZERİNE YAZILIR: analist beklentisi bilanço
     gününe kadar revize olur, sonrasında gerçekleşen değer düşer. Yani bu
     tablo elle bakım istemiyor, kendi kendine güncel kalıyor. */
  try {
    const unique = new Map<
      string,
      NonNullable<Awaited<ReturnType<typeof getEarningsCalendar>> extends infer R
        ? R extends { ok: true; data: (infer T)[] }
          ? T
          : never
        : never>
    >();
    let anyOk = false;
    let firstError = "";
    for (let offset = 0; offset <= EARNINGS_HORIZON_DAYS; offset++) {
      const day = addEtDays(today, offset);
      const result = await getEarningsCalendar(day, day);
      if (!result.ok) {
        firstError ||= result.message;
        continue;
      }
      anyOk = true;
      for (const entry of result.data) {
        unique.set(`${entry.symbol}|${entry.reportDate}`, entry);
      }
    }
    if (anyOk) {
      const rows = [...unique.values()].map((entry) => ({
        symbol: entry.symbol,
        reportDate: entry.reportDate,
        hour: entry.hour,
        epsEstimate: entry.epsEstimate,
        epsActual: entry.epsActual,
        revenueEstimate: entry.revenueEstimate,
        revenueActual: entry.revenueActual,
        quarter: entry.quarter,
        year: entry.year,
      }));

      for (let i = 0; i < rows.length; i += 200) {
        await db
          .insert(earningsCalendar)
          .values(rows.slice(i, i + 200))
          .onConflictDoUpdate({
            target: [earningsCalendar.symbol, earningsCalendar.reportDate],
            set: {
              hour: sql`excluded.hour`,
              epsEstimate: sql`excluded.eps_estimate`,
              epsActual: sql`excluded.eps_actual`,
              revenueEstimate: sql`excluded.revenue_estimate`,
              revenueActual: sql`excluded.revenue_actual`,
              updatedAt: new Date(),
            },
          });
      }
      report.earnings = rows.length;
    } else {
      report.earnings = `atlandı: ${firstError}`;
    }
  } catch (error) {
    report.earnings = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2. Piyasa haberleri ---- */
  try {
    const result = await getMarketNews("general");
    if (result.ok) {
      const seen = new Set<string>();
      const rows = result.data
        .slice(0, 60)
        .filter((item) => {
          if (seen.has(item.providerId)) return false;
          seen.add(item.providerId);
          return true;
        })
        .map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols,
          publishedAt: item.publishedAt,
        }));
      if (rows.length > 0) {
        await db.insert(newsTable).values(rows).onConflictDoNothing();
      }
      report.news = rows.length;
    } else {
      report.news = `atlandı: ${result.message}`;
    }
  } catch (error) {
    report.news = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2b. Şirket haberleri ----
     Genel akış Yahoo ağırlıklı ve Yahoo her habere aynı yer tutucu logoyu
     iliştiriyor; o beslemeden okunur bir görsel çıkmıyor. Şirket bazlı uç
     ise makalenin kendi görselini veriyor (Benzinga, SeekingAlpha, Reuters
     foto servisi…). Bu yüzden en büyük şirketler için ayrıca çekiliyor. */
  try {
    const majors = await db
      .select({ symbol: symbolsTable.symbol })
      .from(symbolsTable)
      .where(isNotNull(symbolsTable.marketCap))
      .orderBy(desc(symbolsTable.marketCap))
      .limit(COMPANY_NEWS_SYMBOLS);

    const from = addEtDays(today, -2);
    let inserted = 0;

    for (const { symbol } of majors) {
      const result = await getCompanyNews(symbol, from, today);
      if (!result.ok) continue;

      const rows = result.data
        .filter((item) => item.imageUrl)
        .slice(0, 4)
        .map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols?.length ? item.symbols : [symbol],
          publishedAt: item.publishedAt,
        }));

      if (rows.length > 0) {
        await db.insert(newsTable).values(rows).onConflictDoNothing();
        inserted += rows.length;
      }
    }

    report.companyNews = inserted;
  } catch (error) {
    report.companyNews = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2c. Haber çevirisi (Claude — anahtar varsa) ---- */
  try {
    if (isTranslateConfigured()) {
      report.translate = await translatePendingNews(40);
    } else {
      report.translate = "atlandı: DEEPL_API_KEY veya ANTHROPIC_API_KEY yok";
    }
  } catch (error) {
    report.translate = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2d. Sembol profillerini tazele ----
     Profil; hisse sayısı, sektör ve logoyu taşır. Piyasa değeri sayfalarda
     canlı fiyat × hisse sayısı olarak hesaplandığı için bu kayıtların gün
     içinde tazelenmesi gerekmez — hisse sayısı ancak geri alım/ihraçla
     değişir. Günde 60 sembol dönerek ~9 günde tüm evren yenilenir; Finnhub'ın
     dakikada 60 istek sınırı ve fonksiyonun 120 sn bütçesi buna izin verir. */
  try {
    // Önce yaklaşan bilançoların tanınmayan sembolleri (spotlight için),
    // kalan bütçeyle en bayat kayıtlar. getCompanyProfile symbols tablosuna
    // kendisi yazar (insert/update).
    const [upcoming, stalest] = await Promise.all([
      getEarningsSymbolsMissingProfile(7, 15),
      getStalestSymbols(60),
    ]);
    const targets = [...new Set([...upcoming, ...stalest])].slice(0, 60);

    let refreshed = 0;
    for (const symbol of targets) {
      const result = await getCompanyProfile(symbol);
      if (result.ok) {
        refreshed++;
      } else {
        // Profil dönmese de sıraya tekrar girmesin diye damga güncellenir.
        await db
          .update(symbolsTable)
          .set({ updatedAt: new Date() })
          .where(eq(symbolsTable.symbol, symbol));
      }
    }
    report.profiles = refreshed;
  } catch (error) {
    report.profiles = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2e. Ekonomik takvimi ileriye doldur ----
     Takvimin ilan edilmiş tarihleri elle tohumlanıyordu ve bir gün bitip
     ekranı sessizce boşaltıyordu. Artık FRED'in yayın takviminden bir yıl
     ileriye kadar kendi kendine uzuyor; elle işlenmiş kayıtlara dokunmuyor.
     Ayrıntı ve FOMC'nin neden buradan gelmediği: lib/calendar-sync.ts */
  try {
    const sync = await syncCalendar(today);
    report.calendar = `+${sync.inserted} yayın, +${sync.rolling} haftalık`;
    if (sync.problems.length > 0) {
      report.calendarProblems = sync.problems.join(" | ");
    }
    /* Takvimin ömrü rapora yazılır: bu sayı küçülüyorsa senkron çalışmıyor
       demektir ve bunu takvim boşalmadan ÖNCE görmek gerekir. */
    report.calendarRunwayDays = await calendarRunwayDays(today);
  } catch (error) {
    report.calendar = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 3. Makro seriler ---- */
  try {
    let count = 0;
    for (const definition of MACRO_SERIES) {
      const result = await getSeries(definition);
      if (!result.ok) continue;
      await db
        .update(macroSeries)
        .set({
          latestValue: result.data.latestValue,
          prevValue: result.data.prevValue,
          periodLabel: result.data.periodLabel,
          observations: result.data.observations,
          updatedAt: new Date(),
        })
        .where(eq(macroSeries.seriesId, definition.seriesId));
      count++;
    }
    report.macro = count;
  } catch (error) {
    report.macro = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 4. Geçmiş olayların gerçekleşen değerleri ----
     Son 7 günün olaylarından actual'ı boş olanlara FRED'deki en güncel
     gözlemi işle. Sonraki açıklama tarihini de takvimden doldur. */
  try {
    let filled = 0;
    const pending = await db
      .select()
      .from(economicEvents)
      .where(
        and(
          gte(economicEvents.eventDate, addEtDays(today, -7)),
          lte(economicEvents.eventDate, today),
          isNull(economicEvents.actual),
        ),
      );

    for (const event of pending) {
      if (!event.fredSeriesId) continue;
      const definition = MACRO_SERIES.find(
        (s) => s.seriesId === event.fredSeriesId,
      );
      if (!definition) continue;

      const result = await getSeries(definition, 3);
      if (!result.ok || result.data.latestValue === null) continue;

      await db
        .update(economicEvents)
        .set({
          actual: String(result.data.latestValue),
          previous:
            result.data.prevValue !== null
              ? String(result.data.prevValue)
              : event.previous,
          updatedAt: new Date(),
        })
        .where(eq(economicEvents.id, event.id));
      filled++;
    }

    // Makro kartlardaki "sonraki açıklama" — takvimdeki ilk ileri tarihli olay
    for (const definition of MACRO_SERIES) {
      const [next] = await db
        .select({ date: economicEvents.eventDate })
        .from(economicEvents)
        .where(
          and(
            eq(economicEvents.fredSeriesId, definition.seriesId),
            gte(economicEvents.eventDate, today),
          ),
        )
        .orderBy(economicEvents.eventDate)
        .limit(1);
      if (next) {
        await db
          .update(macroSeries)
          .set({ nextReleaseAt: next.date })
          .where(eq(macroSeries.seriesId, definition.seriesId));
      }
    }

    report.actuals = filled;
  } catch (error) {
    report.actuals = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 5. Günlük özet (TR + EN) ---- */
  try {
    const [events, earningsRows, holidays, names] = await Promise.all([
      getEventsBetween(today, today),
      db
        .select()
        .from(earningsCalendar)
        .where(eq(earningsCalendar.reportDate, today)),
      getHolidays(),
      getSymbolNames([...INDEX_STRIP]),
    ]);

    const status = getMarketStatus(new Date(), holidays);
    const quotesResult = await getQuotes([...INDEX_STRIP], status);
    const indexQuotes = INDEX_STRIP.map((symbol) => ({
      symbol,
      label: names[symbol]?.name ?? symbol,
      quote: quotesResult.ok ? (quotesResult.data[symbol] ?? null) : null,
    }));

    for (const locale of LOCALES) {
      const brief = await buildDailyBrief({
        dateEt: today,
        locale,
        events,
        earnings: earningsRows,
        indexQuotes,
      });

      // Kullanıcının kendi Claude'u /api/brief ile yazı gönderdiyse o esastır;
      // sunucu üretimi yalnızca gün için henüz kayıt yokken yazılır.
      await db
        .insert(dailyBriefs)
        .values({
          briefDate: today,
          locale,
          headline: brief.headline,
          bodyMd: brief.bodyMd,
          generatedBy: brief.generatedBy,
        })
        .onConflictDoNothing();
    }
    report.brief = "ok";
  } catch (error) {
    report.brief = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  return NextResponse.json({ ok: true, date: today, report });
}
