import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { cleanNickname } from "@/lib/puzzle-board";
import { getBoard, setNickname, startRun, type Board } from "@/lib/puzzle-board-data";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readTextCapped } from "@/lib/read-body";
import { puzzleDayKey } from "@/lib/stock-puzzle";

/**
 * Hisseyi Bil — günün sıralaması (29 Ekim). Kurallar `lib/puzzle-board.ts`,
 * veri `lib/puzzle-board-data.ts`, ekran `components/puzzle/PuzzleLeaderboard.tsx`.
 *
 * GET: günün tablosu (yalnız BUGÜN — arşiv günlerinin sıralaması yok) ve
 * giriş yapmışsa okurun kendi sırası. Takma adı olmayan herkes anonim.
 * POST `{ action: "start" }`: okur günün bulmacasını açtı, saat başlar
 * (kayıt varsa dokunulmaz). POST `{ action: "nickname", nickname }`:
 * takma ad (boş = anonim). İkisi de oturum ister; tahminler bu uçtan değil
 * bulmacanın kendi ucundan kaydedilir (`/api/bulmaca`, sırayla).
 *
 * KAYNAK DENETİMİ: oturum çerezli POST yalnız sitenin kendi kökünden.
 */
const LIMIT = 30;
const WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 512;

export type BoardResponse = { ok: true; day: string; signedIn: boolean; board: Board } | { ok: false; error: string };

const respond = (data: BoardResponse, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (!rateLimit(clientKey(request, "bulmaca-siralama"), LIMIT, WINDOW_MS).allowed) return respond({ ok: false, error: "rate-limited" }, 429);
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const day = puzzleDayKey();
  const board = await getBoard(day, userId, t.stockPuzzle.board.anonymous);
  return respond({ ok: true, day, signedIn: Boolean(userId), board });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return respond({ ok: false, error: "origin" }, 403);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return respond({ ok: false, error: "auth" }, 401);
  if (!rateLimit(`bulmaca-siralama:${userId}`, LIMIT, WINDOW_MS).allowed) return respond({ ok: false, error: "rate-limited" }, 429);

  let body: Record<string, unknown>;
  try {
    const raw = await readTextCapped(request, MAX_BODY_BYTES);
    if (raw === null) return respond({ ok: false, error: "bad-request" }, 413);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return respond({ ok: false, error: "bad-request" }, 400);
  }
  const day = puzzleDayKey();
  const locale = await getLocale();
  const t = getDictionary(locale);
  if (body.action === "start") {
    await startRun(userId, day);
  } else if (body.action === "nickname" && typeof body.nickname === "string") {
    const nickname = cleanNickname(body.nickname);
    if (nickname === null) return respond({ ok: false, error: "nickname" }, 400);
    if (!(await setNickname(userId, nickname))) return respond({ ok: false, error: "unavailable" }, 503);
  } else {
    return respond({ ok: false, error: "bad-request" }, 400);
  }
  return respond({ ok: true, day, signedIn: true, board: await getBoard(day, userId, t.stockPuzzle.board.anonymous) });
}
