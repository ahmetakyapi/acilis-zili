import type { Metadata } from "next";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { AnswerFacts, type AnswerFact } from "@/components/answers/AnswerFacts";
import { AnswerLinks } from "@/components/answers/AnswerLinks";
import styles from "@/components/answers/Answers.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { DataStamp, EmptyState, PageHeader, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getHolidays } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  coveredYears,
  fill,
  holidayName,
  holidayRows,
  holidayYearGroups,
  isObservedHoliday,
  longDate,
  nextClosure,
  nextEarlyClose,
  trLocative,
  weekdayName,
} from "@/lib/market-answers";
import { daysBetweenEt, etDateTimeToUtc, todayEt, type MarketHoliday } from "@/lib/market-hours";
import { TR_ZONE, formatInZone } from "@/lib/session-clock";
import { pageAlternates } from "@/lib/site";

const PATH = "/abd-borsasi-tatil-gunleri";

/* Başlıktaki yıllar VERİDEN (`coveredYears`): tohum 2028'i taşıdığında ya da
   2026 geride kaldığında başlık kendiliğinden kayar. Veri okunamadıysa yıl
   uydurulmaz, yılsız başlık basılır. Türkçe açıklamadaki bulunma eki son
   yılın okunuşundan (`trLocative`: "2027'de", "2029'da"). */
