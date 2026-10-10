import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { analysisAccess } from "@/lib/ai-analysis-access";
import { reserveAnalysis, releaseAnalysis } from "@/lib/ai-analysis-quota";
import { generateAnalysis } from "@/lib/ai-analysis";
import { AnalysisInput } from "@/lib/ai-analysis-core";
import { db } from "@/lib/db";
import { aiAnalysisRequests } from "@/lib/schema";
import { isKnownSymbol } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 180;
const respond = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
});
const configured = () => !!process.env.CLAUDE_ANALYSIS_API_KEY && process.env.CLAUDE_ANALYSIS_DISABLED !== "1";

export async function GET(request: Request) {
  try {
    const access = await analysisAccess();
    if (!access || !configured()) return respond({ error: "forbidden" }, 403);
    const params = new URL(request.url).searchParams;
    const symbol = params.get("symbol")?.toUpperCase();
    const locale = params.get("locale");
    const history = await db.select({ id: aiAnalysisRequests.id, symbol: aiAnalysisRequests.symbol,
      horizon: aiAnalysisRequests.horizon, locale: aiAnalysisRequests.locale, result: aiAnalysisRequests.result,
    }).from(aiAnalysisRequests).where(and(
      eq(aiAnalysisRequests.userId, access.userId), eq(aiAnalysisRequests.status, "completed"),
      symbol ? eq(aiAnalysisRequests.symbol, symbol) : undefined,
      locale ? eq(aiAnalysisRequests.locale, locale) : undefined,
    )).orderBy(desc(aiAnalysisRequests.createdAt)).limit(20);
    return respond({ remaining: access.remaining, dailyLimit: access.dailyLimit,
      inProgress: !!access.lockId && !!access.lockUntil && access.lockUntil > new Date(), history });
  } catch { return respond({ error: "unavailable" }, 503); }
}

export async function POST(request: Request) {
  // Cookie kimliğiyle yazan uç: başka sitelerden ücretli istek üretilemez.
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return respond({ error: "origin" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 1024) return respond({ error: "invalid-input" }, 400);
  let id: string | null = null;
  let userId: string | null = null;
  let completed = false;
  try {
    const access = await analysisAccess();
    if (!access) return respond({ error: "forbidden" }, 403);
    if (!configured()) return respond({ error: "unavailable" }, 503);
    const raw = await request.text();
    if (raw.length > 1024) return respond({ error: "invalid-input" }, 400);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return respond({ error: "invalid-input" }, 400); }
    const parsed = AnalysisInput.safeParse(input);
    if (!parsed.success) return respond({ error: "invalid-input" }, 400);
    const { requestId, symbol, horizon, locale } = parsed.data;
    if (!(await isKnownSymbol(symbol))) return respond({ error: "unknown-symbol" }, 400);
    // Aynı işin ağ üzerinden tekrar gönderilmesi ikinci Claude ücretini üretmez.
    const [previous] = await db.select().from(aiAnalysisRequests).where(and(
      eq(aiAnalysisRequests.id, requestId), eq(aiAnalysisRequests.userId, access.userId),
    )).limit(1);
    if (previous) {
      if (previous.symbol !== symbol || previous.horizon !== horizon || previous.locale !== locale) return respond({ error: "invalid-input" }, 400);
      if (previous.status === "completed" && previous.result) return respond({ id: requestId, result: previous.result, reused: true });
      return respond({ error: previous.status === "processing" ? "busy" : "analysis-failed" }, previous.status === "processing" ? 429 : 503);
    }
    if (!(await reserveAnalysis(access.userId, requestId))) {
      const current = await analysisAccess();
      return respond({ error: current?.remaining === 0 ? "quota" : "busy" }, 429);
    }
    id = requestId; userId = access.userId;
    await db.insert(aiAnalysisRequests).values({ id, userId, symbol, horizon, locale,
      status: "processing", model: process.env.CLAUDE_ANALYSIS_MODEL || "claude-sonnet-4-6" });
    const result = await generateAnalysis(symbol, horizon, locale, async (inputTokens, outputTokens) => {
      await db.update(aiAnalysisRequests).set({ inputTokens, outputTokens }).where(and(eq(aiAnalysisRequests.id, requestId), eq(aiAnalysisRequests.userId, access.userId)));
    });
    if (!configured()) throw new Error("forbidden");
    // Yetki/kilit kontrolü sonuç kaydıyla aynı SQL'de: iptal edilmiş iş yayınlanmaz.
    const saved = await db.update(aiAnalysisRequests).set({ status: "completed", result }).where(and(
      eq(aiAnalysisRequests.id, id), eq(aiAnalysisRequests.userId, userId), eq(aiAnalysisRequests.status, "processing"),
      sql`EXISTS (SELECT 1 FROM ai_analysis_access WHERE user_id = ${userId}::uuid AND enabled = true AND lock_id = ${id}::uuid AND lock_until > now())`,
    )).returning({ id: aiAnalysisRequests.id });
    if (!saved.length) throw new Error("forbidden");
    completed = true;
    return respond({ id, result, reused: false });
  } catch (error) {
    if (id && userId) {
      try { await db.update(aiAnalysisRequests).set({ status: "failed" }).where(and(eq(aiAnalysisRequests.id, id), eq(aiAnalysisRequests.userId, userId), eq(aiAnalysisRequests.status, "processing"))); }
      catch { /* Gizli upstream hata metni loglanmaz. */ }
    }
    const code = error instanceof Error ? error.message : "unavailable";
    const safe = code === "data-unavailable" || code === "forbidden" ? code : "analysis-failed";
    return respond({ error: safe }, safe === "forbidden" ? 403 : 503);
  } finally {
    if (id && userId) {
      try { await releaseAnalysis(userId, id, !completed); } catch { /* Süreli kilit sonraki istekte temizlenir. */ }
    }
  }
}
