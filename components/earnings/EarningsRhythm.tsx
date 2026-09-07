import Link from "next/link";
import { addEtDays } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsRow } from "@/lib/schema";
import styles from "@/components/motion/DirectoryExperience.module.css";

/** Calendar density, not a forecast or a market chart. Empty days stay zero. */
export function EarningsRhythm({ rows, today, locale, t }: {
  rows: Pick<EarningsRow, "reportDate">[]; today: string; locale: Locale; t: Dictionary;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addEtDays(today, i);
    return { date, count: rows.filter((row) => row.reportDate === date).length };
  });
  const maximum = Math.max(1, ...days.map((day) => day.count));
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return <>
    <h2 className={styles.visualHeading}>{t.directory.reportingRhythm}<span>{t.directory.distributionUnit}</span></h2>
    <div className={styles.rhythm} data-motion-stagger>{days.map(({ date, count }) => {
      const content = <><span className={styles.rhythmBar}><b>{count}</b><i data-motion-draw="bar" style={{ height: `${count / maximum * 65}%` }} /></span><span>{date.slice(-2)}<small> {dayName.format(new Date(`${date}T12:00:00Z`))}</small></span></>;
      return count ? <Link key={date} href={`#earnings-day-${date}`} aria-label={`${date} · ${count} ${t.earnings.companyMany}`}>{content}</Link> : <div key={date}>{content}</div>;
    })}</div>
  </>;
}
