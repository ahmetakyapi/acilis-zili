"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { portfolioPositions } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
import { isValidSymbol } from "@/lib/utils";
import { isIsoDate, TCMB_MIN_DATE } from "@/lib/fx";
import { istanbulToday } from "@/lib/providers/fx-history";
import { MAX_POSITIONS } from "@/lib/portfolio-data";

/**
 * Portföy eylemleri — ekleme ve silme.
 *
 * Her eylem oturumu KENDİSİ doğruluyor (proxy yalnızca ön eleme) ve
 * kimlik oturumdan geliyor, formdan değil: başkasının pozisyonunu silmek
 * için kimliğini bilmek yetmiyor, satır `user_id` ile de eşleşmeli.
 *
 * Girdi Zod ile doğrulanıyor; takip listesi eylemleriyle aynı tavan
 * mantığı (gerekçe `app/actions/watchlist.ts` → "Yazma tavanları"):
 * giriş yapmış tek bir hesap döngüyle yüz binlerce satır yazamasın.
 *
 * TABLO YOKSA (migration henüz uygulanmadıysa) yazma düşüyor ve okuyucu
 * kısa bir hata alıyor; sayfa zaten "şu an açılamıyor" durumunda.
 */

export type PortfolioActionState = {
  status: "idle" | "saved" | "error";
  error?: "invalid" | "limit" | "rateLimited" | "failed" | "signedOut";
};

/** Dakikada yazma tavanı — elle form doldurmanın hızı bunun çok altında. */
const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 60_000;
/** Makul üst sınırlar: bir milyar adet, on milyon dolarlık hisse fiyatı. */
const MAX_QUANTITY = 1_000_000_000;
const MAX_PRICE_USD = 10_000_000;
const MAX_NOTE = 120;

/* Sayı alanları `type="number"` ile geliyor ama tarayıcı dışından da
   çağrılabilir; virgüllü ondalık da kabul ediliyor ("12,5"). */
const decimal = z
  .string()
  .trim()
  .transform((raw) => Number(raw.replace(",", ".")))
  .pipe(z.number().finite());

const PositionInput = z.object({
  symbol: z
    .string()
    .trim()
    .transform((raw) => raw.toUpperCase())
    .refine((value) => isValidSymbol(value)),
  quantity: decimal.pipe(z.number().positive().max(MAX_QUANTITY)),
  costUsd: decimal.pipe(z.number().positive().max(MAX_PRICE_USD)),
  boughtAt: z.string().refine((value) => isIsoDate(value)),
  note: z.string().trim().max(MAX_NOTE).optional(),
});

export async function addPositionAction(
  _prev: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "error", error: "signedOut" };

  /* Anahtar IP değil KULLANICI: yazma oturuma bağlı. */
  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  const parsed = PositionInput.safeParse({
    symbol: String(formData.get("symbol") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    costUsd: String(formData.get("costUsd") ?? ""),
    boughtAt: String(formData.get("boughtAt") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  /* Tarih aralığı: TCMB arşivinin anlamlı başlangıcı ile bugün. Öncesi eski
     lira (gerekçe `TCMB_MIN_DATE`), sonrası henüz yaşanmadı. */
  if (
    !parsed.success ||
    parsed.data.boughtAt < TCMB_MIN_DATE ||
    parsed.data.boughtAt > istanbulToday()
  ) {
    return { status: "error", error: "invalid" };
  }
  const input = parsed.data;

  try {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(portfolioPositions)
      .where(eq(portfolioPositions.userId, userId));
    if (total >= MAX_POSITIONS) return { status: "error", error: "limit" };

    await db.insert(portfolioPositions).values({
      userId,
      symbol: input.symbol,
      quantity: String(input.quantity),
      costUsd: String(input.costUsd),
      boughtAt: input.boughtAt,
      note: input.note ? input.note : null,
    });
  } catch {
    return { status: "error", error: "failed" };
  }

  revalidatePath("/portfoy");
  return { status: "saved" };
}

export async function deletePositionAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return;

  try {
    await db
      .delete(portfolioPositions)
      .where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  } catch {
    return;
  }
  revalidatePath("/portfoy");
}
