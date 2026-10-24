import "server-only";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { guncelBilanco } from "@/lib/data";
import { addEtDays } from "@/lib/market-hours";
import { earningsCalendar, earningsVotes, type EarningsRow } from "@/lib/schema";
import { SAME_REPORT_DAYS } from "@/lib/earnings-overrides";
import {
  boardFor,
  isVoteChoice,
  staleVotePeriods,
  VOTE_SAME_REPORT_DAYS,
  matchVoteRow,
  voteAccuracy,
  voteBoardKey,
  voteOutcome,
  type VoteAccuracy,
  type VoteChoice,
  type VoteTally,
} from "@/lib/earnings-vote";

/**
 * Bilanço oylamasının veri katmanı — mantık `lib/earnings-vote.ts`.
 *
 * TABLO YOKKEN SESSİZ (`available: false`). Tablo migration'la geliyor ve
 * migration'lar deploy'da uygulanmıyor (CLAUDE.md "Altyapı"); o arada
 * bileşen hiç basılmıyor — kaydedilemeyecek bir oy düğmesi tıklamayı
 * yutmak olurdu. Kalıp `lib/price-alerts.ts` → `getUserAlerts`.
 *
 * PENCERE ±45 GÜN. Oy satırının `report_date`i oyun verildiği gün bilinen
 * tarih; sağlayıcı tarihi sonradan kaydırırsa satır o tarihte kalıyor.
 * Aynı raporun aralığını kaçırmamak için okuma aralığı iki yana
 * `SAME_REPORT_DAYS` (elle düzeltme katmanının "aynı rapor" ölçütü) kadar
 * genişliyor; eşleme zaten çeyrek anahtarıyla, fazla satır zarar vermiyor.
 */

export type VoteBoard = {
  available: boolean;
  /** `voteBoardKey` → okurun oyu. */
  mine: Record<string, VoteChoice>;
  /** `voteBoardKey` → dağılım. Ekrana çıkıp çıkmayacağına `buildVoteView` karar verir. */
  tallies: Record<string, VoteTally>;
};

const EMPTY_BOARD: VoteBoard = { available: false, mine: {}, tallies: {} };

export async function getVoteBoard(
  userId: string | null,
  from: string,
  to: string,
  symbols?: readonly string[],
): Promise<VoteBoard> {
  const lo = addEtDays(from, -SAME_REPORT_DAYS);
  const hi = addEtDays(to, SAME_REPORT_DAYS);
  const inRange = and(
    gte(earningsVotes.reportDate, lo),
    lte(earningsVotes.reportDate, hi),
    symbols && symbols.length > 0 ? inArray(earningsVotes.symbol, [...symbols]) : undefined,
  );
  try {
    const [counts, own] = await Promise.all([
      db
        .select({
          symbol: earningsVotes.symbol,
          period: earningsVotes.period,
          choice: earningsVotes.choice,
          n: sql<number>`count(*)::int`,
        })
        .from(earningsVotes)
        .where(inRange)
        .groupBy(earningsVotes.symbol, earningsVotes.period, earningsVotes.choice),
      userId
        ? db
            .select({ symbol: earningsVotes.symbol, period: earningsVotes.period, choice: earningsVotes.choice })
            .from(earningsVotes)
            .where(and(eq(earningsVotes.userId, userId), inRange))
        : Promise.resolve([]),
    ]);
    const tallies: Record<string, VoteTally> = {};
    for (const row of counts) {
      if (!isVoteChoice(row.choice)) continue;
      const key = voteBoardKey(row.symbol, row.period);
      const tally = (tallies[key] ??= { beat: 0, miss: 0 });
      tally[row.choice] += Number(row.n);
    }
    const mine: Record<string, VoteChoice> = {};
    for (const row of own) {
      if (isVoteChoice(row.choice)) mine[voteBoardKey(row.symbol, row.period)] = row.choice;
    }
    return { available: true, mine, tallies };
  } catch {
    return EMPTY_BOARD;
  }
}

/**
 * Oy verilecek takvim satırı — eylemin tek doğruluk kaynağı. İstemci
 * yalnızca sembol ve çeyrek anahtarı gönderiyor; tarih, pencere ve kilit
 * anı sunucuda takvimden okunuyor, istemcinin söylediği bir saate
 * güvenilmiyor. Bugünden (ET) önceki satır aday değil: dünkü raporun oyu
 * zaten kapalı.
 */
export async function findVoteRow(
  symbol: string,
  period: string,
  today: string,
): Promise<EarningsRow | null> {
  const rows = await db
    .select()
    .from(earningsCalendar)
    .where(and(eq(earningsCalendar.symbol, symbol), gte(earningsCalendar.reportDate, today), guncelBilanco));
  return matchVoteRow({ symbol, period, reportDate: "" }, rows);
}

