import { and, eq, gt, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { db } from "@/lib/db";
import type * as schema from "@/lib/schema";
import { claudeSpend } from "@/lib/schema";

/**
 * CLAUDE GÜNLÜK HARCAMA SAYACININ KALICI YARISI (14 Kasım güvenlik denetimi).
 * Karar mantığı `lib/claude-budget.ts`te; burada yalnız üç deyim var ve
 * metinleri testte sınanıyor (`tests/claude-spend-store.test.ts`).
 *
 * ARTIŞ TEK DEYİM VE KOŞULLU. "Oku, karşılaştır, yaz" iki süreç arasında
 * yarışır (mavi-yeşil geçişte eski ve yeni süreç birlikte yaşar): ikisi de
 * 149 okuyup 150 yazar, 151. çağrı geçer. `insert … on conflict do update …
 * where n < tavan returning n` satırı kilitler ve koşulu satırın SON hâline
 * karşı sınar; satır dönmezse tavan dolmuştur. Günün ilk çağrısı satırı
 * `n = 1` ile açar; tavanı sıfır olan çağıran buraya hiç gelmez
 * (`lib/claude-budget.ts` önce onu reddeder).
 */

type Database = NeonHttpDatabase<typeof schema>;

/** Bir hak alır; günün sayacı `ceiling`e varmışsa hiç satır dönmez. */
export const takeSpendQuery = (database: Database, day: string, ceiling: number) =>
  database
    .insert(claudeSpend)
    .values({ day, n: 1 })
    .onConflictDoUpdate({
      target: claudeSpend.day,
      set: { n: sql`${claudeSpend.n} + 1` },
      setWhere: sql`${claudeSpend.n} < ${ceiling}`,
    })
    .returning({ n: claudeSpend.n });

/** Ücretlenmeyen çağrının hakkını geri verir; sayaç sıfırın altına inmez. */
export const refundSpendQuery = (database: Database, day: string) =>
  database
    .update(claudeSpend)
    .set({ n: sql`${claudeSpend.n} - 1` })
    .where(and(eq(claudeSpend.day, day), gt(claudeSpend.n, 0)));

/**
 * Veritabanına ulaşılamazken bellekte sayılan hakları sonradan işler.
 * KOŞULSUZ: bu çağrılar zaten yapıldı ve ücretlendi, tavan onları geri
 * alamaz; sayaç gerçeği söylesin diye tavanın üstüne de çıkabilir.
 */
export const addSpendQuery = (database: Database, day: string, count: number) =>
  database
    .insert(claudeSpend)
    .values({ day, n: count })
    .onConflictDoUpdate({ target: claudeSpend.day, set: { n: sql`${claudeSpend.n} + ${count}` } });

export type SpendStore = {
  /** Yeni toplam; tavan doluysa `null`. */
  take(day: string, ceiling: number): Promise<number | null>;
  refund(day: string): Promise<void>;
  add(day: string, count: number): Promise<void>;
};

/** Canlı depo. `DATABASE_URL` yoksa (yerel, test) depo yok: bütçe bellekte sayar. */
export function databaseSpendStore(): SpendStore | null {
  if (!process.env.DATABASE_URL) return null;
  return {
    async take(day, ceiling) {
      const [row] = await takeSpendQuery(db, day, ceiling);
      return row ? row.n : null;
    },
    async refund(day) {
      await refundSpendQuery(db, day);
    },
    async add(day, count) {
      await addSpendQuery(db, day, count);
    },
  };
}

/** Postgres "relation does not exist" — Drizzle hatayı `cause` içine sarıyor. */
export function isMissingTable(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === "42P01" || codeOf(cause) === "42P01";
}
