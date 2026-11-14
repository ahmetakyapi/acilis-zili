import test from "node:test";
import assert from "node:assert/strict";
import { economicEventSeeds } from "../db/seed/economic-events";
import {
  EVENT_PAGES,
  EVENT_PAGE_SLUGS,
  eventOccurrences,
  eventPage,
  eventPageForGlossary,
  matchesEventPage,
  occurrenceYears,
  recentReleases,
  upcomingOccurrences,
  type EventLike,
} from "../lib/event-pages";
import { glossaryTerm } from "../content/glossary";
import { guideArticle } from "../content/guide";
import tr from "../lib/i18n/dictionaries/tr";
import en from "../lib/i18n/dictionaries/en";
import { fill, longDate, seasonHours, trLocative } from "../lib/market-answers";

/**
 * Olay sayfalarının takvim satırlarıyla eşleşmesi. Tohumun GERÇEK satırları
 * kullanılıyor: tohumdaki slug kalıbı değişirse eşleşme burada düşer.
 */

const row = (over: Partial<EventLike> & Pick<EventLike, "slug" | "eventDate">): EventLike => ({
  eventTimeEt: "08:30",
  titleTr: "x",
  titleEn: "x",
  actual: null,
  forecast: null,
  previous: null,
  unit: "%",
  fredSeriesId: null,
  ...over,
});

const SEED: EventLike[] = economicEventSeeds("2026-11-14").map((event) => ({
  slug: event.slug,
  eventDate: event.eventDate,
  eventTimeEt: event.eventTimeEt,
  titleTr: event.titleTr,
  titleEn: event.titleEn,
  actual: null,
  forecast: null,
  previous: null,
  unit: event.unit,
  fredSeriesId: event.fredSeriesId,
}));

const fomc = eventPage("fomc")!;
const tufe = eventPage("tufe")!;
const nfp = eventPage("tarim-disi-istihdam")!;
const pce = eventPage("pce")!;

test("küratörlü liste: dört sayfa, liste dışı adres yok", () => {
  assert.deepEqual([...EVENT_PAGE_SLUGS], ["fomc", "tufe", "tarim-disi-istihdam", "pce"]);
  assert.equal(eventPage("gsyh"), null);
  assert.equal(eventPage("FOMC"), null);
  assert.equal(eventPage(""), null);
});

test("her sayfanın sözlük terimi ve rehber yazıları iki dilde var", () => {
  for (const page of EVENT_PAGES) {
    for (const locale of ["tr", "en"]) {
      assert.ok(glossaryTerm(page.glossary, locale), `${page.slug}: sözlük ${page.glossary} (${locale})`);
      for (const guide of page.guides) {
        assert.ok(guideArticle(guide, locale), `${page.slug}: rehber ${guide} (${locale})`);
      }
    }
    assert.equal(eventPageForGlossary(page.glossary)?.slug, page.slug);
  }
  assert.equal(eventPageForGlossary("temettu"), null);
});

test("tohum satırları: aile anahtarı doğru olayı seçer, kardeşini seçmez", () => {
  assert.equal(matchesEventPage(fomc, { slug: "fomc-rate-2026-12-09", fredSeriesId: "DFEDTARU" }), true);
  assert.equal(matchesEventPage(fomc, { slug: "fomc-presser-2026-12-09", fredSeriesId: null }), false);
  assert.equal(matchesEventPage(fomc, { slug: "fomc-sep-2026-12-09", fredSeriesId: null }), false);
  assert.equal(matchesEventPage(tufe, { slug: "cpi-2026-12-10", fredSeriesId: "CPIAUCSL" }), true);
  assert.equal(matchesEventPage(tufe, { slug: "core-cpi-2026-12-10", fredSeriesId: "CPILFESL" }), false);
  assert.equal(matchesEventPage(nfp, { slug: "nfp-2026-12-04", fredSeriesId: "PAYEMS" }), true);
  assert.equal(matchesEventPage(nfp, { slug: "unemployment-2026-12-04", fredSeriesId: "UNRATE" }), false);
  assert.equal(matchesEventPage(nfp, { slug: "jobless-claims-2026-12-03", fredSeriesId: "ICSA" }), false);
});

