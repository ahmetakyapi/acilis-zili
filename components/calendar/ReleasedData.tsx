import type { CSSProperties } from "react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import calendar from "@/components/calendar/CalendarExperience.module.css";
import { ReleaseNote } from "@/components/calendar/ReleaseNote";
import { ImpactDots, Panel, PanelHeader } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { deviationSpans, formatDeviation, releaseDeviation, roundedDiff, seriesKey, type Deviation } from "@/lib/release-deviation";
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
 * Her kart: tarih ve saat (TR önce), başlık, üç değer, SAPMA ÇİZGİSİ, yön
 * künyesi ve Claude notu.
 *
 * SAPMA ÇİZGİSİ (25 Ekim). Üç değer sıfırdan başlayan üç çubuktu; 194 bin
 * ile 200 bin aynı boyda görünüyordu ve kartın sorusu ("beklentiye göre
 * nerede") çizimden okunmuyordu. Çizgi artık beklentiyi sıfır alıyor
 * (`releaseDeviation`, gerekçesi orada): ortada beklenti çizgisi, gri
 * çentik önceki, nokta gerçekleşen; nokta beklentiden kendi yerine bir kez
 * kayıyor (`data-motion-draw="travel"`, hareketi azaltana son kare).
 * Altındaki künye farkı birimiyle söylüyor: "Beklentinin 6 Bin Altında".
 *
 * RENK YALNIZ YÖN, YARGI DEĞİL. Yüksek işsizlik başvurusu da "üstünde"dir;
 * yeşil "iyi" demek değil, "beklentinin üstünde" demek. Bu yüzden renk tek
 * taşıyıcı değil: künye yönü sözle ve ▲/▼ ile yazıyor, rayın iki ucu
 * "Altında"/"Üstünde" diye adlı, panelin dibindeki satır kuralı açıkça
 * söylüyor. Yön ve rozet, Claude'a verilen `vsForecast` ile aynı
 * fonksiyondan (`compareReleased`).
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
  const v = t.calendarVisuals.released;
  const tags = zoneTag(locale);
  const impactLabel: Record<string, string> = { high: c.impactHigh, medium: c.impactMedium, low: c.impactLow };
  const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { weekday: "short", timeZone: "UTC" });
  const anyLine = events.some((event) => releaseDeviation(event.actual, event.forecast, event.previous) !== null);
  /* Aynı serinin kartları ortak ölçekte (gerekçe `lib/release-deviation.ts`). */
  const spans = deviationSpans(events);

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
          const deviation = releaseDeviation(event.actual, event.forecast, event.previous, { span: spans.get(seriesKey(event.slug)) });
          const vsForecast = compareReleased(event.actual, event.forecast);
          const vsPrevious = compareReleased(event.actual, event.previous);
          /* Çizgi yoksa (düz sayı değil) eski rozet: yön sözle, farksız. */
          const fallback = vsForecast ? c.releasedVsForecast[vsForecast] : vsPrevious ? c.releasedVsPrevious[vsPrevious] : null;
          const rows = [
            { key: "actual", label: c.actual, value: event.actual },
            { key: "forecast", label: c.forecast, value: event.forecast },
            { key: "previous", label: c.previous, value: event.previous },
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
              {/* ÜÇ DEĞER YAN YANA, işaretleri çizginin lejantı: nokta
                  gerçekleşen, dik çizgi beklenti, gri çentik önceki. Sayı
                  metinde duruyor; çizgi onun konum hâli (`aria-hidden`). */}
              <dl className={styles.figures}>
                {rows.map((row) => (
                  <div key={row.key} className={styles.figure} data-kind={row.key} data-dir={row.key === "actual" ? deviation?.direction : undefined}>
                    <dt className={styles.figureLabel}>
                      {deviation && <i aria-hidden className={styles.key} />}
                      {row.label}
                    </dt>
                    <dd className={cn(styles.figureValue, "numeral")}>{formatEventValue(row.value, event.unit, locale) ?? row.value}</dd>
                  </div>
                ))}
              </dl>
              {deviation ? (
                <>
                  <DeviationLine deviation={deviation} below={v.sideBelow} above={v.sideAbove} baseLabel={deviation.base === "forecast" ? c.forecast : c.previous} />
                  <p className={styles.verdictLine}>
                    <span className={styles.verdict} data-dir={deviation.direction}>
                      {deviation.direction !== "inline" && (
                        <span aria-hidden className={styles.glyph}>
                          {deviation.direction === "above" ? "▲" : "▼"}
                        </span>
                      )}
                      {verdictText(deviation, event.unit, locale, v, "base")}
                    </span>
                    {deviation.previousDirection && deviation.previousDiff !== null && (
                      <span className={styles.verdictSecondary}>{verdictText(deviation, event.unit, locale, v, "previous")}</span>
                    )}
                  </p>
                </>
              ) : (
                fallback && <span className={styles.verdictPill}>{fallback}</span>
              )}
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
      {(anyLine || notes) && (
        <div className={calendar.foot}>
          {anyLine && <p>{v.legend}</p>}
          {notes && <p>{c.releasedDisclosure}</p>}
        </div>
      )}
    </Panel>
  );
}

