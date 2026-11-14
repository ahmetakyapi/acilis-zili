import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { AnswerFacts, type AnswerFact } from "@/components/answers/AnswerFacts";
import { AnswerLinks } from "@/components/answers/AnswerLinks";
import styles from "@/components/answers/Answers.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { DataStamp, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { glossaryTerm } from "@/content/glossary";
import { getEventsBetweenResult } from "@/lib/data";
import {
  eventOccurrences,
  eventPage,
  occurrenceYears,
  recentReleases,
  upcomingOccurrences,
  type EventPageDef,
  type Occurrence,
} from "@/lib/event-pages";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { fill, longDate, weekdayName } from "@/lib/market-answers";
import { addEtDays, etDateTimeToUtc, todayEt } from "@/lib/market-hours";
import { missingMetadata } from "@/lib/page-meta";
import { TR_ZONE, displayZone, formatInZone, readerDayOffset, zoneDateKey } from "@/lib/session-clock";
import { pageAlternates } from "@/lib/site";
import { NO_VALUE, formatEventValue } from "@/lib/utils";

/** Geriye bakış: "son üç açıklama" için. Aylık veride üç yayın ~90 gün,
 *  altı haftada bir toplanan FOMC'de ~130; pay bırakıldı. */
const LOOKBACK_DAYS = 200;

/**
 * Sayfanın olayları: geriye `LOOKBACK_DAYS`, ileriye gelecek yılın sonuna.
 *
 * Yeni sorgu yok: takvim ekranının okuyucusu (`getEventsBetweenResult`,
 * istek içinde `cache()`li — künye ile gövde aynı aralığı sorduğu için tek
 * sorgu). Süzme `lib/event-pages.ts`te, saf ve testli. "Okunamadı" boş
 * listeden AYRI döner: çağıran o durumda tarih yokluğu iddia etmez.
 */
async function loadOccurrences(page: EventPageDef, today: string) {
  const until = `${Number(today.slice(0, 4)) + 1}-12-31`;
  const result = await getEventsBetweenResult(addEtDays(today, -LOOKBACK_DAYS), until);
  return result.ok ? { ok: true as const, list: eventOccurrences(page, result.rows) } : { ok: false as const, list: [] };
}

/** Olayın OKUYUCUNUN takvimindeki günü: 14:00 New York kışın Türkiye'de
 *  aynı gün 22:00, ama 20:00 New York ertesi güne düşer. Saatsiz olayda
 *  New York günü. */
function readerDate(event: Occurrence, locale: Locale): string {
  return event.eventTimeEt
    ? zoneDateKey(etDateTimeToUtc(event.eventDate, event.eventTimeEt), displayZone(locale))
    : event.eventDate;
}

function trTime(event: Occurrence): string | null {
  return event.eventTimeEt ? formatInZone(etDateTimeToUtc(event.eventDate, event.eventTimeEt), TR_ZONE) : null;
}

export async function generateMetadata(props: PageProps<"/takvim/[olay]">): Promise<Metadata> {
  const { olay } = await props.params;
  const { locale, t } = await getI18n();
  const page = eventPage(olay);
  if (!page) return missingMetadata(locale);
  const L = t.eventPages;
  const copy = L.pages[page.slug];

  const loaded = await loadOccurrences(page, todayEt());
  const upcoming = upcomingOccurrences(loaded.list, new Date());
  const next = upcoming[0];
  const years = occurrenceYears(upcoming);
  const time = next ? trTime(next) : null;
  return {
    /* Yıllar yaklaşan tarihlerden; veri yoksa yılsız başlık (uydurma yok). */
    title: years.length > 0 ? fill(copy.metaTitle, { years: years.join(L.yearJoin) }) : copy.metaTitleBare,
    description:
      next && time
        ? fill(copy.metaDescription, { date: longDate(readerDate(next, locale), locale), time })
        : copy.metaDescriptionBare,
    alternates: pageAlternates(`/takvim/${page.slug}`, locale),
  };
}

