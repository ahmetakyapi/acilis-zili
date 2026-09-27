import "server-only";

import { getEventsBetweenResult, getMacroRows } from "@/lib/data";
import { addEtDays, etDateTimeToUtc, todayEt } from "@/lib/market-hours";
import {
  MACRO_SERIES,
  getSeries,
  type MacroSeriesDefinition,
} from "@/lib/providers/fred";
import type { MacroObservation } from "@/lib/providers/types";
import type { MacroSeriesRow } from "@/lib/schema";

/**
 * /makro ekranının satırları — tablo + canlı yedek.
 *
 * SERİ LİSTESİ KODDA, DEĞERLER TABLODA. `macro_series` satırlarını tohum
 * açıyor, cron dolduruyor (app/api/cron/daily). Yeni bir seri koda
 * eklendiğinde tohum koşana kadar tablosunda satırı YOK ve cron da
 * yalnızca var olan satırı güncelliyor (`update`, `upsert` değil) — yani
 * sayfa tablodan okusaydı yeni seri tohuma kadar hiç görünmezdi.
 * Migration'lar ve tohum deploy'da koşmuyor (CLAUDE.md), yani bu pencere
 * günlerce açık kalabilir.
 *
 * Kural: tabloda satırı olmayan ya da değeri boş kalan her seri FRED'den
 * canlı okunur ve kartı yine basılır. Damga o zaman çekim anını yazar.
 * Tablonun okunamadığı durumda da aynı yol: sayfa altı kartla değil
 * canlı değerlerle açılır.
 */

export type MacroBoardRow = {
  definition: MacroSeriesDefinition;
  titleTr: string;
  titleEn: string;
  unit: string;
  latestValue: number | null;
  prevValue: number | null;
  periodLabel: string | null;
  observations: MacroObservation[];
  /** Son gözlemin tarihi — haftalık ve günlük serilerin künyesi. */
  observedAt: string | null;
  nextReleaseAt: string | null;
  updatedAt: Date;
  /** Tablodan değil canlı FRED'den geldi. */
  live: boolean;
};

/** Kartın grafiği ve tablo satırı aynı pencere: son 60 gözlem (şema yorumu). */
const LIVE_OBSERVATIONS = 60;

function fromRow(definition: MacroSeriesDefinition, row: MacroSeriesRow): MacroBoardRow {
  const observations = ((row.observations as MacroObservation[] | null) ?? [])
    .filter((point) => Number.isFinite(point.value))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    definition,
    titleTr: row.titleTr,
    titleEn: row.titleEn,
    unit: row.unit ?? definition.unit,
    latestValue: row.latestValue,
    prevValue: row.prevValue,
    periodLabel: row.periodLabel,
    observations,
    observedAt: observations.at(-1)?.date ?? null,
    nextReleaseAt: row.nextReleaseAt,
    updatedAt: row.updatedAt,
    live: false,
  };
}

async function fromLive(definition: MacroSeriesDefinition): Promise<MacroBoardRow | null> {
  const result = await getSeries(definition, LIVE_OBSERVATIONS);
  if (!result.ok) return null;
  return {
    definition,
    titleTr: definition.titleTr,
    titleEn: definition.titleEn,
    unit: definition.unit,
    latestValue: result.data.latestValue,
    prevValue: result.data.prevValue,
    periodLabel: result.data.periodLabel,
    observations: result.data.observations,
    observedAt: result.data.observations.at(-1)?.date ?? null,
    nextReleaseAt: null,
    updatedAt: result.fetchedAt,
    live: true,
  };
}

/**
 * Kod sırasıyla (MACRO_SERIES): enflasyon, iş gücü, politika, sonra ikinci
 * halka. Tablo slug'a göre alfabetik dönüyordu; sıra bir sunum niyeti
 * taşımıyordu (aynı gözlem ana sayfanın `MACRO_HOME_SLUGS` yorumunda).
 */
export async function getMacroBoard(): Promise<MacroBoardRow[]> {
  const rows = await getMacroRows();
  const bySeries = new Map(rows.map((row) => [row.seriesId, row]));
  const resolved = await Promise.all(
    MACRO_SERIES.map(async (definition) => {
      const row = bySeries.get(definition.seriesId);
      if (row && row.latestValue !== null && row.observations) return fromRow(definition, row);
      return fromLive(definition);
    }),
  );
  return resolved.filter((row): row is MacroBoardRow => row !== null);
}

/* ---- Sonraki FOMC ---- */

/**
 * FOMC toplantıları arası en çok ~8 hafta; pencere bir çeyrek. Takvimde
 * bu pencerede toplantı yoksa tohum eskimiştir (FOMC elle işleniyor,
 * db/seed/economic-events.ts) ve kart tarih UYDURMAZ, hiç basılmaz.
 */
const FOMC_LOOKAHEAD_DAYS = 120;
const FOMC_SLUG_PREFIX = "fomc-rate-";

/** Fed'in hedef aralığının iki ucu — günlük seriler. */
const TARGET_UPPER = { seriesId: "DFEDTARU", slug: "fed-target-upper", units: "lin" };
const TARGET_LOWER = { seriesId: "DFEDTARL", slug: "fed-target-lower", units: "lin" };
const TARGET_OBSERVATIONS = 5;

export type NextFomc = {
  date: string;
  timeEt: string | null;
  /** Aynı toplantıda projeksiyonlar (nokta grafiği) da açıklanıyor mu. */
  withProjections: boolean;
  target: { lower: number; upper: number; date: string; fetchedAt: Date } | null;
};

export async function getNextFomc(now: Date = new Date()): Promise<NextFomc | null> {
  const today = todayEt(now);
  const [events, upper, lower] = await Promise.all([
    getEventsBetweenResult(today, addEtDays(today, FOMC_LOOKAHEAD_DAYS)),
    getSeries(TARGET_UPPER, TARGET_OBSERVATIONS),
    getSeries(TARGET_LOWER, TARGET_OBSERVATIONS),
  ]);
  if (!events.ok) return null;
  /* Bugünün toplantısı açıklandıysa (saat geçtiyse) sıradaki o değil. */
  const next = events.rows.find(
    (event) =>
      event.slug.startsWith(FOMC_SLUG_PREFIX) &&
      (event.eventDate > today || !event.eventTimeEt || etDateTimeToUtc(event.eventDate, event.eventTimeEt) > now),
  );
  if (!next) return null;
  const withProjections = events.rows.some(
    (event) => event.eventDate === next.eventDate && event.slug.startsWith("fomc-sep-"),
  );

  /* İki uç AYNI GÜNÜN gözlemi olmalı: biri güncellenip öteki bir gün
     geride kalırsa aralık iki ayrı kararın yarısından kurulurdu. */
  const upperPoint = upper.ok ? upper.data.observations.at(-1) : undefined;
  const lowerPoint = lower.ok ? lower.data.observations.at(-1) : undefined;
  const target =
    upper.ok && upperPoint && lowerPoint && upperPoint.date === lowerPoint.date
      ? { lower: lowerPoint.value, upper: upperPoint.value, date: upperPoint.date, fetchedAt: upper.fetchedAt }
      : null;

  return { date: next.eventDate, timeEt: next.eventTimeEt, withProjections, target };
}
