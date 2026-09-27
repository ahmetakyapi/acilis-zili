import { cache } from "react";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  earningsAnalyses,
  earningsAnalysisExtras,
  type AnalysisKpi,
  type AnalysisSegment,
} from "@/lib/schema";

/**
 * Bilanço analizinin isteğe bağlı ekleri — "30 Saniyede" özeti, segment
 * gelirleri, şirkete özgü ölçüler. Tablonun neden ayrı olduğu
 * `lib/schema.ts` → `earningsAnalysisExtras` künyesinde.
 *
 * TABLO YOKKEN HİÇBİR ŞEY KIRILMAZ. Migration'lar deploy'dan sonra elle
 * uygulanıyor; bu dosyadaki her okuma ve yazma hatayı yutup "ek yok"
 * cevabına düşüyor (`lib/avatar-data.ts` kalıbı). Eksik ek, eski analizin
 * zaten olduğu hâl: sayfa bugünkü gibi çizilir.
 */

/* ---------------------------------------------------------------------------
   Giriş şeması — `/api/analiz` POST gövdesinin yeni alanları
   --------------------------------------------------------------------------- */

/**
 * Bir KPI'nın ya da segment tablosunun belgesi — SÖZLÜK, serbest metin değil.
 *
 * Rutinin kuralı "yalnızca şirketin kendi açıkladığı sayı": bülten, 10-Q,
 * 10-K. Serbest metin olsaydı "analist tahmini" ya da "sektör raporu" da
 * yazılabilirdi ve ekranda bir KAYNAK gibi dururdu. Sözlükte olmayan kaynak
 * uçta reddediliyor; ekrandaki adı sözlükten (`earningsExtra.sources`).
 * Kazanç çağrısı bilerek YOK: çağrıda söylenen bir sayı yazılı bir
 * belgede değil ve doğrulanamıyor.
 */
export const KPI_SOURCES = [
  "press-release",
  "shareholder-letter",
  "10-Q",
  "10-K",
  "8-K",
] as const;
export type KpiSource = (typeof KPI_SOURCES)[number];

export function isKpiSource(value: string | null | undefined): value is KpiSource {
  return (KPI_SOURCES as readonly string[]).includes(value ?? "");
}

/** "30 Saniyede" — tam üç madde. İki madde bir özet değil, dört madde bir liste. */
export const TAKEAWAY_COUNT = 3;
const TAKEAWAY_MIN = 20;
const TAKEAWAY_MAX = 220;
/** Pay görseli tek segmentte anlamsız (yüzde yüz); sekizden fazlası okunmuyor. */
const SEGMENTS_MIN = 2;
const SEGMENTS_MAX = 8;
const KPIS_MAX = 8;

const SegmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  /* HAM dolar ve NEGATİF OLAMAZ. Bültenlerde "eliminasyonlar" ya da
     "kurumsal" gibi eksi satırlar var; pay görselinde eksi bir dilim çizilemez
     ve toplamı bozar. Rutin o satırları hiç yazmıyor (§ 4). */
  revenue: z.number().nonnegative(),
  yoy_pct: z.number().nullish(),
  note: z.string().trim().max(80).nullish(),
});

const KpiSchema = z.object({
  name: z.string().trim().min(2).max(60),
  value: z.number(),
  /* "USD" → para, "%" → yüzde, başka her değer sayma birimi ("abone"). */
  unit: z.string().trim().min(1).max(24),
  yoy_pct: z.number().nullish(),
  source: z.enum(KPI_SOURCES),
});

/**
 * POST gövdesine eklenen dört alan. Hepsi `.nullish()` — gerekçe
 * `app/api/analiz/route.ts` başında (GET boş alanı `null` döndürüyor ve o
 * gövde geri gönderilebilmeli).
 */
export const EXTRAS_INPUT_SHAPE = {
  takeaways: z
    .array(z.string().trim().min(TAKEAWAY_MIN).max(TAKEAWAY_MAX))
    .length(TAKEAWAY_COUNT)
    .nullish(),
  segments: z.array(SegmentSchema).min(SEGMENTS_MIN).max(SEGMENTS_MAX).nullish(),
  segments_source: z.enum(KPI_SOURCES).nullish(),
  kpis: z.array(KpiSchema).min(1).max(KPIS_MAX).nullish(),
};

