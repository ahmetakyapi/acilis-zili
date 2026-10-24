import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { getStatus } from "@/lib/data";
import {
  claimPost,
  markSent,
  releasePost,
  sendMessage,
  sendPhoto,
  telegramChannels,
  telegramLedgerReady,
  type Channel,
} from "@/lib/telegram";
import { closePost, macroPosts, preOpenPost, storyPosts, type Outgoing, type Plan } from "@/lib/telegram-data";
import { closeWindow, preOpenWindow } from "@/lib/telegram-plan";

/**
 * TELEGRAM KANALI — `deploy/cron-telegram.sh` beş dakikada bir, her gün
 * çağırır. Durum makinesi: her koşuda "şimdi gönderilecek ne var" diye
 * bakar (alarm taramasının kalıbı, app/api/cron/alarmlar). Gerekçe ve
 * parçalar `lib/telegram.ts` başında.
 *
 * Dört tür, dördü de AYNI koşuda değerlendirilir:
 *   acilis   açılıştan ≤ 15 dk önce (bülten yoksa son 5 dk'da bültensiz)
 *   kapanis  kapanış + 30 dk ile akşam seansı sonu arasında
 *   mercek   son 6 saatte yayımlanan, kanalın dilindeki yazı
 *   makro    bugün açıklanan büyük veri (TÜFE, Fed, istihdam), 6 saat içinde
 *
 * Üç kapı:
 * - Belirteç ya da TR kanalı yoksa `skipped: "off"` — betik "kapalı" yazar,
 *   hiçbir şey okunmaz.
 * - Defter tablosu yoksa `skipped: "no-ledger"` — tekrar gönderimi
 *   önleyemeyen gönderici hiç göndermez (lib/schema.ts → telegramPosts).
 * - Mesaj SAHİPLENMEDEN gönderilmez; Telegram açıkça reddederse sahiplenme
 *   geri alınır ve sonraki koşu yeniden dener. Üst üste binen iki koşudan
 *   ikincisi anahtarı dolu bulur ve geçer.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tek koşu kilidi — gerekçe app/api/cron/haftalik-posta/route.ts (süreç tek). */
let running = false;

type Report = { key: string; result: string };

/**
 * TEKRARDAN SESSİZLİK İYİDİR. Telegram'ın zaman aşımına uğrayan isteği
 * çoğu kez yine de teslim ediliyor; eski akış o durumda görselli mesajın
 * aynısını metin olarak hemen bir daha atıyor, metin de zaman aşımına
 * uğrarsa sahiplenmeyi geri alıp sonraki koşuda ÜÇÜNCÜ kez deniyordu. Kanal
 * aboneleri için iki kez gelen mesaj, hiç gelmeyenden kötü (geri alınamaz;
 * gelmeyen mesajın içeriği zaten sitede). Bu yüzden:
 *   - yalnız AÇIK 4xx (`rejected`) kesin "gitmedi"dir: görselde metin
 *     yedeğine geçilir, metinde sahiplenme geri alınır;
 *   - zaman aşımı, ağ hatası, 5xx = "bilinmiyor": yedek yola GEÇİLMEZ,
 *     satır `claimed` kalır ve bir daha denenmez. Yönetim ekranında
 *     `claimed` kalan satır bu belirsizliğin izi.
 */
async function deliver(channel: Channel, post: Outgoing): Promise<string> {
  const claimed = await claimPost(post.key, post.kind, channel.locale, post.summary);
  if (!claimed) return "duplicate";
  const photo = post.photo ? await post.photo() : null;
  let sent = photo ? await sendPhoto(channel.chatId, photo.url, photo.captionHtml) : null;
  /* Görseli Telegram AÇIKÇA reddetti (adresi çekemedi): aynı içerik metin
     olarak, önizlemesiyle gider. */
  if (!sent || (!sent.ok && sent.rejected)) sent = await sendMessage(channel.chatId, post.html, post.preview);
  if (!sent.ok) {
    console.error(`[telegram] ${post.key} gönderilemedi: ${sent.error}`);
    if (!sent.rejected) return "unknown";
    await releasePost(post.key);
    return "failed";
  }
  await markSent(post.key, sent.messageId);
  return "sent";
}

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const channels = telegramChannels();
  if (channels.length === 0) return NextResponse.json({ skipped: "off" });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    if (!(await telegramLedgerReady())) return NextResponse.json({ skipped: "no-ledger" });

    const status = await getStatus();
    const now = new Date();
    const open = preOpenWindow(status, now);
    const close = closeWindow(status, now);
    const reports: Report[] = [];
    const notes: string[] = [];

    for (const channel of channels) {
      const plans: Plan[] = [];
      /* Her tür kendi hatasını yutar: kapanış barları düştü diye yeni
         Mercek yazısı beklemesin. */
      const attempt = async (name: string, run: () => Promise<Plan>) => {
        try {
          plans.push(await run());
        } catch (error) {
          console.error(`[telegram] ${name} hazırlanamadı`, error);
          notes.push(`${channel.locale}:${name}:error`);
        }
      };
      if (open.due) await attempt("acilis", () => preOpenPost(channel.locale, status, open.final));
      if (close) await attempt("kapanis", () => closePost(channel.locale, status));
      await attempt("mercek", () => storyPosts(channel.locale, now));
      await attempt("makro", () => macroPosts(channel.locale, status, now));

      for (const plan of plans) {
        if (plan.skipped) notes.push(`${channel.locale}:${plan.skipped}`);
        for (const post of plan.posts) reports.push({ key: post.key, result: await deliver(channel, post) });
      }
    }

    return NextResponse.json({
      channels: channels.map((channel) => channel.locale),
      windows: { acilis: open.due, kapanis: close },
      sent: reports.filter((report) => report.result === "sent").length,
      failed: reports.filter((report) => report.result === "failed").length,
      unknown: reports.filter((report) => report.result === "unknown").length,
      reports,
      notes,
    });
  } finally {
    running = false;
  }
}
