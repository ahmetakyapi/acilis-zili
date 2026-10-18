import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { indexMemberOf } from "@/db/seed/indices";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { analysisHref } from "@/lib/analysis";
import { briefHref } from "@/lib/brief";
import { barDay, closeToClose, rangeCovering } from "@/lib/brief-indices";
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
import type { Bar } from "@/lib/providers/types";
import { logoSrc } from "@/lib/logos";
import { news, watchlistItems, watchlists } from "@/lib/schema";
import { timePair } from "@/lib/session-clock";
import { isSpotlight } from "@/lib/spotlight";

/**
 * PAZAR ÖZETİ — verisi (16 Ekim; 17 Ekim'de pazartesiden pazara). Posta
 * lib/notify-emails.ts → `weeklyEmailMessage`; gönderen
 * app/api/cron/haftalik-posta.
 *
 * İçerik dil başına BİR KEZ toplanır (her alıcı için ayrı sorgu yok); yalnız
 * "takip listende bu hafta" satırı kişiye özel.
 *
 * VERİ DÜRÜSTLÜĞÜ — posta GİDİNCE GERİ ALINAMAZ, yani yazma katmanı
 * kuralları geçerli (CLAUDE.md "Veri dürüstlüğü" 4):
 * - Endeks yüzdesi ancak son kapanış geçen haftanın son işlem günüyse
 *   basılır; önbellekten gelen eski seri "bu hafta" diye yazılmaz.
 * - Açıklanmamış bilanço (`epsActual` null) "kaçırdı" değil — listeye
 *   hiç girmez. Günlük eşitleme hafta içi 13:30 TR'de koştuğu için cuma
 *   sonuçları pazartesiye kadar tabloya düşmüyordu; uç göndermeden önce
 *   geçen haftanın gerçekleşenlerini kendisi tazeliyor
 *   (lib/earnings-refresh.ts).
 * - Okunamayan takvim boş hafta değil (`failed`): bölüm "alınamadı" der,
 *   "bilanço yok" demez.
 */

export const INDEX_LABELS: Record<string, string> = {
  SPY: "S&P 500",
  QQQ: "Nasdaq 100",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

export type DigestIndex = {
  symbol: string;
  label: string;
  changePct: number;
  price: number;
  /** Haftanın seansları, kapanıştan kapanışa — postadaki günlük adım çubukları. */
  steps: { date: string; changePct: number }[];
};

export type DigestReport = {
  symbol: string;
  name: string | null;
  reportDate: string;
  eps: Surprise | null;
  revenue: Surprise | null;
  /** Bizim yazdığımız analiz varsa yolu (dilsiz). */
  analysisPath: string | null;
  /** Hissenin geride kalan haftası, kapanıştan kapanışa — endekslerle aynı
      ölçü (indexMoveFromBars). Seri eksikse null; satır yüzdesiz basılır.
      17 Ekim, sahibinin isteği: "beklentiyi aştı" tek başına anlamsız,
      piyasanın nasıl karşıladığı yanında okunmalı. */
  week: { changePct: number; steps: DigestIndex["steps"] } | null;
};

export type DigestLink = { title: string; meta: string | null; path: string; external?: boolean };

export type DigestAheadItem = { symbol: string; name: string | null; timing: "bmo" | "amc" | "other"; logoUrl?: string | null; marketCap?: number | null };

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
  pastFailed: boolean;
  brief: { headline: string; path: string } | null;
  stories: DigestLink[];
  news: DigestLink[];
  ahead: DigestAheadDay[];
  aheadFailed: boolean;
  /** Bu haftanın bilanço açıklayan bütün sembolleri — kişisel satır için. */
  aheadAll: Map<string, { date: string; timing: DigestAheadItem["timing"] }>;
  events: DigestEvent[];
  /** Haftada yüksek önemli veri yoksa sıradaki (altı hafta içinde) — bölüm boş kalmasın. */
  nextEvent: DigestEvent | null;
  eventsFailed: boolean;
  /** Claude'un iki paragraflık yorumu (lib/weekly-commentary.ts); yoksa bölüm basılmaz. */
  commentary?: { past: string; ahead: string } | null;
};

const MAX_REPORTED = 8;
const MAX_AHEAD_PER_DAY = 6;
const MAX_EVENTS = 8;
const MAX_NEWS = 6;
const MAX_STORIES = 3;

/** Bu postanın haftası: pazar (ve cumartesi) koşunca GELEN pazartesi; hafta içi elle koşulursa içinde bulunulan hafta. */
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

/** Sembollerin geride kalan haftası — endeks şeridi ve bilanço açıklayan hisseler aynı yoldan. */
async function weeklyMoves(symbols: readonly string[], pastMonday: string, pastFriday: string, now: Date): Promise<DigestIndex[]> {
  if (symbols.length === 0) return [];
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  const range = rangeCovering(pastMonday, todayEt(now));
  if (!range) return [];
  const lastSession = isTradingDay(pastFriday, holidays) ? pastFriday : prevTradingDay(pastFriday, holidays);
  const moves = await Promise.all(
    symbols.map(async (symbol): Promise<DigestIndex | null> => {
      try {
        const result = await getChartBars(symbol, range, status);
        return result.ok ? indexMoveFromBars(symbol, result.data, pastMonday, pastFriday, lastSession) : null;
      } catch {
        return null;
      }
    }),
  );
  return moves.filter((move): move is DigestIndex => move !== null);
}

