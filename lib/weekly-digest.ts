import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { indexMemberOf } from "@/db/seed/indices";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { analysisHref } from "@/lib/analysis";
import { briefHref } from "@/lib/brief";
import { closeToClose, rangeCovering } from "@/lib/brief-indices";
import {
  getAnalyses,
  getBriefByDate,
  getEventsBetweenResult,
  getHolidays,
  getStatus,
  getStories,
  weekAnchor,
} from "@/lib/data";
import { db } from "@/lib/db";
import { epsSurprise, revenueSurprise, type Surprise } from "@/lib/earnings-week";
import { getEarningsWeek } from "@/lib/earnings-week-data";
import type { Locale } from "@/lib/i18n/config";
import { addEtDays, etDateTimeToUtc, isTradingDay, prevTradingDay, todayEt } from "@/lib/market-hours";
import { getChartBars } from "@/lib/providers";
import { news, watchlistItems, watchlists } from "@/lib/schema";
import { timePair } from "@/lib/session-clock";
import { isSpotlight } from "@/lib/spotlight";

/**
 * PAZARTESİ ÖZETİ — verisi (16 Ekim). Posta lib/notify-emails.ts →
 * `weeklyEmail`; gönderen app/api/cron/haftalik-posta.
 *
 * İçerik dil başına BİR KEZ toplanır (her alıcı için ayrı sorgu yok); yalnız
 * "takip listende bu hafta" satırı kişiye özel.
 *
 * VERİ DÜRÜSTLÜĞÜ — posta GİDİNCE GERİ ALINAMAZ, yani yazma katmanı
 * kuralları geçerli (CLAUDE.md "Veri dürüstlüğü" 4):
 * - Endeks yüzdesi ancak son kapanış geçen haftanın son işlem günüyse
 *   basılır; önbellekten gelen eski seri "bu hafta" diye yazılmaz.
 * - Açıklanmamış bilanço (`epsActual` null) "kaçırdı" değil — listeye
 *   hiç girmez. Cuma kapanış sonrası sonuçları pazartesi 13:30 TR
 *   eşitlemesinde dolar; posta bu yüzden 14:15 TR'de gider (cron).
 * - Okunamayan takvim boş hafta değil (`failed`): bölüm "alınamadı" der,
 *   "bilanço yok" demez.
 */

export const INDEX_LABELS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

export type DigestIndex = { symbol: string; label: string; changePct: number; price: number };

export type DigestReport = {
  symbol: string;
  name: string | null;
  reportDate: string;
  eps: Surprise | null;
  revenue: Surprise | null;
  /** Bizim yazdığımız analiz varsa yolu (dilsiz). */
  analysisPath: string | null;
};

export type DigestLink = { title: string; meta: string | null; path: string; external?: boolean };

export type DigestAheadItem = { symbol: string; name: string | null; timing: "bmo" | "amc" | "other" };

export type DigestAheadDay = {
  date: string;
  closed: string | null;
  items: DigestAheadItem[];
  /** Okuyucunun saatiyle "~16:00" — açılış öncesi ve kapanış sonrası. */
  bmoClock: string;
  amcClock: string;
};

export type DigestEvent = { date: string; time: string | null; title: string };

export type DigestData = {
  locale: Locale;
  pastMonday: string;
  pastFriday: string;
  thisMonday: string;
  thisFriday: string;
  indices: DigestIndex[];
  reported: DigestReport[];
  reportedTotal: number;
  pastFailed: boolean;
  brief: { headline: string; path: string } | null;
  stories: DigestLink[];
  news: DigestLink[];
  ahead: DigestAheadDay[];
  aheadFailed: boolean;
  /** Bu haftanın bilanço açıklayan bütün sembolleri — kişisel satır için. */
  aheadAll: Map<string, { date: string; timing: DigestAheadItem["timing"] }>;
  events: DigestEvent[];
  eventsFailed: boolean;
};

const MAX_REPORTED = 8;
const MAX_AHEAD_PER_DAY = 6;
const MAX_EVENTS = 8;
const MAX_NEWS = 4;
const MAX_STORIES = 3;

/** Bu postanın haftası: pazartesi çalışınca bugün; hafta sonu koşarsa gelen pazartesi. */
export function digestWeek(now: Date): { thisMonday: string; pastMonday: string } {
  const today = todayEt(now);
  const anchor = weekAnchor(today);
  /* weekAnchor pazarı BİTEN haftaya sayıyor; pazartesi dışında elle koşulursa
     da "bu hafta" gelen ya da içinde bulunulan hafta olmalı. */
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  const thisMonday = day === 0 || day === 6 ? addEtDays(anchor, 7) : anchor;
  return { thisMonday, pastMonday: addEtDays(thisMonday, -7) };
}

