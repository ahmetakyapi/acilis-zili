import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, TimingChip, type TimingTone } from "@/components/ui/primitives";
import { dayLabel, type WeekCandidate, type WeekDay } from "@/lib/earnings-week";
import type { Dictionary, Locale } from "@/lib/i18n";
import { zoneTag } from "@/lib/session-clock";
import type { TimePair } from "@/lib/session-clock";
import styles from "./WeekBoard.module.css";

/**
 * Beş günlük pano — her gün bir kart, içinde açılış öncesi ve kapanış
 * sonrası şeritleri.
 *
 * SAAT "~" İLE ve penceresinin adıyla (CLAUDE.md "Veri dürüstlüğü" 1):
 * sağlayıcı yalnızca bmo/amc veriyor. Birincil saat okuyucunun dilinde
 * (TR'de İstanbul), öteki saat yanında künye olarak — takvimin geri
 * kalanıyla aynı kural (`lib/session-clock.ts`).
 *
 * Görseldeki karo tavanı (`LANE_CAP`) burada YOK: sayfa bütün seçilenleri
 * gösteriyor, görsel yer darlığından kırpıyor ve "+N" yazıyor.
 */
export function WeekBoard({
  days,
  locale,
  t,
}: {
  days: WeekDay[];
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <div className={styles.board}>
      {days.map((day) => (
        <DayCard key={day.date} day={day} locale={locale} t={t} />
      ))}
    </div>
  );
}

function DayCard({ day, locale, t }: { day: WeekDay; locale: Locale; t: Dictionary }) {
  const w = t.earningsExtra.week;
  const label = dayLabel(day.date, locale);
  const lanes: { key: string; tone: TimingTone; title: string; clock: TimePair | null; rows: WeekCandidate[] }[] = [
    { key: "bmo", tone: "pre", title: w.beforeOpen, clock: day.bmoClock, rows: day.bmo },
    { key: "amc", tone: "post", title: w.afterClose, clock: day.amcClock, rows: day.amc },
    { key: "other", tone: "neutral", title: w.otherTime, clock: null, rows: day.other },
  ];
  const visible = lanes.filter((lane) => lane.rows.length > 0);

  return (
    <section className={styles.day} aria-labelledby={`week-day-${day.date}`}>
      <header className={styles.dayHead}>
        {/* Gün başlığı bir h3: panelin h2'si "Haftalık Bilanço Takvimi". */}
        <h3 id={`week-day-${day.date}`} className={styles.dayName}>
          {label.weekday}
        </h3>
        <span className={styles.dayDate}>{label.day}</span>
      </header>

      {day.closed ? (
        <p className={styles.dayEmpty}>{w.marketClosed}</p>
      ) : visible.length === 0 ? (
        <p className={styles.dayEmpty}>{w.emptyDay}</p>
      ) : (
        visible.map((lane) => (
          <div key={lane.key} className={styles.lane}>
            <p className={styles.laneHead}>
              <TimingChip tone={lane.tone} size="sm">
                {lane.title}
              </TimingChip>
              {lane.clock && (
                <>
                  <span className={`figure ${styles.laneClock}`}>~{lane.clock.primary}</span>
                  <span className={`figure ${styles.laneClockAlt}`}>
                    ~{lane.clock.secondary} {zoneTag(locale).secondary}
                  </span>
                </>
              )}
            </p>
            <ul className={styles.entries}>
              {lane.rows.map((row) => (
                <li key={row.symbol}>
                  <Link
                    href={`/hisse/${row.symbol}`}
                    prefetch={false}
                    className={styles.entry}
                    aria-label={row.name ? `${row.symbol} · ${row.name}` : row.symbol}
                  >
                    <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="xs" />
                    <span className={styles.entrySymbol}>{row.symbol}</span>
                    {row.name && <span className={styles.entryName}>{row.name}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
