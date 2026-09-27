import { desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  dailyBriefs,
  earningsAnalyses,
  earningsCalendar,
  macroSeries,
  quotesCache,
  stories,
  technicalAnalyses,
} from "./schema";
import { getHolidays } from "./data";
import { providerStatus } from "./providers";
import {
  cronState,
  routineReports,
  type CronState,
  type RoutineReport,
} from "./routine-schedule";
import { isTechnicalSlot } from "./technical";
import { getErrorCountSince } from "./error-log";

/**
 * `/api/health`in içeriği — dış izleyici için makinece okunur sağlık.
 *
 * NE ÖLÇÜYOR, NE ÖLÇMÜYOR. Veritabanı gerçekten yoklanıyor (`select 1`,
 * süre sınırlı) çünkü sitenin ayakta olması onun ayakta olmasına bağlı.
 * Sağlayıcılar YOKLANMIYOR: dakikada bir soran bir izleyici Finnhub'ın
 * dakikalık kotasını (60) ve Alpaca'nınkini sayfa trafiğinden yerdi. Onların
 * durumu elde olan izden okunuyor — anahtar tanımlı mı, son kotasyon
 * önbelleğe ne zaman yazıldı, günlük senkron en son ne zaman koştu.
 *
 * GİZLİ DEĞER YOK. Anahtarlar yalnızca evet/hayır, hata mesajları yalnızca
 * sınıf ("timeout", "error"); bağlantı dizesi, sorgu metni ya da sürücünün
 * mesajı dışarı çıkmıyor — uç yetkisiz ve depo herkese açık.
 */

/** Veritabanı yoklamasının süre sınırı — izleyicinin kendi zaman aşımının altında. */
const DB_TIMEOUT_MS = 3000;

export type DbProbe = { ok: true; latencyMs: number } | { ok: false; reason: "not-configured" | "timeout" | "error" };

/** `select 1` — süre sınırlı, fırlatmaz. */
export async function probeDatabase(): Promise<DbProbe> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "not-configured" };
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      db.execute(sql`select 1`).then(() => "ok" as const),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), DB_TIMEOUT_MS);
      }),
    ]);
    if (outcome === "timeout") return { ok: false, reason: "timeout" };
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(timer);
  }
}

/** Toplama fonksiyonunun ham dizesi → Date (bkz. lib/admin-data.ts → toDate). */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export type HealthReport = {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  database: DbProbe;
  providers: {
    configured: { alpaca: boolean; finnhub: boolean; fred: boolean };
    /** Kotasyon önbelleğine en son yazılan an — fiyat akışının izi. */
    lastQuoteAt: string | null;
    /** Günlük senkronun izi ve bugünkü durumu (lib/routine-schedule.ts → cronState). */
    cron: { lastRunAt: string | null; state: CronState; dueTr: string } | null;
  };
  routines: RoutineReport[] | null;
  /** Son 24 saatte kaydedilen uygulama hatası; tablo yoksa null. */
  errors24h: { total: number; groups: number } | null;
};

const ERROR_WINDOW_HOURS = 24;

/**
 * Raporun tamamı. Veritabanı düşmüşse ikinci tur sorgu atılmıyor: her biri
 * aynı hatayı verecek ve izleyicinin cevabını geciktirecekti.
 */
