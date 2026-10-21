"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getStatus, isKnownSymbol } from "@/lib/data";
import { db } from "@/lib/db";
import { isSessionTrade } from "@/lib/market-hours";
import { getQuote } from "@/lib/providers";
import {
  isPercentDirection,
  MAX_THRESHOLD_PCT,
  MIN_THRESHOLD_PCT,
} from "@/lib/percent-alerts";
import { isDirection, MAX_ALERTS, MAX_ALERTS_PER_SYMBOL } from "@/lib/price-alerts";
import { rateLimit } from "@/lib/rate-limit";
import { percentAlerts, priceAlerts } from "@/lib/schema";
import { getLocale } from "@/lib/i18n";
import { isValidSymbol, parseDecimalInput } from "@/lib/utils";

/**
 * Fiyat alarmı eylemleri. Her eylem oturumu kendisi doğrular.
 *
 * DURUM DÖNDÜRÜYOR, SESSİZ DEĞİL. Reddedilen hedef formda kalırdı ve
 * okuyucu neden kurulmadığını bilemezdi. Hata kodu forma dönüyor, metni
 * sözlükte — favori eylemlerinin tavan sonuçlarıyla (`full`, `limit`) aynı
 * kalıp.
 *
 * TAVAN: hesap başına 50, sembol başına 5. Gerçek kullanımın çok üstünde;
 * amaç tek bir hesabın döngüyle tabloyu şişirmesini engellemek (aynı
 * gerekçe `app/actions/watchlist.ts` → "Yazma tavanları").
 */

export type AlertActionState = {
  status: "idle" | "ok" | "error";
  error?: "auth" | "target" | "direction" | "threshold" | "same" | "limit" | "symbolLimit" | "unavailable";
  /** Her gönderimde değişir; istemci aynı hatayı iki kez duyurabilsin. */
  at: number;
};

/** Hedefin makul aralığı — yazım hatasıyla (fazladan sıfır) kurulan alarmı keser. */
const MAX_TARGET = 10_000_000;

/* KÖK DE SEMBOL SAYFASI DA TAZELENMİYOR (20 Ekim). `revalidatePath("/")`
   ana sayfanın imlerini (`_N_T_/`, `_N_T_/index`), `/hisse/${symbol}` de
   hisse sayfasınınkini düşürüyordu: her alarm yazması (hesap başına
   dakikada 30) o sayfanın piyasa panolarını ve kotasyonlarını bir sonraki
   çizimde sağlayıcıdan yeniden çektiriyordu — en işlek hisselerde
   sürekli. Doğruluğa katkısı yoktu: sayfalar dinamik (kök yerleşim
   `headers()` okuyor), ana sayfadaki alarm özeti (WatchlistSummary) ve
   hisse sayfasındaki alarmlar istek içinde okunuyor, önbellekte değil;
   eylemdeki herhangi bir `revalidatePath` bulunulan sayfayı yanıtta zaten
   yeniden çiziyor. Gerekçenin tamamı `app/actions/watchlist.ts` →
   `revalidateFavorites`. Tazeleme yalnız satır gerçekten yazıldı ya da
   silindiyse. */
function revalidate() {
  revalidatePath("/favoriler");
}

/** "245,50" ve "245.50" iki dilde de geçerli; binlik ayırıcı DİLE GÖRE
    (TR "1.500" = 1500 — gerekçe lib/utils.ts → parseDecimalInput). */
