import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { priceAlerts } from "@/lib/schema";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { isDirection } from "@/lib/price-alerts";
import { alertPayload, findHits, type PendingAlert } from "@/lib/alert-sweep";
import { sendToUser } from "@/lib/push";
import { getDictionary } from "@/lib/i18n";

/**
 * Fiyat alarmı taraması — `deploy/cron-alerts.sh` seans boyunca beş
 * dakikada bir çağırır. Gerekçe `lib/alert-sweep.ts`.
 *
 * Üç kapı, üçü de veri dürüstlüğünden:
 * - Piyasa KAPALIYKEN hiçbir şey yapılmıyor: fiyat değişmiyor, yeni bir
 *   tetik olamaz; kapanış fiyatıyla tetiklenecek olan zaten son açık
 *   pencerede tetiklendi.
 * - Paket BAYATSA (sağlayıcı düştü, Neon önbelleğindeki önceki seans)
 *   hiçbir şey yazılmıyor — yazma katmanı bayat kotasyon kullanmaz
 *   (CLAUDE.md "Veri dürüstlüğü" 4). Bayat fiyatla tetiklenen alarm,
 *   okuyucunun telefonuna yanlış bir haber gönderirdi.
 * - Tetik yazması `triggeredAt IS NULL` koşullu ve `returning`li: aynı
 *   anda sayfadan ya da üst üste binen iki koşumdan işaretlenen alarm için
 *   ikinci bir bildirim gitmiyor.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = await getStatus();
  if (status.session === "closed") return NextResponse.json({ skipped: "closed" });

  let pending: PendingAlert[];
  try {
    const rows = await db
      .select({
        id: priceAlerts.id,
        userId: priceAlerts.userId,
        symbol: priceAlerts.symbol,
        direction: priceAlerts.direction,
        target: priceAlerts.target,
      })
      .from(priceAlerts)
      .where(isNull(priceAlerts.triggeredAt));
    pending = rows.flatMap((row) =>
      isDirection(row.direction) && Number.isFinite(Number(row.target))
        ? [{ ...row, direction: row.direction, target: Number(row.target) }]
        : [],
    );
  } catch {
    /* Tablo yok (migration 0026) ya da veritabanı düştü — sonraki koşum dener. */
    return NextResponse.json({ skipped: "no-table" });
  }
  if (pending.length === 0) return NextResponse.json({ pending: 0 });

  const symbols = [...new Set(pending.map((alert) => alert.symbol))];
  const quotes = await getQuotes(symbols, status);
  if (!quotes.ok || quotes.stale) return NextResponse.json({ pending: pending.length, skipped: "stale" });

  const prices: Record<string, number> = {};
  for (const [symbol, quote] of Object.entries(quotes.data)) if (quote) prices[symbol] = quote.price;
  const hits = findHits(pending, prices);

  const now = new Date();
  let triggered = 0;
  let delivered = 0;
  for (const hit of hits) {
    const claimed = await db
      .update(priceAlerts)
      .set({ triggeredAt: now, triggeredPrice: String(hit.price) })
      .where(and(eq(priceAlerts.id, hit.id), isNull(priceAlerts.triggeredAt)))
      .returning({ id: priceAlerts.id })
      .catch(() => []);
    if (claimed.length === 0) continue;
    triggered += 1;
    delivered += await sendToUser(hit.userId, (locale) =>
      alertPayload(hit, locale, getDictionary(locale).notifications),
    );
  }

  return NextResponse.json({ pending: pending.length, symbols: symbols.length, triggered, delivered });
}
