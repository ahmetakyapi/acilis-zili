import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import { PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { CapitalBoard } from "./CapitalBoard";
import { filedLabel, quarterLabel } from "./format";
import { gridEntries } from "./InvestorGrid";
import styles from "./InvestorsIndex.module.css";

/**
 * Dizinin kapağı (6 Kasım): solda başlık, tek cümle ve dönem künyesi;
 * sağda sermaye panosu (`CapitalBoard`, gerekçe orada). Paylaş sağ kolonun
 * tepesinde — kapağın sağ üst köşesi, sitenin dizin kapaklarındaki yeri
 * (sahibinin 10 Ekim tercihi, `PageShare`). Bu yüzden `PageHeader`a
 * `share` verilmiyor: başlık satırına girerse 1440'ta sol kolonun ucunda,
 * sayfanın ortasında kalıyordu.
 *
 * Izgara `page-frame`in İÇİNDE ayrı bir kutu: `page-frame` telefonda
 * kolonları üç sınıflık özgüllükle tek kolona eziyor (globals.css), alanlı
 * ızgarayı onunla yarıştırmamak için.
 */
export function InvestorsMasthead({
  overview,
  share,
  locale,
  t,
}: {
  overview: Overview | null;
  share: ReactNode;
  locale: string;
  t: Dictionary["investors"];
}) {
  const period = overview?.movers.period ?? null;
  const capital = overview ? gridEntries(overview).capital : null;
  const hasBoard = Boolean(capital && capital.total > 0);
  return (
    <section className={cn("page-frame", styles.masthead)}>
      <div className={styles.mastGrid} data-board={hasBoard || undefined}>
        <div className={styles.mastCopy}>
          <PageHeader embedded title={t.title} subtitle={t.subtitle} />
          {/* Künye başlığın ALTINDA (üst künye yok, 9 Ekim): hangi çeyreğin
              portföyleri ve en son ne zaman bildirildi. */}
          {(period || overview?.latestFiled) && (
            <p className={cn(styles.kunye, "numeral")}>
              {period && <span>{quarterLabel(period, t)}</span>}
              {overview?.latestFiled && <span>{filedLabel(overview.latestFiled, locale, t)}</span>}
            </p>
          )}
        </div>
        <div className={styles.mastShare}>{share}</div>
        {capital && hasBoard && (
          <div className={styles.mastBoard}>
            <CapitalBoard capital={capital} locale={locale} t={t} />
          </div>
        )}
      </div>
    </section>
  );
}