export type ExtrasInput = {
  takeaways?: string[] | null;
  segments?: z.infer<typeof SegmentSchema>[] | null;
  segments_source?: KpiSource | null;
  kpis?: z.infer<typeof KpiSchema>[] | null;
};

/**
 * Segmentler kaynaksız gelmez. `superRefine` içinden çağrılıyor — iki alan
 * arasındaki bağ, `growth_pct` + `growth_basis` kuralının aynısı.
 */
export function extrasIssues(body: ExtrasInput): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  const hasSegments = (body.segments?.length ?? 0) > 0;
  if (hasSegments && !body.segments_source) {
    issues.push({
      path: "segments_source",
      message:
        "segments kaynağıyla birlikte verilir: press-release | shareholder-letter | 10-Q | 10-K | 8-K",
    });
  }
  return issues;
}

/* ---------------------------------------------------------------------------
   Kayıt
   --------------------------------------------------------------------------- */

export type AnalysisExtras = {
  takeaways: string[] | null;
  segments: AnalysisSegment[] | null;
  segmentsSource: KpiSource | null;
  kpis: AnalysisKpi[] | null;
};

const EMPTY: AnalysisExtras = {
  takeaways: null,
  segments: null,
  segmentsSource: null,
  kpis: null,
};

export function hasAnyExtras(extras: AnalysisExtras): boolean {
  return (
    (extras.takeaways?.length ?? 0) > 0 ||
    (extras.segments?.length ?? 0) > 0 ||
    (extras.kpis?.length ?? 0) > 0
  );
}

/** Giriş gövdesinin (snake_case) kayda dönüşü. */
export function extrasFromInput(body: ExtrasInput): AnalysisExtras {
  const segments = body.segments?.length ? body.segments : null;
  return {
    takeaways: body.takeaways?.length ? body.takeaways : null,
    segments: segments
      ? segments.map((segment) => ({
          name: segment.name,
          revenue: segment.revenue,
          yoyPct: segment.yoy_pct ?? null,
          note: segment.note ?? null,
        }))
      : null,
    segmentsSource: segments ? (body.segments_source ?? null) : null,
    kpis: body.kpis?.length
      ? body.kpis.map((kpi) => ({
          name: kpi.name,
          value: kpi.value,
          unit: kpi.unit,
          yoyPct: kpi.yoy_pct ?? null,
          source: kpi.source,
        }))
      : null,
  };
}

/** Kaydın geri okunan hâli — alan adları POST gövdesiyle birebir. */
export function extrasToOutput(extras: AnalysisExtras | null) {
  const value = extras ?? EMPTY;
  return {
    takeaways: value.takeaways ?? [],
    segments: (value.segments ?? []).map((segment) => ({
      name: segment.name,
      revenue: segment.revenue,
      yoy_pct: segment.yoyPct ?? null,
      note: segment.note ?? null,
    })),
    segments_source: value.segmentsSource,
    kpis: (value.kpis ?? []).map((kpi) => ({
      name: kpi.name,
      value: kpi.value,
      unit: kpi.unit,
      yoy_pct: kpi.yoyPct ?? null,
      source: kpi.source,
    })),
  };
}

function normalize(row: {
  takeaways: string[] | null;
  segments: AnalysisSegment[] | null;
  segmentsSource: string | null;
  kpis: AnalysisKpi[] | null;
}): AnalysisExtras {
  return {
    takeaways: row.takeaways?.length ? row.takeaways : null,
    segments: row.segments?.length ? row.segments : null,
    segmentsSource: isKpiSource(row.segmentsSource) ? row.segmentsSource : null,
    /* Sözlükten düşmüş bir kaynak (ileride bir değer kaldırılırsa) ekranda
       adsız kalmasın diye satır hiç basılmıyor. */
    kpis: row.kpis?.length ? row.kpis.filter((kpi) => isKpiSource(kpi.source)) : null,
  };
}

/**
 * Ekleri yazar ya da (hepsi boşsa) siler.
 *
 * POST gövdenin TAMAMINI üzerine yazıyor; ekler de aynı kurala uyuyor:
 * alanı göndermeyen gövde eki temizler. Rutinin düzeltme akışı "GET ile
 * oku → düzenle → geri gönder" olduğu için okunan paket ekleri de taşıyor
 * ve hiçbir şey kaybolmuyor.
 *
 * Dönüş: "saved" · "cleared" · "unavailable" (tablo yok ya da yazılamadı —
 * ana kayıt yine yazılmış durumda, uç bunu yanıtında söylüyor).
 */
