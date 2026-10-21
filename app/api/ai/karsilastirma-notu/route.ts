import { NextResponse } from "next/server";
import { isBot } from "@/lib/analytics";
import { anonymousClient } from "@/lib/claude-budget";
import { isCompareRange } from "@/lib/compare";
import { getCompareNote } from "@/lib/compare-note";
import { noteSymbols } from "@/lib/compare-note-core";
import { getSymbolNames } from "@/lib/data";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { insightFailure, insightsConfigured } from "@/lib/stock-insights";

/**
 * Karşılaştırma ekranının Claude notu (18 Ekim) —
 * `?semboller=AMD,NVDA&aralik=6M`. Gerekçe ve maliyet lib/compare-note.ts.
 *
 * Hisse notunun ucuyla aynı kapılar (app/api/ai/hisse-notu): not istemciden,
 * panel görünüme girince istenir (components/markets/CompareNoteCard.tsx);
 * bot (kullanıcı ajanı) geri çevrilir; IP başına dakikada 20 — kart seçim ve
 * aralık değişiminde 800 ms bekleyip tek istek atıyor ve aynı anahtarı
 * istemcide hatırlıyor, yani okuyucu düğmeler arasında gezinirken de tavanın
 * altında kalır. Semboller 2–4, geçerli ve TANINAN (tek sorgu,
 * `getSymbolNames`); bilinmeyen sembol Claude'a hiç gitmez. Bileşim sayısı
 * yine de sınırsıza yakın: önbellekte olmayan not istemcinin günlük payından
 * düşer (20 Ekim, lib/claude-budget.ts).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" });
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  if (!rateLimit(clientKey(request, "karsilastirma-notu"), 20, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const params = new URL(request.url).searchParams;
  const symbols = noteSymbols(params.get("semboller"));
  const range = params.get("aralik");
  if (!symbols || !isCompareRange(range)) return respond({ ok: false, reason: "bad-request" }, 400);
  const names = await getSymbolNames(symbols);
  if (symbols.some((symbol) => !names[symbol])) return respond({ ok: false, reason: "unknown" }, 404);
  const { note, key } = await getCompareNote(symbols, range, anonymousClient(request));
  return respond(note ? { ok: true, note } : { ok: false, reason: "unavailable", cause: key ? insightFailure("compare", key) : null });
}
