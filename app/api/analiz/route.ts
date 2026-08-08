import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { earningsAnalyses } from "@/lib/schema";
import { isLocale } from "@/lib/i18n/config";
import { periodSlug } from "@/lib/analysis";

/**
 * Bilanço analizi alım ucu.
 *
 * İsteğe bağlı alanların hepsi `.nullish()` — yani hem yokluğu hem de açık
 * `null` kabul ediliyor. Gerekçe kâğıt üzerinde değil pratikte: rutinin
 * dokümanlı akışı "GET ile oku → düzenle → aynı gövdeyi POST et" ve GET,
 * boş alanları `null` olarak döndürüyor. Şema yalnızca `.optional()` olsaydı
 * o gövde geri gönderilemezdi; alan eksik değil, açıkça boş.
 *
 * Bülten ve mercek köprüsünün üçüncüsü: kullanıcının kendi claude.ai rutini
 * açıklanan bilançoyu okur, değerlendirmeyi yazar, buraya
 * gönderir. Sitede API anahtarı tutulmaz, model maliyeti sunucuya binmez.
 *
 * Aynı `symbol + period + locale` ikinci kez gelirse ÜZERİNE yazılır — bir
 * analiz düzeltilebilir. İki dil iki ayrı POST'tur; biri gelmezse sayfa
 * orijinali not düşerek gösterir.
 *
 * Sayılar HAM gönderilir (8_970_000_000), biçimlenmiş metin değil: aynı kayıt
 * iki dilde de gösteriliyor ve binlik ayracı sunum katmanına ait.
 */

const SourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500).nullish(),
});

const HighlightSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(60),
  /** Değerin yanındaki renkli kısa not: "▲ %372", "Rekor". */
  note: z.string().trim().max(40).nullish(),
  tone: z.enum(["up", "down", "neutral"]).nullish(),
});

/** Çeyreklik gelir sütunu. `projected` işaretli olan kesikli çizilir. */
const RevenueBarSchema = z.object({
  label: z.string().trim().min(1).max(20),
  value: z.number(),
  projected: z.boolean().nullish(),
  /** Sütunun üstünde yazacak metin; yoksa değer biçimlenir ("10,3–10,8"). */
  note: z.string().trim().max(24).nullish(),
});

/** Gelecek çeyrek öngörüsü — bir ölçünün alt/üst bandı ve piyasa beklentisi. */
const GuidanceSchema = z.object({
  label: z.string().trim().min(1).max(60),
  low: z.number(),
  high: z.number(),
  consensus: z.number().nullish(),
  /** "Mr $", "$", "%" — değerin ardına eklenir. */
  unit: z.string().trim().max(8).nullish(),
  /** Nötr bağlam satırı. */
  note: z.string().trim().max(120).nullish(),
  /** Renkli yargı: "Aralığın Üstünde ▼" / "Uyumlu ✓". */
  evaluation: z.string().trim().max(60).nullish(),
  tone: z.enum(["up", "down", "neutral"]).nullish(),
});

const SectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(40).max(4000),
});

const BodySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z.\-]+$/, "yalnızca harf, nokta ve tire"),
  /** Görünen dönem adı — URL parçası bundan türetilir. */
  period_label: z.string().trim().min(2).max(40),
  /** İstenirse URL parçası açıkça verilebilir: "4c-fy2026". */
  period: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "yalnızca küçük harf, rakam ve tire")
    .nullish(),
  locale: z.string().nullish(),
  company: z.string().trim().min(1).max(120),
  exchange: z.string().trim().max(20).nullish(),
  sector: z.string().trim().max(120).nullish(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timing: z.enum(["bmo", "amc", "dmh"]).nullish(),
  next_period_label: z.string().trim().max(40).nullish(),
  next_report_estimate: z.string().trim().max(40).nullish(),

  score: z.number().int().min(0).max(100),
  verdict: z.enum(["buy", "hold", "sell"]),
  /**
   * Görüş şeridinin gövdesi — 2-3 cümle.
   *
   * Alt sınır 20'den 120'ye çıktı: tek cümlelik bir manşet sayfanın en
   * geniş şeridinde tek satır kalıyor ve şerit boş görünüyordu. Karnedeki
   * karşılığı da 2-3 cümle.
   */
  headline: z.string().trim().min(120).max(600),

  price: z.number().nullish(),
  reaction_pct: z.number().nullish(),
  market_cap: z.number().nullish(),
  return_1y_pct: z.number().nullish(),
  target_price: z.number().nullish(),
  upside_pct: z.number().nullish(),
  analyst_count: z.number().int().min(0).max(200).nullish(),

  revenue: z.number().nullish(),
  revenue_yoy_pct: z.number().nullish(),
  eps: z.number().nullish(),
  eps_surprise_pct: z.number().nullish(),

  summary: z.array(z.string().trim().min(40).max(2000)).min(1).max(6),
  analysis: z.array(SectionSchema).min(1).max(12),
  strengths: z.array(z.string().trim().min(10).max(300)).max(6).nullish(),
  risks: z.array(z.string().trim().min(10).max(300)).max(6).nullish(),
  upcoming: z.array(z.string().trim().min(10).max(300)).max(6).nullish(),
  highlights: z.array(HighlightSchema).max(10).nullish(),
  ceo_quote: z
    .object({
      quote: z.string().trim().min(20).max(800),
      name: z.string().trim().min(2).max(80),
      title: z.string().trim().min(2).max(80),
      /** Çağrıda vurgulanan 2-3 konu — alıntının yanında hap rozet olur. */
      topics: z.array(z.string().trim().min(3).max(80)).max(4).nullish(),
    })
    .nullish(),
  quarterly_revenue: z.array(RevenueBarSchema).max(8).nullish(),
  /** Sütun grafiğinin altındaki üç mini ölçü. */
  revenue_footer: z.array(HighlightSchema).max(3).nullish(),
  guidance: z.array(GuidanceSchema).max(5).nullish(),
  /** Öngörü kartının altındaki üç mini ölçü. */
  guidance_footer: z.array(HighlightSchema).max(3).nullish(),
  sources: z.array(SourceSchema).max(20).nullish(),
});

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/**
 * Kaydı geri okur — `?symbol=SNDK&period=4c-fy2026`.
 *
 * Mercek ucundaki gerekçenin aynısı: rutin bir analizi düzeltmek istediğinde
 * eski metni okuyabilmeli, POST gövdenin tamamını üzerine yazdığı için
 * hafızadan yeniden yazmak zorunda kalmamalı. Alan adları POST gövdesiyle
 * birebir aynı yazılıyor — okunan paket düzenlenip doğrudan geri
 * gönderilebilsin.
 */
