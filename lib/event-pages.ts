import { eventFamily, hasActual } from "./day-flow";
import { etDateTimeToUtc } from "./market-hours";

/**
 * Takvim olay sayfaları — `/takvim/fomc`, `/takvim/tufe`,
 * `/takvim/tarim-disi-istihdam`, `/takvim/pce` (14 Kasım 2026, SEO denetimi).
 *
 * "FOMC toplantısı ne zaman", "ABD enflasyon verisi ne zaman açıklanacak"
 * sorularının kendi adresi yoktu: cevap `/takvim`in haftalık görünümünde,
 * o haftaya denk gelirse duruyordu. Bu dosya KÜRATÖRLÜ listeyi ve olayın
 * takvim satırlarıyla eşleşmesini tutar; liste dışı adres `notFound()`.
 *
 * EŞLEŞME İKİ ANAHTARLA, AD KALIBIYLA DEĞİL. Aynı olay takvime iki yoldan
 * giriyor ve slug'ları farklı:
 *   - tohum (`db/seed/economic-events.ts`): `cpi-2026-11-10`,
 *     `fomc-rate-2026-12-09`, `nfp-2026-12-04`
 *   - günlük FRED eşitlemesi (`lib/calendar-sync.ts`): `fred-cpi-…`,
 *     `fred-employment-situation-…`, `fred-core-pce-…`
 * Başlıklar da farklı ("Kasım TÜFE Verisi" / "TÜFE Enflasyon Verisi"), yani
 * başlık kalıbı kırılgan olurdu. Birincil anahtar slug'ın tarihsiz ailesi
 * (`eventFamily`), yedek anahtar olayın FRED serisi: eşitlemeye yeni bir
 * slug öneki girse de seri kimliği aynı kalır. Seri yalnız TEMSİLCİ olaya
 * ait olanlardan seçildi (çekirdek TÜFE `CPILFESL`, işsizlik `UNRATE` ayrı
 * seriler; onlar bu sayfalara düşmez).
 */

export type EventPageSlug = "fomc" | "tufe" | "tarim-disi-istihdam" | "pce";

export type EventPageDef = {
  /** Adresteki parça ve sözlük anahtarı. */
  slug: EventPageSlug;
  /** Takvim slug'ının tarihsiz ailesi (`eventFamily`). */
  families: readonly string[];
  /** Yedek anahtar: olayın gerçekleşen değerini taşıyan FRED serisi. */
  seriesIds: readonly string[];
  /** İlgili sözlük terimi (`/sozluk/[terim]`). */
  glossary: string;
  /** İlgili rehber yazıları (`/rehber/[slug]`) — `GuideHint` çift sayı ister. */
  guides: readonly [string, string];
};

export const EVENT_PAGES: readonly EventPageDef[] = [
  {
    slug: "fomc",
    families: ["fomc-rate"],
    seriesIds: ["DFEDTARU"],
    glossary: "fomc",
    guides: ["sahin-guvercin", "faiz-tahvil"],
  },
  {
    slug: "tufe",
    families: ["cpi", "fred-cpi"],
    seriesIds: ["CPIAUCSL"],
    glossary: "tufe",
    guides: ["enflasyon", "faiz-tahvil"],
  },
  {
    slug: "tarim-disi-istihdam",
    families: ["nfp", "fred-employment-situation"],
    seriesIds: ["PAYEMS"],
    glossary: "tarim-disi-istihdam",
    guides: ["istihdam", "sahin-guvercin"],
  },
  {
    slug: "pce",
    families: ["core-pce", "fred-core-pce"],
    seriesIds: ["PCEPILFE"],
    glossary: "pce",
    guides: ["enflasyon", "sahin-guvercin"],
  },
];

export const EVENT_PAGE_SLUGS: readonly EventPageSlug[] = EVENT_PAGES.map((page) => page.slug);

/** Adres parçasından sayfa tanımı; listede yoksa `null` (→ `notFound()`). */
export function eventPage(slug: string): EventPageDef | null {
  return EVENT_PAGES.find((page) => page.slug === slug) ?? null;
}

