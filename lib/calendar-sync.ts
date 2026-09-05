import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { economicEvents } from "./schema";
import { getReleaseDates, getSeriesRelease } from "./providers/fred";
import { addEtDays, todayEt } from "./market-hours";
import { joblessClaimsEvents } from "../db/seed/economic-events";

/**
 * Takvimin kendi kendini uzatması.
 *
 * SORUN: ekonomik takvimin ilan edilmiş tarihleri (TÜFE, istihdam raporu)
 * `db/seed/economic-events.ts` içine ELLE işleniyordu ve bir gün bitiyorlardı.
 * Bittiklerinde takvim sessizce boşalıyor — hata yok, sadece "yaklaşan olay
 * yok" yazıyor. Bir yatırımcının TÜFE gününü kaçırması için fazlasıyla
 * yeterli. Tohumu elle tazelemek de çözüm değildi: kimse takvimin dolu olup
 * olmadığını her ay kontrol etmiyor.
 *
 * ÇÖZÜM: FRED zaten her yayının İLAN EDİLMİŞ GELECEK tarihlerini veriyor
 * (`/release/dates`). Günlük cron bunu çekip takvimi bir yıl ileriye kadar
 * dolduruyor. Kaynak resmî, tarih tahmin değil, ve kimsenin bir şey
 * hatırlaması gerekmiyor.
 *
 * ELLE İŞLENEN KAZANIR: aynı gün ve aynı seri için tohumda bir kayıt varsa
 * ona dokunulmuyor. Tohumdaki başlıklar daha iyi ("TÜFE — Temmuz Verisi")
 * ve saatleri kesin; FRED yalnızca onların bittiği yerden devam ediyor.
 *
 * FOMC BURADAN GELMEZ. Fed'in toplantı takvimi bir FRED "yayını" değil —
 * politika faizi serisinin bağlı olduğu H.15 günlük yayınlanır ve toplantı
 * günleriyle ilgisi yoktur. FOMC elle işlenmeye devam ediyor; `manualCoverage()`
 * onun ömrünü ayrıca takip ediyor.
 */

/**
 * Takvime olay üreten yayınlar — yayın başına TEK temsilci seri.
 *
 * Neden temsilci: bir FRED yayını birden çok seri taşıyor. TÜFE yayını hem
 * CPIAUCSL hem CPILFESL'i içeriyor; ikisi için de olay üretmek takvime aynı
 * güne iki özdeş satır koyardı. Yayının kendisi bir takvim olayıdır, içindeki
 * her seri değil.
 *
 * Seri kimlikleri MACRO_SERIES'te zaten üretimde kullanılanlardan seçildi;
 * doğrulanmamış yeni bir kimlik eklenmedi.
 */
const CALENDAR_RELEASES = [
  {
    seriesId: "CPIAUCSL",
    slug: "cpi",
    /* BLS ve BEA yayınları 08:30 ET'de çıkar — bu bir kural, tahmin değil.
       FRED yalnızca tarihi veriyor, saati vermiyor. */
    timeEt: "08:30",
    titleTr: "TÜFE Enflasyon Verisi",
    titleEn: "CPI Inflation Data",
    unit: "%",
  },
  {
    seriesId: "PAYEMS",
    slug: "employment-situation",
    timeEt: "08:30",
    titleTr: "İstihdam Raporu",
    titleEn: "Employment Situation",
    unit: "bin",
  },
  {
    seriesId: "PCEPILFE",
    slug: "core-pce",
    timeEt: "08:30",
    titleTr: "Çekirdek PCE, Fed'in Baktığı Enflasyon Ölçüsü",
    titleEn: "Core PCE, the Fed's Preferred Gauge",
    unit: "%",
  },
] as const;

/** Takvim bu kadar gün ileriye doldurulur. */
const HORIZON_DAYS = 365;

export type CalendarSyncReport = {
  /** FRED'den eklenen yeni olay sayısı. */
  inserted: number;
  /** Yuvarlanan kurallı seriden eklenen olay sayısı. */
  rolling: number;
  /** Sorun yaşanan yayınlar — sessizce yutulmaz, cron raporunda görünür. */
  problems: string[];
};

/**
 * Takvimi bugünden bir yıl ileriye kadar doldurur.
 *
 * Her adım kendi hatasını yutar ve rapora yazar: FRED düşerse takvim
 * eskisi gibi çalışmaya devam eder, yalnızca uzamaz.
 */