/** İlk cümle: sıradaki tarih ve Türkiye saati. */
function answerSentence(
  next: Occurrence | undefined,
  ok: boolean,
  L: Dictionary["eventPages"],
  subject: string,
  locale: Locale,
  now: Date,
): string {
  if (!ok) return L.answerUnavailable;
  if (!next) return fill(L.answerNone, { subject });
  const time = trTime(next);
  const date = longDate(readerDate(next, locale), locale, { weekday: true });
  if (!time || !next.eventTimeEt) return fill(L.answerUntimed, { subject, date });
  const offset = readerDayOffset(next.eventDate, next.eventTimeEt, locale, now);
  const template = offset === 0 ? L.answerToday : offset === 1 ? L.answerTomorrow : L.answerNext;
  return fill(template, { subject, date, time, timeNy: next.eventTimeEt });
}

/**
 * /takvim/[olay] — TAKVİM OLAY SAYFALARI (14 Kasım 2026, SEO denetimi):
 * `/takvim/fomc`, `/takvim/tufe`, `/takvim/tarim-disi-istihdam`,
 * `/takvim/pce`.
 *
 * "FOMC toplantısı ne zaman", "ABD enflasyon verisi ne zaman açıklanacak"
 * sorularının cevabı `/takvim`in haftalık görünümünde, o haftaya denk
 * gelirse duruyordu; sorunun kendi adresi yoktu. Tek dinamik segment +
 * KÜRATÖRLÜ liste (`lib/event-pages.ts` → `EVENT_PAGES`): listede olmayan
 * adres `notFound()` — her takvim satırına ince bir sayfa açılmaz.
 *
 * `/takvim?tur=temettu` İLE ÇAKIŞMIYOR: o bir sorgu parametresi (görünüm,
 * ayrı rota değil — 28 Eylül kararı, `../page.tsx`); bu segment yalnız
 * yol parçasını alır.
 *
 * İLK CÜMLE sıradaki tarihi ve Türkiye saatini söyler; sunucuda hesaplanır,
 * ham HTML'de durur. Tarih OKUYUCUNUN takvim günüdür (`readerDate`), saat o
 * günün farkıyla (`formatInZone`; kışın 22:00, yazın 21:00 — sabit yazılmaz).
 *
 * VERİ DÜRÜSTLÜĞÜ. Sıradaki tarih veride yoksa uydurulmaz: cümle bunu
 * söyler, tablo basılmaz. "Son Açıklamalar" yalnız gerçekleşen değeri olan
 * geçmiş satır varsa basılır. Saati ilan edilmemiş olayda saat yazılmaz.
 * Takvim okunamadıysa "tarih yok" DENMEZ (okunamadı ≠ boş).
 *
 * SAAT SÜTUNLARI ADLARIYLA, iki dilde aynı sırada ("Türkiye Saati",
 * "New York"): sayfanın sorusu Türkiye saati. İngilizce İLK CÜMLE ise
 * sitenin kuralıyla New York'u öne alır, Türkiye saatini parantezde verir.
 *
 * Ekran sırası: yol satırı → başlık (ilk cümle) → ölçü ızgarası (tarih,
 * saat, kalan gün) → Yaklaşan Tarihler → Son Açıklamalar (varsa) → Bu
 * Açıklama Nedir (sözlük ve takvim bağlantısı) → Sık Sorulanlar →
 * DataStamp → GuideHint.
 *
 * ÖLÇÜM (yerel, tohum takvimi + sahte geçmiş değerler, 14 Kasım; TR ve EN,
 * açık ve koyu): dört sayfada 390 ve 1440'ta yatay taşma 0, tek `h1`,
 * tablo kaplarında scrollWidth − clientWidth 0.
 */
