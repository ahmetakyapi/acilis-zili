import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { syncMarketNews } from "@/lib/news-sync";
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
 * 40 haber — Claude çağrısı BACKGROUND_TIMEOUT_MS'e sığsın.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const report: Record<string, number | string> = {};
  try {
    report.news = await syncMarketNews();
  } catch (error) {
    report.news = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  try {
    report.translate = isTranslateConfigured() ? await translatePendingNews(40) : "atlandı: çeviri anahtarı yok";
  } catch (error) {
    report.translate = `hata: ${error instanceof Error ? error.message : "?"}`;
  }
  const failed = String(report.news).startsWith("hata") && String(report.translate).startsWith("hata");
  return NextResponse.json(report, { status: failed ? 503 : 200 });
}