function parseTarget(raw: string, locale: "tr" | "en"): number | null {
  const value = parseDecimalInput(raw, locale);
  return value !== null && value > 0 && value < MAX_TARGET ? value : null;
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
  const target = parseTarget(String(formData.get("target") ?? ""), await getLocale());
  if (!isValidSymbol(symbol) || target === null) return { status: "error", error: "target", at };

  /* Kova SAĞLAYICI ÇAĞRISINDAN ÖNCE (15 Ekim taraması): isValidSymbol salt
     biçim denetler, yani "QQZX", "QQZY"… gibi sonsuz benzersiz sembol
     üretilebilir ve her biri getQuote'ta ayrı önbellek anahtarı — tavana
     dayanmış hesap bile her çağrıda Alpaca isteği açtırıyordu. Kalıp
     portfolio.ts'teki yazma kovasının aynısı. */
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed)
    return { status: "error", error: "unavailable", at };

  /* YÖN SUNUCUDA, BİLİNEN SON FİYATTAN. İstemcinin bildiği fiyat sayfanın
     çizildiği anınki; sunucu kotasyonu alabiliyorsa o esas.

     BAYAT FİYAT DA YÖNÜ SÖYLER (16 Ekim). Yön yalnız TAZE fiyattan
     türetiliyordu; bayat kotasyonda (ön seansta henüz işlem görmemiş hisse,
     sağlayıcı kesintisi) sayfa fiyatı göstermiyor, formun gizli alanı hep
     "above" gönderiyor ve sunucu ona güveniyordu: $94'teki hisseye "90'ın
     altına inerse" diye kurulan alarm "90'ın üstüne çıkarsa" olarak
     yazılıyor, ilk taze taramada "90 üstüne çıktı" diye YANLIŞ bir push
     gidiyordu. Hedefin hangi tarafta olduğu bir gösterim iddiası değil,
     son işlem fiyatı bunu söylemeye yeter. Kuruluş fiyatı (ilerleme
     çubuğu) ise yine yalnız taze fiyattan. Hiç fiyat yoksa yön okuyucunun
     AÇIK seçimi olmalı (form o zaman iki yönü sorar). */
  const status = await getStatus();
  const quote = await getQuote(symbol, status);
  /* Uydurma sembol tarama paketini bozuyordu (bkz. alarm taraması): ne
     evrende ne sağlayıcıda olan sembole alarm kurulmaz. */
  if (!quote.ok && !(await isKnownSymbol(symbol))) return { status: "error", error: "target", at };
  const price = quote.ok && !quote.stale ? quote.data.price : null;
  const side = quote.ok ? quote.data.price : null;
  let direction: "above" | "below";
  if (side != null) {
    if (Math.abs(side - target) / side < 0.0005) return { status: "error", error: "same", at };
    direction = target > side ? "above" : "below";
  } else {
    const submitted = formData.get("direction");
    if (!isDirection(submitted)) return { status: "error", error: "direction", at };
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

  revalidate();
  return { status: "ok", at };
}

/* Silme de aynı kovada (20 Ekim): kovasızken rastgele bir kimlikle döngü
   hiçbir şey silmeden her çağrıda tazeleme yaptırıyordu. Tazeleme yalnız
   satır gerçekten silindiyse. */
export async function deletePriceAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed) return;
  let row: { id: string } | undefined;
  try {
    [row] = await db
      .delete(priceAlerts)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)))
      .returning({ id: priceAlerts.id });
  } catch {
    return;
  }
  if (row) revalidate();
}

/* --------------------------------------------------------------------------
   Yüzde alarmları (15 Ekim) — gerekçe lib/schema.ts → percentAlerts.
   Fiyat alarmıyla aynı omurga: oturum, oran kovası (AYNI kova — iki tür
   birlikte 30/dk), sunucuda doğrulama, tavanlar, tablo yokken "unavailable".
   Sağlayıcı çağrısı YOK: yön ve eşik kullanıcının açık seçimi, güncel
   fiyattan türetilecek bir şey yok.
   -------------------------------------------------------------------------- */

/** "5", "5,5" ve "5.5" geçerli; aralık sınırı lib/percent-alerts.ts'te. Kayıt
    `numeric(6,2)`: iki haneden fazlası yuvarlanırdı ve satırda yazan eşikle
    tetiklenen eşik ayrı düşerdi — iki haneyle sınırlı. */
