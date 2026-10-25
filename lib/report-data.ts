import { cache } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { percentAlerts, priceAlerts, users, watchlistItems, watchlists } from "@/lib/schema";
import { getUserAvatar } from "@/lib/avatar-data";
import type { Avatar } from "@/lib/avatars";
import { getHolidays } from "@/lib/data";
import { isTradingDay, todayEt } from "@/lib/market-hours";
import { sessionWeeks, type SessionWeek } from "@/lib/report-summary";
import { getProfileSettings } from "@/lib/profile-data";
import { loadShowcase, type Showcase } from "@/lib/profile-showcase";
import type { Locale } from "@/lib/i18n";
import { getPublishedPostsByUser } from "@/lib/user-post-data";

/**
 * ZİL RAPORU (15 Ekim) — /raporum'un tek okuma yolu.
 *
 * Rapor BEYAN DEĞİL KAYIT: her sayı hesabın kendi verisinden (üyelik günü,
 * takip listeleri, alarmlar, portföy — vitrinin aynı hesabı) ya da piyasa
 * takviminden (tatil tablosuyla sayılan seans günü) geliyor. Okuma başına
 * uydurma kesinlik yok: seans sayımı tohumlanmış tatil takvimine dayanır ve
 * takvim yalnız NYSE'yi bilir — künye bunu "NYSE takvimiyle" diye söyler.
 *
 * Her parça kendi sessiz-düşme yolunu zaten taşıyor (watchlist [] döner,
 * alarmlar available:false, vitrin null); rapor eksik parçayla da çizilir.
 */

export type BellReport = {
  username: string;
  avatar: Avatar | null;
  joinedAt: Date;
  memberDays: number;
  /** Üyelikten bugüne NYSE seans günü — tatil takvimiyle sayılır. */
  tradingDays: number;
  /** Aynı sayımın haftalık şeridi (lib/report-summary.ts → sessionWeeks). */
  weeks: SessionWeek[];
  lists: number;
  listSymbols: number;
  /** Takip listelerindeki tekil semboller, en son ekleneni önde; tavan
   *  `WATCH_STRIP_MAX` — rapordaki logo şeridi için (tamamı /favoriler'de). */
  watchSymbols: string[];
  alertsTotal: number;
  /** Çalan alarm. İki tür de tek seferlik: tetiklenen alarm durur, yani
   *  sayı "kaç alarm çaldı" ile "kaç kez çaldı"yı birlikte söyler. */
  alertsHit: number;
  posts: number;
  /** Yayındaki son yazılar (en yenisi önde), tavan `RECENT_POSTS_MAX`. */
  recentPosts: { slug: string; title: string; publishedAt: Date | null }[];
  profilePublic: boolean;
  showcase: Showcase | null;
};

/** Rapordaki logo şeridinin tavanı: 390'da üç satır, fazlası "+N" ile /favoriler'e. */
export const WATCH_STRIP_MAX = 12;
/** Rapordaki yazı listesinin tavanı; tamamı profilde. */
export const RECENT_POSTS_MAX = 3;

export const loadBellReport = cache(
  async (userId: string, locale: Locale, otherSectorLabel: string): Promise<BellReport | null> => {
    const [row] = await db
      .select({ username: users.username, joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .catch(() => []);
    if (!row) return null;

    const [avatar, holidays, listRows, symbolRows, priceStats, pctStats, posts, profile, showcase] =
      await Promise.all([
        getUserAvatar(userId),
        getHolidays(),
        db
          .select({
            lists: sql<number>`count(distinct ${watchlists.id})::int`,
            symbols: sql<number>`count(distinct ${watchlistItems.symbol})::int`,
          })
          .from(watchlists)
          .leftJoin(watchlistItems, eq(watchlistItems.watchlistId, watchlists.id))
          .where(eq(watchlists.userId, userId))
          .catch(() => [] as { lists: number; symbols: number }[]),
        /* Sembol başına EN SON ekleniş: aynı sembol iki listedeyse bir kez,
           yeni eklenen önde (okurun şu an baktığı şey). */
        db
          .select({ symbol: watchlistItems.symbol, added: sql<Date>`max(${watchlistItems.addedAt})` })
          .from(watchlistItems)
          .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
          .where(eq(watchlists.userId, userId))
          .groupBy(watchlistItems.symbol)
          .orderBy(desc(sql`max(${watchlistItems.addedAt})`))
          .limit(WATCH_STRIP_MAX)
          .catch(() => [] as { symbol: string; added: Date }[]),
        db
          .select({
            total: sql<number>`count(*)::int`,
            hit: sql<number>`count(*) filter (where ${priceAlerts.triggeredAt} is not null)::int`,
          })
          .from(priceAlerts)
          .where(eq(priceAlerts.userId, userId))
          .catch(() => [] as { total: number; hit: number }[]),
        db
          .select({
            total: sql<number>`count(*)::int`,
            hit: sql<number>`count(*) filter (where ${percentAlerts.triggeredAt} is not null)::int`,
          })
          .from(percentAlerts)
          .where(eq(percentAlerts.userId, userId))
          .catch(() => [] as { total: number; hit: number }[]),
        getPublishedPostsByUser(userId),
        getProfileSettings(userId),
        loadShowcase(userId, locale, otherSectorLabel),
      ]);

    /* Üyelik günü de ET günü (20 Ekim): `toISOString()` UTC gününü veriyordu
       ve 20:00–24:00 ET (yazın; kışın 19:00) kaydı ertesi güne kayıyordu —
       ET gece yarısına dek seans sayısı 0, sonra kayıt günü hep eksik. */
    const joinedDay = todayEt(row.joinedAt);
    const today = todayEt();
    const sessions =
      joinedDay <= today
        ? sessionWeeks(joinedDay, today, (day) => isTradingDay(day, holidays))
        : { total: 0, weeks: [] };
    const memberDays = Math.max(
      1,
      Math.floor((Date.now() - row.joinedAt.getTime()) / (24 * 3600 * 1000)) + 1,
    );

    return {
      username: row.username,
      avatar,
      joinedAt: row.joinedAt,
      memberDays,
      tradingDays: sessions.total,
      weeks: sessions.weeks,
      lists: listRows[0]?.lists ?? 0,
      listSymbols: listRows[0]?.symbols ?? 0,
      watchSymbols: symbolRows.map((row) => row.symbol),
      alertsTotal: (priceStats[0]?.total ?? 0) + (pctStats[0]?.total ?? 0),
      alertsHit: (priceStats[0]?.hit ?? 0) + (pctStats[0]?.hit ?? 0),
      posts: posts.length,
      recentPosts: posts
        .slice(0, RECENT_POSTS_MAX)
        .map((post) => ({ slug: post.slug, title: post.title, publishedAt: post.publishedAt })),
      profilePublic: profile?.isPublic === true,
      showcase,
    };
  },
);
