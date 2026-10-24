import { NextResponse } from "next/server";
import { z } from "zod";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { getHolidays } from "@/lib/data";
import { isLocale } from "@/lib/i18n/config";
import { isIsoDay } from "@/lib/date-input";
import { isTradingDay } from "@/lib/market-hours";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import {
  DAILY_CHART_INPUT_SHAPE,
  dailyChartInputSchema,
  saveDailyChart,
} from "@/lib/content-write";
import { dailyChartHref, groundingSource, lastCompletedSession } from "@/lib/daily-chart";
import { getDailyChart, getLatestDailyChart } from "@/lib/daily-chart-data";
import { loadDailyChartContext } from "@/lib/daily-chart-context";

/**
 * Günün Grafiği alım ucu (24 Ekim).
 *
 * Mercek ve bültenle aynı köprü: claude.ai rutini (docs/claude-rutinler.md
 * § 7) `/api/grafik/context`i okur, tek grafik + ~100 kelime yazar ve buraya
 * gönderir. Sitede model çağrısı yok. Doğrulama ve yazma
 * `lib/content-write.ts`te; bu uç yetkiyi, günü ve SAYILARI denetliyor.
 *
 * SAYI DENETİMİ BURADA, 422. Başlıktaki, grafikteki ve açıklamadaki her
 * sayı aynı günün bağlam paketinde geçmek zorunda (`lib/ai-grounding.ts`;
 * site içi Claude notlarının kuralı). Paket uçta YENİDEN kuruluyor — rutinin
 * "gördüm" dediği pakete güvenilmiyor; kapanmış günün barları değişmediği
 * için iki kurulum aynı sayıları veriyor (`lib/daily-chart-context.ts`).
 * Yanıt düşen sayıları listeliyor: rutin onları düzeltip yeniden dener.
 *
 * Aynı gün + dil ikinci kez gelirse üzerine yazılır; önceki hâl
 * `story_revisions`a düşer.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/** Postgres "relation does not exist" — tablo migration'ı henüz uygulanmamış. */
function isMissingTable(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === "42P01" || codeOf(cause) === "42P01";
}

/**
 * Kaydı geri okur — `?date=YYYY-MM-DD&locale=tr`. Tarih yoksa en son grafik.
 * Alan adları POST gövdesiyle AYNI: rutin okuduğunu düzeltip geri gönderir.
 */
export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "tr";
  const dateParam = url.searchParams.get("date");
  if (dateParam !== null && !isIsoDay(dateParam)) {
    return NextResponse.json({ error: "invalid-date", detail: "?date=YYYY-MM-DD" }, { status: 400 });
  }
  const date = dateParam ?? (await getLatestDailyChart(locale))?.chartDate ?? null;
  const issue = date ? await getDailyChart(date, locale) : null;
  /* İSTENEN DİLDE YOKSA 404: rutin "İngilizcesi eksik mi" diye soruyor;
     orijinali döndürmek "var" demek olurdu. */
  if (!issue || issue.row.locale !== locale) {
    return NextResponse.json({ error: "not-found", date, locale }, { status: 404 });
  }
  const { row, locales } = issue;
  return NextResponse.json({
    ok: true,
    date: row.chartDate,
    locale: row.locale,
    locales,
    title: row.title,
    chart_md: row.chartMd,
    body_md: row.bodyMd,
    sources: row.sources ?? [],
    updated_at: row.updatedAt,
    url: dailyChartHref(row.chartDate),
  });
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let parsed;
  try {
    parsed = dailyChartInputSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid-body",
        detail: error instanceof z.ZodError ? error.issues : undefined,
        expected: DAILY_CHART_INPUT_SHAPE,
      },
      { status: 400 },
    );
  }

  /* GÜN: yalnız TAMAMLANMIŞ bir işlem günü. Açık seansın grafiği yarım
     barla yazılırdı; gelecek ya da tatil günü bir şey anlatmaz. */
  const holidays = await getHolidays();
  const last = lastCompletedSession(new Date(), holidays);
  const date = parsed.date ?? last;
  if (date > last || !isTradingDay(date, holidays)) {
    return NextResponse.json(
      { error: "not-a-completed-session", date, last_completed_session: last },
      { status: 400 },
    );
  }

  const { context, complete, coverage } = await loadDailyChartContext(date);
  if (!complete) {
    return NextResponse.json(
      { error: "context-incomplete", date, missing: context.missing, universe_coverage: coverage },
      { status: 503 },
    );
  }

  /* Kaynak etiketleri denetimin DIŞINDA: "Reuters — Q3 2026" gibi künye
     metni bağlamda geçmez ve geçmesi de gerekmez. */
  const written = [parsed.title, parsed.chart_md, parsed.body_md].join("\n");
  const ungrounded = ungroundedNumbers(written, groundingSource(context));
  if (ungrounded.length > 0) {
    return NextResponse.json(
      {
        error: "ungrounded-numbers",
        detail: "Bu sayılar /api/grafik/context paketinde geçmiyor; paketteki yazılışı kopyala ya da sayıyı çıkar.",
        numbers: [...new Set(ungrounded)],
      },
      { status: 422 },
    );
  }

  try {
    const saved = await saveDailyChart({ ...parsed, date }, "claude");
    return NextResponse.json({ ok: true, ...saved, url: dailyChartHref(saved.date) });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "table-missing", detail: "daily_charts migration'ı uygulanmamış." }, { status: 503 });
    }
    throw error;
  }
}
