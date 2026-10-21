import { NextResponse } from "next/server";
import { isBot } from "@/lib/analytics";
import { anonymousClient } from "@/lib/claude-budget";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getReleaseNote, releaseNoteFailure } from "@/lib/release-notes";
import { insightsConfigured } from "@/lib/stock-insights";

/**
 * Takvimin veri notu (18 Ekim) — `?id=<ekonomik olay>`. Gerekçe
 * lib/release-notes.ts. Hisse ve haber notlarıyla aynı kapı
 * (app/api/ai/hisse-notu): not istemciden, kart görünüme girince istenir;
 * bot ve geçersiz kimlik geri çevrilir; IP başına dakikada 20 (panel en çok
 * dört kart, yani dört istek). Açıklanmamış, düşük etkili ya da on günden
 * eski olayın notu yazılmaz — uç rastgele kimlikle çağrı harcatamaz.
 * Önbellekte olmayan not istemcinin günlük payından düşer (20 Ekim,
 * lib/claude-budget.ts — dört anonim not ucu tek pay).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" });
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  if (!rateLimit(clientKey(request, "veri-notu"), 20, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return respond({ ok: false, reason: "bad-request" }, 400);
  const note = await getReleaseNote(id, anonymousClient(request));
  return respond(note ? { ok: true, insight: note } : { ok: false, reason: "unavailable", cause: releaseNoteFailure(id) });
}
