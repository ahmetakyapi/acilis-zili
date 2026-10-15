import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { notificationPrefs, watchlistItems, watchlists } from "@/lib/schema";
import { getEarningsBetween } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { sendToUser } from "@/lib/push";
import { getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";

/**
 * "Bilanço yarın" hatırlatması (15 Ekim) — `deploy/cron-bilanco.sh` günde
 * bir çağırır. Tercihi açan hesaplara, takip listelerindeki şirketlerden
 * YARIN (ET) bilanço açıklayacak olanları tek bildirimde gönderir.
 *
 * - Takvim `getEarningsBetween`den okunur, HAM tablodan değil: elle tarih
 *   düzeltmeleri (earnings_overrides) oradan geçiyor; ham sorgu revize
 *   edilmiş eski tarihleri de getirirdi.
 * - Satır-başına-alarm değil GÜNLÜK İŞ: tekrar gönderimi engelleyen şey
 *   kadans (günde tek koşum) + gün-kapsamlı tag (aynı gün ikinci koşum
 *   öncekinin yerine geçer ama yeniden titreştirir — o yüzden crontab'da
 *   tek satır, tekrar yok).
 * - Kullanıcı başına EN ÇOK BİR bildirim: semboller tek gövdede sayılır,
 *   altı taneden fazlası "+n" ile söylenir.
 * - Tablolardan biri yoksa (migration 0033 / takip listeleri) sessizce
 *   atlanır; sonraki koşum dener.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Gövdede adıyla sayılan sembol sayısı; kalanı "+n". */
const LISTED_SYMBOLS = 6;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const tomorrow = addEtDays(todayEt(), 1);
  const rows = await getEarningsBetween(tomorrow, tomorrow);
  if (rows.length === 0) return NextResponse.json({ date: tomorrow, earnings: 0 });
  const reporting = new Set(rows.map((row) => row.symbol));

  let watchers: { userId: string; symbol: string }[];
  try {
    watchers = await db
      .select({ userId: watchlists.userId, symbol: watchlistItems.symbol })
      .from(watchlistItems)
      .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
      .innerJoin(
        notificationPrefs,
        and(
          eq(notificationPrefs.userId, watchlists.userId),
          eq(notificationPrefs.earningsReminder, true),
        ),
      )
      .where(inArray(watchlistItems.symbol, [...reporting]));
  } catch {
    /* notification_prefs yok (migration 0033) ya da veritabanı düştü. */
    return NextResponse.json({ date: tomorrow, skipped: "no-table" });
  }
  if (watchers.length === 0) {
    return NextResponse.json({ date: tomorrow, earnings: reporting.size, users: 0 });
  }

  const byUser = new Map<string, Set<string>>();
  for (const row of watchers) {
    const set = byUser.get(row.userId) ?? new Set<string>();
    set.add(row.symbol);
    byUser.set(row.userId, set);
  }

  let delivered = 0;
  for (const [userId, symbols] of byUser) {
    const list = [...symbols].sort();
    delivered += await sendToUser(userId, (locale) => {
      const t = getDictionary(locale).notifications;
      const named = list.slice(0, LISTED_SYMBOLS).join(", ");
      const rest = list.length - LISTED_SYMBOLS;
      const body = (list.length === 1 ? t.earningsBodyOne : t.earningsBody)
        .replace("{symbols}", rest > 0 ? `${named} +${rest}` : named)
        .replace("{n}", String(list.length));
      return {
        title: t.earningsTitle,
        body,
        url: withLocale("/bilancolar/takip", locale),
        /* Gün-kapsamlı tag: aynı günün ikinci koşumu (olmamalı) yığmaz. */
        tag: `earnings-${tomorrow}`,
      };
    });
  }

  return NextResponse.json({
    date: tomorrow,
    earnings: reporting.size,
    users: byUser.size,
    delivered,
  });
}