function timing(hour: string | null): DigestAheadItem["timing"] {
  return hour === "bmo" ? "bmo" : hour === "amc" ? "amc" : "other";
}

async function weeklyIndices(pastMonday: string, pastFriday: string, now: Date): Promise<DigestIndex[]> {
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  const range = rangeCovering(pastMonday, todayEt(now));
  if (!range) return [];
  const lastSession = isTradingDay(pastFriday, holidays) ? pastFriday : prevTradingDay(pastFriday, holidays);
  const moves = await Promise.all(
    INDEX_STRIP.map(async (symbol): Promise<DigestIndex | null> => {
      const result = await getChartBars(symbol, range, status);
      if (!result.ok) return null;
      const move = closeToClose(result.data, pastMonday, pastFriday);
      /* Son kapanış haftanın son seansı değilse seri eksik — yüzde YOK. */
      if (move.change_pct === null || move.price === null || move.price_date !== lastSession) return null;
      return { symbol, label: INDEX_LABELS[symbol] ?? symbol, changePct: move.change_pct, price: move.price };
    }),
  );
  return moves.filter((move): move is DigestIndex => move !== null);
}

function important(symbols: readonly string[] | null, reportedSet: Set<string>): number {
  if (!symbols?.length) return 0;
  if (symbols.some((s) => reportedSet.has(s))) return 3;
  if (symbols.some((s) => isSpotlight(s) || indexMemberOf(s) !== null)) return 2;
  return 0;
}

/**
 * Geçen haftanın öne çıkan haberleri. Sıralama puanı yok; ana sayfanın
 * seçicisiyle aynı ruh (components/today/home/TopNews.tsx): büyük şirket ve
 * o hafta bilanço açıklayanlar önce, sembol başına bir, kaynak başına iki.
 */
async function weeklyNews(locale: Locale, pastMonday: string, thisMonday: string, reportedSet: Set<string>): Promise<DigestLink[]> {
  try {
    const rows = await db
      .select({
        id: news.id,
        headline: news.headline,
        headlineTr: news.headlineTr,
        source: news.source,
        symbols: news.symbols,
        publishedAt: news.publishedAt,
      })
      .from(news)
      .where(and(gte(news.publishedAt, etDateTimeToUtc(pastMonday, "00:00")), lt(news.publishedAt, etDateTimeToUtc(thisMonday, "00:00"))))
      .limit(800);
    const scored = rows
      .map((row) => ({ row, score: important(row.symbols, reportedSet) }))
      .filter((item) => item.score > 0 && (locale === "en" || item.row.headlineTr))
      .sort((a, b) => b.score - a.score || b.row.publishedAt.getTime() - a.row.publishedAt.getTime());
    const perSymbol = new Set<string>();
    const perSource = new Map<string, number>();
    const picked: DigestLink[] = [];
    for (const { row } of scored) {
      const symbol = row.symbols?.[0] ?? "";
      const source = row.source ?? "";
      if (perSymbol.has(symbol) || (perSource.get(source) ?? 0) >= 2) continue;
      perSymbol.add(symbol);
      perSource.set(source, (perSource.get(source) ?? 0) + 1);
      picked.push({
        title: locale === "tr" ? (row.headlineTr ?? row.headline) : row.headline,
        meta: [row.symbols?.slice(0, 2).join(" · "), row.source].filter(Boolean).join(" — ") || null,
        path: `/haberler/${row.id}`,
      });
      if (picked.length >= MAX_NEWS) break;
    }
    return picked;
  } catch {
    return [];
  }
}

