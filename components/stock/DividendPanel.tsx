import { frequencyLabel } from "@/components/calendar/DividendCalendar";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { getSymbolDividends } from "@/lib/dividend-data";
import { getDictionary, type Locale } from "@/lib/i18n";
import { todayEt } from "@/lib/market-hours";
import {
  formatEtDateCompact,
  formatEtDateLong,
  formatEtDateMedium,
  formatPercentPlain,
  formatPrice,
  cn,
  plural,
} from "@/lib/utils";
import styles from "@/components/calendar/Dividends.module.css";

/**
 * Hisse sayfasının temettü paneli — sunucu bileşeni.
 *
 * Sıra ekran düzeninin sırası: başlık, sıradaki hak kesim (künye şeridi),
 * yıllara göre toplam (ölçü ızgarası, çubuklu), son ödemeler, künyeler
 * (stopaj, T+1), damga.
 *
 * YIL TOPLAMI ÇUBUKLU, çünkü panelin sorduğu soru "temettü artıyor mu" ve
 * cevabı üç sayının karşılaştırması (CLAUDE.md: karşılaştırılan her
 * büyüklük bir de çizgi olarak okunur). İçinde bulunulan yıl KISMİ ve
 * öyle etiketleniyor: eylüldeki bir yılın toplamı, tam yılın yanında
 * düşüş gibi okunurdu.
 *
 * Sayfaya yerleşimi bu paketin işi değil; çağıran yalnızca `symbol` ve
 * `locale` veriyor, sözlüğü panel kendisi okuyor.
 */

const RECENT_ROWS = 4;
/** Tutar bu değerin altındaysa dört hane: 0,0325 $ iki haneyle 0,03 olurdu. */
const SMALL_RATE = 0.1;
const SMALL_RATE_DIGITS = 4;

export async function DividendPanel({
  symbol,
  locale,
  wide = false,
}: {
  symbol: string;
  locale: Locale;
  /** Tam genişlikte duruyorsa: yıl toplamları ile son ödemeler yan yana. */
  wide?: boolean;
}) {
  const t = getDictionary(locale);
  const x = t.marketExtras;
  const result = await getSymbolDividends(symbol);
  const money = (value: number) =>
    formatPrice(value, locale, { currency: true, digits: value < SMALL_RATE ? SMALL_RATE_DIGITS : 2 });

  if (!result.ok) {
    return (
      <Panel className={styles.panel}>
        <PanelHeader title={x.panelTitle} />
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      </Panel>
    );
  }

  const { past, next } = result;
  const currentYear = Number(todayEt().slice(0, 4));
  const years = new Map<number, { total: number; count: number }>();
  for (const item of past) {
    const year = Number(item.exDate.slice(0, 4));
    const entry = years.get(year) ?? { total: 0, count: 0 };
    entry.total += item.rate;
    entry.count += 1;
    years.set(year, entry);
  }
  const yearRows = [...years.entries()].sort(([a], [b]) => b - a);
  const peak = Math.max(...yearRows.map(([, entry]) => entry.total), Number.EPSILON);
  const recent = [...past].reverse().slice(0, RECENT_ROWS);
  const freq = frequencyLabel(result.frequency, t);

  return (
    <Panel className={cn(styles.panel, wide && styles.panelWide)}>
      <PanelHeader title={x.panelTitle} meta={freq ?? undefined} />
      {past.length === 0 && !next ? (
        <p className={styles.panelEmpty}>{x.panelNone}</p>
      ) : (
        <>
          {next && (
            <div className={styles.nextStrip}>
              <div>
                <span className={styles.stripLabel}>{x.nextExDate}</span>
                <strong>{formatEtDateLong(next.exDate, locale)}</strong>
              </div>
              {result.nextLastBuy && (
                <div>
                  <span className={styles.stripLabel}>{x.lastBuy}</span>
                  <strong>{formatEtDateLong(result.nextLastBuy, locale)}</strong>
                </div>
              )}
              <div>
                <span className={styles.stripLabel}>{x.amount}</span>
                <strong className="numeral">{money(next.rate)}</strong>
              </div>
              {next.payableDate && (
                <div>
                  <span className={styles.stripLabel}>{x.payableLong}</span>
                  <strong className="numeral">{formatEtDateCompact(next.payableDate, locale)}</strong>
                </div>
              )}
            </div>
          )}

          {/* GÖVDE SARMALI — dar panelde `display:contents` (düzen eskisi
              gibi), `wide`da iki sütunluk ızgara. */}
          <div className={styles.panelBody}>
          {yearRows.length > 0 && (
            <dl className={styles.years}>
              {yearRows.map(([year, entry]) => (
                <div key={year}>
                  <dt>
                    <span className="numeral">{year}</span>
                    {year === currentYear && <span className={styles.partial}>{x.partialYear}</span>}
                  </dt>
                  <dd>
                    <span className="numeral">{money(entry.total)}</span>
                    <span className={styles.count}>{plural(entry.count, x.paymentsOne, x.payments).replace("{n}", String(entry.count))}</span>
                    <ScaleBar ratio={entry.total / peak} signed={false} className={styles.yearBar} />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {recent.length > 0 && (
            <div className={styles.recent}>
              <h3>{x.recentPayments}</h3>
              <ul>
                {recent.map((item) => (
                  <li key={`${item.exDate}-${item.rate}`}>
                    <span className="numeral">{formatEtDateMedium(item.exDate, locale)}</span>
                    <span className="numeral">{money(item.rate)}</span>
                    {item.special && <span className={styles.badge}>{x.special}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>

          {result.yieldPct !== null && (
            <p className={styles.yieldLine}>
              {x.yieldEstimate} <b className="numeral">~{formatPercentPlain(result.yieldPct, locale, 1)}</b>
            </p>
          )}
        </>
      )}
      <div className={styles.notes}>
        <p>
          {x.withholding}{" "}
          {/* Oran bireysel yatırımcı için anlaşma oranı (%20); %15 yalnızca
              oy hakkının %10'unu tutan şirketlere uygulanıyor. */}
          <Link href="/rehber/w-8ben" className={styles.inlineLink}>{x.w8benGuide}</Link>
          <span aria-hidden> · </span>
          <Link href="/vergi" className={styles.inlineLink}>{x.taxGuide}</Link>
        </p>
        {next && <p>{x.t1Rule}</p>}
        {result.yieldPct !== null && <p>{x.yieldMethod}</p>}
      </div>
      <DataStamp labels={t.data} source={x.dividendSource} at={result.fetchedAt} locale={locale} className={styles.stamp} />
    </Panel>
  );
}
