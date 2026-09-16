import { db } from "../../lib/db";
import { economicEvents } from "../../lib/schema";
import {
  COVERAGE_WARN_DAYS,
  economicEventSeeds,
  manualCoverage,
} from "./economic-events";

/**
 * Ekonomik takvim adımı — TEK YERDE.
 *
 * Hem tam seed (`index.ts`) hem de yalnız bu adımı koşan giriş
 * (`events-only.ts`) buradan okuyor. Ayrı bir giriş olmasının sebebi
 * `stories`: tam seed o tabloya da yazıyor ve bir mercek yazısının gövdesini
 * seed sürümüyle DEĞİŞTİRİYOR. Seed `lib/content-write.ts`ten geçmediği için
 * `story_revisions`a fotoğraf da düşmüyor, yani o yazı panelden ya da
 * rutinden düzenlendiyse geri dönüşü yok. Oysa çoğu zaman istenen şey
 * yalnızca takvimin tazelenmesi — başlık düzeltmesi, yeni FOMC tarihleri.
 * O iş için bütün tabloları riske atmak gerekmiyor.
 *
 * Bu adım idempotent ve yalnızca `economic_events` tablosuna dokunuyor.
 * `actual`, `forecast` ve `previous` DEĞERLERİNE ELLENMİYOR: onlar sağlayıcıdan
 * geliyor ve seed'in bildiği bir şey değil.
 */
export async function seedEconomicEvents(): Promise<number> {
  const events = economicEventSeeds();
  for (const event of events) {
    await db
      .insert(economicEvents)
      .values({
        eventDate: event.eventDate,
        eventTimeEt: event.eventTimeEt,
        slug: event.slug,
        titleTr: event.titleTr,
        titleEn: event.titleEn,
        importance: event.importance,
        unit: event.unit,
        fredSeriesId: event.fredSeriesId,
        source: event.source,
      })
      .onConflictDoUpdate({
        target: [economicEvents.slug, economicEvents.eventDate],
        set: {
          eventTimeEt: event.eventTimeEt,
          titleTr: event.titleTr,
          titleEn: event.titleEn,
          importance: event.importance,
          updatedAt: new Date(),
        },
      });
  }
  return events.length;
}

/**
 * Elle bakımı gereken takvimlerin ne kadar ömrü kaldığını yazar.
 *
 * CPI, FOMC ve istihdam tarihleri kurala bağlı değil, ilan edilmiş
 * takvimlerden elle işleniyor — bir gün bitiyorlar ve bittiklerinde takvim
 * sessizce boşalıyor. Bu satırlar o sessizliği kırıyor.
 */
export function reportCoverage(): void {
  const coverage = manualCoverage();
  const short = coverage.filter((c) => c.daysLeft < COVERAGE_WARN_DAYS);

  for (const entry of coverage) {
    const mark = entry.daysLeft < COVERAGE_WARN_DAYS ? "!" : " ";
    console.log(
      `   ${mark} ${entry.label.padEnd(16)} son tarih ${entry.lastDate ?? "—"} (${entry.daysLeft} gün)`,
    );
  }

  if (short.length > 0) {
    console.log(
      `\n  UYARI: ${short.map((c) => c.label).join(", ")} takvimi ${COVERAGE_WARN_DAYS} günden az kaldı.` +
        `\n  Yeni tarihleri db/seed/economic-events.ts içine işle:` +
        `\n    TÜFE ve istihdam → bls.gov/schedule/news_release/` +
        `\n    FOMC             → federalreserve.gov/monetarypolicy/fomccalendars.htm`,
    );
  }
}
