import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { AlsoReporting } from "@/components/earnings/AlsoReporting";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import { timingOf } from "@/components/earnings/EarningsCalendar";
import { LogoTile, TimingChip } from "@/components/ui/primitives";
import type { AnalysisBadge as AnalysisBadgeData } from "@/lib/data";
import {
  epsSurprise,
  laneOf,
  type ScheduleDay,
  type ScheduleRow,
} from "@/lib/earnings-week";
import type { Dictionary, Locale } from "@/lib/i18n";
import { zoneTag } from "@/lib/session-clock";
import { cn, formatEtDateLong, formatMoneyCompact, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./WeekSchedule.module.css";

/**
 * Haftanın Takvimi — `/bilancolar/hafta` sekmesinin ikinci paneli.
 *
 * TAKVİM SEKMESİNİ TEKRAR ETMİYOR, TAMAMLIYOR. `/bilancolar` bugünden ileri
 * kayan bir pencere ve kart dili konuşuyor (günün devleri tam satır, sonraki
 * altı mini kart); geçmiş günü hiç göstermiyor. Bu panel sabit bir
 * pazartesi–cuma ve TABLO dili: satırlar aynı sütunlarda, yani beş günün
 * EPS beklentisi aynı hatta okunuyor. Haftanın geçmiş günlerinde gerçekleşen
 * EPS ve beklentiden sapma da burada — takvim sekmesinin ileriye bakan
 * listesinde yeri yok. Sütun yalnızca haftada en az bir gerçekleşen varsa
 * açılıyor; gelecek bir haftada boş bir sütun olurdu.
 *
 * TELEFONDA SATIR İKİ KAT, KAYDIRMA YOK. Altı sütun 358 piksele sığmıyor
 * ve CLAUDE.md sığmayan tabloyu kaba zorlamayı yasaklıyor; burada kaydırma
 * yerine satırın kendisi kırılıyor: üstte şirket ve saat, altta etiketli
 * ölçüler. Etiketler geniş ekranda başlık satırına çıkıyor ve hücrelerde
 * yalnızca ekran okuyucuya kalıyor.
 *
 * Satır şirket sayfasına gider (`data-cc` ile şirket kartı); analiz rozeti
 * kendi bağlantısıyla üstte (`AnalysisBadge`, iç içe bağlantı yok).
 */
export function WeekSchedule({
  schedule,
  badges,
  watchSet,
  today,
  locale,
  t,
}: {
  schedule: ScheduleDay[];
  badges: Record<string, AnalysisBadgeData>;
  watchSet: ReadonlySet<string>;
  today: string;
  locale: Locale;
  t: Dictionary;
}) {
  const e = t.earningsWeek;
  const hasActuals = schedule.some((day) => day.listed.some((row) => row.epsActual !== null));
  /* Piyasa değeri çizgisi listenin en büyüğüne göre — mozaikle aynı ölçek. */
  const peak = Math.max(0, ...schedule.flatMap((day) => day.listed.map((row) => row.marketCap ?? 0)));

  return (
    <div className={styles.schedule} data-actuals={hasActuals || undefined}>
      <div className={styles.head} aria-hidden>
        <span>{e.colCompany}</span>
        <span>{e.colTime}</span>
        <span className={styles.num}>{e.colEps}</span>
        {hasActuals && <span className={styles.num}>{e.colEpsActual}</span>}
        <span className={styles.num}>{e.colRevenue}</span>
        <span className={styles.num}>{e.colCap}</span>
        <span className={styles.num}>{e.colAnalysis}</span>
      </div>
      {schedule.map((day) => (
        <DayBlock
          key={day.date}
          day={day}
          peak={peak}
          hasActuals={hasActuals}
          badges={badges}
          watchSet={watchSet}
          today={today}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function DayBlock({
  day,
  peak,
  hasActuals,
  badges,
  watchSet,
  today,
  locale,
  t,
}: {
  day: ScheduleDay;
  peak: number;
  hasActuals: boolean;
  badges: Record<string, AnalysisBadgeData>;
  watchSet: ReadonlySet<string>;
  today: string;
  locale: Locale;
  t: Dictionary;
}) {
  const e = t.earningsWeek;
  const w = t.earningsExtra.week;
  const state = day.date === today ? "today" : day.date < today ? "past" : "ahead";
  const restTotal = day.rest.bmo.length + day.rest.amc.length + day.rest.other.length;
  const headingId = `week-schedule-${day.date}`;

  return (
    <section className={styles.day} aria-labelledby={headingId} data-state={state}>
      <header className={styles.dayHead}>
        {/* Gün başlığı h3: panelin h2'si "Haftanın Takvimi". Tarihin
            tamamı ve gün adı başlıkta ("28 Eylül Pazartesi"), takvim
            sekmesinin gün başlığıyla aynı biçim. */}
        <h3 id={headingId} className={styles.dayTitle}>
          {formatEtDateLong(day.date, locale)}
        </h3>
        {state === "today" && <span className={styles.todayTag}>{t.calendar.today}</span>}
        <span className={`figure ${styles.dayCount}`}>
          {w.countCompanies.replace("{count}", String(day.total))}
        </span>
      </header>

      {day.closed ? (
        <p className={styles.dayEmpty}>{w.marketClosed}</p>
      ) : day.total === 0 ? (
        <p className={styles.dayEmpty}>{e.dayEmpty}</p>
      ) : (
        day.listed.length > 0 && (
          <ol className={styles.rows}>
            {day.listed.map((row) => (
              <Row
                key={row.symbol}
                row={row}
                day={day}
                peak={peak}
                hasActuals={hasActuals}
                badge={badges[`${row.symbol}:${row.reportDate}`]}
                watched={watchSet.has(row.symbol)}
                today={today}
                locale={locale}
                t={t}
              />
            ))}
          </ol>
        )
      )}

      {/* Kalanlar açılana kadar ÇİZİLMİYOR (gerekçe `AlsoReporting`). */}
      <AlsoReporting
        label={t.earnings.alsoReporting}
        total={restTotal}
        groups={[
          { label: t.earnings.beforeOpen, tone: "pre" as const, list: day.rest.bmo },
          { label: t.earnings.afterClose, tone: "post" as const, list: day.rest.amc },
          { label: t.earnings.timeUnknown, tone: "neutral" as const, list: day.rest.other },
        ].map((group) => ({
          label: group.label,
          tone: group.tone,
          symbols: group.list.map((row) => ({ symbol: row.symbol, watched: watchSet.has(row.symbol) })),
        }))}
      />
    </section>
  );
}

function Row({
  row,
  day,
  peak,
  hasActuals,
  badge,
  watched,
  today,
  locale,
  t,
}: {
  row: ScheduleRow;
  day: ScheduleDay;
  peak: number;
  hasActuals: boolean;
  badge: AnalysisBadgeData | undefined;
  watched: boolean;
  today: string;
  locale: Locale;
  t: Dictionary;
}) {
  const e = t.earningsWeek;
  const timing = timingOf(row.hour, t);
  const lane = laneOf(row.hour);
  const clock = lane === "bmo" ? day.bmoClock : lane === "amc" ? day.amcClock : null;
  const surprise = epsSurprise(row.epsActual, row.epsEstimate);
  /* `|| true`: `currency` boş dize olabiliyor (gerekçe EarningsCalendar
     `cardFigures`). Tahminler ana borsanın parasında. */
  const eps =
    row.epsEstimate !== null ? formatPrice(row.epsEstimate, locale, { currency: row.currency || true }) : null;
  const actual =
    row.epsActual !== null ? formatPrice(row.epsActual, locale, { currency: row.currency || true }) : null;
  const revenue =
    row.revenueEstimate !== null ? formatMoneyCompact(row.revenueEstimate, locale, row.currency) : null;
  const cap = row.marketCap !== null ? formatMoneyCompact(row.marketCap, locale) : null;
  const ratio = row.marketCap !== null && peak > 0 ? row.marketCap / peak : 0;

  return (
    <li className={styles.row} data-sched-row>
      <Link
        href={`/hisse/${row.symbol}`}
        prefetch={false}
        className={styles.cover}
        aria-label={row.name ? `${row.symbol} · ${row.name}` : row.symbol}
        data-cc={row.symbol}
      />
      <span className={styles.company}>
        <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
        <span className={styles.companyText}>
          <span className={styles.symbol}>
            {watched && (
              <span aria-hidden className={styles.star}>
                ★
              </span>
            )}
            {row.symbol}
          </span>
          {row.name && <span className={styles.name}>{row.name}</span>}
        </span>
      </span>

      <span className={styles.time}>
        <TimingChip tone={timing.tone} size="sm">
          {timing.short}
        </TimingChip>
        {/* SAAT "~" İLE: sağlayıcı yalnızca pencereyi veriyor (CLAUDE.md
            "Veri dürüstlüğü" 1). Birincil saat okuyucunun dilinde. */}
        {clock && (
          <span className={styles.clock}>
            <span className="figure">~{clock.primary}</span>
            <span className={`figure ${styles.clockAlt}`}>
              ~{clock.secondary} {zoneTag(locale).secondary}
            </span>
          </span>
        )}
      </span>

      <span className={styles.figs}>
        <span className={styles.fig}>
          <span className={styles.label}>{e.epsShort}</span>
          <span className={cn("figure", styles.value, !eps && styles.none)}>{eps ?? NO_VALUE}</span>
        </span>
        {hasActuals && (
          <span className={styles.fig}>
            <span className={styles.label}>{e.actualShort}</span>
            {actual ? (
              <span className={styles.actual}>
                <span className={cn("figure", styles.value)}>{actual}</span>
                {surprise && (
                  <span className={cn("figure", styles.surprise)} data-dir={surprise.direction}>
                    {surprise.ratio === null ? (
                      e[surprise.direction]
                    ) : (
                      <>
                        {formatPercent(surprise.ratio * 100, locale, 1)}
                        <span className="sr-only"> · {e[surprise.direction]}</span>
                      </>
                    )}
                  </span>
                )}
              </span>
            ) : (
              <span className={cn(styles.value, styles.none)}>
                {row.reportDate >= today ? e.pending : NO_VALUE}
              </span>
            )}
          </span>
        )}
        <span className={styles.fig}>
          <span className={styles.label}>{e.revenueShort}</span>
          <span className={cn("figure", styles.value, !revenue && styles.none)}>{revenue ?? NO_VALUE}</span>
        </span>
        <span className={styles.fig}>
          <span className={styles.label}>{e.capShort}</span>
          <span className={cn("figure", styles.value, !cap && styles.none)}>{cap ?? NO_VALUE}</span>
          {/* Büyüklük bir de uzunluk (CLAUDE.md "karşılaştırılan her büyüklük
              bir de çizgi"); en az 3 piksel, gerekçe mozaikteki `Tile`. */}
          {cap && (
            <span className={styles.bar} aria-hidden>
              <span style={{ "--ratio": ratio } as CSSProperties} />
            </span>
          )}
        </span>
      </span>

      <span className={styles.analysis}>
        {badge && <AnalysisBadge badge={badge} t={t} size="sm" />}
      </span>
    </li>
  );
}
