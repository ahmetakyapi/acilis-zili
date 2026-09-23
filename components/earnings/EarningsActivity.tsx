import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { addEtDays } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsRow } from "@/lib/schema";
import { formatEtDateCompact } from "@/lib/utils";
import styles from "@/components/motion/DirectoryExperience.module.css";

/** Günlük çubuk bu sayıya kadar; üstünde çubuklar haftaya toplanıyor. */
const DAILY_MAX = 10;

type Column = { key: string; from: string; to: string; count: number };

function utcNoon(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function isWeekend(date: string) {
  const day = utcNoon(date).getUTCDay();
  return day === 0 || day === 6;
}

/** Pazartesi başlayan haftanın ilk günü — gruplamanın anahtarı. */
function weekStart(date: string) {
  const day = utcNoon(date).getUTCDay();
  return addEtDays(date, -((day + 6) % 7));
}

/**
 * Seçili takvim penceresinin yoğunluğu — yüklenmiş satırlardan sayılıyor.
 * Çubuk boyu açıklama YOĞUNLUĞUNU karşılaştırıyor, piyasa önemini değil.
 *
 * SAYISIZ ÇUBUK BİR ŞEY SÖYLEMİYORDU (23 Eylül, sahibinin şikâyeti).
 * Yedi çubuğun altında yalnızca ilk ve son tarih vardı: hangi çubuğun hangi
 * gün olduğu sayılarak, kaç bilanço olduğu ise hiç okunmuyordu; hafta sonu
 * iki boş çubuk olarak yer tutuyordu. Şimdi her çubuğun üstünde sayısı,
 * altında günü var ve çubuk o günün listesine bağlanıyor. Açıklaması
 * olmayan hafta sonu düşüyor. Ay görünümünde otuz ince çubuğa etiket
 * sığmıyor; orada çubuklar HAFTA — "28 Eyl – 2 Eki · 180".
 */
export function EarningsActivity({ rows, from, to, locale, t }: {
  rows: EarningsRow[]; from: string; to: string; locale: Locale; t: Dictionary;
}) {
  if (!rows.length) return null;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.reportDate, (counts.get(row.reportDate) ?? 0) + 1);
  const days: { date: string; count: number }[] = [];
  for (let date = from; date <= to; date = addEtDays(date, 1)) {
    const count = counts.get(date) ?? 0;
    if (count > 0 || !isWeekend(date)) days.push({ date, count });
  }
  if (!days.length) return null;
  const busiest = [...days].sort((a, b) => b.count - a.count)[0];

  const weekly = days.length > DAILY_MAX;
  const columns: Column[] = [];
  for (const day of days) {
    const key = weekly ? weekStart(day.date) : day.date;
    const last = columns.at(-1);
    if (last && last.key === key) {
      last.to = day.date;
      last.count += day.count;
    } else {
      columns.push({ key, from: day.date, to: day.date, count: day.count });
    }
  }
  const max = Math.max(1, ...columns.map((column) => column.count));

  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
  const dayOfMonth = new Intl.DateTimeFormat(intlLocale, { day: "numeric", timeZone: "UTC" });
  const countLabel = (n: number) => t.directory.reportsCount.replace("{n}", n.toLocaleString(locale));

  return <figure className={styles.earningsActivity}>
    <figcaption><span>{t.directory.earningsActivity}</span><strong>{countLabel(rows.length)}</strong></figcaption>
    <ol className={styles.activityBars} data-weekly={weekly || undefined}>
      {columns.map((column) => {
        const peak = weekly
          ? busiest.date >= column.from && busiest.date <= column.to
          : column.from === busiest.date;
        const label = weekly
          ? column.from === column.to
            ? formatEtDateCompact(column.from, locale)
            : `${formatEtDateCompact(column.from, locale)} – ${formatEtDateCompact(column.to, locale)}`
          : null;
        const body = <>
          <span className={styles.activityCount} aria-hidden>{column.count > 0 ? column.count.toLocaleString(locale) : ""}</span>
          <span className={styles.activityTrack} aria-hidden>
            <i style={{ height: `${Math.max(column.count > 0 ? 6 : 0, column.count / max * 100)}%` }} />
          </span>
          <span className={styles.activityDay}>
            {label ?? <>{weekday.format(utcNoon(column.from))}<b className="numeral">{dayOfMonth.format(utcNoon(column.from))}</b></>}
          </span>
          <span className="sr-only">{countLabel(column.count)}</span>
        </>;
        return <li key={column.key} data-peak={peak || undefined} data-empty={column.count === 0 || undefined}>
          {column.count > 0
            ? <Link href={`#earnings-day-${weekly ? firstReporting(column, counts) : column.from}`}>{body}</Link>
            : <span>{body}</span>}
        </li>;
      })}
    </ol>
    <Link href={`#earnings-day-${busiest.date}`} className={styles.activityPeak}>
      <span>{t.directory.earningsBusiest}</span><strong>{formatEtDateCompact(busiest.date, locale)} · {countLabel(busiest.count)}</strong><span aria-hidden>↗</span>
    </Link>
  </figure>;
}

/** Haftanın bilanço açıklanan ilk günü — çubuğun bağlantısı oraya iner. */
function firstReporting(column: Column, counts: Map<string, number>) {
  for (let date = column.from; date <= column.to; date = addEtDays(date, 1)) {
    if ((counts.get(date) ?? 0) > 0) return date;
  }
  return column.from;
}
