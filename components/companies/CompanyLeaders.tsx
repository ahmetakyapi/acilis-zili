import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LogoTile } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { formatMoneyCompact } from "@/lib/utils";
import styles from "./CompanyLeaders.module.css";

type Leader = { symbol: string; name: string; logoUrl: string | null; marketCap: number | null };

/** The former orbital selector showed a second company/market-cap reading
 * below ten logos. That added 90px to the cover (355.8px at 1440px) and
 * required two interactions to open a company. The ranked shelf now links
 * directly to each company. Ranking still comes from the directory's real
 * market caps; equal logo sizes are navigation, not a size comparison. */
export function CompanyLeaders({ leaders, labels, locale }: {
  leaders: Leader[];
  labels: Dictionary["directory"];
  locale: Locale;
}) {
  const visible = leaders.slice(0, 10);
  if (!visible.length) return null;
  /* Çubuğun ölçeği listenin BİRİNCİSİ: doğrusal, logaritmik değil (gerekçe
     tablolardaki piyasa değeri çubuğuyla aynı — büyüklüğü çarpıtmamak). */
  const peak = Math.max(...visible.map((item) => item.marketCap ?? 0), 1);

  return <section className={styles.leaders} aria-label={labels.marketLeaders}>
    <div className={styles.heading}>
      <h2>{labels.marketLeaders}</h2>
      <span>{labels.leadersByCap}</span>
    </div>
    <ol className={styles.choices} data-motion-stagger>
      {visible.map((item, index) => <li key={item.symbol}>
        <Link href={withLocale(`/hisse/${item.symbol}`, locale)} prefetch={false}
          className={styles.company} data-first={index === 0 || undefined} aria-label={`${item.name} (${item.symbol})`} title={item.name}>
          <span className={styles.rank} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <ArrowUpRight className={styles.open} size={12} aria-hidden="true" />
          <span className={styles.logo}><LogoTile symbol={item.symbol} logoUrl={item.logoUrl} className="size-10" /></span>
          <span className={styles.symbol}>{item.symbol}</span>
          <span className={styles.cap}>{formatMoneyCompact(item.marketCap, locale)}</span>
          {/* PAY ÇUBUĞU (26 Eylül): logoların eşit boyu gezinme içindi,
              büyüklük söylemiyordu. Karonun dibinde birinciye oranla ince
              bir çubuk; görünüme girince soldan uzuyor. */}
          {item.marketCap ? (
            <span aria-hidden className={styles.share}>
              <i data-motion-draw="line" style={{ width: `${Math.max(4, (item.marketCap / peak) * 100)}%` }} />
            </span>
          ) : null}
        </Link>
      </li>)}
    </ol>
  </section>;
}
