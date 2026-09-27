import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { users, watchlistItems, watchlists } from "./schema";
import { getUserAvatar } from "./avatar-data";
import { getPortfolioPositions } from "./portfolio-data";
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
  const [lists, avatar, portfolio] = await Promise.all([
    db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.sortOrder), asc(watchlists.createdAt)),
    getUserAvatar(userId),
    getPortfolioPositions(userId),
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
  };
}
