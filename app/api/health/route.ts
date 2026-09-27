import { NextResponse } from "next/server";
import { buildHealthReport } from "@/lib/health";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Dış izleyici için sağlık ucu — `GET /api/health` (28 Eylül).
 *
 * Kime: UptimeRobot, Better Stack gibi bir izleyici ya da elle `curl`.
 * Adres: https://aciliszili.com/api/health — dil öneki yok, proxy `api/`
 * yollarına dokunmuyor.
 *
 * KOD: veritabanı yanıt veriyorsa 200, vermiyorsa 503. Geciken rutin ya da
 * kaçan senkron siteyi düşürmüyor; gövdede `status: "degraded"` ve ilgili
 * alanla söyleniyor (ayrıntı lib/health.ts). İzleyicide iki kural kurulabilir:
 * kod 200 değilse "site düştü", gövde "degraded" içeriyorsa "içerik gecikti".
 *
 * YETKİSİZ ama SINIRLI: gövdede hiçbir gizli değer yok (anahtarlar
 * yalnızca evet/hayır), yine de her çağrı veritabanına yedi kısa sorgu
 * demek. IP başına dakikada 30 istek; izleyiciler dakikada bir sorar.
 * Önbellek YOK (`no-store`): bayat bir "ok" izleyiciyi yanıltır.
 *
 * `deploy/update.sh`in dağıtım kontrolü BUNU KULLANMIYOR ve kullanmamalı:
 * o kontrol "yeni sürüm ayağa kalktı mı" soruyor, veritabanı kesintisinde
 * dağıtımı geri almak doğru cevap olmazdı.
 */

const LIMIT = 30;
const WINDOW_MS = 60 * 1000;

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "health"), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } },
    );
  }

  const report = await buildHealthReport();
  return NextResponse.json(report, {
    status: report.database.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
