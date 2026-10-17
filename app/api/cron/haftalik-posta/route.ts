import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { emailConfigured } from "@/lib/email";
import { enrollWeeklyDefault, sendNotificationEmail, weeklyRecipients } from "@/lib/email-notify";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { refreshEarningsResults } from "@/lib/earnings-refresh";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { weeklyEmailMessage, type DigestPersonal } from "@/lib/notify-emails";
import { weeklyCommentary } from "@/lib/weekly-commentary";
import { digestWeek, gatherDigest, watchlistSymbols, type DigestData } from "@/lib/weekly-digest";

/**
 * PAZAR ÖZETİ (16 Ekim; 17 Ekim'de pazartesiden pazara, sahibinin isteği)
 * — `deploy/cron-weekly-mail.sh` pazar 07:00–11:00 UTC arasında saatte bir
 * çağırır; ilk koşu 10:00 TR. Veri lib/weekly-digest.ts, şablon
 * lib/notify-emails.ts, kapı lib/email-notify.ts.
 *
 * PAZAR NEDEN: hafta kapanmış, yenisi başlamamış; okuyucu haftayı pazar
 * sabahı planlıyor. Bedeli: günlük eşitleme (cron-daily) yalnız hafta içi
 * 13:30 TR'de koşuyor, yani cuma açılış öncesi ve cuma kapanış sonrası
 * bilançoların gerçekleşenleri pazar sabahı tabloda YOK. Uç bu yüzden
 * göndermeden önce geçen haftanın beş gününü sağlayıcıdan tazeliyor
 * (lib/earnings-refresh.ts) — tazeleme düşerse posta yine gider, açıklanmamış
 * görünen satır listeye zaten girmiyor (veri dürüstlüğü: "kaçırdı" değil).
 * Haftalık bülten pazartesi 09:30'da yazıldığı için pazar postasında
 * genellikle yok; bölüm yalnız varsa basılıyor.
 *
 * TEKRAR DENENEBİLİR. Her alıcı `weekly:<pazartesi>:<kullanıcı>` anahtarıyla
 * sahiplenilir: ikinci koşu gidenleri atlar, bütçeye takılanları ya da
 * gönderimi düşenleri tamamlar. Takvimin İKİ yarısı da okunamazsa 503 —
 * içi boş posta yerine bir saat sonra yeniden dener.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!emailConfigured()) return NextResponse.json({ skipped: "email-off" });

  const now = new Date();
  const weekday = new Date(`${todayEt(now)}T00:00:00Z`).getUTCDay();
  const force = new URL(request.url).searchParams.get("zorla") === "1";
  if (weekday !== 0 && !force) return NextResponse.json({ skipped: "not-sunday" });

  /* Varsayılan açık: henüz kaydedilmemiş üyeler (yeni kayıtlar dahil) önce
     özete eklenir — gerekçe lib/email-notify.ts → enrollWeeklyDefault. */
  const enrolled = await enrollWeeklyDefault(now);
  const recipients = await weeklyRecipients();
  if (recipients === null) {
    console.error("[haftalık posta] alıcılar okunamadı");
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
  if (recipients.length === 0) return NextResponse.json({ recipients: 0, sent: 0 });

  /* Sonraki saatlik koşular da tazeler: beş istek, ve ilk koşuda sağlayıcı
     düştüyse ikinci koşu boşluğu kapatır. */
  const { pastMonday } = digestWeek(now);
  const refreshed = await refreshEarningsResults(pastMonday, addEtDays(pastMonday, 4));
  if (!refreshed.ok) console.error("[haftalık posta] bilanço gerçekleşenleri tazelenemedi");

  const digests = new Map<Locale, DigestData>();
  for (const locale of new Set(recipients.map((r) => r.locale))) {
    digests.set(locale, await gatherDigest(locale, now));
  }
  if ([...digests.values()].every((d) => d.pastFailed && d.aheadFailed)) {
    console.error("[haftalık posta] takvim okunamadı");
    return NextResponse.json({ error: "calendar" }, { status: 503 });
  }

  /* Yorum takvim okunduktan SONRA: yarım veriyle yazılan yorum hafta boyu
     önbellekte kalırdı. Düşerse posta yorumsuz gider (lib/weekly-commentary.ts). */
  for (const digest of digests.values()) digest.commentary = await weeklyCommentary(digest);

  const watched = await watchlistSymbols(recipients.map((r) => r.userId));
  const counts = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
  let budgetHit = false;

  for (const recipient of recipients) {
    const data = digests.get(recipient.locale)!;
    const mine = watched.get(recipient.userId) ?? new Set<string>();
    const personal: DigestPersonal = [...mine]
      .map((symbol) => ({ symbol, hit: data.aheadAll.get(symbol) }))
      .filter((p): p is { symbol: string; hit: { date: string; timing: "bmo" | "amc" | "other" } } => p.hit !== undefined)
      .map((p) => ({ symbol: p.symbol, date: p.hit.date, timing: p.hit.timing }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
    const copy = getDictionary(recipient.locale).emailNotify;
    const result = await sendNotificationEmail(recipient, "weekly", `weekly:${data.thisMonday}:${recipient.userId}`, (r) =>
      weeklyEmailMessage(r, data, personal, copy),
    );
    if (result === "sent") counts.sent += 1;
    else if (result === "duplicate") counts.duplicate += 1;
    else if (result === "failed") counts.failed += 1;
    else if (result === "budget") {
      budgetHit = true;
      break;
    } else counts.skipped += 1;
  }

  return NextResponse.json({
    recipients: recipients.length,
    ...counts,
    budget: budgetHit ? "exhausted" : "ok",
    earningsRefreshed: refreshed.ok ? refreshed.rows : "failed",
    enrolled: enrolled ?? "failed",
  });
}
