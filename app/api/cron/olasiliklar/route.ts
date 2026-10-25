import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { isMissingTable, readLatestSnapshot, saveSnapshot } from "@/lib/probability-data";
import { fetchKalshiSnapshot } from "@/lib/providers/kalshi";
import { ELECTION_WATCH, fedWatchWindow, nextMeeting, shouldRefresh } from "@/lib/probabilities";

/**
 * Olasılıkların anlık görüntüsü (25 Ekim) — `deploy/cron-olasiliklar.sh`
 * saatte bir çağırır, uç kendisi karar verir:
 *
 * - GÜNDE BİR: son kayıt 20 saatten eskiyse yenisi alınır (sahibinin
 *   isteği: "günde 1 kere çeksek yeterli").
 * - ÖZEL SAATLERDE SAATTE BİR: seçim gecesi (`ELECTION_WATCH`) ve sıradaki
 *   Fed kararının çevresi. Sonuç gecesi olasılık yerine sonuç yazılacaksa
 *   kaynağın kapattığı piyasayı bir gün sonra değil o gece görmek gerekiyor.
 *
 * SAYILAR SAĞLAYICIDAN, Claude'DAN DEĞİL (gerekçe lib/probabilities.ts).
 *
 * Tablo yoksa (migration uygulanmadı) 503 `table-missing`: betik günlüğe
 * yazar; sayfa o arada önbellekli canlı okumayla çalışıyor.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Süreç içi kilit — curl'ün yeniden denemesi ikinci bir yazım açmasın (bilanço ucuyla aynı gerekçe). */
let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    return await run(new URL(request.url).searchParams.has("zorla"));
  } finally {
    running = false;
  }
}

async function run(force: boolean): Promise<NextResponse> {
  const now = new Date();
  let latest: Awaited<ReturnType<typeof readLatestSnapshot>>;
  try {
    latest = await readLatestSnapshot();
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "table-missing", detail: "probability_snapshots migration'ı uygulanmamış." }, { status: 503 });
    }
    return NextResponse.json({ error: "read-failed" }, { status: 503 });
  }

  const fedWindow = latest ? fedWatchWindow(nextMeeting(latest.snapshot.fed, now)?.strikeAt ?? null) : null;
  const windows = fedWindow ? [ELECTION_WATCH, fedWindow] : [ELECTION_WATCH];
  if (!force && !shouldRefresh(now, latest?.takenAt ?? null, windows)) {
    return NextResponse.json({ skipped: "fresh", takenAt: latest?.takenAt.toISOString() ?? null });
  }

  let snapshot: Awaited<ReturnType<typeof fetchKalshiSnapshot>>;
  try {
    snapshot = await fetchKalshiSnapshot(now);
  } catch (error) {
    /* Okunamayan kaynak boş kayıt DEĞİL: 503, betik yeniden dener; tabloda
       önceki iyi görüntü kalır. */
    return NextResponse.json({ error: "provider-failed", detail: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
  try {
    await saveSnapshot(snapshot);
  } catch {
    return NextResponse.json({ error: "write-failed" }, { status: 503 });
  }
  return NextResponse.json({
    saved: snapshot.takenAt,
    fed: snapshot.fed.length,
    congress: snapshot.congress.length,
    macro: snapshot.macro.length,
  });
}
