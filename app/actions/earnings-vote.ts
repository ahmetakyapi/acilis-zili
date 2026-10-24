"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { getHolidays } from "@/lib/data";
import { findVoteRow, writeVote } from "@/lib/earnings-vote-data";
import {
  VOTE_CHOICES,
  VOTE_PERIOD_PATTERN,
  voteGate,
  type VoteChoice,
  type VoteTally,
} from "@/lib/earnings-vote";
import { todayEt } from "@/lib/market-hours";
import { rateLimit } from "@/lib/rate-limit";
import { isValidSymbol } from "@/lib/utils";

/**
 * "Beklentiyi Geçer mi?" oyu — herkese açık bir POST ucu, her çağrıda dört
 * kapı (CLAUDE.md "Server Action herkese açık POST ucudur"):
 *
 *   1. OTURUM: oy yalnız oturumun hesabına yazılır. İstemciden kullanıcı
 *      kimliği ALINMIYOR; sahiplik oturumdan geliyor, yani başkasının
 *      adına oy yazmanın bir yolu yok.
 *   2. ŞEMA (zod): sembol sitenin sembol kalıbı, çeyrek anahtarı
 *      `VOTE_PERIOD_PATTERN`, seçim iki değerden biri.
 *   3. ORAN: hesap başına dakikada 30. Gerçek okur bir sayfada birkaç oy
 *      veriyor; tavan döngüyle tabloyu dövmeyi kesiyor (aynı gerekçe
 *      `app/actions/watchlist.ts` → "Yazma tavanları").
 *   4. KİLİT: hedef satır ve kilit anı SUNUCUDA takvimden; istemcinin
 *      "hâlâ açık" demesine güvenilmiyor. Açıklama anı geldiyse ya da
 *      gerçekleşen EPS düştüyse oy reddedilir.
 *   5. TEK OY: okurun aynı rapora eski tarih anahtarıyla verdiği oy
 *      yazımda yeni anahtara taşınıyor (`writeVote`).
 *
 * Tazeleme (`revalidatePath`) YOK: bileşen dönen dağılımı kendisi çiziyor,
 * sayfanın geri kalanı oya bağlı değil (gerekçe `app/actions/watchlist.ts`
 * → `revalidateFavorites`: her tazeleme o sayfanın önbelleğini ıskalatır).
 */

export type VoteActionResult =
  | { ok: true; choice: VoteChoice; tally: VoteTally }
  | { ok: false; error: "auth" | "input" | "locked" | "rate" | "unavailable" };

const VoteInput = z.object({
  symbol: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(isValidSymbol),
  period: z.string().regex(VOTE_PERIOD_PATTERN),
  choice: z.enum(VOTE_CHOICES),
});

/** Hesap başına dakikada oy tavanı — gerekçe dosya başında. */
const VOTE_LIMIT = 30;
const VOTE_WINDOW_MS = 60_000;

export async function castEarningsVote(input: unknown): Promise<VoteActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "auth" };

  const parsed = VoteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "input" };
  const { symbol, period, choice } = parsed.data;

  if (!rateLimit(`earnings-vote:${userId}`, VOTE_LIMIT, VOTE_WINDOW_MS).allowed) {
    return { ok: false, error: "rate" };
  }

  try {
    const [row, holidays] = await Promise.all([findVoteRow(symbol, period, todayEt()), getHolidays()]);
    /* Kapı saf (`voteGate`) ve test ediliyor: tests/earnings-vote.test.ts. */
    if (!row || voteGate({ row, period, holidays, now: new Date() }) !== "open") {
      return { ok: false, error: "locked" };
    }
    const tally = await writeVote({ userId, symbol, period, reportDate: row.reportDate, choice });
    return { ok: true, choice, tally };
  } catch {
    /* Tablo yok (migration inmedi) ya da veritabanı düştü — iki durumda da
       oy yazılmadı; bileşen okura söylüyor. */
    return { ok: false, error: "unavailable" };
  }
}
