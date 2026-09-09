import Link from "next/link";
import { ArrowUpRight, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { LogoTile } from "@/components/ui/primitives";
import { SpotlightCard } from "@/components/motion/PremiumMotion";
import { timingOf } from "./EarningsCalendar";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsRow } from "@/lib/schema";
import type { SymbolMeta } from "@/lib/data";
import { formatEtDateCompact, formatEtDateLong, formatMoneyCompact, formatPrice } from "@/lib/utils";
import styles from "@/components/motion/DirectoryVisuals.module.css";

/** Largest companies in the selected calendar window, with source estimates.
 * The date link opens the actual reporting day; no synthetic urgency/count. */
export function EarningsRadar({ rows, meta, locale, t }: { rows: EarningsRow[]; meta: Record<string, SymbolMeta>; locale: Locale; t: Dictionary }) {
  const seen = new Set<string>();
  const featured = [...rows].sort((a, b) => (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0) || a.reportDate.localeCompare(b.reportDate)).filter(row => {
    if (seen.has(row.symbol)) return false;
    seen.add(row.symbol); return true;
  }).slice(0, 3);
  const lead = featured[0];
  if (!lead) return <div className={styles.radarEmpty}><CalendarBlank size={36} weight="duotone" /><p>{t.earnings.empty}</p></div>;
  const company = meta[lead.symbol];
  const reportDate = new Date(`${lead.reportDate}T12:00:00Z`);
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(reportDate);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(reportDate);
  return <section className={styles.radar} aria-label={t.directory.earningsRadar}>
    <div className={styles.visualHeader}><h2>{t.directory.earningsRadar}</h2><CalendarBlank size={17} /></div>
    <SpotlightCard className={styles.radarSpotlight}>
    <Link className={styles.radarLead} href={`#earnings-day-${lead.reportDate}`}>
      <div className={styles.radarTop}>
        <div className={styles.radarIdentity}>
          <LogoTile symbol={lead.symbol} logoUrl={company?.logoUrl} className={styles.radarLogo} />
          <div><strong>{lead.symbol}</strong><span>{company?.name ?? lead.symbol}</span></div>
        </div>
        <time className={styles.radarDate} dateTime={lead.reportDate} aria-label={formatEtDateLong(lead.reportDate, locale)}>
          <span>{month}</span><strong>{Number(lead.reportDate.slice(-2))}</strong>
        </time>
      </div>
      <div className={styles.radarSession}><span>{weekday} <i aria-hidden>·</i> {timingOf(lead.hour, t).label}</span><ArrowUpRight size={16} aria-hidden /></div>
      {(lead.revenueEstimate != null || lead.epsEstimate != null) && <dl className={styles.radarEstimates}>
        {lead.revenueEstimate != null && <div><dt>{t.earnings.revenueEstimate}</dt><dd>{formatMoneyCompact(lead.revenueEstimate, locale, company?.currency)}</dd></div>}
        {lead.epsEstimate != null && <div><dt>{t.earnings.epsEstimate}</dt><dd>{formatPrice(lead.epsEstimate, locale, { currency: company?.currency || true })}</dd></div>}
      </dl>}
    </Link>
    </SpotlightCard>
    {featured.length > 1 && <div className={styles.radarFollowing} data-motion-stagger>{featured.slice(1).map(row => <Link key={row.symbol} href={`#earnings-day-${row.reportDate}`}>
      <LogoTile symbol={row.symbol} logoUrl={meta[row.symbol]?.logoUrl} size="sm" />
      <div><strong>{row.symbol}</strong><time dateTime={row.reportDate} title={formatEtDateLong(row.reportDate, locale)}>{formatEtDateCompact(row.reportDate, locale)}</time></div>
      <ArrowUpRight size={14} aria-hidden />
      <span className={styles.radarFollowingSession}>{timingOf(row.hour, t).label}</span>
    </Link>)}</div>}
  </section>;
}