/** Sözlük teriminin olay sayfası (`/sozluk/fomc` → `/takvim/fomc`). */
export function eventPageForGlossary(term: string): EventPageDef | null {
  return EVENT_PAGES.find((page) => page.glossary === term) ?? null;
}

/** Eşleşmenin baktığı alanlar — `EconomicEventRow`un alt kümesi. */
export type EventLike = {
  slug: string;
  eventDate: string;
  eventTimeEt: string | null;
  titleTr: string;
  titleEn: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  fredSeriesId: string | null;
};

/** Bu takvim satırı o sayfanın olayı mı. */
export function matchesEventPage(
  page: EventPageDef,
  event: Pick<EventLike, "slug" | "fredSeriesId">,
): boolean {
  if (page.families.includes(eventFamily(event.slug))) return true;
  return event.fredSeriesId !== null && page.seriesIds.includes(event.fredSeriesId);
}

export type Occurrence = EventLike & {
  /** FOMC: aynı gün ekonomik projeksiyon (nokta grafiği) da yayımlanıyor. */
  projections: boolean;
};

/**
 * Sayfanın olayları, tarihe göre; gün başına TEK satır.
 *
 * Tohum ile eşitleme aynı günü iki ayrı slug'la yazabilir (eşitleme "aynı
 * seri + aynı gün"ü atlıyor ama seri kimliği sonradan boşaltılmış bir satır
 * bunu delebilir). İki satırdan gerçekleşen değeri olan, o da eşitse sayfa
 * tanımında önce yazılan aile kalır.
 */
export function eventOccurrences(page: EventPageDef, rows: readonly EventLike[]): Occurrence[] {
  const projectionDays = new Set(
    rows.filter((row) => eventFamily(row.slug) === "fomc-sep").map((row) => row.eventDate),
  );
  const rank = (row: EventLike) => {
    const family = page.families.indexOf(eventFamily(row.slug));
    return (hasActual(row.actual) ? 0 : 100) + (family === -1 ? 50 : family);
  };
  const byDay = new Map<string, EventLike>();
  for (const row of rows) {
    if (!matchesEventPage(page, row)) continue;
    const kept = byDay.get(row.eventDate);
    if (!kept || rank(row) < rank(kept)) byDay.set(row.eventDate, row);
  }
  return [...byDay.values()]
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .map((row) => ({ ...row, projections: page.slug === "fomc" && projectionDays.has(row.eventDate) }));
}

/** Açıklama anı. Saati ilan edilmemiş olayda günün SONU: gün bitmeden
 *  "geçti" denmez (uydurma kesinlik yok). */
function releaseAt(event: Pick<EventLike, "eventDate" | "eventTimeEt">): number {
  return etDateTimeToUtc(event.eventDate, event.eventTimeEt ?? "23:59").getTime();
}

/** Henüz açıklanmamış olaylar: anı gelecekte olanlar, yakından uzağa. */
export function upcomingOccurrences(list: readonly Occurrence[], now: Date): Occurrence[] {
  const nowMs = now.getTime();
  return list.filter((event) => releaseAt(event) > nowMs);
}

/**
 * Son açıklamalar: anı geçmiş VE gerçekleşen değeri olanlar, yeniden eskiye.
 * Değeri gelmemiş geçmiş satır alınmaz — "son üç açıklama" bölümü yalnız
 * veride karşılığı varsa basılır.
 */
export function recentReleases(list: readonly Occurrence[], now: Date, limit = 3): Occurrence[] {
  const nowMs = now.getTime();
  return list
    .filter((event) => releaseAt(event) <= nowMs && hasActual(event.actual))
    .reverse()
    .slice(0, limit);
}

/** Yaklaşan olayların kapsadığı takvim yılları (en çok iki): başlıktaki
 *  "2026–2027" buradan, veriden. */
export function occurrenceYears(upcoming: readonly Occurrence[], limit = 2): number[] {
  return [...new Set(upcoming.map((event) => Number(event.eventDate.slice(0, 4))))]
    .sort((a, b) => a - b)
    .slice(0, limit);
}
