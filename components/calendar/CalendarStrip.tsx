import styles from "@/components/calendar/CalendarExperience.module.css";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketHoliday } from "@/lib/market-hours";
import type { EconomicEventRow } from "@/lib/schema";
import { cn, etDateParts } from "@/lib/utils";

/**
 * Tarih şeridi — hafta ve ay görünümünün "hangi gün ne var" özeti.
 *
 * Eski şerit her günü aynı kutuyla basıyordu: boş günde tire, olaylı günde
 * mavi degrade. Degrade SEÇİLİ gün gibi okunuyordu (okuyucu 24'ün seçili
 * olduğunu sandı, hiçbir şey seçili değildi), hafta sonu ve tatil iş
 * gününden ayrılmıyordu ve ay görünümü 30 hücreyi gizli bir yatay
 * kaydırmaya diziyordu (ölçüldü: 1440'ta 1320 piksellik kapta 2876 piksel,
 * 30 hücrenin 16'sı ekran dışında, hiçbir işaret yok). 320'de haftanın bile
 * Pazartesi hücresi kayıyordu (308 > 284).
 *
 * Şimdi: iş günü iki birim, hafta sonu bir birim genişlikte — hafta sonu
 * açıklama taşımıyor, yeri de ona göre. Olay NOKTAYLA söyleniyor (önem
 * sırasıyla, en çok dört), tatil adıyla işaretli. Ay görünümü Pazartesi
 * başlayan gerçek bir yedi sütunlu ızgara; hiçbir şey kaydırmanın arkasına
 * saklanmıyor.
 *
 * Boş iş günü hücresi YAZI TAŞIMIYOR. Bir süre "Açıklama Yok" diyordu ve
 * aynı cümle hemen altındaki ajandanın sessiz satırında ("22–23 Eylül ·
 * Açıklama Yok") ikinci kez duruyordu; şerit bir özet, boşluğu noktasızlık
 * ve soluk rakam zaten söylüyor. Olgu iddiası ajandada, bir kez.
 *
 * Nokta renkleri önem çiplerinin renkleri (kırmızı, sarı, gri): çipler
 * aynı panelin başında ve şeridin lejantı onlar. Ayrı bir biçim dili
 * (dolu / halka / küçük nokta) üçüncü bir sözlük açıyordu.
 */

const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
/** En çok dört nokta, fazlası "+N". Telefonda da dört: 4×6 + 3×3 = 33 piksel, 320'deki ~37 piksellik iş günü hücresine sığıyor. */
const MAX_DOTS = 4;
/** Pazartesi başlayan hafta: 2024-01-01 bir Pazartesi. */
const MONDAY_ANCHOR = "2024-01-01";

type StripProps = {
  view: "week" | "month";
  dates: string[];
  byDay: Map<string, EconomicEventRow[]>;
  holidays: Map<string, MarketHoliday>;
  today: string;
  locale: Locale;
  t: Dictionary;
};

