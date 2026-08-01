import {
  DualTime,
  EmptyState,
  PageHeader,
  Segmented,
} from "@/components/ui/primitives";
import { getEventsBetween } from "@/lib/data";
import { addEtDays, etDateTimeToUtc, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, dualTime } from "@/lib/utils";
import type { EconomicEventRow } from "@/lib/schema";

/**
 * Ekonomik takvim — gazetenin hafta fihristi.
 *
 * Her gün kendi sütununda durur; sütun başlığı kalın kuralla kapanır, olaylar
 * kılcal çizgilerle ayrılır. Kutu yok. Dar ekranda sütunlar alt alta iner ve
 * üstteki gün şeridi çapa bağlantılarıyla aralarında gezdirir.
 */

const VIEWS = ["day", "week", "month"] as const;
type View = (typeof VIEWS)[number];

const IMPACTS = ["high", "medium", "low"] as const;

export default async function CalendarPage(props: PageProps<"/takvim">) {
  const search = await props.searchParams;
  const view: View = VIEWS.includes(search.g as View)
    ? (search.g as View)
    : "week";
  const impactFilter = typeof search.onem === "string" ? search.onem : null;

  const { locale, t } = await getI18n();
  const today = todayEt();

  const to =
    view === "day"
      ? today
      : view === "week"
        ? addEtDays(today, 6)
        : addEtDays(today, 29);

  let events = await getEventsBetween(today, to);
  if (impactFilter) {
    events = events.filter((event) => event.importance === impactFilter);
  }

  const byDay = new Map<string, EconomicEventRow[]>();
  for (const event of events) {
    const list = byDay.get(event.eventDate) ?? [];
    list.push(event);
    byDay.set(event.eventDate, list);
  }
  const days = [...byDay.entries()];

  const impactLabel: Record<string, string> = {
    high: t.calendar.impactHigh,
    medium: t.calendar.impactMedium,
    low: t.calendar.impactLow,
  };
  const viewLabel: Record<View, string> = {
    day: t.calendar.day,
    week: t.calendar.week,
    month: t.calendar.month,
  };

  const viewHref = (v: View) =>
    `/takvim?g=${v}${impactFilter ? `&onem=${impactFilter}` : ""}`;
  const impactHref = (level: string | null) =>
    level ? `/takvim?g=${view}&onem=${level}` : `/takvim?g=${view}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <PageHeader eyebrow={t.calendar.title} title={viewLabel[view]} />

        {/* Dar ekranda iki seçici yan yana sığmaz: kutu kendi içinde kayar.
            `shrink-0` burada olamaz — kapsayıcıyı genişletip sayfayı taşırır. */}
        <div className="scroll-x flex max-w-full items-center gap-3 pb-1">
          <Segmented
            ariaLabel={t.calendar.title}
            options={VIEWS.map((v) => ({
              href: viewHref(v),
              label: viewLabel[v],
              active: view === v,
            }))}
          />
          <Segmented
            ariaLabel={t.calendar.impact}
            options={[
              {
                href: impactHref(null),
                label: t.common.all,
                active: !impactFilter,
              },
              ...IMPACTS.map((level) => ({
                href: impactHref(impactFilter === level ? null : level),
                label: impactLabel[level],
                active: impactFilter === level,
              })),
            ]}
          />
        </div>
      </div>

      <p className="text-[12.5px] text-muted">{t.calendar.allTimesET}</p>

      {days.length === 0 ? (
        <EmptyState title={t.calendar.empty} />
      ) : (
        <>
          {/* Gün şeridi — dar ekranda sütunlar arasında gezinme çapası.
              Masaüstünde sütunlar zaten yan yana olduğu için gizlenir. */}
          {days.length > 1 && (
            <div className="scroll-x -mt-4 flex gap-1.5 lg:hidden">
              {days.map(([date]) => {
                const isToday = date === today;
                return (
                  <a
                    key={date}
                    href={`#gun-${date}`}
                    className={cn(
                      "flex min-w-[58px] flex-1 flex-col items-center border px-2 py-1.5 transition-colors",
                      isToday
                        ? "border-up bg-primary-wash text-up"
                        : "border-rule text-dim hover:text-ink",
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-[0.08em]">
                      {weekdayShort(date, locale)}
                    </span>
                    <span className="numeral text-[17px] font-semibold">
                      {dayNumber(date)}
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {days.map(([date, dayEvents]) => (
              <DayColumn
                key={date}
                date={date}
                events={dayEvents}
                isToday={date === today}
                impactLabel={impactLabel}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Gün sütunu
   -------------------------------------------------------------------------- */

function DayColumn({
  date,
  events,
  isToday,
  impactLabel,
  locale,
  t,
}: {
  date: string;
  events: EconomicEventRow[];
  isToday: boolean;
  impactLabel: Record<string, string>;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section id={`gun-${date}`} className="min-w-0 scroll-mt-6">
      {/* Sütun başlığı kalın kuralla kapanır — gazete gün ayıracı */}
      <div
        className={cn(
          "flex items-baseline gap-2 border-b-2 pb-2",
          isToday ? "border-up" : "border-ink",
        )}
      >
        <span
          className={cn(
            "numeral text-[26px] font-semibold leading-none",
            isToday ? "text-up" : "text-ink",
          )}
        >
          {dayNumber(date)}
        </span>
        <span
          className={cn(
            "text-[12px] uppercase tracking-[0.09em]",
            isToday ? "text-up" : "text-faint",
          )}
        >
          {weekdayLong(date, locale)}
        </span>
      </div>

      <ul>
        {events.map((event) => {
          const time = event.eventTimeEt
            ? dualTime(
                etDateTimeToUtc(event.eventDate, event.eventTimeEt),
                event.eventTimeEt,
              )
            : null;
          const high = event.importance === "high";

          return (
            <li
              key={event.id}
              className="border-b border-hairline py-3 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                {time ? (
                  <DualTime
                    et={time.et}
                    tr={time.tr}
                    className="text-[12px] text-faint"
                  />
                ) : (
                  <span className="text-[12px] text-faint">—</span>
                )}
                {high && (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-down">
                    {impactLabel.high}
                  </span>
                )}
              </div>

              <p
                className={cn(
                  "mt-1 text-[14.5px] leading-[1.35]",
                  high ? "font-semibold text-ink" : "text-body",
                )}
              >
                {locale === "tr" ? event.titleTr : event.titleEn}
              </p>

              <EventReading event={event} t={t} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Beklenti · gerçekleşen · önceki tek satırda.
 * Gerçekleşen beklentinin altındaysa magenta, üstündeyse camgöbeği basılır —
 * sayı yoksa satır hiç çizilmez (uydurma veri yok).
 */
function EventReading({
  event,
  t,
}: {
  event: EconomicEventRow;
  t: Dictionary;
}) {
  if (!event.actual && !event.forecast && !event.previous) return null;

  const beat = surpriseDirection(event.actual, event.forecast);

  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-faint">
      {event.forecast && (
        <span>
          {t.calendar.forecast} {event.forecast}
        </span>
      )}
      {event.actual && (
        <span>
          {t.calendar.actual}{" "}
          <b
            className={cn(
              "font-semibold",
              beat === "up"
                ? "text-up"
                : beat === "down"
                  ? "text-down"
                  : "text-ink",
            )}
          >
            {event.actual}
          </b>
        </span>
      )}
      {event.previous && (
        <span className="hidden sm:inline">
          {t.calendar.previous} {event.previous}
        </span>
      )}
    </p>
  );
}

/* --------------------------------------------------------------------------
   Yardımcılar
   -------------------------------------------------------------------------- */

/** Metin içindeki ilk sayıyı okur — "%4,4" ve "−69,8 Mr$" gibi biçimleri kaldırır. */
function numericOf(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/\./g, "").replace(/,/g, ".").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Gerçekleşen beklentiye göre nerede.
 *
 * Yön İYİ/KÖTÜ demek değildir — işsizlikte yüksek gelen kötüdür, istihdamda
 * iyidir. Burada yalnızca "beklentinin üstünde mi altında mı" söylenir;
 * yorum okuyucunundur.
 */
function surpriseDirection(
  actual: string | null,
  forecast: string | null,
): "up" | "down" | null {
  const a = numericOf(actual);
  const f = numericOf(forecast);
  if (a === null || f === null || a === f) return null;
  return a > f ? "up" : "down";
}

function dayNumber(dateStr: string): string {
  return dateStr.slice(8, 10);
}

function weekdayLong(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

function weekdayShort(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}
