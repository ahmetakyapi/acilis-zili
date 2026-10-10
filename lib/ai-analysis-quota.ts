import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { istanbulDay } from "./ai-analysis-core";

/** Sunucu kapanmışsa süresi dolan iş kullanıcıya kalıcı kota kaybı bırakmaz. */
export async function recoverExpiredAnalysis(userId: string) {
  await db.execute(sql`
    WITH expired AS MATERIALIZED (
      SELECT user_id, lock_id FROM ai_analysis_access
      WHERE user_id = ${userId}::uuid AND lock_id IS NOT NULL AND lock_until < now()
      FOR UPDATE
    ), failed AS (
      UPDATE ai_analysis_requests SET status = 'failed'
      WHERE id IN (SELECT lock_id FROM expired) AND status = 'processing'
    )
    UPDATE ai_analysis_access a SET lock_id = NULL, lock_until = NULL,
      used_count = GREATEST(0, used_count - CASE WHEN EXISTS (
        SELECT 1 FROM ai_analysis_requests r, expired e WHERE r.id = e.lock_id AND r.status = 'completed'
      ) THEN 0 ELSE 1 END)
    FROM expired e WHERE a.user_id = e.user_id
  `);
}

/** Tek UPDATE: farklı süreçler / çift tıklamalar kota veya iş kilidini aşamaz. */
export async function reserveAnalysis(userId: string, id: string) {
  const day = istanbulDay();
  const result = await db.execute(sql`
    UPDATE ai_analysis_access SET
      used_count = CASE WHEN used_day = ${day}::date THEN used_count + 1 ELSE 1 END,
      used_day = ${day}::date, lock_id = ${id}::uuid, lock_until = now() + interval '4 minutes'
    WHERE user_id = ${userId}::uuid AND enabled = true
      AND (lock_until IS NULL OR lock_until < now())
      AND (daily_limit IS NULL OR CASE WHEN used_day = ${day}::date THEN used_count ELSE 0 END < daily_limit)
    RETURNING user_id`);
  return result.rows.length > 0;
}

export async function releaseAnalysis(userId: string, id: string, refund: boolean) {
  // used_count son rezervasyon gününe ait; gece yarısında biten başarısız iş de iade edilir.
  await db.execute(sql`UPDATE ai_analysis_access SET lock_id = NULL,
    lock_until = CASE WHEN ${refund} THEN now() + interval '1 minute' ELSE NULL END,
    used_count = CASE WHEN ${refund} THEN GREATEST(0, used_count - 1) ELSE used_count END
    WHERE user_id = ${userId}::uuid AND lock_id = ${id}::uuid`);
}
