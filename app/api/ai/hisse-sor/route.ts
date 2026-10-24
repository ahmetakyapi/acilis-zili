import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { fundMetaOf } from "@/db/seed/symbols";
import { isBot } from "@/lib/analytics";
import { isKnownSymbol } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { readTextCapped } from "@/lib/read-body";
import { insightsConfigured } from "@/lib/stock-insights";
import { askStock, questionQuota } from "@/lib/stock-question";
import { normalizeQuestion } from "@/lib/stock-question-core";
import { isValidSymbol } from "@/lib/utils";

/**
 * Bu Hisseye Sor (24 Ekim) — POST `{ symbol, question, locale }`. Gerekçe,
 * veri ve doğruluk kuralları lib/stock-question.ts.
 *
 * Çerez kimliğiyle ücretli çağrı başlatan uç: köken aynı site olmalı
 * (analiz ucuyla aynı denetim, app/api/ai/analysis), gövde 2 KB'yi aşamaz
 * (lib/read-body.ts), bot ve oturumsuz geri çevrilir. Okur başına dakikada
 * 5 istek; günlük hak ve uçuştaki soru `askStock`ta. Fon sayfasında kutu
 * basılmıyor (değerleme, analist ve bilanço verisi yok); uç da kabul etmez.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_BODY_BYTES = 2048;
const PER_MINUTE = 5;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

const Body = z.object({
  symbol: z.string().max(12),
  question: z.string().max(600),
  locale: z.enum(["tr", "en"]),
});

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return respond({ ok: false, reason: "origin" }, 403);
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" }, 503);
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return respond({ ok: false, reason: "auth" }, 401);
  if (!rateLimit(`hisse-sor:${userId}`, PER_MINUTE, 60_000).allowed) return respond({ ok: false, reason: "rate", remaining: questionQuota.left(userId) }, 429);

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
  const symbol = body.symbol.toUpperCase();
  const question = normalizeQuestion(body.question);
  if (!question) return respond({ ok: false, reason: "question", remaining: questionQuota.left(userId) }, 400);
  if (!isValidSymbol(symbol) || fundMetaOf(symbol) || !(await isKnownSymbol(symbol))) return respond({ ok: false, reason: "unknown" }, 404);

  const result = await askStock(userId, symbol, question, body.locale);
  const status = result.ok ? 200 : result.reason === "quota" || result.reason === "busy" ? 429 : result.reason === "budget" ? 503 : 502;
  return respond(result, status);
}