export async function buildHealthReport(now: Date = new Date()): Promise<HealthReport> {
  const database = await probeDatabase();
  const configured = providerStatus();
  if (!database.ok) {
    return {
      status: "down",
      checkedAt: now.toISOString(),
      database,
      providers: { configured, lastQuoteAt: null, cron: null },
      routines: null,
      errors24h: null,
    };
  }

  const [quotes, cronStamps, briefs, story, analysis, technical, holidays, errors] =
    await Promise.allSettled([
      db.select({ at: sql<string | null>`max(${quotesCache.updatedAt})` }).from(quotesCache),
      /* Senkronun İZİ yalnızca kendi yazdığı iki sütundan — gerekçe
         lib/admin-data.ts → getCronPulse. */
      Promise.all([
        db.select({ at: sql<string | null>`max(${earningsCalendar.updatedAt})` }).from(earningsCalendar),
        db.select({ at: sql<string | null>`max(${macroSeries.updatedAt})` }).from(macroSeries),
      ]),
      db
        .select({ period: dailyBriefs.period, latest: sql<string | null>`max(${dailyBriefs.briefDate})` })
        .from(dailyBriefs)
        .groupBy(dailyBriefs.period),
      /* Tazelik `published_at` ile `updated_at`in büyüğü — gerekçe
         lib/admin-data.ts → getHealthChecks, "TAZELİK published_at'TAN
         OKUNMAZ". */
      db
        .select({ latest: sql<string | null>`max(greatest(${stories.publishedAt}, ${stories.updatedAt}))` })
        .from(stories),
      db
        .select({
          latest: sql<string | null>`max(greatest(${earningsAnalyses.publishedAt}, ${earningsAnalyses.updatedAt}))`,
        })
        .from(earningsAnalyses),
      db
        .select({
          sessionDate: technicalAnalyses.sessionDate,
          slots: sql<string>`string_agg(distinct ${technicalAnalyses.slot}, ',')`,
        })
        .from(technicalAnalyses)
        .groupBy(technicalAnalyses.sessionDate)
        .orderBy(desc(technicalAnalyses.sessionDate))
        .limit(1),
      getHolidays(),
      getErrorCountSince(ERROR_WINDOW_HOURS),
    ]);

  const lastQuoteAt =
    quotes.status === "fulfilled" ? toDate(quotes.value[0]?.at)?.toISOString() ?? null : null;

  let cron: HealthReport["providers"]["cron"] = null;
  if (cronStamps.status === "fulfilled") {
    const stamps = cronStamps.value
      .map(([row]) => toDate(row?.at))
      .filter((d): d is Date => d !== null);
    const lastRun = stamps.length ? new Date(Math.max(...stamps.map((d) => d.getTime()))) : null;
    cron = { lastRunAt: lastRun?.toISOString() ?? null, ...cronState(lastRun, now) };
  }

  let routines: RoutineReport[] | null = null;
  if (
    briefs.status === "fulfilled" &&
    story.status === "fulfilled" &&
    analysis.status === "fulfilled" &&
    technical.status === "fulfilled" &&
    holidays.status === "fulfilled"
  ) {
    const byPeriod = new Map(briefs.value.map((row) => [row.period, row.latest]));
    const [tech] = technical.value;
    routines = routineReports(
      {
        dailyLatest: byPeriod.get("daily") ?? null,
        weeklyLatest: byPeriod.get("weekly") ?? null,
        technicalLatest: tech
          ? { sessionDate: tech.sessionDate, slots: tech.slots.split(",").filter(isTechnicalSlot) }
          : null,
        storyLatest: toDate(story.value[0]?.latest),
        analysisLatest: toDate(analysis.value[0]?.latest),
      },
      now,
      holidays.value,
    );
  }

  const errors24h =
    errors.status === "fulfilled" && errors.value.ok ? errors.value.data : null;

  /* "degraded": site ayakta ama bakılacak bir şey var — geciken rutin,
     kaçan senkron ya da okunamayan bir iz. HTTP kodu yine 200: izleyici
     "site çöktü" alarmını yalnızca veritabanı düşünce çalsın; gecikme
     gövdedeki `status` alanından ayrı bir kuralla izlenebilir. */
  const late = routines?.some((r) => r.state === "late") ?? true;
  const cronMissed = cron === null || cron.state === "missed";
  return {
    status: late || cronMissed ? "degraded" : "ok",
    checkedAt: now.toISOString(),
    database,
    providers: { configured, lastQuoteAt, cron },
    routines,
    errors24h,
  };
}
