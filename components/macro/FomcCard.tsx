import type { CSSProperties } from "react";
import { DataStamp, Panel } from "@/components/ui/primitives";
import { addEtDays, todayEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getNextFomc } from "@/lib/macro-data";
import { readerDayOffset, timePair, zoneTag } from "@/lib/session-clock";
import {
  formatEtDateLong,
  formatEtDateMedium,
  formatPercentPlain,
  relativeDayLabel,
} from "@/lib/utils";
import styles from "./MacroExperience.module.css";

/**
 * Sonraki FOMC — tarih, saat ve bugünkü hedef aralık.
 *
 * PİYASA FİYATLAMASI YOK ve olmaması bilinçli: "Ekim'de indirim olasılığı
 * %72" gibi bir satır vadeli faiz kontratlarından hesaplanıyor ve elimizde
 * o kontratların fiyatını veren bir kaynak yok. Başka bir sitenin
 * sayısını kopyalamak ya da kendi tahminimizi yazmak, ekranda nereden
 * geldiğini söyleyemediğimiz bir sayı olurdu. Kart bu yüzden yalnızca
 * bildiğini yazıyor: takvimdeki tarih (federalreserve.gov, elle tohumlanan
 * takvim) ve FRED'in yayımladığı hedef aralık.
 *
 * Hedef aralık TOPLANTIDAN SONRA değişir; gözlem tarihi künyede.
 */
/** Takvim şeridinin gün sınırı: getNextFomc'nin bakış penceresiyle aynı büyüklükte. */
const STRIP_MAX_DAYS = 120;
const SATURDAY = 6;
const SUNDAY = 0;

/**
 * Bugünden toplantıya kadar her ET günü bir çizgi: hafta sonları kısa,
 * toplantı günü marka renginde ve tam boy. Tarih UYDURULMUYOR; şerit
 * takvimdeki tarihle bugünün arasındaki günlerden başka bir şey çizmiyor.
 * Dökülme (sağa doğru sırayla uzama) CSS'te, hareketi azaltana düz basılır.
 */
function dayStrip(today: string, meeting: string) {
  const days: { date: string; kind: "today" | "weekend" | "day" | "meeting" }[] = [];
  for (let date = today, i = 0; date <= meeting && i <= STRIP_MAX_DAYS; date = addEtDays(date, 1), i++) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    days.push({
      date,
      kind: date === meeting ? "meeting" : date === today ? "today" : weekday === SATURDAY || weekday === SUNDAY ? "weekend" : "day",
    });
  }
  return days;
}

export async function FomcCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const next = await getNextFomc();
  if (!next) return null;
  const times = next.timeEt ? timePair(next.date, next.timeEt, locale) : null;
  const tags = zoneTag(locale);
  const away = readerDayOffset(next.date, next.timeEt, locale);
  const strip = dayStrip(todayEt(), next.date);

  /* Izgaranın ilk hücresi: öteki kartlarla aynı kutu (`styles.card`), ama
     ton farklı (`data-kind="fomc"`): bir seri değil, bir takvim olayı ve
     tıklanmıyor. Uzun "fiyatlama yok" notu kartın dibinde, saç teliyle. */
  return (
    <Panel className={styles.fomc}>
      <div className={styles.cardHead}>
        <h2 className={`${styles.cardTitle} ${styles.inkTight}`}>{x.fomcTitle}</h2>
        {next.withProjections && <span className={styles.status}>{x.fomcProjections}</span>}
      </div>

      <div className={styles.fomcCount}>
        {away >= 1 ? (
          <>
            <b className="numeral">{away}</b>
            <span>{x.fomcDaysLeft}</span>
          </>
        ) : (
          <b>{relativeDayLabel(Math.max(away, 0), t.calendar)}</b>
        )}
      </div>
      <p className={styles.fomcDate}>
        {formatEtDateLong(next.date, locale)}
        {times && (
          <span className="numeral"> {times.primary} <small>· {times.secondary} {tags.secondary}</small></span>
        )}
      </p>

      {strip.length > 1 && (
        <div className={styles.fomcStrip} role="img" aria-label={`${x.fomcCalendar}: ${strip.length - 1}`}>
          {strip.map((day, i) => (
            <span key={day.date} data-kind={day.kind} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
      )}

      <dl className={styles.fomcTarget}>
        <dt>{x.fomcTarget}</dt>
        <dd className="numeral">
          {next.target
            ? `${formatPercentPlain(next.target.lower, locale, 2)} - ${formatPercentPlain(next.target.upper, locale, 2)}`
            : t.common.noData}
        </dd>
        {next.target && (
          <>
            <dt>{x.observed}</dt>
            <dd className="numeral">{formatEtDateMedium(next.target.date, locale)}</dd>
          </>
        )}
      </dl>
      <p className={styles.fomcNote}>{x.fomcNoPricing}</p>
      {next.target && (
        <DataStamp labels={t.data} source="fred" at={next.target.fetchedAt} locale={locale} className="mt-2" />
      )}
    </Panel>
  );
}
