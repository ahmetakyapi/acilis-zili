import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { addEtDays } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsRow } from "@/lib/schema";
import { formatEtDateCompact } from "@/lib/utils";
import styles from "@/components/motion/DirectoryExperience.module.css";

/** The selected calendar window, counted from the already loaded reports.
 * Bar heights compare reporting density, not market importance. */
export function EarningsActivity({ rows, from, to, locale, t }: {
  rows: EarningsRow[]; from: string; to: string; locale: Locale; t: Dictionary;
}) {
  if (!rows.length) return null;
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.reportDate, (counts.get(row.reportDate) ?? 0) + 1);
  const days: { date: string; count: number }[] = [];
  for (let date = from; date <= to; date = addEtDays(date, 1)) days.push({ date, count: counts.get(date) ?? 0 });
  const busiest = [...days].sort((a, b) => b.count - a.count)[0];
  const countLabel = (n: number) => t.directory.reportsCount.replace("{n}", n.toLocaleString(locale));
  return <figure className={styles.earningsActivity}>
    <figcaption><span>{t.directory.earningsActivity}</span><strong>{countLabel(rows.length)}</strong></figcaption>
    <div className={styles.activityBars} aria-hidden="true">
      {days.map(day => <span key={day.date} data-peak={day.date === busiest.date} title={`${formatEtDateCompact(day.date, locale)} · ${countLabel(day.count)}`}>
        <i style={{ height: `${day.count / busiest.count * 100}%` }} />
      </span>)}
    </div>
    <div className={styles.activityAxis} aria-hidden><span>{formatEtDateCompact(from, locale)}</span><span>{formatEtDateCompact(to, locale)}</span></div>
    <Link href={`#earnings-day-${busiest.date}`} className={styles.activityPeak}>
      <span>{t.directory.earningsBusiest}</span><strong>{formatEtDateCompact(busiest.date, locale)} · {countLabel(busiest.count)}</strong><span aria-hidden>↗</span>
    </Link>
  </figure>;
}
