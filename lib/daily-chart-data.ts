import { cache } from "react";
import { desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyCharts, type DailyChartRow } from "@/lib/schema";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { isIsoDay } from "@/lib/date-input";

/* ==========================================================================
   Günün Grafiği — okuma (24 Ekim)

   TABLO YOKKEN SESSİZCE DÜŞER. `daily_charts` migration'la geliyor ve
   migration deploy'da uygulanmıyor (CLAUDE.md "Altyapı"): kod tablodan önce
   yayına inebilir. O arada her okuyucu "kayıt yok" der — sayfa 404, ana
   sayfa kartı hiç basılmaz, bülten bağlantısı çıkmaz. Hata ayrımı burada
   yapılmıyor (okunamayan ile olmayan aynı cevap): özellik bir süs, sitenin
   geri kalanını bir okuma hatası yüzünden hata sınırına göndermek ona
   orantısız. Panel ise tablonun varlığını ayrıca soruyor
   (`getDailyChartHealth` → `available`).
   ========================================================================== */

export type DailyChartRecord = DailyChartRow;

export type DailyChartIssue = {
  /** İstenen dildeki kayıt; yoksa orijinali — sayfa "TR" notunu basar. */
  row: DailyChartRecord;
  /** Kaydın GERÇEKTEN yazıldığı diller — hreflang ve og:locale için. */
  locales: Locale[];
};

const chartRowsForDay = cache(async function chartRowsForDay(date: string): Promise<DailyChartRecord[]> {
  if (!isIsoDay(date)) return [];
  try {
    return await db.select().from(dailyCharts).where(eq(dailyCharts.chartDate, date)).limit(4);
  } catch {
    return [];
  }
});

/** Bir günün grafiği — `cache()`li: künye ve gövde aynı istekte bir kez sorar. */
export async function getDailyChart(date: string, locale: Locale): Promise<DailyChartIssue | null> {
  const rows = await chartRowsForDay(date);
  const row = rows.find((entry) => entry.locale === locale) ?? rows.find((entry) => entry.locale === "tr") ?? rows[0];
  if (!row) return null;
  return { row, locales: rows.map((entry) => entry.locale).filter(isLocale) };
}

export type DailyChartIndexRow = Pick<
  DailyChartRecord,
  "chartDate" | "locale" | "title" | "chartMd" | "bodyMd" | "updatedAt"
>;

/**
 * Arşiv — gün başına TEK kayıt: istenen dil varsa o, yoksa orijinali
 * (`getStories` kuralı). Sınır gün sayısı; dil başına satır düştüğü için
 * iki katı çekilip birleştirme sonrası kırpılıyor.
 */
export async function getDailyChartArchive(locale: Locale, limit = 60): Promise<DailyChartIndexRow[]> {
  try {
    const rows = await db
      .select({
        chartDate: dailyCharts.chartDate,
        locale: dailyCharts.locale,
        title: dailyCharts.title,
        chartMd: dailyCharts.chartMd,
        bodyMd: dailyCharts.bodyMd,
        updatedAt: dailyCharts.updatedAt,
      })
      .from(dailyCharts)
      .orderBy(desc(dailyCharts.chartDate))
      .limit(limit * 2);
    const byDay = new Map<string, DailyChartIndexRow>();
    for (const row of rows) {
      const held = byDay.get(row.chartDate);
      if (!held || (held.locale !== locale && row.locale === locale)) byDay.set(row.chartDate, row);
    }
    return [...byDay.values()].slice(0, limit);
  } catch {
    return [];
  }
}

/** En son grafik — ana sayfa kartı ve bülten bağlantısı. */
export const getLatestDailyChart = cache(async function getLatestDailyChart(
  locale: Locale,
): Promise<DailyChartIndexRow | null> {
  return (await getDailyChartArchive(locale, 1))[0] ?? null;
});

/**
 * Panelin sorusu: tablo var mı, son günlerde hangi gün hangi dilde yazıldı.
 * `available: false` TABLO YOK ya da okunamadı — "eksik yok" ile
 * karışmasın diye ayrı (lib/price-alerts.ts → `available` kalıbı).
 */
export async function getDailyChartHealth(
  since: string,
): Promise<{ available: boolean; days: Map<string, Locale[]> }> {
  try {
    const rows = await db
      .select({ chartDate: dailyCharts.chartDate, locale: dailyCharts.locale })
      .from(dailyCharts)
      .where(gte(dailyCharts.chartDate, since));
    const days = new Map<string, Locale[]>();
    for (const row of rows) {
      if (!isLocale(row.locale)) continue;
      days.set(row.chartDate, [...(days.get(row.chartDate) ?? []), row.locale]);
    }
    return { available: true, days };
  } catch {
    return { available: false, days: new Map() };
  }
}

/** Rutin bağlamı için: son yazılan grafikler — aynı konuyu üst üste seçmesin. */
export async function getRecentDailyCharts(limit: number) {
  try {
    const rows = await db
      .select({ chartDate: dailyCharts.chartDate, locale: dailyCharts.locale, title: dailyCharts.title, chartMd: dailyCharts.chartMd })
      .from(dailyCharts)
      .orderBy(desc(dailyCharts.chartDate))
      .limit(limit * 2);
    return { available: true as const, rows };
  } catch {
    return { available: false as const, rows: [] };
  }
}
