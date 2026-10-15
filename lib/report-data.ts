import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { percentAlerts, priceAlerts, users, watchlistItems, watchlists } from "@/lib/schema";
import { getUserAvatar } from "@/lib/avatar-data";
import type { Avatar } from "@/lib/avatars";
import { getHolidays } from "@/lib/data";
import { addEtDays, isTradingDay, todayEt } from "@/lib/market-hours";
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
  lists: number;
  listSymbols: number;
  alertsTotal: number;
  alertsHit: number;
  posts: number;
  profilePublic: boolean;
  showcase: Showcase | null;
};

/** İki ET günü arasındaki seans günü sayısı (uçlar dahil). */
function countTradingDays(fromDay: string, toDay: string, holidays: Parameters<typeof isTradingDay>[1]): number {
  let count = 0;
  let day = fromDay;
  /* Üyelik en fazla birkaç yıl: gün döngüsü ucuz; emniyet tavanı 20 yıl. */
  for (let i = 0; i < 7400 && day <= toDay; i += 1) {
    if (isTradingDay(day, holidays)) count += 1;
    day = addEtDays(day, 1);
  }
  return count;
}

export const loadBellReport = cache(
  async (userId: string, locale: Locale, otherSectorLabel: string): Promise<BellReport | null> => {
    const [row] = await db
      .select({ username: users.username, joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .catch(() => []);
    if (!row) return null;

    const [avatar, holidays, listRows, priceStats, pctStats, posts, profile, showcase] =
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

    const joinedDay = row.joinedAt.toISOString().slice(0, 10);
    const today = todayEt();
    const memberDays = Math.max(
      1,
      Math.floor((Date.now() - row.joinedAt.getTime()) / (24 * 3600 * 1000)) + 1,
    );

    return {
      username: row.username,
      avatar,
      joinedAt: row.joinedAt,
      memberDays,
      tradingDays: joinedDay <= today ? countTradingDays(joinedDay, today, holidays) : 0,
      lists: listRows[0]?.lists ?? 0,
      listSymbols: listRows[0]?.symbols ?? 0,
      alertsTotal: (priceStats[0]?.total ?? 0) + (pctStats[0]?.total ?? 0),
      alertsHit: (priceStats[0]?.hit ?? 0) + (pctStats[0]?.hit ?? 0),
      posts: posts.length,
      profilePublic: profile?.isPublic === true,
      showcase,
    };
  },
);
