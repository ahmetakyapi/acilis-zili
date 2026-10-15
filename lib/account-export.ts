import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { users, watchlistItems, watchlists } from "./schema";
import { getUserAvatar } from "./avatar-data";
import { getNotificationPrefs } from "./notification-prefs";
import { getUserPercentAlerts } from "./percent-alerts";
import { getProfileSettings } from "./profile-data";
import { getOwnPosts } from "./user-post-data";
import { getInbox } from "./notifications";
import { getPortfolioPositions } from "./portfolio-data";
import { getUserAlerts } from "./price-alerts";
import { getPortfolioSales } from "./portfolio-sales-data";
import { getUserSubscriptions } from "./push";
import { EXPORT_FORMAT_VERSION, type AccountExport } from "./account-export-format";

/**
 * Hesabın dışa aktarımını okur — `null` hesap yoksa (silinmiş ama oturumu
 * açık kalmış bir token). Gerekçe ve içerik `lib/account-export-format.ts`.
 *
 * Kullanıcı kimliği OTURUMDAN geliyor, istekten değil: uç yalnızca
 * oturum sahibinin kendi verisini verebiliyor.
 *
 * Profil ikonu `getUserAvatar`dan: tablo yokken o okuma sessizce `null`
 * dönüyor (lib/avatar-data.ts) ve dışa aktarım da düşmüyor.
 */
export async function loadAccountExport(userId: string, now: Date = new Date()): Promise<AccountExport | null> {
  const [account] = await db
    .select({
      username: users.username,
      email: users.email,
      locale: users.locale,
      theme: users.theme,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account) return null;

  /* Portföy iki paket paralel yazılırken bu dosyanın dışında kalmıştı:
     indirme "hesabın tuttuğu her şey" diyordu ama pozisyonları vermiyordu
     (28 Eylül, belge taramasında bulundu). KVKK veri taşınabilirliği. */
  const [lists, avatar, portfolio, alerts, sales, push, profile, percent, prefs, posts, inbox] = await Promise.all([
    db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.sortOrder), asc(watchlists.createdAt)),
    getUserAvatar(userId),
    getPortfolioPositions(userId),
    getUserAlerts(userId),
    getPortfolioSales(userId),
    getUserSubscriptions(userId),
    getProfileSettings(userId),
    getUserPercentAlerts(userId),
    getNotificationPrefs(userId),
    getOwnPosts(userId),
    getInbox(userId),
  ]);
  const items = lists.length
    ? await db
        .select()
        .from(watchlistItems)
        .where(
          inArray(
            watchlistItems.watchlistId,
            lists.map((list) => list.id),
          ),
        )
        .orderBy(asc(watchlistItems.sortOrder), asc(watchlistItems.addedAt))
    : [];

  return {
    format: "acilis-zili/account-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    account: {
      username: account.username,
      email: account.email,
      locale: account.locale,
      theme: account.theme,
      createdAt: account.createdAt.toISOString(),
      lastSeenAt: account.lastSeenAt?.toISOString() ?? null,
    },
    avatar: avatar ? { icon: avatar.icon, color: avatar.color } : null,
    /* Profil ayarları (15 Ekim): tanıtım ve görünürlük anahtarları da
       KVKK tablosunda sayılı üye verisi — indirilen dosyada da olmalı. */
    profile: profile
      ? {
          bio: profile.bio,
          isPublic: profile.isPublic,
          showWatchlists: profile.showWatchlists,
          showPortfolio: profile.showPortfolio,
        }
      : null,
    /* Veritabanı kimlikleri (uuid) dışarıda: okuyucu için anlamsızlar ve
       dosyanın tek işi okuyucunun kendi verisini ona geri vermek. */
    watchlists: lists.map((list) => ({
      name: list.name,
      color: list.color,
      sortOrder: list.sortOrder,
      createdAt: list.createdAt.toISOString(),
      items: items
        .filter((item) => item.watchlistId === list.id)
        .map((item) => ({
          symbol: item.symbol,
          note: item.note,
          sortOrder: item.sortOrder,
          addedAt: item.addedAt.toISOString(),
        })),
    })),
    portfolio: portfolio.ok
      ? portfolio.positions.map((position) => ({
          symbol: position.symbol,
          quantity: position.quantity,
          costUsd: position.costUsd,
          boughtAt: position.boughtAt,
          note: position.note,
        }))
      : null,
    portfolioSales: sales.available
      ? sales.parts.map((part) => ({
          saleId: part.saleId,
          symbol: part.symbol,
          quantity: part.quantity,
          priceUsd: part.priceUsd,
          soldAt: part.soldAt,
          costUsd: part.costUsd,
          boughtAt: part.boughtAt,
        }))
      : null,
    priceAlerts: alerts.available
      ? alerts.alerts.map((alert) => ({
          symbol: alert.symbol,
          direction: alert.direction,
          target: alert.target,
          refPrice: alert.refPrice,
          createdAt: alert.createdAt,
          triggeredAt: alert.triggeredAt,
          triggeredPrice: alert.triggeredPrice,
        }))
      : null,
    percentAlerts: percent.available
      ? percent.alerts.map((alert) => ({
          symbol: alert.symbol,
          direction: alert.direction,
          thresholdPct: alert.thresholdPct,
          createdAt: alert.createdAt,
          triggeredAt: alert.triggeredAt,
          triggeredPct: alert.triggeredPct,
        }))
      : null,
    inbox: inbox.available
      ? inbox.items.map((item) => ({
          kind: item.kind,
          title: item.title,
          body: item.body,
          url: item.url,
          createdAt: item.createdAt.toISOString(),
          read: item.read,
        }))
      : null,
    posts: posts.available
      ? posts.posts.map((post) => ({
          slug: post.slug,
          title: post.title,
          dek: post.dek,
          bodyMd: post.bodyMd,
          symbols: post.symbols,
          status: post.status,
          reviewNote: post.reviewNote,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          submittedAt: post.submittedAt?.toISOString() ?? null,
          publishedAt: post.publishedAt?.toISOString() ?? null,
        }))
      : null,
    notificationPrefs: prefs.available ? { earningsReminder: prefs.earningsReminder } : null,
    notificationDevices: push.available
      ? push.subscriptions.map((sub) => ({
          device: sub.device,
          locale: sub.locale,
          createdAt: sub.createdAt,
          lastSentAt: sub.lastSentAt,
        }))
      : null,
  };
}
