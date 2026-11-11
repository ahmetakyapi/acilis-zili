import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { getHolidays } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { pushConfigured, sendToUser } from "@/lib/push";
import { claimPushSend, prunePushSends, releasePushSend, weeklyPushCandidates } from "@/lib/push-prefs";
import { portfolioPushDue, portfolioPushKey, portfolioPushText } from "@/lib/portfolio-week-push";
import { portfolioWeek } from "@/lib/portfolio-weekly";
import { heldMoves, portfolioLots } from "@/lib/portfolio-weekly-note";

/**
 * CUMA PORTFÖY ÖZETİ (11 Kasım, sahibinin isteği) — `deploy/cron-portfoy-ozeti.sh`
 * günde birkaç kez çağırır; uç kendisi karar verir. Zamanlama ve metin
 * lib/portfolio-week-push.ts (haftanın son kapanışı kesinleşince, TR'de
 * gece değil), tercih lib/push-prefs-model.ts (varsayılan kapalı, site
 * sahibinde açık).
 *
 * NEDEN BİRDEN ÇOK KOŞU: sunucunun cron'u UTC'de ve `CRON_TZ`yi
 * desteklemiyor (deploy/cron-install.sh); ABD yaz saati, yarım gün ve
 * cumanın tatil olduğu hafta farklı anlara düşüyor. Satırlar her durumu
 * kapsayacak saatlerde, "henüz değil" koşusu veritabanına bile gitmeden
 * (tatil listesi dışında) döner.
 *
 * TEKRAR YOK: okur başına hafta anahtarı (lib/schema.ts → pushSends)
 * gönderimden ÖNCE açılır; hiçbir cihaza ulaşamayan gönderimin satırı geri
 * alınır, sonraki koşu yeniden dener. Tablo yoksa gönderim olmaz.
 *
 * VERİ: pazar postasının karnesiyle AYNI hesap (lib/portfolio-weekly.ts →
 * portfolioWeek; barlar önbelleksiz ve haftanın son seansını kanıtlamalı —
 * lib/weekly-digest.ts → weeklyMoves). Ölçülemeyen portföye bildirim
 * gitmez. Claude çağrısı yok; tutar yok, yalnız oran.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Süreç içi tek koşu kilidi — gerekçe app/api/cron/bilanco/route.ts. */
let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    return await run(new Date());
  } finally {
    running = false;
  }
}

async function run(now: Date): Promise<NextResponse> {
  if (!pushConfigured()) return NextResponse.json({ skipped: "push-off" });
  const week = portfolioPushDue(now, await getHolidays());
  if (!week) return NextResponse.json({ skipped: "not-due" });
  const key = portfolioPushKey(week.monday);

  const candidates = await weeklyPushCandidates();
  if (!candidates) return NextResponse.json({ week: week.monday, error: "db" }, { status: 503 });
  if (candidates.length === 0) return NextResponse.json({ week: week.monday, users: 0 });
  const lots = await portfolioLots(candidates);
  if (!lots) return NextResponse.json({ week: week.monday, error: "db" }, { status: 503 });
  if (lots.size === 0) return NextResponse.json({ week: week.monday, users: 0 });

  const symbols = new Set([...lots.values()].flatMap((list) => list.map((lot) => lot.symbol)));
  const moves = await heldMoves(symbols, { pastMonday: week.monday, pastFriday: week.friday }, now);
  if (moves.size === 0) return NextResponse.json({ week: week.monday, error: "bars" }, { status: 503 });

  let sent = 0;
  let unmeasured = 0;
  let already = 0;
  let delivered = 0;
  for (const [userId, list] of lots) {
    const summary = portfolioWeek(list, moves, new Map(), week.monday);
    if (!summary) {
      unmeasured += 1;
      continue;
    }
    if (!(await claimPushSend(userId, key))) {
      already += 1;
      continue;
    }
    const count = await sendToUser(userId, (locale) => ({
      ...portfolioPushText(summary, locale, getDictionary(locale).pushPrefs),
      url: withLocale("/portfoy", locale),
      tag: key,
    })).catch(() => 0);
    if (count === 0) await releasePushSend(userId, key);
    else sent += 1;
    delivered += count;
  }
  await prunePushSends(now);
  return NextResponse.json({ week: week.monday, lastSession: week.lastSession, users: lots.size, sent, already, unmeasured, delivered });
}