export async function syncCalendar(
  today: string = todayEt(),
): Promise<CalendarSyncReport> {
  const report: CalendarSyncReport = {
    inserted: 0,
    rolling: 0,
    problems: [],
  };
  const horizon = addEtDays(today, HORIZON_DAYS);

  /* ---- 1. İlan edilmiş yayın tarihleri (FRED) ---- */

  // Elle işlenmiş kayıtlar önce okunur; üzerlerine yazılmayacak.
  const claimed = new Set<string>();
  try {
    const existing = await db
      .select({
        date: economicEvents.eventDate,
        seriesId: economicEvents.fredSeriesId,
      })
      .from(economicEvents)
      .where(
        and(
          gte(economicEvents.eventDate, today),
          lte(economicEvents.eventDate, horizon),
          inArray(
            economicEvents.fredSeriesId,
            CALENDAR_RELEASES.map((r) => r.seriesId),
          ),
        ),
      );
    for (const row of existing) {
      if (row.seriesId) claimed.add(`${row.seriesId}|${row.date}`);
    }
  } catch (error) {
    report.problems.push(
      `mevcut kayıtlar okunamadı: ${message(error)} — güvenli tarafta kalmak için FRED adımı atlandı`,
    );
    // Neyin zaten var olduğunu bilmeden yazmak çift kayıt üretir.
    return finishWithRolling(report, today);
  }

  for (const release of CALENDAR_RELEASES) {
    try {
      const found = await getSeriesRelease(release.seriesId);
      if (!found.ok) {
        report.problems.push(`${release.slug}: ${found.message}`);
        continue;
      }

      const dates = await getReleaseDates(found.data.id, today, horizon);
      if (!dates.ok) {
        report.problems.push(`${release.slug}: ${dates.message}`);
        continue;
      }

      const rows = dates.data
        // FRED geçmiş tarihleri de dönebiliyor; takvim ileriye bakar.
        .filter((date) => date >= today && date <= horizon)
        .filter((date) => !claimed.has(`${release.seriesId}|${date}`))
        .map((date) => ({
          eventDate: date,
          eventTimeEt: release.timeEt,
          slug: `fred-${release.slug}-${date}`,
          titleTr: release.titleTr,
          titleEn: release.titleEn,
          importance: "high" as const,
          unit: release.unit,
          fredSeriesId: release.seriesId,
          source: "fred-release",
        }));

      if (rows.length === 0) continue;

      // Aynı slug ikinci kez gelirse dokunma — bu iş her gün tekrar koşuyor.
      await db.insert(economicEvents).values(rows).onConflictDoNothing({
        target: [economicEvents.slug, economicEvents.eventDate],
      });
      report.inserted += rows.length;
    } catch (error) {
      report.problems.push(`${release.slug}: ${message(error)}`);
    }
  }

  return finishWithRolling(report, today);
}

/**
 * Kurala bağlı seriler — haftalık işsizlik başvuruları.
 *
 * Bunlar için FRED'e gitmeye gerek yok: "her Perşembe 08:30 ET" bir kural.
 * Tohumdaki üreteç burada da kullanılıyor ki tek bir tanım olsun.
 */
async function finishWithRolling(
  report: CalendarSyncReport,
  today: string,
): Promise<CalendarSyncReport> {
  try {
    const rows = joblessClaimsEvents(today, 52).map((event) => ({
      eventDate: event.eventDate,
      eventTimeEt: event.eventTimeEt,
      slug: event.slug,
      titleTr: event.titleTr,
      titleEn: event.titleEn,
      importance: event.importance,
      unit: event.unit,
      fredSeriesId: event.fredSeriesId,
      source: event.source,
    }));

    await db.insert(economicEvents).values(rows).onConflictDoNothing({
      target: [economicEvents.slug, economicEvents.eventDate],
    });
    report.rolling = rows.length;
  } catch (error) {
    report.problems.push(`işsizlik başvuruları: ${message(error)}`);
  }
  return report;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "bilinmeyen hata";
}

/**
 * Takvimde kaç gün ileriye kadar YÜKSEK ÖNEMLİ olay var.
 *
 * Cron raporunda görünür: sayı küçülmeye başladıysa senkron çalışmıyor
 * demektir ve bunu takvim tamamen boşalmadan önce görmek gerekir.
 */
export async function calendarRunwayDays(
  today: string = todayEt(),
): Promise<number> {
  try {
    const [row] = await db
      .select({ furthest: sql<string | null>`max(${economicEvents.eventDate})` })
      .from(economicEvents)
      .where(
        and(
          gte(economicEvents.eventDate, today),
          eq(economicEvents.importance, "high"),
        ),
      );

    if (!row?.furthest) return 0;
    return Math.round(
      (Date.parse(`${row.furthest}T00:00:00Z`) -
        Date.parse(`${today}T00:00:00Z`)) /
        86400000,
    );
  } catch {
    return 0;
  }
}
