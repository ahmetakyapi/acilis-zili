"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { watchlistItems, watchlists } from "@/lib/schema";
import { isValidSymbol } from "@/lib/utils";

/**
 * Takip listesi işlemleri.
 * Her eylem oturumu kendisi doğrular — proxy yalnızca ön elemedir.
 */

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

const LIST_COLORS = ["primary", "brass", "up", "down", "flat"] as const;

export async function createWatchlist(formData: FormData) {
  const userId = await requireUserId();
  if (!userId) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const color = String(formData.get("color") ?? "primary");
  if (!name) return;

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${watchlists.sortOrder}), -1)` })
    .from(watchlists)
    .where(eq(watchlists.userId, userId));

  await db.insert(watchlists).values({
    userId,
    name,
    color: (LIST_COLORS as readonly string[]).includes(color) ? color : "primary",
    sortOrder: maxOrder + 1,
  });

  revalidatePath("/favoriler");
}

export async function renameWatchlist(formData: FormData) {
  const userId = await requireUserId();
  if (!userId) return;

  const listId = String(formData.get("listId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!listId || !name) return;

  await db
    .update(watchlists)
    .set({ name })
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)));

  revalidatePath("/favoriler");
}

export async function deleteWatchlist(formData: FormData) {
  const userId = await requireUserId();
  if (!userId) return;

  const listId = String(formData.get("listId") ?? "");
  if (!listId) return;

  // ON DELETE CASCADE list öğelerini de siler.
  await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)));

  revalidatePath("/favoriler");
}

export async function addSymbolToList(formData: FormData) {
  const userId = await requireUserId();
  if (!userId) return;

  const listId = String(formData.get("listId") ?? "");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!listId || !isValidSymbol(symbol)) return;

  // Liste gerçekten bu kullanıcının mı?
  const [list] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)))
    .limit(1);
  if (!list) return;

  const [{ maxOrder }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${watchlistItems.sortOrder}), -1)`,
    })
    .from(watchlistItems)
    .where(eq(watchlistItems.watchlistId, listId));

  await db
    .insert(watchlistItems)
    .values({ watchlistId: listId, symbol, sortOrder: maxOrder + 1 })
    .onConflictDoNothing();

  revalidatePath("/favoriler");
  revalidatePath(`/hisse/${symbol}`);
}

export async function removeSymbolFromList(formData: FormData) {
  const userId = await requireUserId();
  if (!userId) return;

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  // Öğenin sahibi doğrulanarak silinir.
  await db.delete(watchlistItems).where(
    and(
      eq(watchlistItems.id, itemId),
      sql`${watchlistItems.watchlistId} in (
        select ${watchlists.id} from ${watchlists}
        where ${watchlists.userId} = ${userId}
      )`,
    ),
  );

  revalidatePath("/favoriler");
}

/** Hisse sayfasındaki yıldız — ilk listeye ekler / tüm listelerden çıkarır. */
export async function toggleSymbolFavorite(formData: FormData) {
  const userId = await requireUserId();
  if (!userId) return;

  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) return;

  const existing = await db
    .select({ itemId: watchlistItems.id })
    .from(watchlistItems)
    .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
    .where(and(eq(watchlists.userId, userId), eq(watchlistItems.symbol, symbol)));

  if (existing.length > 0) {
    for (const row of existing) {
      await db.delete(watchlistItems).where(eq(watchlistItems.id, row.itemId));
    }
  } else {
    let [list] = await db
      .select({ id: watchlists.id })
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(watchlists.sortOrder)
      .limit(1);

    if (!list) {
      [list] = await db
        .insert(watchlists)
        .values({ userId, name: "Takip listem", sortOrder: 0 })
        .returning({ id: watchlists.id });
    }

    await db
      .insert(watchlistItems)
      .values({ watchlistId: list.id, symbol })
      .onConflictDoNothing();
  }

  revalidatePath(`/hisse/${symbol}`);
  revalidatePath("/favoriler");
}
