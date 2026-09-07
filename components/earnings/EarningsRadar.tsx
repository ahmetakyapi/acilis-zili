import Link from "next/link";
import { ArrowUpRight, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { LogoTile } from "@/components/ui/primitives";
import { timingOf } from "./EarningsCalendar";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsRow } from "@/lib/schema";
import type { SymbolMeta } from "@/lib/data";
import { formatEtDateLong, formatMoneyCompact, formatPrice } from "@/lib/utils";
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
  return <div className={styles.radar}>
    <div className={styles.visualHeader}><h2>{t.directory.earningsRadar}</h2><CalendarBlank size={17} /></div>
    <Link className={styles.radarLead} href={`#earnings-day-${lead.reportDate}`}>
      <div className={styles.radarIdentity}><LogoTile symbol={lead.symbol} logoUrl={company?.logoUrl} className="size-12" /><div><strong>{lead.symbol}</strong><span>{company?.name ?? lead.symbol}</span></div><ArrowUpRight size={20} /></div>
      <div className={styles.radarDate}><i aria-hidden /><span>{formatEtDateLong(lead.reportDate, locale)}<small>{timingOf(lead.hour, t).label}</small></span></div>
      {(lead.revenueEstimate != null || lead.epsEstimate != null) && <dl className={styles.radarEstimates}>
        {lead.revenueEstimate != null && <div><dt>{t.earnings.revenueEstimate}</dt><dd>{formatMoneyCompact(lead.revenueEstimate, locale, company?.currency)}</dd></div>}
        {lead.epsEstimate != null && <div><dt>{t.earnings.epsEstimate}</dt><dd>{formatPrice(lead.epsEstimate, locale, { currency: company?.currency || true })}</dd></div>}
      </dl>}
    </Link>
    <div className={styles.radarFollowing} data-motion-stagger>{featured.slice(1).map(row => <Link key={row.symbol} href={`#earnings-day-${row.reportDate}`}><LogoTile symbol={row.symbol} logoUrl={meta[row.symbol]?.logoUrl} size="xs" /><strong>{row.symbol}</strong><span className={styles.radarFollowingDate}>{formatEtDateLong(row.reportDate, locale)}</span><ArrowUpRight size={13} /></Link>)}</div>
  </div>;
}
