import { ImageResponse } from "next/og";
import { getI18n } from "@/lib/i18n";
import { ogFonts } from "@/lib/og";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { formatEtDateLong } from "@/lib/utils";
import { checkChartBlock, firstSentence } from "@/lib/daily-chart";
import { getDailyChart } from "@/lib/daily-chart-data";
import { DAILY_CHART_OG_SIZES, DailyChartOgCard, type DailyChartOgSize } from "@/lib/daily-chart-og";

/**
 * Günün Grafiği görseli — `/gunun-grafigi/2026-10-23/gorsel?boyut=yatay|dikey`
 * (1200×630 sosyal kart, 1080×1350 Instagram ve telefon).
 *
 * ROUTE HANDLER, DOSYA TABANLI OG DEĞİL — `bilancolar/hafta/gorsel` ile aynı
 * gerekçe: dil adresin önekinden geliyor (`/en/...` İngilizce kart), boyut
 * sorgudan. `/api` altında değil: `robots.txt` `/api/`i engelliyor ve X'in
 * kart botu ona uyuyor (`/gun/[tarih]/kart` notu).
 *
 * Kayıt değişmiyor (günün grafiği arşivlik); panel düzeltmesi bir saat içinde
 * görsele yansır.
 */

const CACHE_SECONDS = 3600;

function sizeOf(value: string | null): DailyChartOgSize {
  return value === "dikey" ? "portrait" : "landscape";
}

export async function GET(request: Request, context: RouteContext<"/gunun-grafigi/[tarih]/gorsel">) {
  /* Oran sınırı — kardeş görsellerle aynı gerekçe: her istek bir okuma ve
     bir Satori çizimi; sayfa iki boyut istiyor. */
  const gate = rateLimit(clientKey(request, "grafik-gorsel"), 40, 60_000);
  if (!gate.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }

  const { tarih } = await context.params;
  const { locale, t } = await getI18n();
  const issue = await getDailyChart(tarih, locale);
  if (!issue) return new Response("Not Found", { status: 404 });
  const { row } = issue;
  const check = checkChartBlock(row.chartMd, row.locale);
  if (!check.ok) return new Response("Not Found", { status: 404 });

  const size = sizeOf(new URL(request.url).searchParams.get("boyut"));
  return new ImageResponse(
    (
      <DailyChartOgCard
        block={check.block}
        title={row.title}
        dateLine={t.dailyChart.sessionLine.replace("{date}", formatEtDateLong(row.chartDate, locale))}
        lead={firstSentence(row.bodyMd)}
        eyebrow={t.dailyChart.title}
        size={size}
      />
    ),
    {
      ...DAILY_CHART_OG_SIZES[size],
      fonts: await ogFonts(),
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
        /* Öneksiz adreste dil çerezden okunabiliyor (hafta görselinin notu). */
        Vary: "Cookie",
      },
    },
  );
}
