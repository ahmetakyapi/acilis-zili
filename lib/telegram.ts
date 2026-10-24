import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { telegramPosts } from "./schema";
import type { Locale } from "./i18n/config";
import type { PostKind } from "./telegram-plan";

/**
 * TELEGRAM — gönderici ve defter (24 Ekim).
 *
 * Türkçede ABD hissesine odaklı güvenilir bir kanal yok; Açılış Zili'nin
 * kanalı sitenin zaten yazdığı içeriği kısa mesajlara çeviriyor (bülten
 * özeti + günün takvimi, kapanış, yeni Mercek, büyük makro veri). Mesajlar
 * `lib/telegram-format.ts`, veri `lib/telegram-data.ts`, zamanlama
 * `lib/telegram-plan.ts`, koşu `/api/cron/telegram`.
 *
 * SDK YOK — Bot API iki uçtan ibaret (`sendMessage`, `sendPhoto`) ve tek bir
 * JSON POST'u; e-posta göndericisinin (lib/email.ts) gerekçesinin aynısı.
 *
 * ORTAM: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` (TR kanalı, "@kanal"
 * ya da "-100…" kimliği), isteğe bağlı `TELEGRAM_CHANNEL_ID_EN`. Belirteç ya
 * da TR kanalı yoksa gönderici TAMAMEN uyur: uç `skipped: "off"` döner ve
 * cron betiği günlüğe "kapalı" yazar. Bot kanalda yönetici olmalı (mesaj
 * gönderme yetkisiyle).
 */

const API = "https://api.telegram.org";
/** Bot API'nin yanıt tavanı — asılı bir istek taramayı tutmasın. */
const SEND_TIMEOUT_MS = 10_000;

export type Channel = { locale: Locale; chatId: string };

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

/** Tanımlı kanallar — TR önce. Belirteç ya da TR kanalı yoksa boş. */
export function telegramChannels(): Channel[] {
  const tr = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!token() || !tr) return [];
  const en = process.env.TELEGRAM_CHANNEL_ID_EN?.trim();
  return en ? [{ locale: "tr", chatId: tr }, { locale: "en", chatId: en }] : [{ locale: "tr", chatId: tr }];
}

/**
 * `rejected`: Telegram AÇIKÇA reddetti (4xx yanıtı, ör. adres çekilemedi,
 * HTML bozuk, hız sınırı) — mesaj gitmedi, kesin. `false` ise sonuç
 * BİLİNMİYOR: zaman aşımı, ağ hatası ya da 5xx; istek Telegram'a ulaşıp
 * teslim edilmiş olabilir. Çağıran bu ikisini ayırır (route.ts → deliver).
 */
export type SendResult = { ok: true; messageId: number | null } | { ok: false; error: string; rejected: boolean };

async function call(method: "sendMessage" | "sendPhoto", body: Record<string, unknown>): Promise<SendResult> {
  const key = token();
  if (!key) return { ok: false, error: "off", rejected: true };
  try {
    const response = await fetch(`${API}/bot${key}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: { message_id?: number } }
      | null;
    if (!response.ok || !json?.ok) {
      /* Belirteç adreste: hata metni günlüğe yazılır, adres YAZILMAZ. */
      return {
        ok: false,
        error: `http ${response.status} ${(json?.description ?? "").slice(0, 200)}`,
        rejected: response.status >= 400 && response.status < 500,
      };
    }
    return { ok: true, messageId: json.result?.message_id ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), rejected: false };
  }
}

/**
 * Metin mesajı. `preview` verilirse bağlantı önizlemesi o adresten ve büyük
 * görselle çizilir (Mercek ve bülten sayfasının paylaşım kartı); verilmezse
 * önizleme kapalı — kapanış mesajında altta bir piyasa kartı gürültü olur.
 */
export function sendMessage(chatId: string, html: string, preview?: string): Promise<SendResult> {
  return call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: preview
      ? { url: preview, prefer_large_media: true }
      : { is_disabled: true },
  });
}

/** Görselli mesaj — altyazı en çok 1024 karakter (`CAPTION_LIMIT`). */
export function sendPhoto(chatId: string, photoUrl: string, captionHtml: string): Promise<SendResult> {
  return call("sendPhoto", { chat_id: chatId, photo: photoUrl, caption: captionHtml, parse_mode: "HTML" });
}

/* ---- Defter ---- */

/**
 * Tablo var mı. YOKSA HİÇ GÖNDERİLMEZ — gerekçe `lib/schema.ts` →
 * `telegramPosts`: defteri olmayan gönderici beş dakikada bir aynı mesajı
 * atardı.
 */
export async function telegramLedgerReady(): Promise<boolean> {
  try {
    await db.select({ id: telegramPosts.id }).from(telegramPosts).limit(1);
    return true;
  } catch {
    return false;
  }
}

/**
 * Defterde zaten olan anahtarlar (gitmiş ya da sahiplenilmiş). Hazırlığı
 * pahalı mesajlar (kapanışın ~520 sembollük bar isteği, Mercek'in sayfa
 * çekişi) bunu ÖNCE sorar ki gitmiş mesaj her beş dakikada yeniden
 * hazırlanmasın. Okunamazsa boş küme: hazırlık sürer, tekrarı yine
 * `claimPost` önler (doğru ama pahalı taraf).
 */
export async function ledgerKeys(keys: readonly string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  try {
    const rows = await db
      .select({ key: telegramPosts.dedupeKey })
      .from(telegramPosts)
      .where(inArray(telegramPosts.dedupeKey, [...keys]));
    return new Set(rows.map((row) => row.key));
  } catch {
    return new Set();
  }
}

/** Gönderimi sahiplenir; anahtar zaten varsa (gitti ya da başka koşu sürüyor) false. */
export async function claimPost(key: string, kind: PostKind, locale: Locale, summary: string): Promise<boolean> {
  try {
    const rows = await db
      .insert(telegramPosts)
      .values({ dedupeKey: key, kind, locale, summary })
      .onConflictDoNothing({ target: telegramPosts.dedupeKey })
      .returning({ id: telegramPosts.id });
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function markSent(key: string, messageId: number | null): Promise<void> {
  try {
    await db
      .update(telegramPosts)
      .set({ status: "sent", messageId, sentAt: new Date() })
      .where(eq(telegramPosts.dedupeKey, key));
  } catch {
    /* Satır "claimed" kalır: mesaj gitti, tekrar gönderilmez — doğru taraf. */
  }
}

/**
 * Telegram gönderimi AÇIKÇA reddetti — sahiplenmeyi geri al, sonraki koşu
 * yeniden denesin. Zaman aşımında ÇAĞRILMAZ (route.ts → deliver).
 */
export async function releasePost(key: string): Promise<void> {
  try {
    await db.delete(telegramPosts).where(eq(telegramPosts.dedupeKey, key));
  } catch {
    /* defter okunamıyor */
  }
}

export type TelegramPostRow = typeof telegramPosts.$inferSelect;

/** Yönetim ekranı: son gönderimler. `null` = tablo yok ya da okunamadı. */
export async function recentTelegramPosts(limit: number): Promise<TelegramPostRow[] | null> {
  try {
    return await db.select().from(telegramPosts).orderBy(desc(telegramPosts.createdAt)).limit(limit);
  } catch {
    return null;
  }
}
