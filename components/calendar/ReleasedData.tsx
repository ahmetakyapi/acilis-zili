import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import calendar from "@/components/calendar/CalendarExperience.module.css";
import { valueRatios } from "@/components/calendar/lookahead";
import { ReleaseNote } from "@/components/calendar/ReleaseNote";
import { ScaleBar } from "@/components/markets/CompareScale";
import { ImpactDots, Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { compareReleased } from "@/lib/release-notes-core";
import type { EconomicEventRow } from "@/lib/schema";
import { timePair, zoneTag } from "@/lib/session-clock";
import { cn, etDateParts, formatEventValue } from "@/lib/utils";
import styles from "./ReleasedData.module.css";

/**
 * Son Açıklanan Veriler (18 Ekim, sahibinin isteği: "veri açıklanınca
 * Claude notu"). Takvim ileriye bakıyor; açıklanan bir verinin "ne çıktı,
 * beklentiye göre nerede, genelde ne demek" sorusu ekranda cevapsızdı —
 * satır yalnızca üç sayı taşıyordu.
 *
 * Son on günün açıklanmış yüksek/orta etkili en çok dört verisi
 * (`pickReleased`, lib/release-notes-core.ts); hiç yoksa panel basılmaz.
 * Her kart: tarih ve saat (TR önce), başlık, Gerçekleşen · Beklenti ·
 * Önceki satırları takvim satırının ince ölçek çubuğuyla (`ScaleBar`,
 * `valueRatios` — düz sayı değilse çubuk yok), kıyas rozeti ve Claude notu.
 *
 * ROZET YARGI DEĞİL: "Beklentinin Üstünde" yön söyler, iyi/kötü değil —
 * yüksek işsizlik başvurusu da "üstünde"dir. Bu yüzden renk nötr (takvim
 * satırının çubuk kararıyla aynı, page.tsx → ValueSlot). Rozet ile Claude'a
 * verilen `vsForecast` aynı fonksiyondan (`compareReleased`).
 *
 * Değerler VERİTABANINDAKİ satırdan: notu yazan uç da oradan okuyor; ekrandaki
 * sayı ile notta geçen sayı aynı kaynaktan gelir.
 */
export function ReleasedData({
  events,
  notes,
  locale,
  t,
}: {
  events: EconomicEventRow[];
  /** Claude anahtarı tanımlı mı — değilse not yuvası ve künyesi basılmaz. */
  notes: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  if (events.length === 0) return null;
  const c = t.calendar;
  const tags = zoneTag(locale);
  const impactLabel: Record<string, string> = { high: c.impactHigh, medium: c.impactMedium, low: c.impactLow };
  const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { weekday: "short", timeZone: "UTC" });

  return (
    <Panel className={styles.panel} data-motion-reveal>
      <PanelHeader
        title={c.releasedTitle}
        meta={<span className={styles.meta}>{c.releasedWindow}</span>}
        action={notes ? <Sparkle className={styles.icon} size={18} weight="duotone" aria-hidden /> : undefined}
        className={calendar.panelHead}
      />
      <ol className={styles.cards} data-count={events.length}>
        {events.map((event) => {
          const { day, month } = etDateParts(event.eventDate, locale);
          const times = event.eventTimeEt ? timePair(event.eventDate, event.eventTimeEt, locale) : null;
          const scale = valueRatios([event.actual, event.forecast, event.previous]);
          const vsForecast = compareReleased(event.actual, event.forecast);
          const vsPrevious = compareReleased(event.actual, event.previous);
          const verdict = vsForecast ? c.releasedVsForecast[vsForecast] : vsPrevious ? c.releasedVsPrevious[vsPrevious] : null;
          const rows = [
            { label: c.actual, value: event.actual, ratio: scale?.ratios[0], strong: true },
            { label: c.forecast, value: event.forecast, ratio: scale?.ratios[1], strong: false },
            { label: c.previous, value: event.previous, ratio: scale?.ratios[2], strong: false },
          ].filter((row) => row.value !== null && row.value.trim() !== "");
          return (
            <li key={event.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={cn(styles.when, "numeral")}>
                  {day} {month} {weekday.format(new Date(`${event.eventDate}T12:00:00Z`))}
                  {times && (
                    <>
                      <span aria-hidden> · </span>
                      {times.primary} {tags.primary}
                    </>
                  )}
                </span>
                <ImpactDots importance={event.importance} label={impactLabel[event.importance] ?? event.importance} />
              </div>
              <p className={styles.title}>{locale === "tr" ? event.titleTr : event.titleEn}</p>
              <div className={styles.figures}>
                {rows.map((row) => (
                  <div key={row.label} className={styles.figure} data-strong={row.strong || undefined}>
                    <span className={styles.figureLabel}>{row.label}</span>
                    <span className={styles.lane} aria-hidden>
                      {row.ratio !== undefined && row.ratio !== null && (
                        <ScaleBar ratio={row.ratio} signed={scale?.signed ?? false} className={styles.bar} />
                      )}
                    </span>
                    <span className={cn(styles.figureValue, "numeral")}>{formatEventValue(row.value, event.unit, locale) ?? row.value}</span>
                  </div>
                ))}
              </div>
              {verdict && <span className={styles.verdict}>{verdict}</span>}
              {notes && (
                <ReleaseNote
                  id={event.id}
                  locale={locale}
                  labels={{ context: c.releasedContext, loading: c.releasedLoading, unavailable: c.releasedUnavailable }}
                />
              )}
            </li>
          );
        })}
      </ol>
      {notes && (
        <div className={calendar.foot}>
          <p>{c.releasedDisclosure}</p>
        </div>
      )}
    </Panel>
  );
}