function utcNoon(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

/** Pazar 0 … Cumartesi 6 — tarih UTC öğlesinde okunuyor, saat dilimi kaymaz. */
function weekdayOf(date: string) {
  return utcNoon(date).getUTCDay();
}

function isWeekend(date: string) {
  const day = weekdayOf(date);
  return day === 0 || day === 6;
}

function Dots({ events }: { events: EconomicEventRow[] }) {
  const sorted = [...events].sort(
    (a, b) => (IMPACT_RANK[a.importance] ?? 3) - (IMPACT_RANK[b.importance] ?? 3),
  );
  const extra = sorted.length - MAX_DOTS;
  return (
    <span className={styles.dots} aria-hidden>
      {sorted.slice(0, MAX_DOTS).map((event) => (
        <span key={event.id} className={styles.dot} data-impact={event.importance} />
      ))}
      {extra > 0 && <span className={styles.dotsMore}>+{extra}</span>}
    </span>
  );
}

export function CalendarStrip({ view, dates, byDay, holidays, today, locale, t }: StripProps) {
  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  const weekdayShort = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
  const countLabel = (count: number) =>
    `${count} ${count === 1 ? t.calendar.eventOne : t.calendar.eventMany}`;

  function cell(date: string, index: number) {
    const events = byDay.get(date) ?? [];
    const count = events.length;
    const weekend = isWeekend(date);
    const holiday = holidays.get(date);
    const isToday = date === today;
    const { day, month } = etDateParts(date, locale);
    /* Ay değişince ya da ızgaranın ilk hücresinde ay adı sayının yanında:
       "1 Eki" olmadan 30'dan sonra gelen 1'in hangi ay olduğu okunmuyordu. */
    const showMonth = view === "month" && (day === "1" || index === 0);
    const holidayLabel = holiday
      ? holiday.earlyCloseEt
        ? t.market.earlyClose
        : t.market.closed
      : null;
    const holidayName = holiday ? (locale === "tr" ? holiday.nameTr : holiday.nameEn) : null;

    const foot = count ? (
      <>
        <Dots events={events} />
        <span className={styles.cellCount}>{countLabel(count)}</span>
      </>
    ) : holidayLabel && !weekend ? (
      <span className={styles.cellNote}>{holidayLabel}</span>
    ) : null;

    const contents = (
      <>
        {view === "week" && (
          <span className={styles.cellTop}>
            <span>{weekdayShort.format(utcNoon(date))}</span>
            {isToday && <span className={styles.cellToday}>{t.calendar.today}</span>}
          </span>
        )}
        <span className={styles.cellNum}>
          <strong className="numeral">{day}</strong>
          {showMonth ? <span>{month}</span> : <span className="sr-only">{month}</span>}
          {view === "month" && isToday && <span className="sr-only">{t.calendar.today}</span>}
        </span>
        {foot && <span className={styles.cellFoot}>{foot}</span>}
        {holidayName && <span className="sr-only">{holidayName}</span>}
      </>
    );

    const attrs = {
      className: styles.cell,
      "data-weekend": weekend || undefined,
      "data-today": isToday || undefined,
      "data-holiday": holiday ? (holiday.earlyCloseEt ? "early" : "closed") : undefined,
      "data-empty": count === 0 || undefined,
      title: holidayName ?? undefined,
    };

    return count ? (
      /* Erişilebilir ad GÖRÜNEN metnin kendisi ("Per 24 Eyl 1 Olay"):
         `aria-label` görünen kısaltmayı ("Per") düşürüyordu ve sesle
         "Per 24" diyen kullanıcı bağlantıyı bulamıyordu (WCAG 2.5.3 — aynı
         gerekçe primitives'teki SegmentItem notunda). Ay adı ekran
         okuyucu için gizli metin. */
      <a key={date} href={`#gun-${date}`} {...attrs}>
        {contents}
      </a>
    ) : (
      <span key={date} {...attrs}>
        {contents}
      </span>
    );
  }

  if (view === "week") {
    return (
      <nav className={styles.strip} aria-label={t.calendar.datesNav}>
        {dates.map(cell)}
      </nav>
    );
  }

  /* Sütun başlığı telefonda da KISA ad, tek harf değil: Türkçenin tek
     harflik adları "P S Ç P C C P" — üç P, iki C; hangi sütunun Pazartesi
     hangisinin Perşembe olduğu okunmuyordu. "Pzt" 10 puntoda ~20 piksel,
     390'daki 49 piksellik iş günü sütununa da 25 piksellik hafta sonuna da
     sığıyor.
     Ay: ilk hücreden önceki iş günleri boş yer tutucu. Bugünden önceki
     günler sorgulanmıyor; oraya bir şey yazmak uydurmak olurdu. */
  const leading = (weekdayOf(dates[0]) + 6) % 7;
  const headDays = Array.from({ length: 7 }, (_, index) => {
    const [year, monthNum, dayNum] = MONDAY_ANCHOR.split("-").map(Number);
    return new Date(Date.UTC(year, monthNum - 1, dayNum + index, 12));
  });

  return (
    <nav className={cn(styles.strip, styles.month)} aria-label={t.calendar.datesNav}>
      {headDays.map((date, index) => (
        <span key={`head-${index}`} className={styles.monthHead} aria-hidden data-weekend={index > 4 || undefined}>
          {weekdayShort.format(date)}
        </span>
      ))}
      {Array.from({ length: leading }, (_, index) => (
        <span key={`blank-${index}`} className={styles.blank} aria-hidden />
      ))}
      {dates.map(cell)}
    </nav>
  );
}