export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
  const period = url.searchParams.get("period")?.trim();
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "tr";

  if (!symbol || !period) {
    return NextResponse.json(
      {
        error: "missing-params",
        detail: "?symbol=SNDK&period=4c-fy2026 zorunlu. Liste: /api/analiz/context",
      },
      { status: 400 },
    );
  }

  const [row] = await db
    .select()
    .from(earningsAnalyses)
    .where(
      and(
        eq(earningsAnalyses.symbol, symbol),
        eq(earningsAnalyses.period, period),
        eq(earningsAnalyses.locale, locale),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "not-found", symbol, period, locale },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    symbol: row.symbol,
    period: row.period,
    period_label: row.periodLabel,
    locale: row.locale,
    company: row.company,
    exchange: row.exchange,
    sector: row.sector,
    report_date: row.reportDate,
    timing: row.timing,
    next_period_label: row.nextPeriodLabel,
    next_report_estimate: row.nextReportEstimate,
    score: row.score,
    verdict: row.verdict,
    headline: row.headline,
    price: row.price,
    reaction_pct: row.reactionPct,
    market_cap: row.marketCap,
    return_1y_pct: row.return1yPct,
    target_price: row.targetPrice,
    upside_pct: row.upsidePct,
    analyst_count: row.analystCount,
    revenue: row.revenue,
    revenue_yoy_pct: row.revenueYoyPct,
    eps: row.eps,
    eps_surprise_pct: row.epsSurprisePct,
    summary: row.summary,
    analysis: row.analysis,
    strengths: row.strengths ?? [],
    risks: row.risks ?? [],
    upcoming: row.upcoming ?? [],
    highlights: row.highlights ?? [],
    ceo_quote: row.ceoQuote,
    quarterly_revenue: row.quarterlyRevenue ?? [],
    revenue_footer: row.revenueFooter ?? [],
    guidance: row.guidance ?? [],
    guidance_footer: row.guidanceFooter ?? [],
    sources: row.sources ?? [],
    updated_at: row.updatedAt,
  });
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid-body",
        detail: error instanceof z.ZodError ? error.issues : undefined,
        expected: {
          symbol: "SNDK",
          period_label: "4Ç FY2026 — görünen dönem adı",
          period: "4c-fy2026 (opsiyonel, period_label'dan türetilir)",
          locale: "tr | en (opsiyonel, varsayılan tr)",
          company: "SanDisk",
          exchange: "NASDAQ (opsiyonel)",
          sector: "Yarı İletken · NAND / Flash Depolama (opsiyonel)",
          report_date: "YYYY-MM-DD (ET)",
          timing: "bmo | amc | dmh (opsiyonel)",
          score: "0-100 tam sayı",
          verdict: "buy | hold | sell",
          headline: "2-3 cümle: çeyreğin hikâyesi + tepkinin nedeni (120-600)",
          summary: "['p1','p2','p3'] — 1-6 paragraf",
          analysis: "[{title, body}] — 1-12 bölüm",
          "sayısal alanlar":
            "price, reaction_pct, market_cap, return_1y_pct, target_price, upside_pct, analyst_count, revenue, revenue_yoy_pct, eps, eps_surprise_pct — HAM sayı",
          strengths_risks_upcoming: "['madde', ...] en fazla 6",
          highlights: "[{label, value, note?, tone?}] — 6 metrik karti",
          quarterly_revenue:
            "[{label, value, projected?, note?}] — son 5 çeyrek + öngörü",
          guidance:
            "[{label, low, high, consensus?, unit?, note?, evaluation?, tone?}] ≤5",
          revenue_footer:
            "[{label, value, note?, tone?}] — sütun grafiğinin altındaki 3 ölçü",
          guidance_footer:
            "[{label, value, note?, tone?}] — öngörü kartının altındaki 3 ölçü",
          ceo_quote: "{quote, name, title} (opsiyonel)",
          sources: "[{label, url}] (opsiyonel)",
        },
      },
      { status: 400 },
    );
  }

  const locale = isLocale(parsed.locale) ? parsed.locale : "tr";
  const period = parsed.period ?? periodSlug(parsed.period_label);
  if (!period) {
    return NextResponse.json(
      {
        error: "invalid-period",
        detail: "period_label'dan URL parçası türetilemedi; `period` alanını ver.",
      },
      { status: 400 },
    );
  }

  const symbol = parsed.symbol.toUpperCase();

  const values = {
    symbol,
    period,
    locale,
    periodLabel: parsed.period_label,
    company: parsed.company,
    exchange: parsed.exchange ?? null,
    sector: parsed.sector ?? null,
    reportDate: parsed.report_date,
    timing: parsed.timing ?? null,
    nextPeriodLabel: parsed.next_period_label ?? null,
    nextReportEstimate: parsed.next_report_estimate ?? null,
    score: parsed.score,
    verdict: parsed.verdict,
    headline: parsed.headline,
    price: parsed.price ?? null,
    reactionPct: parsed.reaction_pct ?? null,
    marketCap: parsed.market_cap ?? null,
    return1yPct: parsed.return_1y_pct ?? null,
    targetPrice: parsed.target_price ?? null,
    upsidePct: parsed.upside_pct ?? null,
    analystCount: parsed.analyst_count ?? null,
    revenue: parsed.revenue ?? null,
    revenueYoyPct: parsed.revenue_yoy_pct ?? null,
    eps: parsed.eps ?? null,
    epsSurprisePct: parsed.eps_surprise_pct ?? null,
    summary: parsed.summary,
    analysis: parsed.analysis,
    strengths: parsed.strengths ?? null,
    risks: parsed.risks ?? null,
    upcoming: parsed.upcoming ?? null,
    highlights: parsed.highlights ?? null,
    ceoQuote: parsed.ceo_quote ?? null,
    quarterlyRevenue: parsed.quarterly_revenue ?? null,
    revenueFooter: parsed.revenue_footer ?? null,
    guidance: parsed.guidance ?? null,
    guidanceFooter: parsed.guidance_footer ?? null,
    sources: parsed.sources ?? null,
    generatedBy: "claude",
  };

  await db
    .insert(earningsAnalyses)
    .values(values)
    .onConflictDoUpdate({
      target: [
        earningsAnalyses.symbol,
        earningsAnalyses.period,
        earningsAnalyses.locale,
      ],
      set: { ...values, updatedAt: new Date() },
    });

  return NextResponse.json({
    ok: true,
    symbol,
    period,
    locale,
    url: `/bilancolar/${symbol.toLowerCase()}/${period}`,
  });
}
