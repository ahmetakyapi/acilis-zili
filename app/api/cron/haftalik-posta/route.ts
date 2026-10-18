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
import { moversFor, watchedMoves, watchlistNote, watchlistNoteCap, type WatchWeek } from "@/lib/watchlist-note";

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
  const params = new URL(request.url).searchParams;
  const force = params.get("zorla") === "1";
  /* DENEME (17 Ekim): `?deneme=<üyenin adresi>` postayı YALNIZ o üyeye,
     günden bağımsız, gerçek veri ve yorumla gönderir; konu "[Deneme]"
     önekli, defter anahtarı her seferinde yeni (asıl pazar postasını
     engellemez). Yetki aynı CRON_SECRET; bütçeden düşer. Üye olmayan
     adrese gitmez. */
  const testTo = params.get("deneme")?.trim().toLowerCase() || null;
  /* YENİDEN GÖNDERİM (18 Ekim): adresi sonradan düzeltilen üyeye haftanın
     postasını GERÇEK haliyle (önek yok) bir kez daha yollar — kendi defter
     anahtarı `weekly-resend:<pazartesi>:<kullanıcı>:<adres>`, yani aynı
     adrese haftada en çok bir kez; adres bir daha düzeltilirse yeni adres
     de alır (18 Ekim, Sedat'ın adresi iki kez düzeltildi). Yetki ve üyelik
     şartı denemeyle aynı. */
  const resendTo = params.get("yeniden")?.trim().toLowerCase() || null;
  const single = testTo ?? resendTo;
  if (weekday !== 0 && !force && !single) return NextResponse.json({ skipped: "not-sunday" });

  /* Varsayılan açık: henüz kaydedilmemiş üyeler (yeni kayıtlar dahil) önce
     özete eklenir — gerekçe lib/email-notify.ts → enrollWeeklyDefault. */
  const enrolled = await enrollWeeklyDefault(now);
  const all = await weeklyRecipients();
  const recipients = single && all ? all.filter((r) => r.email.trim().toLowerCase() === single) : all;
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
  /* Takip listesinin geride kalan haftası (18 Ekim): barlar dilden bağımsız,
     tek sefer; Claude notu okurun dilinde, koşu başına tavanlı — gerekçe
     lib/watchlist-note.ts. Notlar postadan ÖNCE, dörder dörder üretilir. */
  const allWatched = new Set([...watched.values()].flatMap((set) => [...set]));
  const anyDigest = [...digests.values()][0]!;
  const moves = allWatched.size ? await watchedMoves(allWatched, anyDigest, now) : new Map<string, number>();
  const personalOf = (recipient: (typeof recipients)[number], data: DigestData): DigestPersonal =>
    [...(watched.get(recipient.userId) ?? [])]
      .map((symbol) => ({ symbol, hit: data.aheadAll.get(symbol) }))
      .filter((p): p is { symbol: string; hit: { date: string; timing: "bmo" | "amc" | "other" } } => p.hit !== undefined)
      .map((p) => ({ symbol: p.symbol, date: p.hit.date, timing: p.hit.timing }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
  const weeks = new Map<string, WatchWeek>();
  for (const recipient of recipients) {
    const movers = moversFor(watched.get(recipient.userId) ?? [], moves);
    if (movers.length) weeks.set(recipient.userId, { movers, note: null });
  }
  const noteQueue = [...weeks.keys()].slice(0, watchlistNoteCap());
  const byId = new Map(recipients.map((r) => [r.userId, r]));
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let id = noteQueue.shift(); id; id = noteQueue.shift()) {
        const recipient = byId.get(id)!;
        const data = digests.get(recipient.locale)!;
        const week = weeks.get(id)!;
        week.note = await watchlistNote(id, recipient.locale, data, week.movers, personalOf(recipient, data));
      }
    }),
  );

  const counts = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
  let budgetHit = false;

  for (const recipient of recipients) {
    const data = digests.get(recipient.locale)!;
    const personal = personalOf(recipient, data);
    const copy = getDictionary(recipient.locale).emailNotify;
    const dedupeKey = testTo
      ? `weekly-test:${data.thisMonday}:${recipient.userId}:${now.getTime()}`
      : resendTo
        ? `weekly-resend:${data.thisMonday}:${recipient.userId}:${recipient.email.trim().toLowerCase()}`
        : `weekly:${data.thisMonday}:${recipient.userId}`;
    const result = await sendNotificationEmail(recipient, "weekly", dedupeKey, (r) => {
      const mail = weeklyEmailMessage(r, data, personal, copy, weeks.get(recipient.userId));
      return testTo ? { ...mail, subject: `[Deneme] ${mail.subject}` } : mail;
    });
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