test("FRED eşitlemesinin slug'ları ve tarihsiz slug da eşleşir", () => {
  assert.equal(matchesEventPage(tufe, { slug: "fred-cpi-2027-02-10", fredSeriesId: "CPIAUCSL" }), true);
  assert.equal(matchesEventPage(nfp, { slug: "fred-employment-situation-2027-02-05", fredSeriesId: "PAYEMS" }), true);
  assert.equal(matchesEventPage(pce, { slug: "fred-core-pce-2026-11-25", fredSeriesId: "PCEPILFE" }), true);
  /* Tarih eki olmayan slug (şemanın örneği: "cpi"). */
  assert.equal(matchesEventPage(tufe, { slug: "cpi", fredSeriesId: null }), true);
  /* Slug öneki değişse de seri kimliği yakalar. */
  assert.equal(matchesEventPage(pce, { slug: "bea-pce-2027-01-29", fredSeriesId: "PCEPILFE" }), true);
  /* İkisi de tutmuyorsa eşleşme yok. */
  assert.equal(matchesEventPage(pce, { slug: "bea-gdp-2027-01-29", fredSeriesId: "GDPC1" }), false);
});

test("tohumdan FOMC: 14 Kasım 2026'dan sonra sıradaki 9 Aralık, nokta grafiğiyle", () => {
  const list = eventOccurrences(fomc, SEED);
  assert.equal(list.length, 11);
  const now = new Date("2026-11-14T12:00:00Z");
  const upcoming = upcomingOccurrences(list, now);
  assert.equal(upcoming[0]?.eventDate, "2026-12-09");
  assert.equal(upcoming[0]?.eventTimeEt, "14:00");
  assert.equal(upcoming[0]?.projections, true);
  assert.equal(upcoming[1]?.eventDate, "2027-01-27");
  assert.equal(upcoming[1]?.projections, false);
  assert.deepEqual(occurrenceYears(upcoming), [2026, 2027]);
  /* Tohum gerçekleşen değer taşımaz: "son açıklamalar" bölümü basılmaz. */
  assert.deepEqual(recentReleases(list, now), []);
});

test("tohumdan TÜFE ve istihdam: gün başına tek satır, sıradaki tarihler", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const cpi = upcomingOccurrences(eventOccurrences(tufe, SEED), now);
  assert.deepEqual(cpi.map((e) => e.eventDate), ["2026-12-10"]);
  const jobs = upcomingOccurrences(eventOccurrences(nfp, SEED), now);
  assert.deepEqual(jobs.map((e) => e.eventDate), ["2026-12-04", "2027-01-08"]);
  /* PCE tohumda yok; FRED eşitlemesiyle gelir. Boş liste uydurma tarih üretmez. */
  assert.deepEqual(eventOccurrences(pce, SEED), []);
  assert.deepEqual(occurrenceYears([]), []);
});

test("aynı günün iki satırı tek satıra iner: değeri olan kalır", () => {
  const list = eventOccurrences(tufe, [
    row({ slug: "fred-cpi-2026-10-14", eventDate: "2026-10-14", fredSeriesId: "CPIAUCSL" }),
    row({ slug: "cpi-2026-10-14", eventDate: "2026-10-14", fredSeriesId: "CPIAUCSL", actual: "3.0" }),
    row({ slug: "cpi-2026-09-11", eventDate: "2026-09-11" }),
    row({ slug: "fred-cpi-2026-09-11", eventDate: "2026-09-11" }),
  ]);
  assert.deepEqual(list.map((e) => e.slug), ["cpi-2026-09-11", "cpi-2026-10-14"]);
  assert.equal(list[1]?.actual, "3.0");
});

test("açıklama anı: saatinden önce yaklaşan, sonra değeri varsa son açıklama", () => {
  const list = eventOccurrences(tufe, [
    row({ slug: "cpi-2026-08-12", eventDate: "2026-08-12", actual: "2.9", forecast: "3.0", previous: "3.1" }),
    row({ slug: "cpi-2026-09-11", eventDate: "2026-09-11", actual: "3.1" }),
    row({ slug: "cpi-2026-10-14", eventDate: "2026-10-14", actual: "3.0" }),
    row({ slug: "cpi-2026-11-10", eventDate: "2026-11-10", actual: "3.2" }),
    /* Geçmiş ama değeri gelmemiş: son açıklamalara girmez. */
    row({ slug: "cpi-2026-11-12", eventDate: "2026-11-12", actual: "—" }),
    row({ slug: "cpi-2026-12-10", eventDate: "2026-12-10" }),
  ]);
  /* 10 Aralık 08:30 ET = 13:30 UTC. */
  const before = new Date("2026-12-10T13:29:00Z");
  const after = new Date("2026-12-10T13:31:00Z");
  assert.deepEqual(upcomingOccurrences(list, before).map((e) => e.eventDate), ["2026-12-10"]);
  assert.deepEqual(upcomingOccurrences(list, after), []);
  assert.deepEqual(
    recentReleases(list, before).map((e) => e.eventDate),
    ["2026-11-10", "2026-10-14", "2026-09-11"],
  );
  /* Saati ilan edilmemiş olay gün bitene dek "geçti" sayılmaz. */
  const untimed = eventOccurrences(tufe, [row({ slug: "cpi-2026-12-10", eventDate: "2026-12-10", eventTimeEt: null })]);
  assert.equal(upcomingOccurrences(untimed, new Date("2026-12-10T20:00:00Z")).length, 1);
  assert.equal(upcomingOccurrences(untimed, new Date("2026-12-11T06:00:00Z")).length, 0);
});

