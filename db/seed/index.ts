import { config } from "dotenv";

config({ path: ".env.local" });

import { db } from "../../lib/db";
import {
  economicEvents,
  macroSeries,
  marketHolidays,
  stories,
  symbols as symbolsTable,
} from "../../lib/schema";
import { MACRO_SERIES } from "../../lib/providers/fred";
import { MARKET_HOLIDAYS } from "./holidays";
import { economicEventSeeds } from "./economic-events";
import { STORY_SEEDS } from "./stories";
import { ALL_SYMBOL_SEEDS } from "./symbols";

/**
 * Seed idempotenttir: tekrar çalıştırmak veriyi bozmaz.
 * Kullanıcı verisine (users, watchlists) dokunmaz.
 */
async function main() {
  console.log("Seed başlıyor…\n");

  // ---- Tatiller ----
  for (const holiday of MARKET_HOLIDAYS) {
    await db
      .insert(marketHolidays)
      .values(holiday)
      .onConflictDoUpdate({
        target: marketHolidays.date,
        set: {
          nameTr: holiday.nameTr,
          nameEn: holiday.nameEn,
          earlyCloseEt: holiday.earlyCloseEt,
        },
      });
  }
  console.log(`  tatiller           ${MARKET_HOLIDAYS.length} kayıt`);

  // ---- Ekonomik takvim ----
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
  console.log(`  ekonomik olaylar   ${events.length} kayıt`);

  // ---- Semboller ----
  for (const seed of ALL_SYMBOL_SEEDS) {
    await db
      .insert(symbolsTable)
      .values({
        symbol: seed.symbol,
        name: seed.name,
        isIndexProxy: seed.isIndexProxy ?? false,
      })
      .onConflictDoUpdate({
        target: symbolsTable.symbol,
        set: { isIndexProxy: seed.isIndexProxy ?? false },
      });
  }
  console.log(`  semboller          ${ALL_SYMBOL_SEEDS.length} kayıt`);

  // ---- Makro seri tanımları (değerler cron ile dolar) ----
  for (const series of MACRO_SERIES) {
    await db
      .insert(macroSeries)
      .values({
        seriesId: series.seriesId,
        slug: series.slug,
        titleTr: series.titleTr,
        titleEn: series.titleEn,
        unit: series.unit,
      })
      .onConflictDoUpdate({
        target: macroSeries.seriesId,
        set: {
          slug: series.slug,
          titleTr: series.titleTr,
          titleEn: series.titleEn,
          unit: series.unit,
        },
      });
  }
  console.log(`  makro seriler      ${MACRO_SERIES.length} kayıt`);

  /* ---- Açılış yazısı ----
     Tablonun asıl sahibi Claude rutini; burada yalnızca ilk kayıt var ki
     boş veritabanında /mercek ekranı gerçek bir örnekle açılsın. Rutinin
     yazdıkları farklı slug kullandığı için bu döngü onlara dokunmaz;
     kendi kaydının üzerine yazar, çünkü metin depoda düzenleniyor. */
  for (const story of STORY_SEEDS) {
    const values = {
      slug: story.slug,
      locale: story.locale,
      title: story.title,
      dek: story.dek,
      bodyMd: story.bodyMd,
      eventDate: story.eventDate,
      symbols: story.symbols,
      sources: story.sources,
      // Türkçe metinde 160 kelime/dk — ArticleBody ile aynı sabit.
      readMinutes: Math.max(
        1,
        Math.round(story.bodyMd.trim().split(/\s+/).length / 160),
      ),
      generatedBy: "seed",
    };
    await db
      .insert(stories)
      .values(values)
      .onConflictDoUpdate({
        target: [stories.slug, stories.locale],
        set: { ...values, updatedAt: new Date() },
      });
  }
  console.log(`  mercek yazıları   ${STORY_SEEDS.length} kayıt`);

  console.log("\nSeed tamamlandı.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed başarısız:", error);
    process.exit(1);
  });