export default async function EventPage(props: PageProps<"/takvim/[olay]">) {
  const { olay } = await props.params;
  const page = eventPage(olay);
  if (!page) notFound();

  const { locale, t } = await getI18n();
  const L = t.eventPages;
  const copy = L.pages[page.slug];
  const path = `/takvim/${page.slug}`;
  const now = new Date();
  const today = todayEt(now);

  const loaded = await loadOccurrences(page, today);
  const upcoming = upcomingOccurrences(loaded.list, now);
  const recent = recentReleases(loaded.list, now);
  const next = upcoming[0];
  const term = glossaryTerm(page.glossary, locale);

  const nextTime = next ? trTime(next) : null;
  const nextOffset = next ? readerDayOffset(next.eventDate, next.eventTimeEt, locale, now) : null;
  const facts: AnswerFact[] = next
    ? [
        {
          label: L.factDate,
          value: longDate(readerDate(next, locale), locale),
          sub: weekdayName(readerDate(next, locale), locale),
        },
        {
          label: L.factTime,
          value: nextTime ?? NO_VALUE,
          sub: next.eventTimeEt ? fill(L.nyTag, { time: next.eventTimeEt }) : L.timeUnknown,
        },
        {
          label: L.factLeft,
          value:
            nextOffset === 0 ? L.today : nextOffset === 1 ? L.tomorrow : fill(L.daysLeft, { n: nextOffset ?? 0 }),
          sub: locale === "tr" ? next.titleTr : next.titleEn,
        },
      ]
    : [];

  const value = (raw: string | null, unit: string | null) => formatEventValue(raw, unit, locale) ?? NO_VALUE;

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: L.breadcrumb, path: "/takvim" },
          { name: copy.title, path },
        ]}
      />
      <nav aria-label={L.breadcrumb} className={styles.crumbs}>
        <Link href="/takvim">{L.breadcrumb}</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">{copy.title}</span>
      </nav>

      <PageHeader
        title={copy.title}
        subtitle={answerSentence(next, loaded.ok, L, copy.subject, locale, now)}
        share={<PageShare compactOnMobile align="right" path={path} title={copy.title} locale={locale} t={t} />}
      />

      <AnswerFacts label={L.factsLabel} facts={facts} />

      {upcoming.length > 0 && (
        <Panel>
          <PanelHeader title={L.datesTitle} meta={fill(L.datesCount, { n: upcoming.length })} />
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{L.colDate}</th>
                <th scope="col" className="hidden sm:table-cell">{L.colDay}</th>
                <th scope="col">{L.colTime}</th>
                <th scope="col" className="hidden sm:table-cell">{L.colNy}</th>
                <th scope="col">{L.colWhat}</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((event) => {
                const date = readerDate(event, locale);
                const time = trTime(event);
                return (
                  <tr key={event.slug + event.eventDate}>
                    <td data-strong data-num>
                      {longDate(date, locale)}
                      <span className={styles.subPhone}>{weekdayName(date, locale)}</span>
                    </td>
                    <td className="hidden sm:table-cell">{weekdayName(date, locale)}</td>
                    <td data-strong data-num className="numeral">
                      {time ?? <span className="text-muted">{L.timeUnknown}</span>}
                      {event.eventTimeEt && (
                        <span className={styles.subPhone}>{fill(L.nyTag, { time: event.eventTimeEt })}</span>
                      )}
                    </td>
                    <td data-num className="numeral hidden sm:table-cell">{event.eventTimeEt ?? NO_VALUE}</td>
                    <td>
                      {locale === "tr" ? event.titleTr : event.titleEn}
                      {event.projections && (
                        <span className={styles.sub}>
                          <span className={styles.tag} data-tone="early">{L.projections}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {recent.length > 0 && (
        <Panel>
          <PanelHeader title={L.recentTitle} />
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{L.colDate}</th>
                <th scope="col" className="hidden sm:table-cell">{L.colWhat}</th>
                <th scope="col" data-end>{L.colActual}</th>
                <th scope="col" data-end>{L.colForecast}</th>
                <th scope="col" data-end className="hidden sm:table-cell">{L.colPrevious}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((event) => (
                <tr key={event.slug + event.eventDate}>
                  <td data-strong data-num>{longDate(readerDate(event, locale), locale)}</td>
                  <td className="hidden sm:table-cell">{locale === "tr" ? event.titleTr : event.titleEn}</td>
                  <td data-strong data-num data-end className="numeral">{value(event.actual, event.unit)}</td>
                  <td data-num data-end className="numeral">{value(event.forecast, event.unit)}</td>
                  <td data-num data-end className="numeral hidden sm:table-cell">{value(event.previous, event.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel>
        <PanelHeader title={L.aboutTitle} />
        <p className={styles.prose}>{copy.about}</p>
        <div className={styles.inlineLinks}>
          {term && <Link href={`/sozluk/${term.slug}`}>{fill(L.glossaryLink, { term: term.term })}</Link>}
          <Link href="/takvim">{L.calendarLink}</Link>
        </div>
      </Panel>

      <AnswerLinks t={t} current={path} />

      <DataStamp source={copy.source} locale={locale} labels={t.data} />

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={[...page.guides]} className="pt-1" />
    </MotionExperience>
  );
}