export async function saveAnalysisExtras(
  analysisId: string,
  extras: AnalysisExtras,
): Promise<"saved" | "cleared" | "unavailable"> {
  try {
    if (!hasAnyExtras(extras)) {
      await db
        .delete(earningsAnalysisExtras)
        .where(eq(earningsAnalysisExtras.analysisId, analysisId));
      return "cleared";
    }
    const values = {
      analysisId,
      takeaways: extras.takeaways,
      segments: extras.segments,
      segmentsSource: extras.segmentsSource,
      kpis: extras.kpis,
    };
    await db
      .insert(earningsAnalysisExtras)
      .values(values)
      .onConflictDoUpdate({
        target: earningsAnalysisExtras.analysisId,
        set: { ...values, updatedAt: new Date() },
      });
    return "saved";
  } catch {
    return "unavailable";
  }
}

/** Tek analizin ekleri; yoksa ya da tablo yoksa `null`. İstek içinde önbellekli. */
export const getAnalysisExtras = cache(async function getAnalysisExtras(
  analysisId: string,
): Promise<AnalysisExtras | null> {
  try {
    const [row] = await db
      .select({
        takeaways: earningsAnalysisExtras.takeaways,
        segments: earningsAnalysisExtras.segments,
        segmentsSource: earningsAnalysisExtras.segmentsSource,
        kpis: earningsAnalysisExtras.kpis,
      })
      .from(earningsAnalysisExtras)
      .where(eq(earningsAnalysisExtras.analysisId, analysisId))
      .limit(1);
    if (!row) return null;
    const extras = normalize(row);
    return hasAnyExtras(extras) ? extras : null;
  } catch {
    return null;
  }
});

/**
 * Liste kartlarının tek satırlık ipucu — `SEMBOL:dönem` başına İLK madde.
 *
 * Dil önceliği `dedupeAnalyses` ile aynı: kart hangi dil satırını
 * gösteriyorsa ipucu da o satırın eki olmalı, yoksa Türkçe kartın altında
 * İngilizce bir madde durur. Anahtar bu yüzden dili de taşıyor.
 */
export async function getTakeawayTeasers(
  keys: { symbol: string; period: string; locale: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  try {
    const rows = await db
      .select({
        symbol: earningsAnalyses.symbol,
        period: earningsAnalyses.period,
        locale: earningsAnalyses.locale,
        first: sql<string | null>`${earningsAnalysisExtras.takeaways}->>0`,
      })
      .from(earningsAnalysisExtras)
      .innerJoin(earningsAnalyses, eq(earningsAnalyses.id, earningsAnalysisExtras.analysisId))
      .where(
        and(
          inArray(earningsAnalyses.symbol, [...new Set(keys.map((key) => key.symbol))]),
          inArray(earningsAnalyses.period, [...new Set(keys.map((key) => key.period))]),
        ),
      );
    for (const row of rows) {
      if (row.first) out.set(teaserKey(row), row.first);
    }
  } catch {
    /* Tablo yok: kartlar ipucusuz, yani bugünkü hâlleriyle. */
  }
  return out;
}

export function teaserKey(row: { symbol: string; period: string; locale: string }) {
  return `${row.symbol}:${row.period}:${row.locale}`;
}

/**
 * Panelin İçerik sağlığı için: hangi analiz satırında özet ve segment var.
 *
 * Analiz kimliği → iki bayrak. Tablo okunamazsa `null` — panel "eksik"
 * yerine "okunamadı" der; migration inmeden her analizi özetsiz saymak
 * yanlış bir alarm olurdu.
 */
export async function getExtrasCoverage(): Promise<
  Map<string, { takeaways: boolean; segments: boolean }> | null
> {
  try {
    const rows = await db
      .select({
        analysisId: earningsAnalysisExtras.analysisId,
        takeaways: sql<boolean>`coalesce(jsonb_array_length(${earningsAnalysisExtras.takeaways}), 0) > 0`,
        segments: sql<boolean>`coalesce(jsonb_array_length(${earningsAnalysisExtras.segments}), 0) > 0`,
      })
      .from(earningsAnalysisExtras);
    return new Map(
      rows.map((row) => [row.analysisId, { takeaways: row.takeaways, segments: row.segments }]),
    );
  } catch {
    return null;
  }
}
