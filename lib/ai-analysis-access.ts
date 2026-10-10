import "server-only";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "./db";
import { aiAnalysisAccess } from "./schema";
import { remainingAnalyses } from "./ai-analysis-core";
import { recoverExpiredAnalysis } from "./ai-analysis-quota";

export async function analysisAccess() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await recoverExpiredAnalysis(session.user.id);
  const [row] = await db.select().from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, session.user.id)).limit(1);
  if (!row?.enabled) return null;
  return { ...row, remaining: remainingAnalyses(row.dailyLimit, row.usedCount, row.usedDay) };
}
