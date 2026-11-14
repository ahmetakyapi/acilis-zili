import type { Metadata } from "next";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { AnswerFacts, type AnswerFact } from "@/components/answers/AnswerFacts";
import { AnswerLinks } from "@/components/answers/AnswerLinks";
import { SessionBand, type SessionBandSegment } from "@/components/answers/SessionBand";
import styles from "@/components/answers/Answers.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SessionRefresh } from "@/components/today/SessionRefresh";
import { DataStamp, PageHeader, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { getHolidays, getStatus } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  clockShifts,
  dayAnswer,
  fill,
  holidayName,
  holidayRows,
  longDate,
  seasonHours,
  shiftRows,
  weekdayName,
  type DayAnswer,
} from "@/lib/market-answers";
import {
  AFTER_HOURS_MINUTES,
  SESSION_BOUNDS,
  closeMinutesFor,
  todayEt,
} from "@/lib/market-hours";
import { TR_ZONE, displayZone, nextZoneMidnight, sessionWindows } from "@/lib/session-clock";
import { pageAlternates } from "@/lib/site";

const PATH = "/abd-borsasi-saatleri";
const DASH = "–";

/* Künye açıklaması saatleri HESAPLAR: "yazın 16:30–23:00, kışın 17:30–00:00"
   cümlesindeki dört saat o yılın ABD saat değişikliği günlerinden çıkar
   (`seasonHours`); sabit yazılsaydı ABD kuralı değiştiği gün arama sonucu
   yanlış saat gösterirdi. `pageMetadata` sabit metin aldığı için künye
   burada elle kuruluyor; canonical ve hreflang yine `pageAlternates`ten. */
export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getI18n();
  const L = t.marketHours;
  const season = seasonHours(Number(todayEt().slice(0, 4)));
  const range = (hours: { open: { tr: string }; close: { tr: string } }) =>
    `${hours.open.tr}${DASH}${hours.close.tr}`;
  const description = season
    ? fill(L.metaDescription, { summer: range(season.summer), winter: range(season.winter) })
    : fill(L.metaDescriptionSingle, {
        hours: range(dayAnswer(new Date(), await getHolidays(), locale).next),
      });
  return {
    title: L.metaTitle,
    description,
    alternates: pageAlternates(PATH, locale),
  };
}

/** İlk cümle: günün dalı + o günün saatleri. Saatler yer tutucudan. */
function answerSentence(answer: DayAnswer, L: Dictionary["marketHours"], locale: Locale): string {
  const next = fill(
    answer.next.dayOffset === 0 ? L.nextToday : answer.next.dayOffset === 1 ? L.nextTomorrow : L.nextDate,
    {
      date: longDate(answer.next.date, locale, { year: false, weekday: true }),
      open: answer.next.open.tr,
      openNy: answer.next.open.ny,
    },
  );
  const sentence = fill(L.answer[answer.kind], {
    open: answer.today?.open.tr ?? "",
    close: answer.today?.close.tr ?? "",
    openNy: answer.today?.open.ny ?? "",
    closeNy: answer.today?.close.ny ?? "",
    holiday: answer.holiday ? holidayName(answer.holiday, locale) : "",
    next,
  });
  return answer.today && answer.halfDay ? `${sentence}${L.answerHalfDay}` : sentence;
}