export async function gatherDigest(locale: Locale, now: Date = new Date()): Promise<DigestData> {
  const { thisMonday, pastMonday } = digestWeek(now);
  const pastFriday = addEtDays(pastMonday, 4);
  const pastSunday = addEtDays(pastMonday, 6);
  const thisFriday = addEtDays(thisMonday, 4);

  const [past, ahead, indices, analyses, stories, brief, events] = await Promise.all([
    getEarningsWeek(pastMonday, locale),
    getEarningsWeek(thisMonday, locale),
    weeklyIndices(pastMonday, pastFriday, now),
    getAnalyses(locale, { limit: 60, sort: "tarih" }),
    getStories(locale, 30),
    getBriefByDate(pastMonday, locale, "weekly"),
    getEventsBetweenResult(thisMonday, thisFriday),
  ]);

  const analysisBySymbol = new Map<string, string>();
  for (const row of analyses) {
    if (row.reportDate && row.reportDate >= pastMonday && row.reportDate <= pastSunday && !analysisBySymbol.has(row.symbol)) {
      analysisBySymbol.set(row.symbol, analysisHref(row.symbol, row.period));
    }
  }

  /* Seçilmiş kayda değer şirketler — haftanın sayfasıyla aynı seçici. */
  const pastPicked = past.days.flatMap((day) => [...day.bmo, ...day.amc, ...day.other]);
  const reportedRows = pastPicked
    .filter((row) => row.epsActual !== null || row.revenueActual !== null)
    .sort((a, b) => Number(b.spotlight) - Number(a.spotlight) || (b.marketCap ?? 0) - (a.marketCap ?? 0));
  const reported: DigestReport[] = reportedRows.slice(0, MAX_REPORTED).map((row) => ({
    symbol: row.symbol,
    name: row.name,
    reportDate: row.reportDate,
    eps: epsSurprise(row.epsActual, row.epsEstimate),
    revenue: revenueSurprise(row.revenueActual, row.revenueEstimate),
    analysisPath: analysisBySymbol.get(row.symbol) ?? null,
  }));
  const reportedSet = new Set(reportedRows.map((row) => row.symbol));

  const newsLinks = await weeklyNews(locale, pastMonday, thisMonday, reportedSet);

  const storyLinks: DigestLink[] = stories
    .filter((story) => story.eventDate >= pastMonday && story.eventDate <= pastSunday)
    .slice(0, MAX_STORIES)
    .map((story) => ({ title: story.title, meta: story.dek ?? null, path: `/mercek/${story.slug}` }));

  const aheadDays: DigestAheadDay[] = ahead.days.map((day) => {
    const items = [...day.bmo, ...day.amc, ...day.other]
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, MAX_AHEAD_PER_DAY)
      .map((row) => ({ symbol: row.symbol, name: row.name, timing: timing(row.hour) }));
    return {
      date: day.date,
      closed: day.closed ? (locale === "tr" ? day.closed.nameTr : day.closed.nameEn) : null,
      items,
      bmoClock: day.bmoClock.primary,
      amcClock: day.amcClock.primary,
    };
  });

  const aheadAll = new Map<string, { date: string; timing: DigestAheadItem["timing"] }>();
  for (const day of ahead.schedule) {
    for (const row of [...day.listed, ...day.rest.bmo, ...day.rest.amc, ...day.rest.other]) {
      if (!aheadAll.has(row.symbol)) aheadAll.set(row.symbol, { date: row.reportDate, timing: timing(row.hour) });
    }
  }
  for (const day of ahead.days) {
    for (const row of [...day.bmo, ...day.amc, ...day.other]) {
      if (!aheadAll.has(row.symbol)) aheadAll.set(row.symbol, { date: row.reportDate, timing: timing(row.hour) });
    }
  }

  const eventRows = events.ok
    ? events.rows
        .filter((row) => row.importance === "high")
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTimeEt ?? "99").localeCompare(b.eventTimeEt ?? "99"))
        .slice(0, MAX_EVENTS)
        .map((row) => ({
          date: row.eventDate,
          time: row.eventTimeEt ? timePair(row.eventDate, row.eventTimeEt, locale).primary : null,
          title: locale === "tr" ? row.titleTr : row.titleEn,
        }))
    : [];

  return {
    locale,
    pastMonday,
    pastFriday,
    thisMonday,
    thisFriday,
    indices,
    reported,
    reportedTotal: reportedRows.length,
    pastFailed: past.failed,
    brief: brief ? { headline: brief.headline, path: briefHref(pastMonday, "weekly") } : null,
    stories: storyLinks,
    news: newsLinks,
    ahead: aheadDays,
    aheadFailed: ahead.failed,
    aheadAll,
    events: eventRows,
    eventsFailed: !events.ok,
  };
}

/** Alıcıların takip listelerindeki semboller — kişisel satır için tek sorgu. */
export async function watchlistSymbols(userIds: string[]): Promise<Map<string, Set<string>>> {
  const byUser = new Map<string, Set<string>>();
  if (userIds.length === 0) return byUser;
  try {
    const rows = await db
      .select({ userId: watchlists.userId, symbol: watchlistItems.symbol })
      .from(watchlistItems)
      .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
      .where(inArray(watchlists.userId, userIds));
    for (const row of rows) {
      const set = byUser.get(row.userId) ?? new Set<string>();
      set.add(row.symbol);
      byUser.set(row.userId, set);
    }
  } catch {
    /* kişisel satır yalnız düşer */
  }
  return byUser;
}
