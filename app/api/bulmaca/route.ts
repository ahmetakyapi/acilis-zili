import { NextResponse } from "next/server";
import { getLocale } from "@/lib/i18n";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readTextCapped } from "@/lib/read-body";
import { dailySilhouette, evaluatePuzzle } from "@/lib/stock-puzzle-data";
import { MAX_GUESSES, isArchiveDay, isJoker, puzzleDayKey, type PuzzleState } from "@/lib/stock-puzzle";
import { isValidSymbol } from "@/lib/utils";

/**
 * "Hisseyi Bil" — tahmin kontrolü ve ipucu açma (24 Ekim).
 *
 * DURUMSUZ: gövde `{ day, guesses }`; sunucu günün cevabını kendisi bilir,
 * listeyi baştan değerlendirir ve yalnızca açılmış ipuçlarını döndürür.
 * Cevap yanıta yalnız bitmiş bulmacada girer (gerekçe
 * `lib/stock-puzzle-data.ts` başında). Tek istekte altı uydurma tahmin
 * cevabı açar; bu bilerek kabul edilmiş bir bedel ve neden kabul edildiği
 * aynı yerde ("DURUMSUZ UCUN BEDELİ").
 *
 * GÜN: bugün ya da ARŞİV günü (25 Ekim: geçmiş bulmacalar oynanabiliyor,
 * `isArchiveDay`). Arşivde de cevap ancak bitmiş bulmacada yanıta girer;
 * ilk bulmacadan önceki ve GELECEK günler 409 + bugünün günü (yarının
 * bulmacası açılmaz). Sekme gece yarısını açık geçerse dünün listesi
 * artık arşiv oyunu olarak değerlendirilir; okurun oyunu kaybolmaz.
 *
 * Listede `JOKER` ("*") bir tahmin hakkı harcayıp sıradaki basamağı açar.
 *
 * Oran sınırı dakikada 30: bir oyun en çok altı tahmin ve bir geri yükleme;
 * ucun maliyeti önbellekli okumalar (havuz, ölçüler, siluet), sağlayıcıya
 * yalnızca günün ilk siluet hesabı gidiyor.
 */
const PUZZLE_LIMIT = 30;
const PUZZLE_WINDOW_MS = 60_000;
/** Altı sembol ve bir tarih — 1 KB fazlasıyla yeter. */
const MAX_BODY_BYTES = 1024;

export type PuzzleResponse =
  | { ok: true; state: PuzzleState }
  | { ok: false; error: "rate-limited" | "bad-request" | "day" | "unavailable" | "unknown-symbol" | "duplicate" | "too-many"; day?: string };

function fail(error: Extract<PuzzleResponse, { ok: false }>["error"], status: number, extra: Partial<Extract<PuzzleResponse, { ok: false }>> = {}, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, error, ...extra } satisfies PuzzleResponse, { status, headers });
}

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "bulmaca"), PUZZLE_LIMIT, PUZZLE_WINDOW_MS);
  if (!limited.allowed) return fail("rate-limited", 429, {}, { "Retry-After": String(limited.retryAfter) });

  let body: unknown;
  try {
    const raw = await readTextCapped(request, MAX_BODY_BYTES);
    if (raw === null) return fail("bad-request", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("bad-request", 400);
  }
  if (!body || typeof body !== "object") return fail("bad-request", 400);
  const { day, guesses } = body as Record<string, unknown>;
  if (
    typeof day !== "string" ||
    !Array.isArray(guesses) ||
    guesses.length > MAX_GUESSES ||
    !guesses.every((item): item is string => typeof item === "string" && (isJoker(item) || isValidSymbol(item))) ||
    /* Son hakta joker yok (`jokerAllowed`): kuralı istemci kadar uç da tutar. */
    guesses.slice(MAX_GUESSES - 1).some((item) => isJoker(item))
  ) {
    return fail("bad-request", 400);
  }

  const today = puzzleDayKey();
  if (day !== today && !isArchiveDay(day, today)) return fail("day", 409, { day: today });

  const locale = await getLocale();
  const result = await evaluatePuzzle(day, guesses, locale);
  if (!result.ok) return fail(result.error, result.error === "unavailable" ? 503 : 400);
  return NextResponse.json({ ok: true, state: result.state } satisfies PuzzleResponse, {
    headers: { "Cache-Control": "no-store" },
  });
}

/** GET yanıtı — ana sayfa girişinin minyatürü. */
export type PuzzleTeaserResponse = { ok: true; day: string; points: number[] | null } | { ok: false };

/** Minyatür beş dakika tarayıcıda: gün dönerken eski günün siluetini
    istemci `day` alanıyla ayıklıyor (`PuzzleTeaser`). */
const TEASER_MAX_AGE_SECONDS = 300;

/**
 * Günün siluet minyatürü (25 Ekim). Bulmacanın ilk ipucunun kendisi ve
 * yalnız o; gerekçe `lib/stock-puzzle-data.ts` → `dailySilhouette`.
 */
export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "bulmaca-siluet"), PUZZLE_LIMIT, PUZZLE_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json({ ok: false } satisfies PuzzleTeaserResponse, {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }
  const day = puzzleDayKey();
  const points = await dailySilhouette(day);
  return NextResponse.json({ ok: true, day, points } satisfies PuzzleTeaserResponse, {
    headers: { "Cache-Control": `private, max-age=${TEASER_MAX_AGE_SECONDS}` },
  });
}