/**
 * /abd-borsasi-saatleri — "ABD BORSASI KAÇTA AÇILIYOR, ŞU AN AÇIK MI"
 * (14 Kasım 2026, SEO denetimi).
 *
 * Soru her gün aranıyor ve sitede kendi adresi yoktu: cevap ana sayfanın
 * geri sayımında, rehber yazısının ortasında ve seans rozetinde dağınıktı.
 * Bu sayfa soruyu tek adreste, İLK CÜMLEDE, sunucuda hesaplanmış güncel
 * değerle yanıtlıyor (alıntılanabilir cevap; kalıp `/bilancolar/[symbol]`):
 * `h1`in altındaki cümle günün dalını söyler (hafta sonu, tatil, yarım gün,
 * ön seans, açık, kapandı), ham HTML'de durur.
 *
 * SAAT TEK KAYNAK (`.claude/rules/veri-ve-onbellek.md` → "Saat: TR Önce").
 * Dosyada tek bir saat yazılı değil; hepsi `lib/market-answers.ts` →
 * `lib/session-clock.ts` / `lib/market-hours.ts` zincirinden, günün
 * tarihiyle. Yaz saati geçiş GÜNLERİ de hesaplanıyor (`clockShifts`).
 *
 * BU SAYFADA BİRİNCİL SAAT İKİ DİLDE DE TÜRKİYE. Sitenin geri kalanında
 * İngilizce arayüz New York saatini öne alır (`zoneTag`); buranın sorusu
 * ise adıyla "Türkiye saatiyle" ve İngilizce başlık da "in Türkiye Time".
 * Sütunlar adlarıyla yazıldığı için ("Türkiye Saati", "New York Saati")
 * hangi saatin hangisi olduğu künyesiz de açık.
 *
 * "BUGÜN" OKUYUCUNUN GÜNÜ, New York'un değil — gerekçe `dayAnswer`.
 *
 * Ekran sırası (`.claude/rules/arayuz.md`): başlık (ilk cümle) → ölçü
 * ızgarası (açılış, kapanış, şu an) → seans şeridi ve tablosu → yaz saati
 * geçişleri → yarım günler → Sık Sorulanlar → DataStamp → GuideHint.
 * Ana görsel seans şeridi; `SessionRail` neden kullanılmadı:
 * `components/answers/SessionBand.tsx`.
 *
 * DİNAMİK: dil ve günün durumu istek anında okunur. Açık kalan sekme
 * seans sınırında ve okuyucunun gece yarısında kendini tazeler
 * (`SessionRefresh`, yalnız içe aktarıldı).
 *
 * ÖLÇÜM (yerel, sahte sağlayıcı, 14 Kasım cumartesi; TR ve EN, açık ve koyu):
 * 390 ve 1440'ta yatay taşma 0, tek `h1`, üç tablo kabında
 * scrollWidth − clientWidth 0.
 */
