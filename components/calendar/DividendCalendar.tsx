import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  DataStamp,
  EmptyState,
  LogoTile,
  Panel,
  PanelHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { getDividendCalendar, DIVIDEND_WINDOW_DAYS } from "@/lib/dividend-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { readerDayOffset } from "@/lib/session-clock";
import {
  formatEtDateCompact,
  formatEtDateLong,
  formatPercentPlain,
  formatPrice,
  relativeDayLabel,
} from "@/lib/utils";
import styles from "./Dividends.module.css";

/**
 * Temettü takvimi — /takvim?tur=temettu.
 *
 * Gruplar HAK KESİM GÜNÜNE göre: okuyucunun sorusu "hangi gün alırsam
 * temettüyü alırım" ve cevabı gün başına tek. Grup başlığı hak kesim
 * gününü ve ondan bir önceki işlem gününü ("Almak İçin Son Gün") birlikte
 * yazıyor; satırlar yalnızca şirkete özgü olanı (tutar, ödeme, getiri).
 *
 * Tarihler kaynağın takvim günleri (ET); saat yok, çünkü hak kesim bir gün
 * olgusu. Türkiye'den bakınca da aynı gün: son alım günü o günün ABD
 * kapanışına kadar, yani TR akşamına kadar.
 */

const FREQUENCY_KEYS: Record<number, "freqMonthly" | "freqQuarterly" | "freqSemiannual" | "freqAnnual"> = {
  12: "freqMonthly",
  4: "freqQuarterly",
  2: "freqSemiannual",
  1: "freqAnnual",
};

export function frequencyLabel(frequency: number | null, t: Dictionary): string | null {
  if (frequency === null) return null;
  const key = FREQUENCY_KEYS[frequency];
  return key ? t.marketExtras[key] : null;
}

export async function DividendCalendar({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const result = await getDividendCalendar();
  const now = new Date();

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={x.dividendTitle}
        meta={
          result.ok
            ? x.dividendMeta
                .replace("{weeks}", String(DIVIDEND_WINDOW_DAYS / 7))
                .replace("{n}", String(result.count))
            : undefined
        }
      />
      {!result.ok ? (
        /* Okunamadı: "bu dönemde temettü yok" DEMİYORUZ — bilinmeyen,
           yok diye yazılmaz (IpoCalendar'daki ayrımın aynısı). */
        <EmptyState compact title={t.common.noData} hint={t.common.noDataHint} />
      ) : result.days.length === 0 ? (
        <EmptyState compact title={x.dividendEmpty} hint={x.dividendEmptyHint} />
      ) : (
        <div className={styles.days}>
          {result.days.map((day) => {
            const away = readerDayOffset(day.exDate, null, locale, now);
            return (
              <section key={day.exDate} className={styles.day} aria-labelledby={`temettu-${day.exDate}`}>
                <div className={styles.dayHead}>
                  <h3 id={`temettu-${day.exDate}`}>{formatEtDateLong(day.exDate, locale)}</h3>
                  {away >= 0 && <span className={styles.rel}>{relativeDayLabel(away, t.calendar)}</span>}
                  <span className={styles.dayTag}>{x.exDate}</span>
                  {day.lastBuy && (
                    <span className={styles.lastBuy}>
                      {x.lastBuy}: <strong>{formatEtDateLong(day.lastBuy, locale)}</strong>
                    </span>
                  )}
                </div>
                <ul className={styles.rows}>
                  {day.rows.map((row) => {
                    const freq = frequencyLabel(row.frequency, t);
                    return (
                      <li key={`${row.dividend.symbol}-${row.dividend.exDate}-${row.dividend.rate}`} className={styles.row}>
                        <Link href={`/hisse/${row.dividend.symbol}`} prefetch={false} className={styles.company}>
                          <LogoTile symbol={row.dividend.symbol} logoUrl={row.logoUrl} size="sm" />
                          <span className="min-w-0">
                            <span className={styles.symbol}>{row.dividend.symbol}</span>
                            <span className={styles.name}>{row.name}</span>
                          </span>
                        </Link>
                        <span className={styles.amount}>
                          <span className="numeral">{formatPrice(row.dividend.rate, locale, { currency: true, digits: row.dividend.rate < 0.1 ? 4 : 2 })}</span>
                          <span className={styles.amountUnit}>{x.perShare}</span>
                          {row.dividend.special && <span className={styles.badge}>{x.special}</span>}
                        </span>
                        <span className={styles.meta}>
                          {row.dividend.payableDate && (
                            <span>
                              {x.payable} <b className="numeral">{formatEtDateCompact(row.dividend.payableDate, locale)}</b>
                            </span>
                          )}
                          {row.yieldPct !== null && (
                            <span>
                              {x.yieldEstimate} <b className="numeral">~{formatPercentPlain(row.yieldPct, locale, 1)}</b>
                            </span>
                          )}
                          {freq && <span>{freq}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <div className={styles.notes}>
        <p>{x.t1Rule}</p>
        <p>{x.yieldMethod}</p>
        <p>
          {x.withholding}{" "}
          {/* Oran bireysel yatırımcı için anlaşma oranı (%20); %15 yalnızca
              oy hakkının %10'unu tutan şirketlere uygulanıyor. */}
          <Link href="/rehber/w-8ben" className={styles.inlineLink}>{x.w8benGuide}</Link>
          <span aria-hidden> · </span>
          <Link href="/vergi" className={styles.inlineLink}>{x.taxGuide}</Link>
        </p>
        <p>{x.dividendCoverage}</p>
      </div>
      {result.ok && (
        <DataStamp labels={t.data} source={x.dividendSource} at={result.fetchedAt} locale={locale} className={styles.stamp} />
      )}
    </Panel>
  );
}

/** İskelette gün ve satır sayısı — gerçek listenin ilk ekranı kadar. */
const SKELETON_DAYS = 3;
const SKELETON_ROWS = 4;

/**
 * Yükleme yedeği — gerçek panelle AYNI başlık, gün ve satır yapısı.
 *
 * Takvim dört haftalık pencerede bütün endeks üyelerinin temettüsünü
 * soruyor; soğuk önbellekte sayfanın ilk baytı bu sorguyu bekliyordu
 * (0,9 saniye, 28 Eylül ölçümü). Panel artık Suspense içinde ve yedek
 * yükseklikle değil yapıyla eşleşiyor: başlık aynı metni taşıyor, satırlar
 * aynı dolguyla basılıyor ve veri indiğinde düzen kaymıyor.
 */
export function DividendCalendarSkeleton({ t }: { t: Dictionary }) {
  return (
    <Panel className={styles.panel}>
      <PanelHeader title={t.marketExtras.dividendTitle} />
      <div className={styles.days} aria-hidden>
        {Array.from({ length: SKELETON_DAYS }, (_, day) => (
          <section key={day} className={styles.day}>
            <div className={styles.dayHead}>
              <Skeleton className="h-4 w-40" />
            </div>
            <ul className={styles.rows}>
              {Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <li key={row} className={styles.row}>
                  <Skeleton className="h-9 w-48" />
                  <Skeleton className="h-4 w-16" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}