type Words = Dictionary["calendarVisuals"]["released"];

/**
 * Künye metni. `base`: gerçekleşen, sıfıra (beklenti ya da önceki) göre.
 * `previous`: gerçekleşen, önceki değere göre — yalnız sıfır beklentiyken.
 * Önceki değerin farkı gerçekleşenden: (gerçekleşen − beklenti) −
 * (önceki − beklenti), aynı yuvarlamayla.
 */
function verdictText(
  deviation: Deviation,
  unit: string | null,
  locale: Locale,
  v: Words,
  which: "base" | "previous",
): string {
  if (which === "previous") {
    const diff = roundedDiff(deviation.diff, deviation.previousDiff ?? 0, deviation.digits);
    const dir = deviation.previousDirection;
    if (dir === "inline" || diff === 0) return v.inlinePrevious;
    const text = formatDeviation(diff, unit, deviation.digits, locale, v);
    return (dir === "above" ? v.abovePrevious : v.belowPrevious).replace("{diff}", text);
  }
  const onForecast = deviation.base === "forecast";
  if (deviation.direction === "inline") return onForecast ? v.inlineForecast : v.inlinePrevious;
  const text = formatDeviation(deviation.diff, unit, deviation.digits, locale, v);
  const template = onForecast
    ? deviation.direction === "above" ? v.aboveForecast : v.belowForecast
    : deviation.direction === "above" ? v.abovePrevious : v.belowPrevious;
  return template.replace("{diff}", text);
}

/**
 * Sapma çizgisi. Ray `container-type: inline-size`: noktanın kayması
 * (`travel`) rayın kendi genişliğiyle, `cqw` cinsinden. Yüzde konum:
 * orta = %50, uçlar ±`DEVIATION_REACH`.
 */
function DeviationLine({
  deviation,
  below,
  above,
  baseLabel,
}: {
  deviation: Deviation;
  below: string;
  above: string;
  baseLabel: string;
}) {
  const HALF = 50;
  const pos = (at: number) => HALF + at * HALF;
  const actual = pos(deviation.actualAt);
  return (
    <div className={styles.line} aria-hidden data-dir={deviation.direction} data-motion-track>
      <div className={styles.rail}>
        <span className={styles.axis} />
        {/* Beklentiden gerçekleşene uzanan bacak: sıfırdan açılıyor. */}
        {deviation.actualAt !== 0 && (
          <span
            className={styles.leg}
            data-motion-draw="line"
            style={{
              left: `${Math.min(HALF, actual)}%`,
              width: `${Math.abs(actual - HALF)}%`,
              transformOrigin: actual > HALF ? "left center" : "right center",
            }}
          />
        )}
        <span className={styles.zero} />
        {deviation.previousAt !== null && (
          <span className={styles.previous} style={{ left: `${pos(deviation.previousAt)}%` }} />
        )}
        <span
          className={styles.dot}
          style={{ left: `${actual}%` } as CSSProperties}
          data-motion-draw={deviation.actualAt !== 0 ? "travel" : undefined}
          data-delta={deviation.actualAt !== 0 ? (HALF - actual).toFixed(2) : undefined}
        />
      </div>
      <div className={styles.ends}>
        <span>{below}</span>
        <span className={styles.endsZero}>{baseLabel}</span>
        <span>{above}</span>
      </div>
    </div>
  );
}
