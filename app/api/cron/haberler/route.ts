import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { getNewsBriefing } from "@/lib/news-insights";
import { syncMarketNews } from "@/lib/news-sync";
import { warmReleaseNotes } from "@/lib/release-notes";
import { insightsConfigured, warmEarningsInsights, warmEarningsPreviews } from "@/lib/stock-insights";
import { isTranslateConfigured, translatePendingNews } from "@/lib/translate";

/**
 * HABER TAZELEME + TÜRKÇELEŞTİRME (17 Ekim) — `deploy/cron-news.sh` her
 * gün üç kez çağırır (05:35, 11:35, 17:35 UTC = 08:35, 14:35, 20:35 TR).
 *
 * Günlük cron hafta içi bir kez haber çekip çeviriyordu; hafta sonu ve
 * akşam gelen haberler ertesi iş gününe kadar ya hiç yoktu ya İngilizceydi
 * (Türkçe arayüz çevirisi olmayan haberi ana sayfa seçicisinden düşürüyor).
 * Çeviri tabloda kalır ("önbellek"): her koşu yalnız `headline_tr` boş olan
 * satırları çevirir, aynı haber ikinci kez ücretlenmez. Koşu başına en çok
 * 40 haber (iki paket); paket başına süre sınırı lib/translate.ts'te.
 *
 * Aynı koşu son iki günde açıklanan büyük bilançoların Claude notunu da
 * önceden yazdırır (lib/stock-insights.ts → warmEarningsInsights) ve
 * dönemin "Günün Gündemi"ni ısıtır (lib/news-insights.ts): dönem nöbetle
 * aynı saatte başlıyor, okur gündemi hazır bulur. Son iki günde açıklanan
 * makro verilerin takvim notu da burada yazılır (lib/release-notes.ts →
 * warmReleaseNotes; koşu başına en çok altı).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 280;

/**
 * TEK KOŞU KİLİDİ (20 Ekim) — app/api/cron/bilanco/route.ts'teki kilidin
 * aynısı. Betik `curl --max-time 290 --retry 2` ile çağırıyor; soğuk
 * önbellekli bir gün (sırayla 12 bilanço notu, 10 önizleme, 6 yayın notu,
 * iki gündem, her biri 60 sn'ye kadar) 290 saniyeyi aşınca curl yeniden
 * deniyor ama ilk istek sunucuda SÜRÜYOR (`maxDuration` VPS'te uygulanmıyor):
 * ikinci koşu bitmemiş çeviri, yayın notu ve gündem çağrılarını yeniden
 * ödüyor, ortak günlük Claude tavanından yiyordu. Uygulama tek süreç; süreç
 * içi bayrak yeter. Kilitliyken 200 (curl 2xx'i yeniden denemez).
 */
let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    return await run();
  } finally {
    running = false;
  }
}

async function run(): Promise<NextResponse> {
  const report: Record<string, number | string> = {};
  try {
    report.news = await syncMarketNews();
  } catch (error) {
    report.news = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  try {
    /* 80 HABER, 120 SANİYELİK PAYLA (22 Ekim). 40'lık parti kuyruğu
       eritmiyordu: hisse sayfaları şirket haberlerini tabloya yazıp yalnız
       ekranda göreni çeviriyor, kalan yığın üç koşuya sığmıyor ve /haberler'de
       İngilizce manşet kalıyordu. Sıklığı artırmak yerine parti büyüdü (Haiku,
       paket başına kuruşlar) ve SÜRE PAYI eklendi: süre yetmeyen paket
       gönderilmez, sonraki koşuya kalır — betiğin 290 saniyelik curl payı
       ve ardından gelen adımlar korunuyor (günlük nöbetteki `TranslateBudget`
       kalıbı). Ekranda görünüp hâlâ çevrilmemiş olanı okuma yolu yanıttan
       sonra çeviriyor (`translateMissingLater`). */
    report.translate = isTranslateConfigured()
      ? await translatePendingNews(80, { deadline: Date.now() + 120_000 })
      : "atlandı: çeviri anahtarı yok";
  } catch (error) {
    report.translate = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  try {
    report.earningsNotes = await warmEarningsInsights(12);
  } catch (error) {
    report.earningsNotes = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  try {
    report.earningsPreviews = await warmEarningsPreviews(10);
  } catch (error) {
    report.earningsPreviews = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  try {
    report.releaseNotes = await warmReleaseNotes(6);
  } catch (error) {
    report.releaseNotes = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  try {
    report.briefing = insightsConfigured() ? ((await getNewsBriefing())?.themes.length ?? "yazılamadı") : "atlandı: anahtar yok";
    if (insightsConfigured()) report.weekBriefing = (await getNewsBriefing(new Date(), "week"))?.themes.length ?? "yazılamadı";
  } catch (error) {
    report.briefing = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  const failed = String(report.news).startsWith("hata") && String(report.translate).startsWith("hata");
  return NextResponse.json(report, { status: failed ? 503 : 200 });
}
