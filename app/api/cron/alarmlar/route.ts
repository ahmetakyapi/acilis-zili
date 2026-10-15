import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { percentAlerts, priceAlerts } from "@/lib/schema";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { isDirection } from "@/lib/price-alerts";
import { isPercentDirection } from "@/lib/percent-alerts";
import {
  alertPayload,
  findHits,
  findPercentHits,
  percentPayload,
  type PendingAlert,
  type PendingPercentAlert,
} from "@/lib/alert-sweep";
import { getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { notifyUser } from "@/lib/notifications";

/**
 * Alarm taraması — `deploy/cron-alerts.sh` seans boyunca beş dakikada bir
 * çağırır. Gerekçe `lib/alert-sweep.ts`. İki tür tek turda: fiyat hedefi
 * (price_alerts) ve günlük yüzde değişim (percent_alerts, 15 Ekim) — ikisi
 * de AYNI kotasyon paketini okur, yoksa aynı sembolün iki farklı fiyatı
 * iki ayrı alarmı değerlendirirdi (CLAUDE.md → aynı sayı aynı kaynaktan).
 *
 * Üç kapı, üçü de veri dürüstlüğünden:
 * - Piyasa KAPALIYKEN hiçbir şey yapılmıyor: fiyat değişmiyor, yeni bir
 *   tetik olamaz; kapanış fiyatıyla tetiklenecek olan zaten son açık
 *   pencerede tetiklendi.
 * - Paket BAYATSA (sağlayıcı düştü, Neon önbelleğindeki önceki seans)
 *   hiçbir şey yazılmıyor — yazma katmanı bayat kotasyon kullanmaz
 *   (CLAUDE.md "Veri dürüstlüğü" 4). Bayat fiyatla tetiklenen alarm,
 *   okuyucunun telefonuna yanlış bir haber gönderirdi.
 * - Tetik yazması `triggeredAt IS NULL` koşullu ve `returning`li: üst üste
 *   binen iki koşumdan işaretlenen alarm için ikinci bildirim gitmiyor.
 *   Yüzde alarmında `changePct` null olan sembol atlanıyor (null "sıfır"
 *   değil "önceki kapanış bilinmiyor").
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

  /* Yüzde alarmları AYRI try/catch: tablo (migration 0033) fiyat
     alarmlarından sonra geldi ve yokluğu fiyat taramasını durdurmamalı. */
  let pendingPct: PendingPercentAlert[] = [];
  try {
    const rows = await db
      .select({
        id: percentAlerts.id,
        userId: percentAlerts.userId,
        symbol: percentAlerts.symbol,
        direction: percentAlerts.direction,
        thresholdPct: percentAlerts.thresholdPct,
      })
      .from(percentAlerts)
      .where(isNull(percentAlerts.triggeredAt));
    pendingPct = rows.flatMap((row) =>
      isPercentDirection(row.direction) && Number.isFinite(Number(row.thresholdPct))
        ? [{ ...row, direction: row.direction, thresholdPct: Number(row.thresholdPct) }]
        : [],
    );
  } catch {
    pendingPct = [];
  }

  if (pending.length === 0 && pendingPct.length === 0) return NextResponse.json({ pending: 0 });

  const symbols = [
    ...new Set([...pending.map((alert) => alert.symbol), ...pendingPct.map((alert) => alert.symbol)]),
  ];
  const quotes = await getQuotes(symbols, status);
  if (!quotes.ok || quotes.stale) {
    return NextResponse.json({ pending: pending.length + pendingPct.length, skipped: "stale" });
  }

  const prices: Record<string, number> = {};
  const changes: Record<string, number | null> = {};
  for (const [symbol, quote] of Object.entries(quotes.data)) {
    if (!quote) continue;
    prices[symbol] = quote.price;
    changes[symbol] = quote.changePct;
  }
  const hits = findHits(pending, prices);
  const pctHits = findPercentHits(pendingPct, changes);

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
    /* Gelen kutusu + push tek girişten (lib/notifications.ts): bildirimi
       açmamış okuyucu da tetiği başlıktaki zilde görür. */
    delivered += await notifyUser(
      hit.userId,
      "alert",
      (locale) => {
        const p = alertPayload(hit, locale, getDictionary(locale).notifications);
        return { title: p.title, body: p.body, path: `/hisse/${hit.symbol}`, tag: p.tag };
      },
      withLocale,
    );
  }
  for (const hit of pctHits) {
    const claimed = await db
      .update(percentAlerts)
      .set({ triggeredAt: now, triggeredPct: String(hit.changePct) })
      .where(and(eq(percentAlerts.id, hit.id), isNull(percentAlerts.triggeredAt)))
      .returning({ id: percentAlerts.id })
      .catch(() => []);
    if (claimed.length === 0) continue;
    triggered += 1;
    delivered += await notifyUser(
      hit.userId,
      "percent",
      (locale) => {
        const p = percentPayload(hit, locale, getDictionary(locale).notifications);
        return { title: p.title, body: p.body, path: `/hisse/${hit.symbol}`, tag: p.tag };
      },
      withLocale,
    );
  }

  return NextResponse.json({
    pending: pending.length,
    pendingPercent: pendingPct.length,
    symbols: symbols.length,
    triggered,
    delivered,
  });
}
