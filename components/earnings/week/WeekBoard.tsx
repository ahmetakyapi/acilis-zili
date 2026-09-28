import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { LogoTile, Skeleton, TimingChip, type TimingTone } from "@/components/ui/primitives";
import { dayLabel, WEEK_DAYS, type WeekCandidate, type WeekDay } from "@/lib/earnings-week";
import type { Dictionary, Locale } from "@/lib/i18n";
import { zoneTag, type TimePair } from "@/lib/session-clock";
import { etDateParts, formatMoneyCompact } from "@/lib/utils";
import styles from "./WeekBoard.module.css";

/**
 * Beş günlük takvim duvarı ve kahramandaki yoğunluk nabzı.
 *
 * ŞERİTLER GÜNLER ARASINDA AYNI HATTA. İlk sürümde her gün kendi kartıydı
 * ve şeritler içeriğe göre akıyordu: salı açılış öncesi boşsa çarşambanın
 * kapanış sonrası şeridi salının açılış öncesi yüksekliğinde başlıyordu,
 * yani "kapanış sonrası kim var" sorusu beş sütunda beş farklı yükseklikte
 * aranıyordu. Duvar artık bir ızgara: satırlar şerit (açılış öncesi,
 * kapanış sonrası, saati belirsiz), sütunlar gün; günler `subgrid` ile
 * aynı satır çizgilerini paylaşıyor. Geniş ekranda şeridin adı ve saati
 * solda bir kez yazılıyor; dar ekranda gün kartları alt alta ve şerit adı
 * her kartın içinde.
 *
 * SAAT "~" İLE ve penceresinin adıyla (CLAUDE.md "Veri dürüstlüğü" 1):
 * sağlayıcı yalnızca bmo/amc veriyor. Birincil saat okuyucunun dilinde
 * (TR'de İstanbul), öteki saat yanında künye olarak. ABD saat değişimi
 * pazar günü olduğu için bir iş haftasının saatleri beş günde aynı; sol
 * sütun ilk açık günün saatini yazıyor, hücreler yine kendi saatini taşıyor.
 *
 * Görseldeki karo tavanı (`LANE_CAP`) burada YOK: sayfa bütün seçilenleri
 * gösteriyor, görsel yer darlığından kırpıyor ve "+N" yazıyor.
 */

type LaneKey = "bmo" | "amc" | "other";

type LaneSpec = { key: LaneKey; tone: TimingTone; title: string };

function laneSpecs(t: Dictionary): LaneSpec[] {
  const w = t.earningsExtra.week;
  return [
    { key: "bmo", tone: "pre", title: w.beforeOpen },
    { key: "amc", tone: "post", title: w.afterClose },
    { key: "other", tone: "neutral", title: w.otherTime },
  ];
}

function clockOf(day: WeekDay, key: LaneKey): TimePair | null {
  if (key === "bmo") return day.bmoClock;
  if (key === "amc") return day.amcClock;
  return null;
}

function countOf(day: WeekDay): number {
  return day.bmo.length + day.amc.length + day.other.length;
}

