import { cache, type CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import {
  DataStamp,
  EmptyState,
  LogoTile,
  Panel,
  PanelHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { getDividendCalendar, DIVIDEND_WINDOW_DAYS, type DividendCalendarDay } from "@/lib/dividend-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { readerDayOffset } from "@/lib/session-clock";
import {
  etDateParts,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercentPlain,
  formatPrice,
  relativeDayLabel,
} from "@/lib/utils";
import styles from "./DividendTimeline.module.css";

/**
 * Temettü takvimi — /takvim?tur=temettu.
 *
 * ÜÇ KATMAN, TEK VERİ. Kahramanın yanında sıradaki hak kesim günü ve o gün
 * temettüyü almak için son gün; panelin başında dört haftanın iş günleri
 * yoğunluk şeridi olarak; altında günlere göre bir zaman çizelgesi. Üçü de
 * aynı `loadCalendar` çağrısını okuyor (istek içinde bir kez).
 *
 * Gruplar HAK KESİM GÜNÜNE göre: okuyucunun sorusu "hangi gün alırsam
 * temettüyü alırım" ve cevabı gün başına tek. O yüzden her günün en
 * görünür satırı "Almak İçin Son Gün"; satırlar yalnızca şirkete özgü
 * olanı taşıyor (tutar, ödeme, getiri).
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

const loadCalendar = cache(getDividendCalendar);

/** Kahramandaki logo mozaiğinde gösterilen en fazla şirket; fazlası "+N". */
const HERO_LOGOS = 8;
/** Şeridin yoğunluk basamakları: 1, 2–3, 4–6, 7 ve üstü ödeme. */
const HEAT_STEPS = [1, 2, 4, 7] as const;
/** Pazartesi–Cuma. */
const WEEKDAYS = 5;
const DAYS_IN_WEEK = 7;

function heatLevel(count: number): number {
  let level = 0;
  HEAT_STEPS.forEach((step, index) => {
    if (count >= step) level = index + 1;
  });
  return level;
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function amountText(rate: number, locale: Locale): string {
  /* Kuruşun altındaki tutarlar (aylık ödeyen fonlar) iki basamakta "0,00 $"
     görünürdü. */
  const SMALL_AMOUNT = 0.1;
  return formatPrice(rate, locale, { currency: true, digits: rate < SMALL_AMOUNT ? 4 : 2 });
}

/* ---------------------------------------------------------------------------
   Kahraman: sıradaki hak kesim
   --------------------------------------------------------------------------- */

/**
 * Sıradaki hak kesim günü — kahramanın sağında.
 *
 * Takvimin en çok sorulan tek sorusu "en yakın temettüyü almak için ne
 * zamana kadar vaktim var" ve cevabı listenin ilk grubunun başlığında
 * gömülüydü. Burada büyük puntoyla: son alım günü, hak kesim günü ve o gün
 * kimin ödediği logolarla.
 */
export async function DividendHero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const result = await loadCalendar();
  if (!result.ok || result.days.length === 0) return null;
  const next = result.days[0];
  const lastBuy = next.lastBuy;
  const away = lastBuy ? readerDayOffset(lastBuy, null, locale, new Date()) : null;
  const shown = next.rows.slice(0, HERO_LOGOS);
  const more = next.rows.length - shown.length;

  return (
    <div className={styles.hero}>
      <div className={styles.heroTop}>
        <h2 className={styles.heroTitle}>{x.dividendNext}</h2>
        <p className={styles.heroCount}>
          <RollingFigure value={String(result.count)} className={styles.heroCountNumber} />
          <span>{x.dividendPaymentsUnit}</span>
        </p>
      </div>

      {lastBuy && (
        <a href={`#temettu-${next.exDate}`} className={styles.heroLastBuy}>
          <span className={styles.heroLastBuyLabel}>{x.lastBuy}</span>
          <span className={styles.heroLastBuyDate}>{formatEtDateLong(lastBuy, locale)}</span>
          {away !== null && away >= 0 && (
            <span className={styles.heroRel}>{relativeDayLabel(away, t.calendar)}</span>
          )}
        </a>
      )}

      <p className={styles.heroEx}>
        {x.exDate}: <strong>{formatEtDateLong(next.exDate, locale)}</strong>
      </p>

      <ul className={styles.heroLogos} aria-label={x.dividendNextCompanies}>
        {shown.map((row, index) => (
          <li key={`${row.dividend.symbol}-${row.dividend.rate}`} style={{ "--i": index } as CSSProperties}>
            <Link href={`/hisse/${row.dividend.symbol}`} prefetch={false} title={row.name} className={styles.heroLogo}>
              <LogoTile symbol={row.dividend.symbol} logoUrl={row.logoUrl} size="md" />
              <span className="sr-only">{row.name}</span>
            </Link>
          </li>
        ))}
        {more > 0 && (
          <li className={styles.heroMore} style={{ "--i": shown.length } as CSSProperties}>
            {x.dividendMore.replace("{n}", String(more))}
          </li>
        )}
      </ul>
    </div>
  );
}

/** Kahraman yedeği — aynı kutular, veri inince kayma yok. */
export function DividendHeroSkeleton({ t }: { t: Dictionary }) {
  return (
    <div className={styles.hero} aria-hidden>
      <div className={styles.heroTop}>
        <p className={styles.heroTitle}>{t.marketExtras.dividendNext}</p>
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-[74px] w-full rounded-2xl" />
      <Skeleton className="h-4 w-48" />
      <div className={styles.heroLogos}>
        {Array.from({ length: HERO_LOGOS }, (_, index) => (
          <Skeleton key={index} className="size-8 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Dört haftalık şerit
   --------------------------------------------------------------------------- */

/**
 * Pencerenin iş günleri, Pazartesi başlayan haftalar hâlinde: her hücre
 * gününün ödeme sayısını tonla ve sayıyla söylüyor, dolu hücre o günün
 * çizelge grubuna iniyor. Hafta sonu yok — hak kesim bir işlem günü olgusu.
 */
function DividendStrip({
  days,
  locale,
  t,
}: {
  days: DividendCalendarDay[];
  locale: Locale;
  t: Dictionary;
}) {
  const today = todayEt();
  const until = addEtDays(today, DIVIDEND_WINDOW_DAYS);
  const counts = new Map(days.map((day) => [day.exDate, day.rows.length]));
  /* HAFTA SONU ŞERİT GELECEK PAZARTESİDEN BAŞLIYOR. Pazar günü "bu
     haftanın pazartesisi" biten haftaydı ve şeridin ilk satırı baştan sona
     geçmiş, sönük beş hücreydi (27 Eylül pazar, ölçüldü). */
  const weekday = weekdayOf(today);
  const SATURDAY = 6;
  const monday =
    weekday === 0 || weekday === SATURDAY
      ? addEtDays(today, (DAYS_IN_WEEK + 1 - weekday) % DAYS_IN_WEEK)
      : addEtDays(today, 1 - weekday);

  const weeks: string[][] = [];
  for (let start = monday; start <= until; start = addEtDays(start, DAYS_IN_WEEK)) {
    weeks.push(Array.from({ length: WEEKDAYS }, (_, index) => addEtDays(start, index)));
  }
  const weekdayNames = weeks[0].map((date) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { weekday: "short", timeZone: "UTC" }).format(
      new Date(`${date}T12:00:00Z`),
    ),
  );

  return (
    <nav className={styles.strip} aria-label={t.marketExtras.dividendStripLabel}>
      <div className={styles.stripHead} aria-hidden>
        {weekdayNames.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <ol key={week[0]} className={styles.stripWeek}>
          {week.map((date, index) => {
            const count = counts.get(date) ?? 0;
            const outside = date < today || date > until;
            const parts = etDateParts(date, locale);
            const inner = (
              <>
                <span className={styles.cellDay}>
                  {parts.day}
                  {(parts.day === "1" || date === week[0]) && <span className={styles.cellMonth}>{parts.month}</span>}
                </span>
                {count > 0 && <span className={`figure ${styles.cellCount}`}>{count}</span>}
              </>
            );
            return (
              <li
                key={date}
                className={styles.cell}
                data-heat={heatLevel(count)}
                data-today={date === today || undefined}
                data-outside={outside || undefined}
                style={{ "--i": index } as CSSProperties}
              >
                {count > 0 ? (
                  <a href={`#temettu-${date}`} className={styles.cellLink}>
                    <span className="sr-only">
                      {formatEtDateLong(date, locale)}: {t.marketExtras.dividendPaymentsCount.replace("{n}", String(count))}
                    </span>
                    <span aria-hidden className={styles.cellInner}>
                      {inner}
                    </span>
                  </a>
                ) : (
                  <span className={styles.cellInner} aria-hidden>
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------------------
   Zaman çizelgesi
   --------------------------------------------------------------------------- */

export async function DividendCalendar({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const result = await loadCalendar();
  const now = new Date();
  /* Getiri çubuğunun ölçeği pencerenin en yüksek getirisi: sayı hücrede
     yazılı, çubuk yalnızca "hangisi daha yüksek" sorusunu okumadan
     cevaplıyor. Bir BÜYÜKLÜK, yargı değil — yüksek getiri "iyi" demek değil,
     renk nötr. */
  const maxYield = result.ok
    ? Math.max(0, ...result.days.flatMap((day) => day.rows.map((row) => row.yieldPct ?? 0)))
    : 0;

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={x.dividendTitle}
        meta={
          result.ok
            ? x.dividendMeta
                .replace("{weeks}", String(DIVIDEND_WINDOW_DAYS / DAYS_IN_WEEK))
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
        <>
          <DividendStrip days={result.days} locale={locale} t={t} />
          <ol className={styles.timeline}>
            {result.days.map((day) => {
              const away = readerDayOffset(day.exDate, null, locale, now);
              const parts = etDateParts(day.exDate, locale);
              const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
                weekday: "long",
                timeZone: "UTC",
              }).format(new Date(`${day.exDate}T12:00:00Z`));
              return (
                <li key={day.exDate} className={styles.day} id={`temettu-${day.exDate}`}>
                  {/* Sol ray: tarih karosu ve çizelgenin çizgisi. */}
                  <div className={styles.rail} aria-hidden>
                    <span className={`figure ${styles.railDay}`}>{parts.day}</span>
                    <span className={styles.railMonth}>{parts.month}</span>
                  </div>
                  <section className={styles.dayBody} aria-labelledby={`temettu-h-${day.exDate}`}>
                    <header className={styles.dayHead}>
                      <h3 id={`temettu-h-${day.exDate}`} className={styles.dayTitle}>
                        {formatEtDateLong(day.exDate, locale)}
                      </h3>
                      <span className={styles.dayTag}>{x.exDate}</span>
                      {away >= 0 && <span className={styles.rel}>{relativeDayLabel(away, t.calendar)}</span>}
                      <span className="sr-only">{weekday}</span>
                    </header>
                    {day.lastBuy && (
                      <p className={styles.lastBuy}>
                        <span>{x.lastBuy}</span>
                        <strong>{formatEtDateLong(day.lastBuy, locale)}</strong>
                      </p>
                    )}
                    <ul className={styles.rows}>
                      {day.rows.map((row) => {
                        const freq = frequencyLabel(row.frequency, t);
                        return (
                          <li key={`${row.dividend.symbol}-${row.dividend.exDate}-${row.dividend.rate}`} className={styles.row}>
                            <Link href={`/hisse/${row.dividend.symbol}`} prefetch={false} className={styles.company}>
                              <LogoTile symbol={row.dividend.symbol} logoUrl={row.logoUrl} size="md" className={styles.logo} />
                              <span className="min-w-0">
                                <span className={styles.symbol}>{row.dividend.symbol}</span>
                                <span className={styles.name}>{row.name}</span>
                              </span>
                            </Link>
                            <span className={styles.amount}>
                              <span className={`numeral ${styles.amountValue}`}>{amountText(row.dividend.rate, locale)}</span>
                              <span className={styles.amountUnit}>
                                {x.perShare}
                                {row.dividend.special && <span className={styles.badge}>{x.special}</span>}
                              </span>
                            </span>
                            <span className={styles.yield}>
                              {row.yieldPct !== null ? (
                                <>
                                  <span className={styles.yieldText}>
                                    <span className={styles.yieldLabel}>{x.yieldEstimate}</span>
                                    <b className="numeral">~{formatPercentPlain(row.yieldPct, locale, 1)}</b>
                                  </span>
                                  <span className={styles.yieldBar} aria-hidden>
                                    <span
                                      className={styles.yieldFill}
                                      style={{ "--ratio": maxYield > 0 ? row.yieldPct / maxYield : 0 } as CSSProperties}
                                    />
                                  </span>
                                </>
                              ) : null}
                            </span>
                            <span className={styles.meta}>
                              {row.dividend.payableDate && (
                                <span>
                                  {x.payable} <b className="numeral">{formatEtDateCompact(row.dividend.payableDate, locale)}</b>
                                </span>
                              )}
                              {freq && <span>{freq}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </li>
              );
            })}
          </ol>
        </>
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
const SKELETON_WEEKS = 5;

/**
 * Yükleme yedeği — gerçek panelle AYNI başlık, şerit, ray ve satır yapısı.
 *
 * Takvim dört haftalık pencerede bütün endeks üyelerinin temettüsünü
 * soruyor; soğuk önbellekte sayfanın ilk baytı bu sorguyu bekliyordu
 * (0,9 saniye, 28 Eylül ölçümü). Panel Suspense içinde ve yedek
 * yükseklikle değil yapıyla eşleşiyor: başlık aynı metni taşıyor, şerit
 * aynı ızgara, satırlar aynı dolguyla basılıyor.
 */
export function DividendCalendarSkeleton({ t }: { t: Dictionary }) {
  return (
    <Panel className={styles.panel}>
      <PanelHeader title={t.marketExtras.dividendTitle} />
      <div className={styles.strip} aria-hidden>
        <div className={styles.stripHead}>
          {Array.from({ length: WEEKDAYS }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        {Array.from({ length: SKELETON_WEEKS }, (_, week) => (
          <div key={week} className={styles.stripWeek}>
            {Array.from({ length: WEEKDAYS }, (_, index) => (
              <div key={index} className={styles.cell} data-heat="0" />
            ))}
          </div>
        ))}
      </div>
      <div className={styles.timeline} aria-hidden>
        {Array.from({ length: SKELETON_DAYS }, (_, day) => (
          <div key={day} className={styles.day}>
            <div className={styles.rail}>
              <Skeleton className="h-7 w-8" />
            </div>
            <div className={styles.dayBody}>
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
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
