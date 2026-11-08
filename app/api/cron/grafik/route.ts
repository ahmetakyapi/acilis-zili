import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { getHolidays } from "@/lib/data";
import { isIsoDay } from "@/lib/date-input";
import { isTradingDay } from "@/lib/market-hours";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { DAILY_CHART_AUTO, dailyChartInputSchema, saveDailyChart } from "@/lib/content-write";
import { groundingSource, lastCompletedSession } from "@/lib/daily-chart";
import { getDailyChart } from "@/lib/daily-chart-data";
import { loadDailyChartContext } from "@/lib/daily-chart-context";
import { fallbackDrafts } from "@/lib/daily-chart-fallback";

/**
 * Günün Grafiği'nin YEDEĞİ (8 Kasım) — `deploy/cron-grafik.sh` kapanıştan
 * sonra ve ertesi sabah çağırır (saatler `deploy/cron-install.sh`).
 *
 * Son tamamlanmış seansın (`lastCompletedSession`, kapanış + 20 dk) HİÇ
 * kaydı yoksa sitenin şablonuyla iki dilde yazar; kayıt varsa (rutin
 * yazmış ya da yedek zaten yazılmış) dokunmaz. Gerekçe ve şablon
 * `lib/daily-chart-fallback.ts`: 7 Kasım'da rutin düştü ve hafta sonu
 * boyunca perşembenin grafiği göründü.
 *
 * Rutinle AYNI KAPILAR: aynı bağlam paketi (tam değilse yazmaz, 503 —
 * betik yeniden dener), aynı doğrulama şeması ve aynı sayı denetimi
 * (`ungroundedNumbers`). Şablonun sayıları zaten paketten; denetim, şablon
 * bir gün bozulursa sayının sessizce sayfaya geçmesin diye.
 *
 * `?date=YYYY-MM-DD` tamamlanmış bir işlem gününü doldurur (boşluk
 * kapatmak için; yine yalnız boşsa).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 150;

/** Süreç içi kilit — curl'ün yeniden denemesi ikinci bir kurulum açmasın. */
let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    return await run(new URL(request.url).searchParams.get("date"));
  } finally {
    running = false;
  }
}

/** Postgres "relation does not exist" — `daily_charts` migration'ı uygulanmamış. */
function isMissingTable(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === "42P01" || codeOf(cause) === "42P01";
}

async function run(dateParam: string | null) {
  if (dateParam !== null && !isIsoDay(dateParam)) {
    return NextResponse.json({ error: "invalid-date", detail: "?date=YYYY-MM-DD" }, { status: 400 });
  }
  const holidays = await getHolidays();
  const last = lastCompletedSession(new Date(), holidays);
  const date = dateParam ?? last;
  if (date > last || !isTradingDay(date, holidays)) {
    return NextResponse.json({ error: "not-a-completed-session", date, last_completed_session: last }, { status: 400 });
  }

  const existing = await getDailyChart(date, "tr");
  if (existing) return NextResponse.json({ skipped: "exists", date, locales: existing.locales });

  const { context, complete, coverage } = await loadDailyChartContext(date);
  if (!complete) {
    return NextResponse.json(
      { error: "context-incomplete", date, missing: context.missing, universe_coverage: coverage },
      { status: 503 },
    );
  }

  const drafts = fallbackDrafts(context);
  if (!drafts) return NextResponse.json({ skipped: "no-template", date, missing: context.missing });

  /* Önce İKİSİ de doğrulanır, sonra yazılır: biri düşerse tek dilli yarım
     yedek kalmasın (iki dil aynı grafiği taşımalı). */
  const source = groundingSource(context);
  const inputs = [];
  for (const draft of drafts) {
    const parsed = dailyChartInputSchema.safeParse(draft);
    if (!parsed.success) {
      return NextResponse.json({ error: "template-invalid", locale: draft.locale, detail: parsed.error.issues }, { status: 500 });
    }
    const ungrounded = ungroundedNumbers([draft.title, draft.chart_md, draft.body_md].join("\n"), source);
    if (ungrounded.length > 0) {
      return NextResponse.json({ error: "ungrounded-numbers", locale: draft.locale, numbers: [...new Set(ungrounded)] }, { status: 500 });
    }
    inputs.push(parsed.data);
  }

  try {
    const written = [];
    for (const input of inputs) {
      const saved = await saveDailyChart({ ...input, date }, DAILY_CHART_AUTO);
      if (!saved.skipped) written.push(saved.locale);
    }
    return NextResponse.json({ ok: true, date, written });
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ skipped: "table-missing" });
    throw error;
  }
}