function parseThreshold(raw: string, locale: "tr" | "en"): number | null {
  const value = parseDecimalInput(raw, locale);
  if (value === null || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return null;
  return value >= MIN_THRESHOLD_PCT && value <= MAX_THRESHOLD_PCT ? value : null;
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
  const threshold = parseThreshold(String(formData.get("threshold") ?? ""), await getLocale());
  const direction = formData.get("pct-direction");
  if (!isValidSymbol(symbol) || !isPercentDirection(direction)) return { status: "error", error: "target", at };
  if (threshold === null) return { status: "error", error: "threshold", at };

  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed)
    return { status: "error", error: "unavailable", at };

  /* UYDURMA SEMBOL YOK (16 Ekim). `isValidSymbol` yalnız biçimi denetliyor;
     tarama bütün bekleyen sembolleri tek pakette istiyor ve Alpaca geçersiz
     sembolü 400 ile reddedince istemci onları TEK TEK ayıklıyor (8 deneme).
     Dokuz uydurma sembole kurulan alarm paketi düşürüyor, tarama "bayat"
     deyip HERKESİN alarmını atlıyordu. Evrende yoksa sağlayıcıya sorulur;
     ikisinde de yoksa kurulmaz. */
  if (!(await isKnownSymbol(symbol)) && !(await getQuote(symbol, await getStatus())).ok)
    return { status: "error", error: "target", at };

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

  revalidate();
  return { status: "ok", at };
}

export async function deletePercentAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed) return;
  let row: { id: string } | undefined;
  try {
    [row] = await db
      .delete(percentAlerts)
      .where(and(eq(percentAlerts.id, id), eq(percentAlerts.userId, userId)))
      .returning({ id: percentAlerts.id });
  } catch {
    return;
  }
  if (row) revalidate();
}

/**
 * Tetiklenmiş yüzde alarmını yeniden kurar: eşik ve yön aynı kalır, tetik
 * temizlenir.
 *
 * AYNI SEANSTA YENİDEN KURULAN ALARM ERTESİ SEANSTA DEVREYE GİRER (16 Ekim).
 * Yorum "ertesi seans sayaç zaten sıfırdan başlıyor" diyordu ama tarama
 * yalnız `triggeredAt IS NULL` ve bugünkü değişime bakıyor: −%5'te öten
 * alarm, okuyucu "bir dahaki sefere de haber ver" diye yeniden kurunca
 * değişim hâlâ −%6 olduğu için beş dakika içinde AYNI bildirimi tekrar
 * gönderiyordu. Tetik bu seansa aitse `createdAt` seansın verisinin
 * tamamlandığı ana (`sessionEnd`) çekiliyor; tarama `createdAt <= şimdi`
 * şartıyla o ana kadar ona bakmıyor. Satır "Sonraki Seansta Devreye
 * Girer" der. Migration gerekmiyor.
 */
export async function rearmPercentAlert(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`alerts:${userId}`, 30, 60_000).allowed) return;
  try {
    const [current] = await db
      .select({ triggeredAt: percentAlerts.triggeredAt })
      .from(percentAlerts)
      .where(and(eq(percentAlerts.id, id), eq(percentAlerts.userId, userId)))
      .limit(1);
    if (!current) return;
    const now = new Date();
    const status = await getStatus();
    const armAt =
      current.triggeredAt && isSessionTrade(current.triggeredAt, status) && status.sessionEnd > now
        ? status.sessionEnd
        : now;
    const [row] = await db
      .update(percentAlerts)
      .set({ createdAt: armAt, triggeredAt: null, triggeredPct: null })
      .where(and(eq(percentAlerts.id, id), eq(percentAlerts.userId, userId)))
      .returning({ id: percentAlerts.id });
    if (row) revalidate();
  } catch {
    return;
  }
}

/**
 * Hedefe ulaşmış alarmı yeniden kurar: aynı hedef, yön ve kuruluş fiyatı
 * GÜNCEL fiyattan yeniden türetiliyor. Fiyat hâlâ hedefin ötesindeyse alarm
 * kurulur kurulmaz yeniden tetiklenirdi; yön o yüzden çevriliyor
 * ("250'nin üstüne çıktı" → artık "250'nin altına inerse"). Yön için bayat
 * son fiyat da, o da yoksa tetik fiyatı yeter (16 Ekim): taze fiyat
 * şartı yön çevirmeyi atlatıyor, alarm aynı bildirimi hemen tekrar
 * gönderiyordu. Kuruluş fiyatı yalnız taze fiyattan.
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
    const side = quote.ok ? quote.data.price : row.triggeredPrice != null ? Number(row.triggeredPrice) : null;
    const direction =
      side == null || !Number.isFinite(side) ? row.direction : target > side ? "above" : "below";
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
    revalidate();
  } catch {
    return;
  }
}