/**
 * Yazar ve hedefin güncel dağılımını döner. Oy değiştirilebilir (kilide kadar).
 *
 * TEK OY, TAŞINARAK. Okurun aynı rapora eski bir TARİH anahtarıyla verdiği
 * oy (tarih kaydı, ya da çeyrek sonradan bilindi) bu yazımda siliniyor ve
 * yerine yeni anahtarlı satır yazılıyor; ikisi tek `batch`te (Neon HTTP
 * sürücüsünde işlem) — silme geçip yazma düşerse okur oysuz kalmasın.
 * Ölçüt saf: `staleVotePeriods` (`lib/earnings-vote.ts`).
 */
export async function writeVote(input: {
  userId: string;
  symbol: string;
  period: string;
  reportDate: string;
  choice: VoteChoice;
}): Promise<VoteTally> {
  const now = new Date();
  const lo = addEtDays(input.reportDate, -VOTE_SAME_REPORT_DAYS);
  const hi = addEtDays(input.reportDate, VOTE_SAME_REPORT_DAYS);
  const own = await db
    .select({ period: earningsVotes.period })
    .from(earningsVotes)
    .where(and(eq(earningsVotes.userId, input.userId), eq(earningsVotes.symbol, input.symbol)));
  const stale = staleVotePeriods(own, input.period, input.reportDate);
  const upsert = db
    .insert(earningsVotes)
    .values({ ...input, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [earningsVotes.userId, earningsVotes.symbol, earningsVotes.period],
      set: { choice: input.choice, reportDate: input.reportDate, updatedAt: now },
    });
  if (stale.length > 0) {
    await db.batch([
      db
        .delete(earningsVotes)
        .where(
          and(
            eq(earningsVotes.userId, input.userId),
            eq(earningsVotes.symbol, input.symbol),
            inArray(earningsVotes.period, stale),
          ),
        ),
      upsert,
    ]);
  } else {
    await upsert;
  }
  /* Dağılım okumadakiyle AYNI birleştirmeyle (`boardFor`): ekrana dönen
     sayı, sayfa tazelenince görünecek sayıyla aynı. */
  const board = await getVoteBoard(null, lo, hi, [input.symbol]);
  return boardFor(board, { symbol: input.symbol, ...periodSourceOf(input.period, input.reportDate) }).tally ?? { beat: 0, miss: 0 };
}

/** Anahtardan `votePeriodKey`in girdisini geri kurar — `boardFor` satır ister. */
function periodSourceOf(period: string, reportDate: string) {
  const match = /^(\d{4})Q([1-4])$/.exec(period);
  return match
    ? { year: Number(match[1]), quarter: Number(match[2]), reportDate }
    : { year: null, quarter: null, reportDate };
}

/**
 * Okurun bir yıldaki isabeti — yıl RAPOR TARİHİNİN (ET) yılı.
 *
 * Sonuç her okumada takvimden: oy satırı sonucu taşımıyor (gerekçe
 * `lib/schema.ts` → `earningsVotes`). İki sorgu: yılın oyları, sonra o
 * sembollerin aynı penceredeki takvim satırları.
 */
export async function getVoteAccuracy(
  userId: string,
  year: number,
): Promise<{ available: boolean; year: number; accuracy: VoteAccuracy | null }> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  try {
    const votes = await db
      .select({
        symbol: earningsVotes.symbol,
        period: earningsVotes.period,
        reportDate: earningsVotes.reportDate,
        choice: earningsVotes.choice,
      })
      .from(earningsVotes)
      .where(and(eq(earningsVotes.userId, userId), gte(earningsVotes.reportDate, from), lte(earningsVotes.reportDate, to)));
    if (votes.length === 0) return { available: true, year, accuracy: null };
    const symbols = [...new Set(votes.map((vote) => vote.symbol))];
    const rows = await db
      .select()
      .from(earningsCalendar)
      .where(
        and(
          inArray(earningsCalendar.symbol, symbols),
          gte(earningsCalendar.reportDate, addEtDays(from, -SAME_REPORT_DAYS)),
          lte(earningsCalendar.reportDate, addEtDays(to, SAME_REPORT_DAYS)),
          guncelBilanco,
        ),
      );
    const scored = votes.flatMap((vote) => {
      if (!isVoteChoice(vote.choice)) return [];
      const row = matchVoteRow(vote, rows);
      return [{ choice: vote.choice, outcome: row ? voteOutcome(row.epsActual, row.epsEstimate) : null }];
    });
    return { available: true, year, accuracy: voteAccuracy(scored) };
  } catch {
    return { available: false, year, accuracy: null };
  }
}
