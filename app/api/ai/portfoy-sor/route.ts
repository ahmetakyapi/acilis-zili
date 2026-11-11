import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { askPortfolio, portfolioQuestionQuota } from "@/lib/portfolio-question";
import { rateLimit } from "@/lib/rate-limit";
import { readTextCapped } from "@/lib/read-body";
import { insightsConfigured } from "@/lib/stock-insights";
import { normalizeQuestion } from "@/lib/stock-question-core";

/**
 * Portföyüne Sor (11 Kasım) — POST `{ question, locale }`. Gerekçe, veri ve
 * doğruluk kuralları lib/portfolio-question.ts.
 *
 * Bu Hisseye Sor ucunun (app/api/ai/hisse-sor) denetimleri aynen: çerez
 * kimliğiyle ücretli çağrı başlatan uç olduğu için köken aynı site olmalı,
 * gövde 2 KB'yi aşamaz, bot ve oturumsuz geri çevrilir, okur başına
 * dakikada 4 istek (portföy girdisi hisse sorusundan ağır). Günlük hak ve
 * uçuştaki soru `askPortfolio`da. Yanıt kişisel: önbelleğe alınmaz.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/* 8 KB (11 Kasım): gövde artık sohbetin önceki üç adımını da taşıyor (soru ≤ 600 + yanıt ≤ 1.200 karakter × 3). */
const MAX_BODY_BYTES = 8192;
const PER_MINUTE = 4;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

/* `history` (11 Kasım): danışmanla sohbetin önceki adımları, en çok üç;
   yalnız bağlam (lib/portfolio-question.ts → PortfolioTurn). */
const Body = z.object({
  question: z.string().max(600),
  locale: z.enum(["tr", "en"]),
  history: z.array(z.object({ question: z.string().max(600), answer: z.string().max(1200) })).max(3).optional(),
});

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return respond({ ok: false, reason: "origin" }, 403);
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" }, 503);
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return respond({ ok: false, reason: "auth" }, 401);
  if (!rateLimit(`portfoy-sor:${userId}`, PER_MINUTE, 60_000).allowed) return respond({ ok: false, reason: "rate", remaining: portfolioQuestionQuota.left(userId) }, 429);

  let body: z.infer<typeof Body>;
  try {
    const raw = await readTextCapped(request, MAX_BODY_BYTES);
    if (raw === null) return respond({ ok: false, reason: "bad-request" }, 400);
    const parsed = Body.safeParse(JSON.parse(raw));
    if (!parsed.success) return respond({ ok: false, reason: "bad-request" }, 400);
    body = parsed.data;
  } catch {
    return respond({ ok: false, reason: "bad-request" }, 400);
  }
  const question = normalizeQuestion(body.question);
  if (!question) return respond({ ok: false, reason: "question", remaining: portfolioQuestionQuota.left(userId) }, 400);

  const result = await askPortfolio(userId, question, body.locale, body.history ?? []);
  const status = result.ok
    ? 200
    : result.reason === "quota" || result.reason === "busy"
      ? 429
      : result.reason === "budget"
        ? 503
        : result.reason === "empty"
          ? 404
          : result.reason === "unverified"
            ? 422
            : 502;
  return respond(result, status);
}
