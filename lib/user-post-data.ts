import { cache } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAvatars, userPosts, users } from "@/lib/schema";
import { getUserAvatar } from "@/lib/avatar-data";
import { AVATAR_DEFAULT_COLOR, isAvatarColor, isAvatarKey, type Avatar } from "@/lib/avatars";
import { isPostStatus, type PostStatus } from "@/lib/user-posts";

/**
 * Kullanıcı yazılarının okuma yolu — gerekçe lib/schema.ts → userPosts.
 * Her okuma tablo yokken SESSİZCE düşer (migration 0034 elle uygulanır):
 * /topluluk boş akış, /yazilarim "şu an açılamıyor", moderasyon kuyruğu
 * "Hazırlanıyor" der (lib/avatar-data.ts kalıbı).
 */

export type OwnPost = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  dek: string;
  bodyMd: string;
  symbols: string[];
  status: PostStatus;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  publishedAt: Date | null;
};

export type PublishedPost = Omit<OwnPost, "reviewNote" | "status"> & {
  publishedAt: Date;
  author: { username: string; avatar: Avatar | null };
};

function symbolsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toOwnPost(row: typeof userPosts.$inferSelect): OwnPost | null {
  if (!isPostStatus(row.status)) return null;
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    dek: row.dek,
    bodyMd: row.bodyMd,
    symbols: symbolsOf(row.symbols),
    status: row.status,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    publishedAt: row.publishedAt,
  };
}

/** Hesabın bütün yazıları, yeniden eskiye. `available: false` tablo yok. */
export const getOwnPosts = cache(
  async (userId: string): Promise<{ available: boolean; posts: OwnPost[] }> => {
    try {
      const rows = await db
        .select()
        .from(userPosts)
        .where(eq(userPosts.userId, userId))
        .orderBy(desc(userPosts.updatedAt));
      return {
        available: true,
        posts: rows.map(toOwnPost).filter((post): post is OwnPost => post !== null),
      };
    } catch {
      return { available: false, posts: [] };
    }
  },
);

/** Tek yazı, yalnızca SAHİBİNE — kimlik oturumdan gelir, sorgu ikisini birden arar. */
export const getOwnPost = cache(async (userId: string, id: string): Promise<OwnPost | null> => {
  try {
    const [row] = await db
      .select()
      .from(userPosts)
      .where(and(eq(userPosts.id, id), eq(userPosts.userId, userId)))
      .limit(1);
    return row ? toOwnPost(row) : null;
  } catch {
    return null;
  }
});

/**
 * Yazar karoları TEK sorguda — akış satır satır `getUserAvatar` çağırsaydı
 * neon-http'de 60 ayrı HTTP turu olurdu (getUserWatchlists'teki tek-sorgu
 * dersi). Tablo yokken boş harita: karolar baş harflere düşer.
 */
async function avatarsFor(userIds: readonly string[]): Promise<Map<string, Avatar>> {
  const map = new Map<string, Avatar>();
  if (userIds.length === 0) return map;
  try {
    const rows = await db
      .select({ userId: userAvatars.userId, icon: userAvatars.icon, color: userAvatars.color })
      .from(userAvatars)
      .where(inArray(userAvatars.userId, [...new Set(userIds)]));
    for (const row of rows) {
      const icon = isAvatarKey(row.icon) ? row.icon : null;
      const color = isAvatarColor(row.color) ? row.color : icon ? AVATAR_DEFAULT_COLOR[icon] : "blue";
      map.set(row.userId, { icon, color });
    }
  } catch {
    /* tablo yok — baş harfler */
  }
  return map;
}

/** Yayındaki akış — /topluluk. Yazar künyesi tek joinle gelir. */
export const getPublishedPosts = cache(async (limit = 60): Promise<PublishedPost[]> => {
  try {
    const rows = await db
      .select({ post: userPosts, username: users.username, authorId: users.id })
      .from(userPosts)
      .innerJoin(users, eq(users.id, userPosts.userId))
      .where(eq(userPosts.status, "published"))
      .orderBy(desc(userPosts.publishedAt))
      .limit(limit);
    const avatars = await avatarsFor(rows.map((row) => row.authorId));
    return rows.flatMap((row) => {
      const own = toOwnPost(row.post);
      if (!own || !own.publishedAt) return [];
      return [
        {
          ...own,
          publishedAt: own.publishedAt,
          author: { username: row.username, avatar: avatars.get(row.authorId) ?? null },
        },
      ];
    });
  } catch {
    return [];
  }
});

/** Tek yayın — /topluluk/[slug]; yayında değilse null (taslak sızmaz). */
export const getPublishedPost = cache(async (slug: string): Promise<PublishedPost | null> => {
  try {
    const [row] = await db
      .select({ post: userPosts, username: users.username, authorId: users.id })
      .from(userPosts)
      .innerJoin(users, eq(users.id, userPosts.userId))
      .where(and(eq(userPosts.slug, slug), eq(userPosts.status, "published")))
      .limit(1);
    if (!row) return null;
    const own = toOwnPost(row.post);
    if (!own || !own.publishedAt) return null;
    const avatar = await getUserAvatar(row.authorId);
    return { ...own, publishedAt: own.publishedAt, author: { username: row.username, avatar } };
  } catch {
    return null;
  }
});

/** Bir üyenin yayındaki yazıları — profil sayfasının Yazılar bloğu. */
export const getPublishedPostsByUser = cache(async (userId: string): Promise<OwnPost[]> => {
  try {
    const rows = await db
      .select()
      .from(userPosts)
      .where(and(eq(userPosts.userId, userId), eq(userPosts.status, "published")))
      .orderBy(desc(userPosts.publishedAt));
    return rows.map(toOwnPost).filter((post): post is OwnPost => post !== null);
  } catch {
    return [];
  }
});

export type QueuePost = OwnPost & { author: string };

/** Moderasyon kuyruğu — bekleyenler, eskiden yeniye (ilk gelen ilk okunur). */
export async function getPendingPosts(): Promise<QueuePost[] | null> {
  try {
    const rows = await db
      .select({ post: userPosts, username: users.username })
      .from(userPosts)
      .innerJoin(users, eq(users.id, userPosts.userId))
      .where(eq(userPosts.status, "pending"))
      .orderBy(userPosts.submittedAt);
    return rows.flatMap((row) => {
      const own = toOwnPost(row.post);
      return own ? [{ ...own, author: row.username }] : [];
    });
  } catch {
    return null;
  }
}

/** Kuyruktaki tek yazı — moderasyon detayı (durumdan bağımsız okur). */
export async function getPostForReview(id: string): Promise<QueuePost | null> {
  try {
    const [row] = await db
      .select({ post: userPosts, username: users.username })
      .from(userPosts)
      .innerJoin(users, eq(users.id, userPosts.userId))
      .where(eq(userPosts.id, id))
      .limit(1);
    if (!row) return null;
    const own = toOwnPost(row.post);
    return own ? { ...own, author: row.username } : null;
  } catch {
    return null;
  }
}
