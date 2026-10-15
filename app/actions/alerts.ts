"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getStatus } from "@/lib/data";
import { db } from "@/lib/db";
import { getQuote } from "@/lib/providers";
import {
  isPercentDirection,
  MAX_THRESHOLD_PCT,
  MIN_THRESHOLD_PCT,
} from "@/lib/percent-alerts";
import { isDirection, MAX_ALERTS, MAX_ALERTS_PER_SYMBOL } from "@/lib/price-alerts";
import { rateLimit } from "@/lib/rate-limit";
import { percentAlerts, priceAlerts } from "@/lib/schema";
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

  /* Kova SAĞLAYICI ÇAĞRISINDAN ÖNCE (15 Ekim taraması): isValidSymbol salt
     biçim denetler, yani "QQZX", "QQZY"… gibi sonsuz benzersiz sembol
     üretilebilir ve her biri getQuote'ta ayrı önbellek anahtarı — tavana
     dayanmış hesap bile her çağrıda Alpaca isteği açtırıyordu. Kalıp
     portfolio.ts'teki yazma kovasının aynısı. */
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed)
    return { status: "error", error: "unavailable", at };

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

/* --------------------------------------------------------------------------
   Yüzde alarmları (15 Ekim) — gerekçe lib/schema.ts → percentAlerts.
   Fiyat alarmıyla aynı omurga: oturum, oran kovası (AYNI kova — iki tür
   birlikte 30/dk), sunucuda doğrulama, tavanlar, tablo yokken "unavailable".
   Sağlayıcı çağrısı YOK: yön ve eşik kullanıcının açık seçimi, güncel
   fiyattan türetilecek bir şey yok.
   -------------------------------------------------------------------------- */

/** "5", "5,5" ve "5.5" geçerli; aralık sınırı lib/percent-alerts.ts'te. */
function parseThreshold(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s|%/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= MIN_THRESHOLD_PCT && value <= MAX_THRESHOLD_PCT
    ? value
    : null;
}

export async function createPercentAlert(
  _previous: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const at = Date.now();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "error", error: "auth", at };

  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const threshold = parseThreshold(String(formData.get("threshold") ?? ""));
  const direction = formData.get("pct-direction");
  if (!isValidSymbol(symbol) || threshold === null || !isPercentDirection(direction))
    return { status: "error", error: "target", at };

  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed)
    return { status: "error", error: "unavailable", at };

  try {
    const [{ total, forSymbol }] = await db
      .select({
        total: sql<number>`count(*)::int`,
        forSymbol: sql<number>`count(*) filter (where ${percentAlerts.symbol} = ${symbol})::int`,
      })
      .from(percentAlerts)
      .where(eq(percentAlerts.userId, userId));
    if (total >= MAX_ALERTS) return { status: "error", error: "limit", at };
    if (forSymbol >= MAX_ALERTS_PER_SYMBOL) return { status: "error", error: "symbolLimit", at };

    await db.insert(percentAlerts).values({
      userId,
      symbol,
      direction,
      thresholdPct: String(threshold),
    });
  } catch {
    // Tablo yok (migration 0033 uygulanmamış) ya da veritabanı düşük.
    return { status: "error", error: "unavailable", at };
  }

  revalidate(symbol);
  return { status: "ok", at };
}

export async function deletePercentAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  if (!id) return;
  try {
    await db
      .delete(percentAlerts)
      .where(and(eq(percentAlerts.id, id), eq(percentAlerts.userId, userId)));
  } catch {
    return;
  }
  revalidate(isValidSymbol(symbol) ? symbol : "");
}

/**
 * Tetiklenmiş yüzde alarmını yeniden kurar: eşik ve yön aynı kalır, tetik
 * temizlenir. Fiyat alarmındaki yön çevirme burada gerekmez: tetik günlük
 * değişime bağlı ve ertesi seans sayaç zaten sıfırdan başlıyor.
 */
export async function rearmPercentAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed) return;
  try {
    const [row] = await db
      .update(percentAlerts)
      .set({ createdAt: new Date(), triggeredAt: null, triggeredPct: null })
      .where(and(eq(percentAlerts.id, id), eq(percentAlerts.userId, userId)))
      .returning({ symbol: percentAlerts.symbol });
    if (row) revalidate(row.symbol);
  } catch {
    return;
  }
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
  /* Aynı kova: sembol kullanıcının kendi satırından gelse de yol aynı
     getQuote'u koşuyor. */
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed) return;
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
