import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "./db";
import { aiAnalysisAccess } from "./schema";
import { remainingAnalyses } from "./ai-analysis-core";
import { recoverExpiredAnalysis } from "./ai-analysis-quota";
import { accessPhase, cooldownUntil } from "./ai-analysis-lock";

export async function analysisAccess() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const read = () => db.select().from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, userId)).limit(1);
  /* ÖNCE OKU, KİLİT VARSA KURTAR (20 Ekim). Kurtarma (`FOR UPDATE`lı bir
     UPDATE) her çağrıda, okumadan ÖNCE koşuyordu: Claude ve Analizlerim
     sayfalarının her görüntülenmesi, erişim satırı olmayan üyede bile, bir
     yazma turu + bir okuma turu. Kurtarılacak iş ancak kilit varken olabilir
     (`lock_id` dolu); kilitsiz satırda kurtarma hiçbir satıra dokunmuyordu.
     Kilit varsa süresinin dolup dolmadığına veritabanı karar veriyor
     (sunucu saatiyle değil — saat kayması iadeyi atlatmasın): eskisi gibi
     kurtar ve yeniden oku. API'nin "iade sonra rezervasyon" sırası aynı. */
  let [row] = await read();
  if (row?.lockId) {
    await recoverExpiredAnalysis(userId);
    [row] = await read();
  }
  if (!row?.enabled) return null;
  /* Kurtarma kararı yukarıda veritabanı saatiyle verildi; `phase` yalnız
     okumadır (masa ve GET), kilit/kota kararı SQL'de kalır. */
  const now = new Date();
  return { ...row, remaining: remainingAnalyses(row.dailyLimit, row.usedCount, row.usedDay),
    phase: accessPhase(row, now), cooldownUntil: cooldownUntil(row, now) };
}

/** Yalnız menüdeki bağlantı için: kilit kurtarma yok, tek birincil anahtar okuması; tablo yoksa kapalı. */
export const hasAnalysisAccess = cache(async (userId: string) => {
  if (!process.env.CLAUDE_ANALYSIS_API_KEY || process.env.CLAUDE_ANALYSIS_DISABLED === "1") return false;
  try {
    const [row] = await db.select({ enabled: aiAnalysisAccess.enabled }).from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, userId)).limit(1);
    return !!row?.enabled;
  } catch { return false; }
});
