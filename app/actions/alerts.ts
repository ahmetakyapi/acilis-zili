"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getStatus } from "@/lib/data";
import { db } from "@/lib/db";
import { getQuote } from "@/lib/providers";
import { isDirection, MAX_ALERTS, MAX_ALERTS_PER_SYMBOL } from "@/lib/price-alerts";
import { priceAlerts } from "@/lib/schema";
import { isValidSymbol } from "@/lib/utils";

/**
 * Fiyat alarmı eylemleri. Her eylem oturumu kendisi doğrular.
 *
 * DURUM DÖNDÜRÜYOR, SESSİZ DEĞİL. Favori eylemleri tavana dayanınca sessiz
 * dönüyor ve sayfa tazelenince eklenmeyen öğe kendini belli ediyor; burada
 * öyle bir iz yok — reddedilen hedef formda kalırdı ve okuyucu neden
 * kurulmadığını bilemezdi. Hata kodu forma dönüyor, metni sözlükte.
 *
 * TAVAN: hesap başına 50, sembol başına 5. Gerçek kullanımın çok üstünde;
 * amaç tek bir hesabın döngüyle tabloyu şişirmesini engellemek (aynı
 * gerekçe `app/actions/watchlist.ts` → "Yazma tavanları").
 */

export type AlertActionState = {
  status: "idle" | "ok" | "error";
  error?: "auth" | "target" | "same" | "limit" | "symbolLimit" | "unavailable";
  /** Her gönderimde değişir; istemci aynı hatayı iki kez duyurabilsin. */
  at: number;
};

/** Hedefin makul aralığı — yazım hatasıyla (fazladan sıfır) kurulan alarmı keser. */
const MAX_TARGET = 10_000_000;

function revalidate(symbol: string) {
  revalidatePath("/favoriler");
  revalidatePath(`/hisse/${symbol}`);
  revalidatePath("/");
}

/** "245,50" ve "245.50" ikisi de geçerli; binlik ayırıcı kabul edilmiyor. */
function parseTarget(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s|\$/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 && value < MAX_TARGET ? value : null;
}

export async function createPriceAlert(
  _previous: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const at = Date.now();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "error", error: "auth", at };

  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const target = parseTarget(String(formData.get("target") ?? ""));
  if (!isValidSymbol(symbol) || target === null) return { status: "error", error: "target", at };

  /* YÖN SUNUCUDA, GÜNCEL FİYATTAN. İstemcinin bildiği fiyat sayfanın
     çizildiği anınki; sunucu kotasyonu alabiliyorsa o esas. Alamıyorsa
     (sağlayıcı düşük) formdaki yön kullanılıyor ve kuruluş fiyatı boş
     kalıyor — ilerleme çubuğu o alarmda çizilmiyor. */
  const status = await getStatus();
  const quote = await getQuote(symbol, status);
  const price = quote.ok && !quote.stale ? quote.data.price : null;
  let direction: "above" | "below";
  if (price != null) {
    if (Math.abs(price - target) / price < 0.0005) return { status: "error", error: "same", at };
    direction = target > price ? "above" : "below";
  } else {
    const submitted = formData.get("direction");
    if (!isDirection(submitted)) return { status: "error", error: "target", at };
    direction = submitted;
  }

  try {
    const [{ total, forSymbol }] = await db
      .select({
        total: sql<number>`count(*)::int`,
        forSymbol: sql<number>`count(*) filter (where ${priceAlerts.symbol} = ${symbol})::int`,
      })
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId));
    if (total >= MAX_ALERTS) return { status: "error", error: "limit", at };
    if (forSymbol >= MAX_ALERTS_PER_SYMBOL) return { status: "error", error: "symbolLimit", at };

    await db.insert(priceAlerts).values({
      userId,
      symbol,
      direction,
      target: String(target),
      refPrice: price == null ? null : String(price),
    });
  } catch {
    // Tablo yok (migration uygulanmamış) ya da veritabanı düşük.
    return { status: "error", error: "unavailable", at };
  }

  revalidate(symbol);
  return { status: "ok", at };
}

export async function deletePriceAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  if (!id) return;
  try {
    await db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)));
  } catch {
    return;
  }
  revalidate(isValidSymbol(symbol) ? symbol : "");
}

/**
 * Hedefe ulaşmış alarmı yeniden kurar: aynı hedef, yön ve kuruluş fiyatı
 * GÜNCEL fiyattan yeniden türetiliyor. Fiyat hâlâ hedefin ötesindeyse alarm
 * kurulur kurulmaz yeniden tetiklenirdi; yön o yüzden çevriliyor
 * ("250'nin üstüne çıktı" → artık "250'nin altına inerse").
 */
export async function rearmPriceAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    const [row] = await db
      .select()
      .from(priceAlerts)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)))
      .limit(1);
    if (!row) return;
    const target = Number(row.target);
    const status = await getStatus();
    const quote = await getQuote(row.symbol, status);
    const price = quote.ok && !quote.stale ? quote.data.price : null;
    const direction =
      price == null ? row.direction : target > price ? "above" : "below";
    await db
      .update(priceAlerts)
      .set({
        direction,
        refPrice: price == null ? null : String(price),
        createdAt: new Date(),
        triggeredAt: null,
        triggeredPrice: null,
      })
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)));
    revalidate(row.symbol);
  } catch {
    return;
  }
}
