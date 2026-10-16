import { NextResponse } from "next/server";
import { and, eq, gte, inArray } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { notificationPrefs, notifications, watchlistItems, watchlists } from "@/lib/schema";
import { getEarningsBetweenResult } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { notifyUser } from "@/lib/notifications";
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
 *
 * TEKRAR DENENEBİLİR (16 Ekim). Günde tek koşum ve tekrarsızlık yüzünden
 * 16:20'de denk gelen bir sürüm (servis birkaç saniye kapalı) ya da Neon
 * hatası o günün hatırlatmalarını sessizce yutuyordu: takvim okunamayınca
 * `getEarningsBetween` boş liste dönüyor, uç 200 "earnings: 0" diyordu.
 * Şimdi okuma hatası 503 (betik günlüğe yazar ve `curl --retry` ile yeniden
 * dener) ve son 12 saatte "bilanço" bildirimi almış hesap atlanır — aynı
 * günün ikinci koşumu kimseye ikinci bildirim göndermez.
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
  const calendar = await getEarningsBetweenResult(tomorrow, tomorrow);
  if (!calendar.ok) {
    console.error("[bilanço] takvim okunamadı", tomorrow);
    return NextResponse.json({ date: tomorrow, error: "calendar" }, { status: 503 });
  }
  const rows = calendar.rows;
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
  } catch (error) {
    /* notification_prefs yok (migration 0033) ya da veritabanı düştü —
       ikisi de görünür olmalı: 503, betik günlüğe yazar ve yeniden dener. */
    console.error("[bilanço] takipçiler okunamadı", error);
    return NextResponse.json({ date: tomorrow, error: "db" }, { status: 503 });
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

  /* Aynı günün önceki koşumunda bildirim almış hesaplar atlanır. Kutu
     tablosu yoksa (migration 0035) bilgi yok — gönderim sürer. */
  const since = new Date(Date.now() - 12 * 3600 * 1000);
  let alreadySent = new Set<string>();
  try {
    const sent = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(
        and(
          eq(notifications.kind, "earnings"),
          gte(notifications.createdAt, since),
          inArray(notifications.userId, [...byUser.keys()]),
        ),
      );
    alreadySent = new Set(sent.map((row) => row.userId));
  } catch {
    /* tablo yok */
  }

  let delivered = 0;
  let skipped = 0;
  for (const [userId, symbols] of byUser) {
    if (alreadySent.has(userId)) {
      skipped += 1;
      continue;
    }
    const list = [...symbols].sort();
    delivered += await notifyUser(
      userId,
      "earnings",
      (locale) => {
        const t = getDictionary(locale).notifications;
        const named = list.slice(0, LISTED_SYMBOLS).join(", ");
        const rest = list.length - LISTED_SYMBOLS;
        const body = (list.length === 1 ? t.earningsBodyOne : t.earningsBody)
          .replace("{symbols}", rest > 0 ? `${named} +${rest}` : named)
          .replace("{n}", String(list.length));
        return {
          title: t.earningsTitle,
          body,
          path: "/bilancolar/takip",
          /* Gün-kapsamlı tag: aynı günün ikinci koşumu (olmamalı) yığmaz. */
          tag: `earnings-${tomorrow}`,
        };
      },
      withLocale,
    );
  }

  return NextResponse.json({
    date: tomorrow,
    earnings: reporting.size,
    users: byUser.size,
    skipped,
    delivered,
  });
}