function holidayCopy(holidays: MarketHoliday[], today: string, L: Dictionary["marketHolidays"], locale: Locale) {
  const years = coveredYears(holidays, today);
  if (years.length === 0) return { title: L.metaTitleBare, description: L.metaDescriptionBare };
  const joined = years.join(L.yearJoin);
  const yearsIn = locale === "tr" ? `${joined}'${trLocative(years[years.length - 1]!)}` : joined;
  return {
    title: fill(L.metaTitle, { years: joined }),
    description: fill(L.metaDescription, { yearsIn }),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const copy = holidayCopy(await getHolidays(), todayEt(), t.marketHolidays, locale);
  return {
    title: copy.title,
    description: copy.description,
    alternates: pageAlternates(PATH, locale),
  };
}

/**
 * /abd-borsasi-tatil-gunleri — NYSE / NASDAQ TATİLLERİ VE YARIM GÜNLER
 * (14 Kasım 2026, SEO denetimi).
 *
 * "ABD borsası tatil günleri" sorusunun sitede adresi yoktu; takvim yalnız
 * o haftanın tatilini şeritte gösteriyordu. Veri zaten vardı
 * (`market_holidays`, tohum `db/seed/holidays.ts`, kaynak NYSE'nin resmî
 * takvimi); yeni sağlayıcı, şema ya da uç yok.
 *
 * İLK CÜMLE sıradaki tatili gün ve adla söyler, ardından sıradaki yarım
 * günü Türkiye saatiyle kapanışıyla; sunucuda hesaplanır, ham HTML'de
 * durur. Yarım günün Türkiye saati SABİT DEĞİL: aynı 13:00 New York kasım
 * sonunda 21:00, temmuz başında 20:00 eder; her satır kendi tarihiyle
 * hesaplanır (`holidayRows`).
 *
 * GÜN ET TAKVİMİYLE. "Geçti" ve "sıradaki" New York takvim gününden
 * sayılır: tatil New York'un günüdür ve Türkiye'de gece yarısından sonra
 * New York'ta hâlâ süren bir tatil "geçmiş" sayılmamalı.
 *
 * TABLO TELEFONDA KAYMAZ (`.claude/rules/arayuz.md`): beş sütunun ikisi
 * (gün adı, kapanış saati) 640'ın altında düşer ve bilgisi kalan hücrelerin
 * alt satırına iner (gün tarihin, kapanış durumun altına).
 *
 * TATİL ADLARI VERİDEN, olduğu gibi (yalnız "(yarım gün)" eki düşer, durum
 * ayrı sütunda). "Gözlem" notu yalnız veride o iz varsa basılır.
 *
 * Ekran sırası: başlık (ilk cümle) → ölçü ızgarası (sıradaki tatil, sıradaki
 * yarım gün, kapanışı) → yıl başına tablo → kısa notlar → Sık Sorulanlar →
 * DataStamp → GuideHint.
 *
 * ÖLÇÜM (yerel, tohum verisi, 14 Kasım; TR ve EN, açık ve koyu): 390 ve
 * 1440'ta yatay taşma 0, tek `h1`, iki tablo kabında
 * scrollWidth − clientWidth 0.
 */
export default async function MarketHolidaysPage() {
  const { locale, t } = await getI18n();
  const L = t.marketHolidays;
  const today = todayEt();
  const holidays = await getHolidays();
  const copy = holidayCopy(holidays, today, L, locale);

  const rows = holidayRows(holidays, today);
  /* Geçmiş yıllar basılmaz: başlık bu yılı ve sonrasını vaat ediyor. */
  const thisYear = Number(today.slice(0, 4));
  const groups = holidayYearGroups(rows).filter((group) => group.year >= thisYear);
  const closure = nextClosure(holidays, today);
  const early = nextEarlyClose(holidays, today);
  const earlyClose = early?.earlyCloseEt
    ? formatInZone(etDateTimeToUtc(early.date, early.earlyCloseEt), TR_ZONE)
    : null;
  const fullDate = (date: string) => longDate(date, locale, { weekday: true });
  const away = (date: string) => {
    const days = daysBetweenEt(today, date);
    return days === 0 ? L.today : days === 1 ? L.tomorrow : fill(L.daysAway, { n: days });
  };

  /* İlk cümle. */
  const answer = closure
    ? (closure.date === today
        ? fill(L.answerToday, { name: holidayName(closure, locale) })
        : fill(L.answerNext, { date: fullDate(closure.date), name: holidayName(closure, locale) })) +
      (early && earlyClose ? fill(L.answerEarly, { date: fullDate(early.date), close: earlyClose }) : "")
    : L.answerNone;

  const facts: AnswerFact[] = [
    ...(closure
      ? [{
          label: L.factNext,
          value: longDate(closure.date, locale, { year: false }),
          sub: `${holidayName(closure, locale)} · ${away(closure.date)}`,
        }]
      : []),
    ...(early && earlyClose
      ? [
          {
            label: L.factEarly,
            value: longDate(early.date, locale, { year: false }),
            sub: `${holidayName(early, locale)} · ${away(early.date)}`,
          },
          {
            label: L.factEarlyClose,
            value: earlyClose,
            sub: `${t.marketHours.colTr} · New York ${early.earlyCloseEt}`,
          },
        ]
      : []),
  ];

  const observed = groups.some((group) => group.rows.some((row) => isObservedHoliday(row.holiday)));

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <BreadcrumbJsonLd locale={locale} items={[{ name: copy.title, path: PATH }]} />
      <PageHeader
        title={copy.title}
        subtitle={holidays.length > 0 ? answer : undefined}
        share={<PageShare compactOnMobile align="right" path={PATH} title={copy.title} locale={locale} t={t} />}
      />

      {/* OKUNAMADI ≠ BOŞ. `getHolidays` hatayı boş listeye çevirir; boş liste
          "tatil yok" diye sunulmaz (tablo her yıl dolu olmak zorunda). */}
      {holidays.length === 0 ? (
        <EmptyState title={L.emptyTitle} hint={L.emptyHint} />
      ) : (
        <>
          <AnswerFacts label={L.factsLabel} facts={facts} />

          {groups.map((group) => {
            const closed = group.rows.filter((row) => row.kind === "closed").length;
            return (
              <Panel key={group.year}>
                <PanelHeader
                  title={fill(L.yearTitle, { year: group.year })}
                  meta={fill(L.yearCount, { closed, early: group.rows.length - closed })}
                />
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{L.colDate}</th>
                      <th scope="col" className="hidden sm:table-cell">{L.colDay}</th>
                      <th scope="col">{L.colHoliday}</th>
                      <th scope="col">{L.colStatus}</th>
                      <th scope="col" className="hidden sm:table-cell">{L.colClose}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.holiday.date} data-past={row.past || undefined}>
                        <td data-strong data-num>
                          {longDate(row.holiday.date, locale, { year: false })}
                          {row.past && <span className="sr-only"> ({L.passed})</span>}
                          <span className={styles.subPhone}>{weekdayName(row.holiday.date, locale)}</span>
                        </td>
                        <td className="hidden sm:table-cell">{weekdayName(row.holiday.date, locale)}</td>
                        <td>{holidayName(row.holiday, locale)}</td>
                        <td>
                          <span className={styles.tag} data-tone={row.kind}>
                            {row.kind === "early" ? L.statusEarly : L.statusClosed}
                          </span>
                          {row.close && (
                            <span className={`numeral ${styles.subPhone}`}>
                              {row.close.tr} · New York {row.close.ny}
                            </span>
                          )}
                        </td>
                        <td data-num className="numeral hidden sm:table-cell">
                          {row.close ? (
                            <>
                              <span className="font-semibold">{row.close.tr}</span>
                              <span className={styles.sub}>New York {row.close.ny}</span>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            );
          })}

          <Panel>
            <PanelHeader
              title={L.notesTitle}
              action={<PanelLink href="/abd-borsasi-saatleri">{L.hoursLink}</PanelLink>}
            />
            <ul className={styles.notes}>
              <li>{L.noteSame}</li>
              {observed && <li>{L.noteObserved}</li>}
              <li>{L.noteTurkiye}</li>
            </ul>
          </Panel>
        </>
      )}

      <AnswerLinks t={t} current={PATH} />

      <DataStamp source={L.stampSource} note={L.stampNote} locale={locale} labels={t.data} />

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["borsa-nasil-isler", "abd-hisse-nasil-alinir"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
