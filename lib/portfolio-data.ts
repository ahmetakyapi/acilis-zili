import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioOrder, portfolioPositions } from "@/lib/schema";

/**
 * Portföy pozisyonları — `/portfoy`.
 *
 * TABLO YOKKEN SESSİZCE DÜŞÜYOR ve bu bilinçli: migration'lar deploy'da
 * uygulanmıyor, yani kod `portfolio_positions` tablosundan önce yayına
 * inebilir (kalıp `lib/avatar-data.ts`). Hata yutulup `{ ok: false }`
 * dönüyor; sayfa "şu an açılamıyor" der, çökmez ve hesabın geri kalanı
 * etkilenmez.
 *
 * `numeric` sütunlar sürücüden DİZE geliyor (kesirli adet kayan noktada
 * yuvarlanmasın diye numeric seçildi); burada sayıya çevriliyor. Çevrilemeyen
 * satır atlanıyor — sıfır adetli bir pozisyon uydurmaktansa göstermemek.
 */

/** Hesap başına pozisyon tavanı — gerçek kullanımın çok üstünde. Burada,
 *  eylem dosyasında değil: `"use server"` modülü yalnızca async fonksiyon
 *  dışa aktarabiliyor ve sayfa bu sayıyı hata metnine yazıyor. */
export const MAX_POSITIONS = 200;

export type PortfolioPosition = {
  id: string;
  symbol: string;
  quantity: number;
  /** Hisse başı alış fiyatı, dolar. */
  costUsd: number;
  /** "YYYY-MM-DD" */
  boughtAt: string;
  note: string | null;
};

export type PortfolioResult =
  | { ok: true; positions: PortfolioPosition[] }
  | { ok: false };

export const getPortfolioPositions = cache(
  async (userId: string): Promise<PortfolioResult> => {
    try {
      const rows = await db
        .select()
        .from(portfolioPositions)
        .where(eq(portfolioPositions.userId, userId))
        .orderBy(asc(portfolioPositions.boughtAt), asc(portfolioPositions.createdAt));
      const positions: PortfolioPosition[] = [];
      for (const row of rows) {
        const quantity = Number(row.quantity);
        const costUsd = Number(row.costUsd);
        if (!(quantity > 0) || !(costUsd >= 0)) continue;
        positions.push({
          id: row.id,
          symbol: row.symbol,
          quantity,
          costUsd,
          boughtAt: row.boughtAt,
          note: row.note,
        });
      }
      return { ok: true, positions };
    } catch {
      return { ok: false };
    }
  },
);

/**
 * Okuyucunun elle verdiği sıra — yoksa `null` ve liste varsayılan sırayla
 * (`orderPositions`). Tablo yokken (migration 0025 henüz uygulanmadıysa) de
 * `null`: sıra bir tercih, okunamaması portföyü açılmaz yapmamalı.
 */
export const getPortfolioOrder = cache(async (userId: string): Promise<string[] | null> => {
  try {
    const [row] = await db
      .select({ positionIds: portfolioOrder.positionIds })
      .from(portfolioOrder)
      .where(eq(portfolioOrder.userId, userId))
      .limit(1);
    return row && Array.isArray(row.positionIds) ? row.positionIds.filter((id) => typeof id === "string") : null;
  } catch {
    return null;
  }
});