export default async function MarketHoursPage() {
  const { locale, t } = await getI18n();
  const L = t.marketHours;
  const now = new Date();
  const [holidays, status] = await Promise.all([getHolidays(), getStatus()]);
  const answer = dayAnswer(now, holidays, locale);

  /* Ölçüler ve seans tablosu: bugün işlem varsa bugünün, yoksa sıradaki
     işlem gününün saatleri; künye hangi gün olduğunu söyler. */
  const shown = answer.today
    ? { date: answer.dayDate, offset: 0, ...answer.today, halfDay: answer.halfDay }
    : { offset: answer.next.dayOffset, ...answer.next };
  const dayLabel =
    shown.offset === 0
      ? L.dayToday
      : shown.offset === 1
        ? L.dayTomorrow
        : longDate(shown.date, locale, { year: false, weekday: true });
  const facts: AnswerFact[] = [
    {
      label: answer.today ? L.factOpen : L.factNextOpen,
      value: shown.open.tr,
      sub: `${dayLabel} · New York ${shown.open.ny}`,
    },
    {
      label: answer.today ? L.factClose : L.factNextClose,
      value: shown.close.tr,
      sub: shown.halfDay ? `${L.halfDayTag} · New York ${shown.close.ny}` : `New York ${shown.close.ny}`,
    },
    {
      label: L.factState,
      value: L.state[answer.kind],
      sub: answer.kind === "holiday" && answer.holiday ? holidayName(answer.holiday, locale) : undefined,
    },
  ];

  /* Seans pencereleri: `sessionWindows` "tr" ile çağrılınca birincil saat
     Türkiye, ikincil New York (bu sayfanın sırası, yukarıdaki not). */
  const closeMinutes = closeMinutesFor(shown.date, holidays);
  const minutesOf: Record<SessionBandSegment["key"], number> = {
    pre: SESSION_BOUNDS.regularOpen - SESSION_BOUNDS.preMarketOpen,
    regular: closeMinutes - SESSION_BOUNDS.regularOpen,
    after: AFTER_HOURS_MINUTES,
  };
  const names: Record<SessionBandSegment["key"], string> = {
    pre: L.sessionPre,
    regular: L.sessionRegular,
    after: L.sessionAfter,
  };
  const windows = sessionWindows(shown.date, "tr", closeMinutes).flatMap((window) =>
    window.key === "overnight"
      ? []
      : [{ key: window.key, name: names[window.key], tr: window.primary, ny: window.secondary, minutes: minutesOf[window.key] }],
  );

  /* Yaz saati: bu yıl ve gelecek yıl. Türkiye için aynı hesap boş dönerse
     "Türkiye uygulamıyor" cümlesi basılır — ezberden değil, veriden. */
  const year = Number(answer.dayDate.slice(0, 4));
  const shifts = shiftRows([year, year + 1], answer.dayDate);
  const trShifts = [year, year + 1].flatMap((y) => clockShifts(y, TR_ZONE));

  const halfDays = holidayRows(holidays, answer.dayDate).filter((row) => row.kind === "early" && !row.past);

  /* Tazeleme: seans anlatısının değiştiği ilk an ya da okuyucunun gece
     yarısı ("bugün" o an değişir), hangisi erkense. */
  const midnight = nextZoneMidnight(now.getTime(), displayZone(locale));
  const refreshAt = midnight < status.nextTransition ? midnight : status.nextTransition;

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <SessionRefresh atIso={refreshAt.toISOString()} />
      <BreadcrumbJsonLd locale={locale} items={[{ name: L.title, path: PATH }]} />
      <PageHeader
        title={L.title}
        subtitle={answerSentence(answer, L, locale)}
        share={<PageShare compactOnMobile align="right" path={PATH} title={L.title} locale={locale} t={t} />}
      />

      <AnswerFacts label={L.factsLabel} facts={facts} />

      <Panel>
        <PanelHeader
          title={L.sessionsTitle}
          meta={shown.halfDay ? `${dayLabel} · ${L.halfDayTag}` : dayLabel}
        />
        <SessionBand
          label={L.sessionsBandLabel}
          segments={windows.map((w) => ({ key: w.key, name: w.name, time: w.tr, minutes: w.minutes }))}
        />
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{L.colSession}</th>
              <th scope="col">{L.colTr}</th>
              <th scope="col">{L.colNy}</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr key={w.key}>
                <td data-strong>{w.name}</td>
                <td data-strong data-num className="numeral">{w.tr}</td>
                <td data-num className="numeral">{w.ny}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>{L.sessionsNote}</p>
      </Panel>

      {shifts.length > 0 && (
        <Panel>
          <PanelHeader title={L.dstTitle} />
          <p className={styles.prose}>{trShifts.length === 0 ? L.dstLead : L.dstLeadGeneric}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{L.colDate}</th>
                <th scope="col">{L.colShift}</th>
                <th scope="col">{L.colAfter}</th>
                <th scope="col" className="hidden sm:table-cell">{L.colLead}</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.date} data-past={shift.past || undefined}>
                  <td data-strong data-num>
                    {longDate(shift.date, locale)}
                    {shift.past && <span className="sr-only"> ({L.passed})</span>}
                  </td>
                  <td>{shift.kind === "start" ? L.shiftStart : L.shiftEnd}</td>
                  <td data-strong data-num className="numeral">
                    {shift.open.tr}{DASH}{shift.close.tr}
                    {/* Telefonda düşen sütun bu hücrenin altına iner. */}
                    <span className={styles.subPhone}>{fill(L.leadHours, { n: shift.leadHours })}</span>
                  </td>
                  <td data-num className="hidden sm:table-cell">{fill(L.leadHours, { n: shift.leadHours })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title={L.halfTitle}
          action={<PanelLink href="/abd-borsasi-tatil-gunleri">{L.allHolidays}</PanelLink>}
        />
        <p className={styles.prose}>
          {halfDays.length > 0 ? fill(L.halfLead, { hours: AFTER_HOURS_MINUTES / 60 }) : L.halfEmpty}
        </p>
        {halfDays.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{L.colHalfDay}</th>
                <th scope="col">{t.marketHolidays.colHoliday}</th>
                <th scope="col">{L.colHalfClose}</th>
              </tr>
            </thead>
            <tbody>
              {halfDays.map((row) => (
                <tr key={row.holiday.date}>
                  <td data-strong>
                    {longDate(row.holiday.date, locale)}
                    <span className={styles.sub}>{weekdayName(row.holiday.date, locale)}</span>
                  </td>
                  <td>{holidayName(row.holiday, locale)}</td>
                  <td data-strong data-num className="numeral">
                    {row.close?.tr}
                    <span className={styles.sub}>New York {row.close?.ny}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <AnswerLinks t={t} current={PATH} />

      <DataStamp source={L.stampSource} note={L.stampNote} locale={locale} labels={t.data} />

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["borsa-nasil-isler", "emir-tipleri"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
