import { NextResponse } from "next/server";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyBriefs,
  earningsCalendar,
  economicEvents,
  news as newsTable,
  macroSeries,
} from "@/lib/schema";
import { getEarningsCalendar, getMarketNews } from "@/lib/providers/finnhub";
import { MACRO_SERIES, getSeries } from "@/lib/providers/fred";
import { getQuotes } from "@/lib/providers";
import { addEtDays, getMarketStatus, todayEt } from "@/lib/market-hours";
import { getEventsBetween, getHolidays, getSymbolNames } from "@/lib/data";
import { buildDailyBrief } from "@/lib/brief";
import { translatePendingNews, isTranslateConfigured } from "@/lib/translate";
import {
  getEarningsSymbolsMissingProfile,
  getStalestSymbols,
} from "@/lib/data";
import { getCompanyProfile } from "@/lib/providers";
import { symbols as symbolsTable } from "@/lib/schema";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { LOCALES } from "@/lib/i18n/config";

export const maxDuration = 120;

/**
 * Günlük senkron — Vercel Cron her sabah 06:00 ET civarı çağırır.
 * Sıra: bilanço takvimi → haberler → makro seriler → gerçekleşen değerler →
 * günlük özet. Her adım kendi hatasını yutar; biri düşse diğerleri çalışır.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const report: Record<string, string | number> = {};
  const today = todayEt();

  /* ---- 1. Bilanço takvimi (bugün → +14 gün) ----
     Neon HTTP sürücüsünde her sorgu ayrı istek; 1500 satırı tek tek yazmak
     dakikalar alır. 200'lük parçalarla toplu upsert yapılır. */
  try {
    const result = await getEarningsCalendar(today, addEtDays(today, 14));
    if (result.ok) {
      // Aynı (symbol, date) yanıtın içinde tekrar edebilir — tekilleştir.
      const unique = new Map<string, (typeof result.data)[number]>();
      for (const entry of result.data) {
        unique.set(`${entry.symbol}|${entry.reportDate}`, entry);
      }
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
      report.earnings = `atlandı: ${result.message}`;
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

  /* ---- 2b. Haber çevirisi (Claude — anahtar varsa) ---- */
  try {
    if (isTranslateConfigured()) {
      report.translate = await translatePendingNews(40);
    } else {
      report.translate = "atlandı: ANTHROPIC_API_KEY yok";
    }
  } catch (error) {
    report.translate = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2c. Sembol profillerini tazele ----
     En bayat 25 sembolün profili (piyasa değeri, sektör, logo) yenilenir;
     Şirketler ve Bilançolar sayfaları bu meta veriden beslenir. */
  try {
    // Önce yaklaşan bilançoların tanınmayan sembolleri (spotlight için),
    // kalan bütçeyle en bayat kayıtlar. getCompanyProfile symbols tablosuna
    // kendisi yazar (insert/update).
    const [upcoming, stalest] = await Promise.all([
      getEarningsSymbolsMissingProfile(7, 15),
      getStalestSymbols(10),
    ]);
    const targets = [...new Set([...upcoming, ...stalest])].slice(0, 25);

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

      await db
        .insert(dailyBriefs)
        .values({
          briefDate: today,
          locale,
          headline: brief.headline,
          bodyMd: brief.bodyMd,
          generatedBy: brief.generatedBy,
        })
        .onConflictDoUpdate({
          target: [dailyBriefs.briefDate, dailyBriefs.locale],
          set: {
            headline: brief.headline,
            bodyMd: brief.bodyMd,
            generatedBy: brief.generatedBy,
            generatedAt: new Date(),
          },
        });
    }
    report.brief = "ok";
  } catch (error) {
    report.brief = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  return NextResponse.json({ ok: true, date: today, report });
}
