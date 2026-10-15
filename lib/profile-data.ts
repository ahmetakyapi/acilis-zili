import { cache } from "react";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles, users } from "@/lib/schema";
import { getUserAvatar } from "@/lib/avatar-data";
import type { Avatar } from "@/lib/avatars";
import {
  BIO_MAX,
  EARLY_MEMBER_RANK,
  USERNAME_PATTERN,
  type ProfileBadge,
  type ProfileSettings,
} from "@/lib/profiles";
import { normalizeUsername } from "@/lib/utils";

/**
 * Hesabın profil ayarları — satır yoksa `null` (arayüz varsayılanları,
 * yani "gizli"yi basar). `lib/avatar-data.ts` ile aynı üç bileşen:
 * istek içi `cache()`, tablo yokken sessizce `null` (migration'lar elle
 * uygulanıyor), değerler tip bekçisinden geçerek döner.
 */
export const getProfileSettings = cache(async (userId: string): Promise<ProfileSettings | null> => {
  try {
    const [row] = await db
      .select({
        bio: userProfiles.bio,
        isPublic: userProfiles.isPublic,
        showWatchlists: userProfiles.showWatchlists,
        showPortfolio: userProfiles.showPortfolio,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    if (!row) return null;
    return {
      /* DB'de sınırdan uzun kalmış bir metin arayüze taşmasın. */
      bio: typeof row.bio === "string" && row.bio.trim() ? row.bio.slice(0, BIO_MAX) : null,
      isPublic: row.isPublic === true,
      showWatchlists: row.showWatchlists === true,
      showPortfolio: row.showPortfolio === true,
    };
  } catch {
    return null;
  }
});

export type PublicProfile = ProfileSettings & {
  userId: string;
  username: string;
  joinedAt: Date;
  avatar: Avatar | null;
};

/**
 * /u/[username] sayfasının okuması. `null` üç durumu birden örter:
 * kullanıcı yok, profil satırı yok, profil gizli. ÜÇÜNÜN DE CEVABI AYNI
 * (404) — "bu kullanıcı adı kayıtlı ama profili gizli" bilgisi, girişteki
 * sayım orakülü gibi (app/actions/auth.ts → DUMMY_HASH) dışarı sızmamalı.
 *
 * Parametre sorguya gitmeden kayıttaki desenden geçer: desene uymayan
 * adres veritabanına hiç sorulmaz. Küçültme `normalizeUsername` ile —
 * düz `toLowerCase` Türkçe İ'yi bozuyor (lib/utils.ts).
 */
export const getPublicProfile = cache(async (rawUsername: string): Promise<PublicProfile | null> => {
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_PATTERN.test(username)) return null;
  try {
    const [row] = await db
      .select({
        userId: users.id,
        username: users.username,
        joinedAt: users.createdAt,
        bio: userProfiles.bio,
        isPublic: userProfiles.isPublic,
        showWatchlists: userProfiles.showWatchlists,
        showPortfolio: userProfiles.showPortfolio,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.username, username))
      .limit(1);
    if (!row || row.isPublic !== true) return null;
    const avatar = await getUserAvatar(row.userId);
    return {
      userId: row.userId,
      username: row.username,
      joinedAt: row.joinedAt,
      avatar,
      bio: typeof row.bio === "string" && row.bio.trim() ? row.bio.slice(0, BIO_MAX) : null,
      isPublic: true,
      showWatchlists: row.showWatchlists === true,
      showPortfolio: row.showPortfolio === true,
    };
  } catch {
    return null;
  }
});

/**
 * YAZAR görünümü — profili gizli (ya da hiç açılmamış) ama /topluluk'ta
 * yayını olan üye. Yayın, kullanıcı adını ZATEN herkese açtı: akıştaki
 * yazar bağlantısını 404'e çıkarmak kırık görünürdü; sayım orakülü de
 * burada korunmaz bir şey korumuyor. SAYFA bu görünümü yalnızca yayını
 * OLAN hesaba açar (yazısızlar yine 404) — kapı sayfada, bu fonksiyon
 * yalnız künyeyi getirir. Bio ve bloklar kapalı döner.
 */
export const getAuthorProfile = cache(async (rawUsername: string): Promise<PublicProfile | null> => {
  const username = normalizeUsername(rawUsername);
  if (!USERNAME_PATTERN.test(username)) return null;
  try {
    const [row] = await db
      .select({ userId: users.id, username: users.username, joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (!row) return null;
    const avatar = await getUserAvatar(row.userId);
    return {
      userId: row.userId,
      username: row.username,
      joinedAt: row.joinedAt,
      avatar,
      bio: null,
      isPublic: false,
      showWatchlists: false,
      showPortfolio: false,
    };
  } catch {
    return null;
  }
});

/**
 * Sahibin KENDİ profil görünümü — /u/[username] sayfasının sahip önizlemesi.
 * Gizliyken de döner: sahip, profili açmadan önce nasıl görüneceğini
 * görebilmeli. Profil satırı yoksa varsayılanlarla (gizli) döner; yalnızca
 * kullanıcı kaydının kendisi yoksa ya da tablo düşmüşse `null`.
 */
export const getOwnerProfile = cache(async (userId: string): Promise<PublicProfile | null> => {
  try {
    const [row] = await db
      .select({ username: users.username, joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return null;
    const [settings, avatar] = await Promise.all([getProfileSettings(userId), getUserAvatar(userId)]);
    return {
      userId,
      username: row.username,
      joinedAt: row.joinedAt,
      avatar,
      ...(settings ?? { bio: null, isPublic: false, showWatchlists: false, showPortfolio: false }),
    };
  } catch {
    return null;
  }
});

/**
 * Hesabın üyelik sırası — kendisinden önce açılmış hesap sayısı + 1.
 * Yalnızca "Erken Üye" rozeti için soruluyor ve rozet zaten katılım
 * tarihinden türediği için gizli bir şey açmıyor. Hata/null → rozet yok.
 */
const getMemberRank = cache(async (joinedAt: Date): Promise<number | null> => {
  try {
    const [row] = await db
      .select({ earlier: sql<number>`count(*)::int` })
      .from(users)
      .where(lt(users.createdAt, joinedAt));
    if (!row) return null;
    return row.earlier + 1;
  } catch {
    return null;
  }
});

/**
 * Rozetler hesaplanır, tabloda durmaz (gerekçe lib/profiles.ts).
 * Yıl rozeti tam yılı dolunca başlar; ilk yıl rozetsizdir — katılım
 * tarihi zaten künyede, "Yeni Üye" damgası bilgi eklemiyor.
 */
export async function profileBadges(joinedAt: Date, now: Date = new Date()): Promise<ProfileBadge[]> {
  const badges: ProfileBadge[] = [];
  const rank = await getMemberRank(joinedAt);
  if (rank !== null && rank <= EARLY_MEMBER_RANK) badges.push({ kind: "early" });
  const years = Math.floor((now.getTime() - joinedAt.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) badges.push({ kind: "year", n: years });
  return badges;
}
