import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { aiAnalysisRequests, userAvatars, users } from "./schema";
import { AVATAR_DEFAULT_COLOR, isAvatarColor, isAvatarKey, type AvatarColor, type AvatarKey } from "./avatars";
import type { SavedAnalysis } from "./ai-analysis";

/** Sekmedeki geçmiş listesi; daha eskisi yalnız Analizlerim'de (kendi raporları). */
const SYMBOL_HISTORY_LIMIT = 30;
const VERDICTS = ["buy", "hold", "sell", "insufficient"] as const;
export type ReportVerdict = (typeof VERDICTS)[number];

export type ReportSummary = {
  id: string;
  horizon: "short" | "medium";
  locale: "tr" | "en";
  verdict: ReportVerdict;
  score: number | null;
  generatedAt: string;
  /** Okuyanın kendi raporu mu — "Senin Raporun" rozeti. */
  mine: boolean;
  /** Raporu oluşturan: kullanıcı adı ve profil karosu. E-posta ve kimlik numarası ASLA. */
  author: ReportAuthor | null;
};

export type ReportAuthor = { name: string; icon: AvatarKey | null; color: AvatarColor | null };

/**
 * Hissenin TAMAMLANMIŞ raporları, kimin ürettiğinden bağımsız.
 *
 * Rapor üretmek kişiye bağlı (kota, yetki); OKUMAK herkese açık: rapor o
 * anın verisiyle yazılmış tarihli bir belge.
 *
 * OLUŞTURAN GÖRÜNÜR (11 Ekim, sahibinin isteği — önceki karar "üreten hiçbir
 * yerde görünmez"di). Üretim yöneticinin açtığı az sayıda hesapta; kimin
 * hangi saatte rapor ürettiği zaman çizelgesini anlamlı kılıyor ("bir saat
 * önce X üretti, bekle"). Yalnız KULLANICI ADI ve profil karosu çıkar;
 * e-posta ve `user_id` sayfaya hiç inmez. Kullanıcı adı zaten sitede
 * herkese görünen addır (hesap menüsü).
 *
 * Avatar ayrı sorguda ve hatası yutuluyor: `user_avatars` migration'la gelen
 * ayrı bir tablo, yoksa baş harfler basılır — ana liste düşmez.
 * Tablo yoksa (migration uygulanmamış) boş liste.
 */
/* İstek içi önbellek: şirket sayfasında Claude paneli ve teknik kartın eylemi aynı listeyi soruyor. */
export const listSymbolReports = cache(async (symbol: string, viewerId: string | null): Promise<ReportSummary[]> => {
  try {
    const rows = await db.select({
      id: aiAnalysisRequests.id, userId: aiAnalysisRequests.userId, username: users.username, horizon: aiAnalysisRequests.horizon, locale: aiAnalysisRequests.locale,
      verdict: sql<string>`${aiAnalysisRequests.result}->'output'->>'verdict'`,
      score: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'overallScore')::int`,
      generatedAt: sql<string>`${aiAnalysisRequests.result}->>'generatedAt'`,
    }).from(aiAnalysisRequests)
      .leftJoin(users, eq(users.id, aiAnalysisRequests.userId))
      .where(and(eq(aiAnalysisRequests.symbol, symbol), eq(aiAnalysisRequests.status, "completed")))
      .orderBy(desc(aiAnalysisRequests.createdAt)).limit(SYMBOL_HISTORY_LIMIT);
    const avatars = await authorAvatars([...new Set(rows.map(row => row.userId))]);
    return rows.map(row => ({
      id: row.id, horizon: row.horizon === "medium" ? "medium" : "short", locale: row.locale === "en" ? "en" : "tr",
      verdict: VERDICTS.includes(row.verdict as ReportVerdict) ? row.verdict as ReportVerdict : "insufficient",
      score: row.score, generatedAt: row.generatedAt, mine: viewerId !== null && row.userId === viewerId,
      author: row.username ? { name: row.username, ...(avatars.get(row.userId) ?? { icon: null, color: null }) } : null,
    }));
  } catch { return []; }
});

/** Oluşturanların profil karoları, tek sorguda; tablo yoksa boş (baş harfler basılır). */
async function authorAvatars(userIds: string[]): Promise<Map<string, { icon: AvatarKey | null; color: AvatarColor | null }>> {
  if (!userIds.length) return new Map();
  try {
    const rows = await db.select({ userId: userAvatars.userId, icon: userAvatars.icon, color: userAvatars.color })
      .from(userAvatars).where(inArray(userAvatars.userId, userIds));
    return new Map(rows.map(row => {
      const icon = isAvatarKey(row.icon) ? row.icon : null;
      return [row.userId, { icon, color: isAvatarColor(row.color) ? row.color : icon ? AVATAR_DEFAULT_COLOR[icon] : null }];
    }));
  } catch { return new Map(); }
}

export async function getSymbolReport(symbol: string, id: string): Promise<SavedAnalysis | null> {
  try {
    const [row] = await db.select({ result: aiAnalysisRequests.result }).from(aiAnalysisRequests)
      .where(and(eq(aiAnalysisRequests.id, id), eq(aiAnalysisRequests.symbol, symbol), eq(aiAnalysisRequests.status, "completed"))).limit(1);
    return row?.result ?? null;
  } catch { return null; }
}

export type UserReportSummary = {
  id: string;
  symbol: string;
  horizon: "short" | "medium";
  verdict: ReportVerdict;
  score: number | null;
  generatedAt: string;
};

/**
 * Bir üyenin TAMAMLANMIŞ raporları — profil sayfasının "Claude Analizleri"
 * bloğu (15 Ekim). Yeni bir görünürlük açmıyor: raporlar hisse sayfasında
 * oluşturanın adıyla zaten herkese açık (listSymbolReports kararı); profil
 * aynı kayıtları kişi bazında topluyor. Satır yalnız künye, raporun gövdesi
 * /claude/[symbol] sayfasında. Tablo yoksa boş liste.
 */
export const listUserReports = cache(async (userId: string, limit = 12): Promise<UserReportSummary[]> => {
  try {
    const rows = await db.select({
      id: aiAnalysisRequests.id, symbol: aiAnalysisRequests.symbol, horizon: aiAnalysisRequests.horizon,
      verdict: sql<string>`${aiAnalysisRequests.result}->'output'->>'verdict'`,
      score: sql<number | null>`(${aiAnalysisRequests.result}->'output'->>'overallScore')::int`,
      generatedAt: sql<string>`${aiAnalysisRequests.result}->>'generatedAt'`,
    }).from(aiAnalysisRequests)
      .where(and(eq(aiAnalysisRequests.userId, userId), eq(aiAnalysisRequests.status, "completed")))
      .orderBy(desc(aiAnalysisRequests.createdAt)).limit(limit);
    return rows.map(row => ({
      id: row.id, symbol: row.symbol, horizon: row.horizon === "medium" ? "medium" : "short",
      verdict: VERDICTS.includes(row.verdict as ReportVerdict) ? row.verdict as ReportVerdict : "insufficient",
      score: row.score, generatedAt: row.generatedAt,
    }));
  } catch { return []; }
});
