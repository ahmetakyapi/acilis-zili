import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { technicalHref } from "@/lib/technical";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import styles from "./Technical.module.css";

export type MoreSymbolEntry = {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  /** Son yayının görüşü; henüz analizi yoksa null. */
  verdict: VerdictKey | null;
  changePct: number | null;
};

/**
 * Detay sayfasının çıkışı: öteki şirketler.
 *
 * Sayfanın sonunda okuyucunun elinde tek bir hissenin görüşü var ve gidecek
 * yeri yoktu — dipnottaki "Bütün Hisseler" bağlantısı onu LİSTEYE, yani bir
 * ara durağa gönderiyordu. Oysa liste on iki karttan ibaret; o kartların
 * kendisi buraya sığıyor. Okuyucu MRVL'yi bitirince NVDA'ya tek dokunuşla
 * geçiyor, geriye dönüp listeyi bulmak zorunda kalmıyor.
 *
 * Kartta üç şey var ve üçü de "bir sonrakine geçmeli miyim" sorusunun
 * cevabı: kim (logo + ad), ne diyor (görüş rozeti), bugün ne yapıyor
 * (değişim). Seviyeler ve metin kasten yok — onlar kendi sayfasının işi,
 * burada olsalardı kart listedeki kartın kopyası olurdu.
 *
 * Analizi henüz olmayan sembol de basılıyor, rozetsiz: liste TECHNICAL_SYMBOLS
 * ve o listenin tamamı okuyucunun gidebileceği yer. Rozetin yokluğu zaten
 * "bu hissede henüz yayın yok" diyor.
 */
export function MoreSymbols({
  entries,
  locale,
  t,
}: {
  entries: readonly MoreSymbolEntry[];
  locale: Locale;
  t: Dictionary;
}) {
  if (entries.length === 0) return null;

  return (
    <section id="technical-more" className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.sectionTitle}>{t.technical.moreSymbols}</h2>
        <Link href="/teknik" className={styles.moreAll}>
          {t.technical.allStocks} ↗
        </Link>
      </div>
      <ul className={styles.moreGrid}>
        {entries.map((entry) => (
          <li key={entry.symbol}>
            <Link
              href={technicalHref(entry.symbol)}
              prefetch={false}
              className={styles.moreCard}
            >
              <span className={styles.moreHead}>
                <LogoTile symbol={entry.symbol} logoUrl={entry.logoUrl} size="md" />
                <span className={styles.moreIdentity}>
                  <strong className="numeral">{entry.symbol}</strong>
                  <span>{entry.name ?? entry.symbol}</span>
                </span>
              </span>
              <span className={styles.moreFoot}>
                {entry.verdict ? (
                  <span className={cn(styles.morePill, verdictPillClass(entry.verdict))}>
                    {verdictLabel(entry.verdict, t)}
                  </span>
                ) : (
                  <span className={styles.moreSoon}>{t.technical.noEditionYet}</span>
                )}
                {entry.changePct !== null && (
                  <span
                    className={cn(
                      "numeral",
                      styles.moreChange,
                      directionText(directionOf(entry.changePct)),
                    )}
                  >
                    {formatPercent(entry.changePct, locale)}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
