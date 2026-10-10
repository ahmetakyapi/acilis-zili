import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users, aiAnalysisAccess, aiAnalysisRequests } from "../lib/schema";
import { istanbulDay } from "../lib/ai-analysis-core";


// Opt-in: gerçek PostgreSQL atomik UPDATE davranışını geçici hesapta sınar.
// NODE_OPTIONS=--conditions=react-server AI_DB_TEST=1 npx tsx --test tests/ai-analysis-quota.integration.test.ts
config({ path: ".env.local", quiet: true });
test("database quota: denied access, concurrent reservations, fifth limit, refunds, expiry and unlimited", { skip: process.env.AI_DB_TEST !== "1" }, async () => {
  const { recoverExpiredAnalysis, reserveAnalysis, releaseAnalysis } = await import("../lib/ai-analysis-quota");
  const userId = randomUUID();
  const username = `ai-test-${userId.slice(0, 8)}`;
  try {
    await db.insert(users).values({ id: userId, username, email: `${username}@example.invalid`, passwordHash: "disabled-test-login" });
    await db.insert(aiAnalysisAccess).values({ userId, enabled: false, dailyLimit: 5 });
    assert.equal(await reserveAnalysis(userId, randomUUID()), false);
    await db.update(aiAnalysisAccess).set({ enabled: true }).where(eq(aiAnalysisAccess.userId, userId));
    const ids = Array.from({ length: 8 }, () => randomUUID());
    const attempts = await Promise.all(ids.map(id => reserveAnalysis(userId, id)));
    assert.equal(attempts.filter(Boolean).length, 1, "only one concurrent job is admitted");
    await releaseAnalysis(userId, ids[attempts.indexOf(true)], false);
    for (let i = 1; i < 5; i++) { const id = randomUUID(); assert.equal(await reserveAnalysis(userId, id), true); await releaseAnalysis(userId, id, false); }
    assert.equal(await reserveAnalysis(userId, randomUUID()), false, "sixth new analysis denied");
    await db.update(aiAnalysisAccess).set({ usedDay: "2020-01-01" }).where(eq(aiAnalysisAccess.userId, userId));
    const id = randomUUID(); assert.equal(await reserveAnalysis(userId, id), true, "new Istanbul day resets quota");
    await releaseAnalysis(userId, id, true);
    let [row] = await db.select().from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, userId));
    assert.equal(row.usedCount, 0, "failed job refunded");
    assert.equal(await reserveAnalysis(userId, randomUUID()), false, "failed job cooldown prevents paid retry loops");
    const staleId = randomUUID();
    await db.update(aiAnalysisAccess).set({ usedCount: 1, usedDay: istanbulDay(), lockId: staleId, lockUntil: new Date(0) }).where(eq(aiAnalysisAccess.userId, userId));
    await db.insert(aiAnalysisRequests).values({ id: staleId, userId, symbol: "NVDA", horizon: "short", locale: "tr", status: "processing", model: "test" });
    await recoverExpiredAnalysis(userId);
    [row] = await db.select().from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, userId));
    assert.equal(row.usedCount, 0); assert.equal(row.lockId, null);
    const [failed] = await db.select().from(aiAnalysisRequests).where(eq(aiAnalysisRequests.id, staleId));
    assert.equal(failed.status, "failed");
    const doneId = randomUUID();
    await db.insert(aiAnalysisRequests).values({ id: doneId, userId, symbol: "NVDA", horizon: "short", locale: "tr", status: "completed", model: "test" });
    await db.update(aiAnalysisAccess).set({ usedCount: 1, lockId: doneId, lockUntil: new Date(0) }).where(eq(aiAnalysisAccess.userId, userId));
    await recoverExpiredAnalysis(userId);
    [row] = await db.select().from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, userId));
    assert.equal(row.usedCount, 1, "finished work remains charged if process died before unlocking");
    await releaseAnalysis(userId, staleId, true);
    [row] = await db.select().from(aiAnalysisAccess).where(eq(aiAnalysisAccess.userId, userId));
    assert.equal(row.usedCount, 1, "late cleanup of old work cannot refund another job");
    await db.update(aiAnalysisAccess).set({ dailyLimit: null, usedCount: 10000 }).where(eq(aiAnalysisAccess.userId, userId));
    const unlimitedId = randomUUID(); assert.equal(await reserveAnalysis(userId, unlimitedId), true);
    await releaseAnalysis(userId, unlimitedId, false);
  } finally { await db.delete(users).where(eq(users.id, userId)); }
});
