import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { LookaheadWeek } from "@/components/calendar/lookahead";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, etDateParts } from "@/lib/utils";

/** Kulvar başına yuva: şeritle aynı dört. */
const SLOTS = 4;
/** Satır başına en çok üç ad; fazlası "+N". FOMC haftası tek günde üç
    yüksek etkili satır taşıyor (karar, basın toplantısı, projeksiyonlar). */
const MAX_NAMES = 3;

/**
 * Önümüzdeki altı hafta — sessiz haftanın cevabı.
 *
 * NEDEN (18 Ekim, sahibinin ekran görüntüsü). Hafta görünümünde tek bir
 * orta etkili açıklama vardı; panel "19 – 21 Ekim · Açıklama Yok" ve
 * "23 Ekim Cuma · Açıklama Yok" satırlarından ibaretti ve sayfa boş
 * görünüyordu. Oysa okuyucunun asıl sorusu "bu hafta ne var" değil, "Fed ne
 * zaman, enflasyon ne zaman" ve cevabı sayfanın zaten okuduğu 41 günlük
 * pencerede duruyor. Bu panel o pencerenin TAMAMINI tek bakışta veriyor:
 * her satır bir hafta, her sütun bir iş günü, her gün şeritteki dört
 * yuvalı kulvar (aynı dil, aynı renkler); satırın sağında haftanın yüksek
 * etkili açıklamaları adlarıyla.
 *
 * Ayrı sorgu yok: sayfanın tek altı haftalık sorgusundan, süzgeçten ÖNCE
 * (önem süzgeci listeyi süzer, ufku değil). Bugünden önceki ve pencerenin
 * ötesindeki günler kulvar çizmez — orayı sorgulamadık, boş demek
 * uydurmak olurdu.
 *
 * Hareket: satırlar `data-motion-stagger` ile kademeli, kulvar şeritleri
 * `data-motion-draw="line"` ile soldan çiziliyor (PremiumMotion; görüş
 * alanına girince bir kez, hareketi azaltana hiç).
 */
export function WeekLookahead({
  weeks,
  hrefFor,
  locale,
  t,
}: {
  weeks: LookaheadWeek[];
  /** Tarihin gündemdeki yeri — sayfa içi çapa, ay görünümü ya da null. */
  hrefFor: (date: string) => string | null;
  locale: Locale;
  t: Dictionary;
}) {
  if (weeks.length === 0) return null;
  const c = t.calendar;
  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  const weekdayShort = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
  const range = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", timeZone: "UTC" });
  const noon = (date: string) => new Date(`${date}T12:00:00Z`);
  const impactLabel: Record<string, string> = {
    high: c.impactHigh,
    medium: c.impactMedium,
    low: c.impactLow,
  };
  const titleOf = (event: { titleTr: string; titleEn: string }) =>
    locale === "tr" ? event.titleTr : event.titleEn;
  const highTotal = weeks.reduce((sum, week) => sum + week.high.length, 0);
  const headDays = weeks[0].days.map((day) => weekdayShort.format(noon(day.date)));

  return (
    <Panel className={styles.ahead}>
      <PanelHeader
        title={c.aheadTitle}
        meta={
          <span className={styles.aheadMeta}>
            <strong className="numeral">{highTotal}</strong> {c.highImpactShort}
          </span>
        }
        className={styles.panelHead}
      />
      <div className={styles.aheadGrid}>
        <div className={styles.aheadHead} aria-hidden>
          <span>{c.week}</span>
          {headDays.map((name) => (
            <span key={name}>{name}</span>
          ))}
          <span className={styles.aheadHeadHigh}>{c.aheadHighlights}</span>
        </div>
        <div className={styles.aheadRows} role="list" data-motion-stagger>
          {weeks.map((week) => {
            const label = range.formatRange(noon(week.monday), noon(week.friday));
            const queried = week.days.every((day) => !day.past && !day.outside);
            const extra = week.high.length - MAX_NAMES;
            return (
              <div
                key={week.monday}
                role="listitem"
                className={styles.aheadRow}
                data-current={week.current || undefined}
              >
                <span className={styles.aheadWeek}>
                  <span className="numeral">{label}</span>
                  <span className={styles.aheadWeekNote}>
                    {week.current ? c.thisWeek : `${week.total} ${week.total === 1 ? c.eventOne : c.eventMany}`}
                  </span>
                </span>
                {week.days.map((day) => {
                  const { day: dayNumber, month } = etDateParts(day.date, locale);
                  const unknown = day.past || day.outside;
                  const summary = day.holiday
                    ? locale === "tr" ? day.holiday.nameTr : day.holiday.nameEn
                    : unknown
                      ? null
                      : day.events.length
                        ? day.events
                            .map((event) => `${titleOf(event)} (${impactLabel[event.importance] ?? event.importance})`)
                            .join(", ")
                        : c.noRelease;
                  return (
                    <span
                      key={day.date}
                      className={styles.aheadDay}
                      data-past={unknown || undefined}
                      data-today={day.today || undefined}
                      data-holiday={day.holiday ? "true" : undefined}
                      title={summary ?? undefined}
                    >
                      <span className={cn(styles.aheadNum, "numeral")} aria-hidden>
                        {dayNumber}
                      </span>
                      {/* Ekran okuyucu için gün: "21 Eki: Haftalık İşsizlik
                          Başvuruları (Orta)". Kulvar onun görsel kopyası. */}
                      {summary && <span className="sr-only">{`${dayNumber} ${month}: ${summary}`}</span>}
                      {day.holiday ? (
                        <span className={styles.aheadClosed} aria-hidden>
                          {day.holiday.earlyCloseEt ? t.market.earlyClose : t.market.closed}
                        </span>
                      ) : (
                        <span className={styles.aheadLane} aria-hidden data-motion-track>
                          {Array.from({ length: SLOTS }, (_, slot) => {
                            const event = day.events[slot];
                            return (
                              <span
                                key={slot}
                                className={styles.laneSlot}
                                data-impact={event?.importance}
                                data-motion-draw={event ? "line" : undefined}
                                style={event ? { transformOrigin: "left center" } : undefined}
                              />
                            );
                          })}
                        </span>
                      )}
                    </span>
                  );
                })}
                <span className={styles.aheadHigh}>
                  {week.high.length > 0 ? (
                    <>
                      {week.high.slice(0, MAX_NAMES).map((event) => {
                        const href = hrefFor(event.eventDate);
                        const { day, month } = etDateParts(event.eventDate, locale);
                        const content = (
                          <>
                            <span className={cn(styles.aheadHighDate, "numeral")}>
                              {day} {month}
                            </span>
                            <span className={styles.aheadHighName}>{titleOf(event)}</span>
                          </>
                        );
                        if (!href) {
                          return (
                            <span key={event.id} className={styles.aheadHighItem}>
                              {content}
                            </span>
                          );
                        }
                        /* Sayfa içi çapa düz `<a>` (DayPicker onu yakalıyor);
                           ay görünümüne geçen bağlantı `LocaleLink`. */
                        return href.startsWith("#") ? (
                          <a key={event.id} href={href} className={styles.aheadHighItem}>
                            {content}
                          </a>
                        ) : (
                          <Link key={event.id} href={href} className={styles.aheadHighItem}>
                            {content}
                          </Link>
                        );
                      })}
                      {extra > 0 && <span className={cn(styles.aheadMore, "numeral")}>+{extra}</span>}
                    </>
                  ) : (
                    <span className={styles.aheadQuiet}>
                      {week.total === 0 && queried ? c.noRelease : c.aheadNoHigh}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