export function WeekBoard({
  days,
  locale,
  t,
  today,
}: {
  days: WeekDay[];
  locale: Locale;
  t: Dictionary;
  /** ET takvim günü — haftanın içindeyse geçmiş günler sönük, bugün işaretli. */
  today: string;
}) {
  /* "Saati Belirsiz" satırı yalnızca haftada öyle bir şirket varsa açılıyor;
     yoksa beş sütunun altında boş bir şerit dururdu. */
  const lanes = laneSpecs(t).filter(
    (lane) => lane.key !== "other" || days.some((day) => day.other.length > 0),
  );
  const peak = Math.max(1, ...days.map(countOf));
  const open = days.find((day) => !day.closed) ?? days[0];

  return (
    <div
      className={styles.board}
      style={{ "--lanes": lanes.length } as CSSProperties}
    >
      {/* Sol eksen: yalnızca geniş ekranda görünür, ekran okuyucudan gizli —
          her hücrenin içinde aynı ad `sr-only` olarak duruyor. */}
      <div className={styles.axis} aria-hidden>
        <span className={styles.axisHead} />
        {lanes.map((lane) => {
          const clock = open ? clockOf(open, lane.key) : null;
          return (
            <span key={lane.key} className={styles.axisLane}>
              <TimingChip tone={lane.tone} size="sm">
                {lane.title}
              </TimingChip>
              {clock && (
                <span className={styles.axisClock}>
                  <span className="figure">~{clock.primary}</span>
                  <span className={`figure ${styles.axisClockAlt}`}>
                    ~{clock.secondary} {zoneTag(locale).secondary}
                  </span>
                </span>
              )}
            </span>
          );
        })}
      </div>

      {days.map((day, index) => (
        <DayColumn
          key={day.date}
          day={day}
          lanes={lanes}
          peak={peak}
          index={index}
          locale={locale}
          t={t}
          today={today}
        />
      ))}
    </div>
  );
}

function DayColumn({
  day,
  lanes,
  peak,
  index,
  locale,
  t,
  today,
}: {
  day: WeekDay;
  lanes: LaneSpec[];
  peak: number;
  index: number;
  locale: Locale;
  t: Dictionary;
  today: string;
}) {
  const w = t.earningsExtra.week;
  const label = dayLabel(day.date, locale);
  const count = countOf(day);
  /* Gün numarası display puntoda, ay yanında künye: takvim şeridinin ve
     yaklaşan bilançoların tarih karosuyla aynı parçalar (`etDateParts`). */
  const { day: dayNumber, month: monthShort } = etDateParts(day.date, locale);
  const state = day.date === today ? "today" : day.date < today ? "past" : "ahead";
  const empty = day.closed || count === 0;

  return (
    <section
      className={styles.day}
      aria-labelledby={`week-day-${day.date}`}
      data-state={state}
      data-empty={empty || undefined}
      style={{ "--i": index } as CSSProperties}
    >
      <header className={styles.dayHead}>
        <div className={styles.dayTitle}>
          {/* Gün başlığı bir h3: panelin h2'si "Açıklayacak Şirketler". */}
          <h3 id={`week-day-${day.date}`} className={styles.dayName}>
            {label.weekday}
          </h3>
          {state === "today" && <span className={styles.todayTag}>{t.calendar.today}</span>}
        </div>
        <p className={styles.dayDate}>
          <span className={`figure ${styles.dayNumber}`}>{dayNumber}</span>
          <span className={styles.dayMonth}>{monthShort}</span>
          <span className={`figure ${styles.dayCount}`}>
            {w.countCompanies.replace("{count}", String(count))}
          </span>
        </p>
        {/* GÜNÜN YOĞUNLUĞU BİR UZUNLUK. En kalabalık gün tam dolu; sayı
            hemen üstünde yazılı, çubuk onu okumadan karşılaştırmak için
            (CLAUDE.md "karşılaştırılan her büyüklük bir de çizgi"). */}
        <span className={styles.density} aria-hidden>
          <span
            className={styles.densityFill}
            style={{ "--ratio": count / peak } as CSSProperties}
          />
        </span>
      </header>

      {empty ? (
        <p className={styles.dayEmpty}>{day.closed ? w.marketClosed : w.emptyDay}</p>
      ) : (
        lanes.map((lane) => (
          <Lane
            key={lane.key}
            lane={lane}
            rows={day[lane.key]}
            clock={clockOf(day, lane.key)}
            locale={locale}
          />
        ))
      )}
    </section>
  );
}