/**
 * Bir endeksin haftası — saf, test edilir. Son kapanış haftanın son seansı
 * değilse seri eksik: yüzde YOK (null). Gün adımları kapanıştan kapanışa;
 * haftanın ilk adımı önceki haftanın son kapanışından.
 */
export function indexMoveFromBars(
  symbol: string,
  bars: readonly Bar[],
  pastMonday: string,
  pastFriday: string,
  lastSession: string,
): DigestIndex | null {
  const move = closeToClose(bars, pastMonday, pastFriday);
  if (move.change_pct === null || move.price === null || move.price_date !== lastSession) return null;
  const steps: DigestIndex["steps"] = [];
  let prevClose: number | null = null;
  for (const bar of bars) {
    const day = barDay(bar);
    if (day > pastFriday) break;
    if (day >= pastMonday && prevClose !== null && prevClose > 0) {
      steps.push({ date: day, changePct: ((bar.close - prevClose) / prevClose) * 100 });
    }
    prevClose = bar.close;
  }
  return { symbol, label: INDEX_LABELS[symbol] ?? symbol, changePct: move.change_pct, price: move.price, steps };
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

  const [past, ahead, indices, analyses, stories, brief, events, later] = await Promise.all([
    getEarningsWeek(pastMonday, locale),
    getEarningsWeek(thisMonday, locale),
    weeklyMoves(INDEX_STRIP, pastMonday, pastFriday, now),
    getAnalyses(locale, { limit: 60, sort: "tarih" }),
    getStories(locale, 30),
    getBriefByDate(pastMonday, locale, "weekly"),
    getEventsBetweenResult(thisMonday, thisFriday),
    getEventsBetweenResult(addEtDays(thisFriday, 1), addEtDays(thisFriday, 42)),
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
  const reportedTop = reportedRows.slice(0, MAX_REPORTED);
  const weekOf = (move: DigestIndex | undefined) => (move ? { changePct: move.changePct, steps: move.steps } : null);
  const stockMoves = new Map((await weeklyMoves(reportedTop.map((row) => row.symbol), pastMonday, pastFriday, now)).map((m) => [m.symbol, m]));
  const reported: DigestReport[] = reportedTop.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    reportDate: row.reportDate,
    eps: epsSurprise(row.epsActual, row.epsEstimate),
    revenue: revenueSurprise(row.revenueActual, row.revenueEstimate),
    analysisPath: analysisBySymbol.get(row.symbol) ?? null,
    week: weekOf(stockMoves.get(row.symbol)),
  }));
  const reportedSet = new Set(reportedRows.map((row) => row.symbol));

  const newsLinks = await weeklyNews(locale, pastMonday, thisMonday, reportedSet);

  const storyLinks: DigestLink[] = stories
    .filter((story) => story.eventDate >= pastMonday && story.eventDate <= pastSunday)
    .slice(0, MAX_STORIES)
    .map((story) => ({ title: story.title, meta: story.dek ?? null, path: `/mercek/${story.slug}` }));

  const highEvents = events.ok ? events.rows.filter((row) => row.importance === "high") : [];
  const aheadDays: DigestAheadDay[] = ahead.days.map((day) => {
    const items = [...day.bmo, ...day.amc, ...day.other]
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, MAX_AHEAD_PER_DAY)
      .map((row) => ({ symbol: row.symbol, name: row.name, timing: timing(row.hour), logoUrl: logoSrc(row.symbol, row.logoUrl), marketCap: row.marketCap }));
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

  const toEvent = (row: { eventDate: string; eventTimeEt: string | null; titleTr: string; titleEn: string }): DigestEvent => ({
    date: row.eventDate,
    time: row.eventTimeEt ? timePair(row.eventDate, row.eventTimeEt, locale).primary : null,
    title: locale === "tr" ? row.titleTr : row.titleEn,
  });
  const eventRows = events.ok
    ? highEvents
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTimeEt ?? "99").localeCompare(b.eventTimeEt ?? "99"))
        .slice(0, MAX_EVENTS)
        .map((row) => toEvent(row))
    : [];

  const nextRow =
    eventRows.length === 0 && later.ok
      ? later.rows
          .filter((row) => row.importance === "high")
          .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTimeEt ?? "99").localeCompare(b.eventTimeEt ?? "99"))[0]
      : undefined;

  return {
    locale,
    pastMonday,
    pastFriday,
    thisMonday,
    thisFriday,
    indices,
    reported,
    pastFailed: past.failed,
    brief: brief ? { headline: brief.headline, path: briefHref(pastMonday, "weekly") } : null,
    stories: storyLinks,
    news: newsLinks,
    ahead: aheadDays,
    aheadFailed: ahead.failed,
    aheadAll,
    events: eventRows,
    nextEvent: nextRow ? toEvent(nextRow) : null,
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