/* Künye ölçüleri (14 Kasım SEO denetimi): başlık + " · Marka" ≤ 65,
   açıklama 110–160. Açıklama tarihi taşıdığı için uzunluk aya göre oynar;
   kısa ve uzun ay adlarıyla sınanır ki eylülde arama sonucu kesilmesin. */
test("olay sayfası künyeleri: başlık markayla ≤ 65, açıklama her ayda 110–160", () => {
  for (const { locale, t } of [
    { locale: "tr" as const, t: tr },
    { locale: "en" as const, t: en },
  ]) {
    const brand = ` · ${t.brand.name}`;
    for (const page of EVENT_PAGES) {
      const copy = t.eventPages.pages[page.slug];
      const title = fill(copy.metaTitle, { years: `2026${t.eventPages.yearJoin}2027` });
      assert.ok((title + brand).length <= 65, `${locale} ${page.slug} başlık ${(title + brand).length}: ${title}`);
      assert.ok((copy.metaTitleBare + brand).length <= 65, `${locale} ${page.slug} yılsız başlık`);
      for (const date of ["2027-05-05", "2027-09-15", "2027-08-12"]) {
        const text = fill(copy.metaDescription, { date: longDate(date, locale), time: "16:30" });
        assert.ok(text.length >= 110 && text.length <= 160, `${locale} ${page.slug} açıklama ${text.length}: ${text}`);
      }
      const bare = copy.metaDescriptionBare.length;
      assert.ok(bare >= 110 && bare <= 160, `${locale} ${page.slug} tarihsiz açıklama ${bare}`);
    }
  }
});

test("saat ve tatil sayfası künyeleri: başlık markayla ≤ 65, açıklama 110–160", () => {
  for (const { locale, t } of [
    { locale: "tr" as const, t: tr },
    { locale: "en" as const, t: en },
  ]) {
    const brand = ` · ${t.brand.name}`;
    const season = seasonHours(2026)!;
    const range = (h: typeof season.summer) => `${h.open.tr}–${h.close.tr}`;
    const texts = [
      fill(t.marketHours.metaDescription, { summer: range(season.summer), winter: range(season.winter) }),
      fill(t.marketHours.metaDescriptionSingle, { hours: range(season.winter) }),
      fill(t.marketHolidays.metaDescription, {
        yearsIn: locale === "tr" ? `2026 ve 2027'${trLocative(2027)}` : "2026 and 2027",
      }),
      t.marketHolidays.metaDescriptionBare,
    ];
    for (const text of texts) {
      assert.ok(text.length >= 110 && text.length <= 160, `${locale} açıklama ${text.length}: ${text}`);
    }
    const titles = [
      t.marketHours.metaTitle,
      fill(t.marketHolidays.metaTitle, { years: `2026${t.marketHolidays.yearJoin}2027` }),
    ];
    for (const title of titles) {
      assert.ok((title + brand).length <= 65, `${locale} başlık ${(title + brand).length}: ${title}`);
    }
  }
  /* Sahibinin verdiği kalıp, harfi harfine. */
  assert.equal(
    fill(tr.marketHolidays.metaDescription, { yearsIn: `2026 ve 2027'${trLocative(2027)}` }),
    "ABD borsaları (NYSE, Nasdaq) 2026 ve 2027'de hangi günler kapalı, hangi günler erken kapanıyor? Yarım günlerin Türkiye saatiyle kapanışı ve sıradaki tatil.",
  );
});