function Lane({
  lane,
  rows,
  clock,
  locale,
}: {
  lane: LaneSpec;
  rows: WeekCandidate[];
  clock: TimePair | null;
  locale: Locale;
}) {
  return (
    <div className={styles.lane} data-lane={lane.key} data-filled={rows.length > 0 || undefined}>
      {/* Dar ekranda görünen şerit başlığı; geniş ekranda sol eksen aynı
          işi yapıyor ve bu satır yalnızca ekran okuyucuya kalıyor. */}
      <p className={styles.laneHead}>
        <TimingChip tone={lane.tone} size="sm">
          {lane.title}
        </TimingChip>
        {clock && (
          <>
            <span className={`figure ${styles.laneClock}`}>~{clock.primary}</span>
            <span className={`figure ${styles.laneClockAlt}`}>
              ~{clock.secondary} {zoneTag(locale).secondary}
            </span>
          </>
        )}
      </p>
      {rows.length > 0 && (
        <ul className={styles.entries}>
          {rows.map((row) => (
            <li key={row.symbol}>
              <Link
                href={`/hisse/${row.symbol}`}
                prefetch={false}
                className={styles.entry}
                aria-label={row.name ? `${row.symbol} · ${row.name}` : row.symbol}
              >
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" className={styles.entryLogo} />
                <span className={styles.entryText}>
                  <span className={styles.entrySymbol}>{row.symbol}</span>
                  {row.name && <span className={styles.entryName}>{row.name}</span>}
                </span>
                {row.marketCap !== null && (
                  <span className={`figure ${styles.entryCap}`}>
                    {formatMoneyCompact(row.marketCap, locale)}
                  </span>
                )}
                <ArrowUpRight size={13} weight="bold" aria-hidden className={styles.entryArrow} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Kahramanın görseli — haftanın nabzı
   --------------------------------------------------------------------------- */

/**
 * Beş sütunluk yoğunluk grafiği: her gün, açılış öncesi ve kapanış sonrası
 * iki katman halinde, en kalabalık güne göre ölçekli.
 *
 * ÖLÇÜLER BURADA, PANELDE DEĞİL. Panonun altında dört kutuluk bir ölçü
 * şeridi vardı (şirket, açılış öncesi, kapanış sonrası, en yoğun gün) ve
 * aynı dört sayı artık bu grafiğin kendisi: toplam büyük puntoyla, şerit
 * sayıları lejantta, en yoğun gün sütununun üstünde. Aynı sayının iki
 * yerde durması yerine bir kez ve bir şekille.
 *
 * Sütunlar yüklemede sıfırdan büyüyor (CSS, kahraman ilk ekranda ve
 * `MotionExperience` ilk ekrandaki öğeye dokunmuyor); hareketi azaltan
 * okuyucu son hâli görüyor.
 */
export function WeekPulse({
  days,
  picked,
  locale,
  t,
}: {
  days: WeekDay[];
  picked: number;
  locale: Locale;
  t: Dictionary;
}) {
  const w = t.earningsExtra.week;
  const counts = days.map(countOf);
  const peak = Math.max(0, ...counts);
  /* En yoğun gün yalnızca bir gün öne çıkıyorsa işaretleniyor: eşitlikte
     "Salı" demek, Perşembe'yi de aynı sayıyla saklamak olurdu. */
  const busiest =
    peak > 0 && counts.filter((count) => count === peak).length === 1 ? counts.indexOf(peak) : -1;
  const bmo = days.reduce((sum, day) => sum + day.bmo.length, 0);
  const amc = days.reduce((sum, day) => sum + day.amc.length, 0);
  const scale = Math.max(1, peak);

  return (
    <div className={styles.pulse}>
      <div className={styles.pulseTop}>
        <h2 className={styles.pulseTitle}>{w.pulseTitle}</h2>
        <p className={styles.pulseTotal}>
          <RollingFigure value={String(picked)} className={styles.pulseNumber} />
          <span>{w.statCompanies}</span>
        </p>
      </div>

      <ol className={styles.pulseBars}>
        {days.map((day, index) => {
          const label = dayLabel(day.date, locale);
          const total = counts[index];
          return (
            <li
              key={day.date}
              className={styles.pulseDay}
              data-peak={index === busiest || undefined}
              style={{ "--i": index } as CSSProperties}
            >
              <span className={`figure ${styles.pulseCount}`}>{day.closed ? "" : total}</span>
              <span className={styles.pulseColumn} aria-hidden>
                <span
                  className={styles.pulseStack}
                  style={{ "--h": total / scale } as CSSProperties}
                >
                  {day.amc.length > 0 && (
                    <span className={styles.segPost} style={{ flexGrow: day.amc.length }} />
                  )}
                  {day.other.length > 0 && (
                    <span className={styles.segOther} style={{ flexGrow: day.other.length }} />
                  )}
                  {day.bmo.length > 0 && (
                    <span className={styles.segPre} style={{ flexGrow: day.bmo.length }} />
                  )}
                </span>
              </span>
              <span className={styles.pulseLabel}>
                <span className="sr-only">
                  {label.weekday}: {w.countCompanies.replace("{count}", String(total))}
                </span>
                <span aria-hidden>{label.short}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <dl className={styles.pulseLegend}>
        <div>
          <dt>
            <span className={styles.keyPre} aria-hidden />
            {w.statBeforeOpen}
          </dt>
          <dd className="figure">{bmo}</dd>
        </div>
        <div>
          <dt>
            <span className={styles.keyPost} aria-hidden />
            {w.statAfterClose}
          </dt>
          <dd className="figure">{amc}</dd>
        </div>
        {busiest >= 0 && (
          <div>
            <dt>{w.statBusiest}</dt>
            <dd>{dayLabel(days[busiest].date, locale).weekday}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/**
 * Nabzın yedeği — gerçek bileşenin AYNI kutuları, metinler görünmez.
 *
 * İlk yedek yalnızca yaklaşık iskelet kutuları çiziyordu ve gerçek nabızdan
 * 50 piksel kısaydı: veri inince kapak uzuyor, altındaki sekme çubuğu ve
 * hafta şeridi aşağı itiliyordu (1280'de CLS 0,14, ölçüldü). Artık aynı
 * sınıflar ve aynı satırlar basılıyor; yalnızca içerik `invisible`.
 */
export function WeekPulseSkeleton({ t }: { t: Dictionary }) {
  const w = t.earningsExtra.week;
  return (
    <div className={styles.pulse} aria-hidden>
      <div className={styles.pulseTop}>
        <p className={styles.pulseTitle}>{w.pulseTitle}</p>
        <p className={styles.pulseTotal}>
          <span className={`invisible ${styles.pulseNumber}`}>0</span>
          <span>{w.statCompanies}</span>
        </p>
      </div>
      <div className={styles.pulseBars}>
        {Array.from({ length: WEEK_DAYS }, (_, index) => (
          <div key={index} className={styles.pulseDay}>
            <span className={styles.pulseCount} />
            <span className={styles.pulseColumn} />
            <span className={`invisible ${styles.pulseLabel}`}>0</span>
          </div>
        ))}
      </div>
      {/* Telefonda lejant iki satıra sarıyor ("En Yoğun Gün" alta iniyor);
          yedek de orada iki satır. */}
      <div className={styles.pulseLegend}>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/3 sm:hidden" />
      </div>
    </div>
  );
}

/** Panonun yedeği — beş sütun, gerçek duvarla aynı ızgara. */
export function WeekBoardSkeleton() {
  const ROWS = 2;
  return (
    <div className={styles.board} aria-hidden style={{ "--lanes": ROWS } as CSSProperties}>
      <div className={styles.axis}>
        <span className={styles.axisHead} />
        {Array.from({ length: ROWS }, (_, index) => (
          <span key={index} className={styles.axisLane}>
            <Skeleton className="h-5 w-24" />
          </span>
        ))}
      </div>
      {Array.from({ length: WEEK_DAYS }, (_, index) => (
        <div key={index} className={styles.day}>
          <div className={styles.dayHead}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
          {Array.from({ length: ROWS }, (_, lane) => (
            <div key={lane} className={styles.lane}>
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
