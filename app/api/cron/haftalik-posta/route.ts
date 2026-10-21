import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { dailyBudget, enrollWeeklyDefault, sendNotificationEmail, weeklyRecipients } from "@/lib/email-notify";
import { emailLog } from "@/lib/schema";
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
 * sahiplenilir: ikinci koşu gidenleri atlar, gönderimi düşenleri tamamlar.
 * Takvimin İKİ yarısı da okunamazsa 503 — içi boş posta yerine bir saat
 * sonra yeniden dener.
 *
 * BÜTÇEYE TAKILANLAR PAZARTESİ (20 Ekim). Burada "bütçeye takılanları ...
 * tamamlar" yazıyordu ama günlük bütçe (lib/email-notify.ts → claimSend)
 * UTC GÜNÜNE göre ve beş pazar koşusu aynı günde: ilk koşu bütçeyi
 * bitirince sonrakiler ilk alıcıda "budget" alıp hiç ilerlemiyordu, betik
 * de "kalanlar sonraki saatte" diye yazıyordu; sırasız sorgu yüzünden
 * dışarıda kalan her hafta aynı üyelerdi. Şimdi:
 * - Sıra hafta başına karılır (`rotate`): tavana takılan hep aynı üye olmaz.
 * - Tek adrese gitmeyen HER koşu (pazar, telafi, `zorla`) önce defteri
 *   okur ve bu haftanın satırı olan alıcıyı listeden düşer (`sentThisWeek`;
 *   `digestWeek` pazartesi de aynı haftayı, yani aynı anahtarı verir).
 *   Kimse kalmadıysa pahalı adımlara (tazeleme, takvim, yorum, notlar) hiç
 *   girmeden `skipped: "complete"` döner. Süzgeç önce yalnız telafideydi:
 *   pazarın ikinci–beşinci koşusu bütçe ilk alıcıda bitince BÜTÜN listeyi
 *   `unsent` sayıyordu (120 üye, 80 bütçe → dört kez "120", eksik 40).
 *   Pazar defteri okuyamazsa süzgeçsiz sürer (`dedupeKey` gideni yine
 *   atlar); telafi okuyamazsa 503.
 * - Pazartesi 07:00 UTC TELAFİ koşusu (cron-install.sh) bütçenin EN ÇOK
 *   YARISINI kullanır: kalanı günün alarm postalarına — alarm bekleyemez,
 *   özet bekleyebilir. Yeni üye kaydı telafide yapılmaz; ilk özetleri pazar.
 * - Yanıttaki `unsent` bütçe yüzünden denenmeyen, defterde satırı olmayan
 *   alıcı sayısı — süzgeç sayesinde her koşuda kesin; betik onu uyarı
 *   olarak yazar. Kalıcı çözüm bütçeyi büyütmek (EMAIL_DAILY_BUDGET:
 *   ücretli plan ya da Brevo).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * TEK KOŞU KİLİDİ (20 Ekim) — app/api/cron/bilanco/route.ts'teki kilidin
 * aynısı. Betik `curl --max-time 290 --retry 2` ile çağırıyor; Opus yorumu
 * (dil başına 90 sn'ye kadar), 60'a kadar not ve gönderim 290 saniyeyi
 * aşınca curl yeniden deniyor ama ilk istek sunucuda SÜRÜYOR (`maxDuration`
 * VPS'te uygulanmıyor). Takip notu yalnız `unstable_cache`li — süren çağrıyı
 * birleştirmiyor — ve ikinci koşu bitmemiş notları yeniden ödüyor, ortak
 * günlük Claude tavanını hisse notlarının elinden alıyordu; gönderim
 * döngüleri de yarışıp bütçeyi birkaç posta aşabiliyordu. Uygulama tek
 * süreç; süreç içi bayrak yeter. Kilitliyken 200 (curl 2xx'i yeniden denemez).
 */
let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    return await run(request);
  } finally {
    running = false;
  }
}

/** Bu haftanın postası defterde olan hesaplar; okunamazsa null. */
async function sentThisWeek(thisMonday: string): Promise<Set<string> | null> {
  try {
    const rows = await db
      .select({ userId: emailLog.userId })
      .from(emailLog)
      .where(and(eq(emailLog.kind, "weekly"), like(emailLog.dedupeKey, `weekly:${thisMonday}:%`)));
    return new Set(rows.map((row) => row.userId));
  } catch {
    return null;
  }
}

/** Hafta başına karılmış, haftanın içinde sabit sıra — gerekçe başlıkta. */
function rotate<T extends { userId: string }>(list: readonly T[], thisMonday: string): T[] {
  const key = (userId: string) => createHash("sha1").update(`${thisMonday}:${userId}`).digest("hex");
  return list
    .map((item) => ({ item, key: key(item.userId) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ item }) => item);
}

async function run(request: Request): Promise<NextResponse> {
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
  /* Pazartesi kendiliğinden gelen çağrı TELAFİ koşusu — gerekçe başlıkta. */
  const catchUp = weekday === 1 && !force && !single;
  if (weekday !== 0 && !catchUp && !force && !single) return NextResponse.json({ skipped: "not-sunday" });

  /* Varsayılan açık: henüz kaydedilmemiş üyeler (yeni kayıtlar dahil) önce
     özete eklenir — gerekçe lib/email-notify.ts → enrollWeeklyDefault. */
  const enrolled = catchUp ? "skipped" : ((await enrollWeeklyDefault(now)) ?? "failed");
  const all = await weeklyRecipients();
  const chosen = single && all ? all.filter((r) => r.email.trim().toLowerCase() === single) : all;
  if (chosen === null) {
    console.error("[haftalık posta] alıcılar okunamadı");
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
  const { pastMonday, thisMonday } = digestWeek(now);
  let recipients = rotate(chosen, thisMonday);
  let unsent = 0;
  /* DEFTER SÜZGECİ tek adrese gitmeyen HER koşuda — gerekçe başlıkta. */
  if (!single) {
    const sent = await sentThisWeek(thisMonday);
    if (sent === null) {
      console.error("[haftalık posta] defter okunamadı");
      /* Telafi kimin eksik olduğunu bilmeden bütçeye girmez. Pazar (ve
         `zorla`) süzgeçsiz sürer: `dedupeKey` gideni yine atlar, defter
         okunamadı diye haftanın ilk gönderimi durmaz. */
      if (catchUp) return NextResponse.json({ error: "db" }, { status: 503 });
    } else {
      const missing = recipients.filter((r) => !sent.has(r.userId));
      if (missing.length === 0) return NextResponse.json({ skipped: "complete", recipients: recipients.length });
      recipients = missing;
    }
    if (catchUp) {
      const capped = recipients.slice(0, Math.floor(dailyBudget() / 2));
      unsent = recipients.length - capped.length;
      recipients = capped;
    }
  }
  if (recipients.length === 0) return NextResponse.json({ recipients: 0, sent: 0, unsent });

  /* Eksik alıcı kaldıkça sonraki saatlik koşular da tazeler: beş istek, ve
     ilk koşuda sağlayıcı düştüyse ikinci koşu boşluğu kapatır. */
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

  for (const [index, recipient] of recipients.entries()) {
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
      unsent += recipients.length - index;
      break;
    } else counts.skipped += 1;
  }

  return NextResponse.json({
    recipients: recipients.length,
    ...counts,
    unsent,
    budget: budgetHit ? "exhausted" : "ok",
    catchUp,
    earningsRefreshed: refreshed.ok ? refreshed.rows : "failed",
    enrolled,
  });
}
