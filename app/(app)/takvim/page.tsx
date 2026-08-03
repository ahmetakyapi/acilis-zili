import { GuideHint } from "@/components/article/GuideHint";
import { IpoCalendar } from "@/components/markets/IpoCalendar";
import Link from "next/link";
import {
  EmptyState,
  ImpactDots,
  Panel,
} from "@/components/ui/primitives";
import { getEventsBetween } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n } from "@/lib/i18n";
import { timePair, zoneTag } from "@/lib/session-clock";
import { cn, formatEtDateLong, formatEtDateShort } from "@/lib/utils";
import type { EconomicEventRow } from "@/lib/schema";

const VIEWS = ["day", "week", "month"] as const;
type View = (typeof VIEWS)[number];

export default async function CalendarPage(
  props: PageProps<"/takvim">,
) {
  const search = await props.searchParams;
  const view: View = VIEWS.includes(search.g as View) ? (search.g as View) : "week";
  const impactFilter = typeof search.onem === "string" ? search.onem : null;

  const { locale, t } = await getI18n();
  const today = todayEt();

  const to =
    view === "day" ? today : view === "week" ? addEtDays(today, 6) : addEtDays(today, 29);
  let events = await getEventsBetween(today, to);

  if (impactFilter) {
    events = events.filter((event) => event.importance === impactFilter);
  }

  // Güne göre grupla
  const byDay = new Map<string, EconomicEventRow[]>();
  for (const event of events) {
    const list = byDay.get(event.eventDate) ?? [];
    list.push(event);
    byDay.set(event.eventDate, list);
  }

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

  // Saat sütunu: üstte okuyucunun saati, altında kaynağın saati.
  const tags = zoneTag(locale);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-ink w-fit text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">
            {t.calendar.title}
          </h1>
          <p className="mt-2 text-sm text-soft">{t.calendar.subtitle}</p>
        </div>
        <p className="text-[11px] text-muted">{t.calendar.timesNote}</p>
      </header>

      {/* Görünüm + önem filtresi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label={t.calendar.title}>
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`/takvim?g=${v}${impactFilter ? `&onem=${impactFilter}` : ""}`}
              className={cn(
                "min-h-[36px] rounded-(--radius-sm) px-3 py-1.5 text-sm font-medium transition-colors",
                view === v
                  ? "bg-primary-wash text-primary"
                  : "text-muted hover:bg-surface-elevated hover:text-soft",
              )}
            >
              {viewLabel[v]}
            </Link>
          ))}
        </nav>
        <nav className="flex gap-1" aria-label={t.calendar.impact}>
          {(["high", "medium", "low"] as const).map((level) => (
            <Link
              key={level}
              href={
                impactFilter === level
                  ? `/takvim?g=${view}`
                  : `/takvim?g=${view}&onem=${level}`
              }
              className={cn(
                "flex min-h-[36px] items-center gap-1.5 rounded-(--radius-sm) px-2.5 py-1.5 text-xs transition-colors",
                impactFilter === level
                  ? "bg-primary-wash text-primary"
                  : "text-muted hover:bg-surface-elevated hover:text-soft",
              )}
            >
              <ImpactDots importance={level} label={impactLabel[level]} />
              {impactLabel[level]}
            </Link>
          ))}
        </nav>
      </div>

      {byDay.size === 0 ? (
        <Panel>
          <EmptyState title={t.calendar.empty} />
        </Panel>
      ) : (
        [...byDay.entries()].map(([date, dayEvents]) => (
          <Panel key={date}>
            <div className="flex items-baseline justify-between border-b border-line-soft px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-strong">
                {formatEtDateLong(date, locale)}
              </h2>
              <span className="numeral text-[11px] text-muted">
                {formatEtDateShort(date, locale)}
              </span>
            </div>

            {/* Sütun başlıkları */}
            <div className="hidden grid-cols-[4rem_1rem_1fr_5rem_5rem_5rem] gap-3 border-b border-line-soft px-4 py-2 text-[10px] uppercase tracking-wider text-muted sm:grid sm:px-5">
              <span>
                {tags.primary} · {tags.secondary}
              </span>
              <span />
              <span>{t.calendar.event}</span>
              <span className="text-right">{t.calendar.actual}</span>
              <span className="text-right">{t.calendar.forecast}</span>
              <span className="text-right">{t.calendar.previous}</span>
            </div>

            <ul className="divide-y divide-line-soft">
              {dayEvents.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[4rem_1rem_1fr] items-center gap-3 px-4 py-2.5 sm:grid-cols-[4rem_1rem_1fr_5rem_5rem_5rem] sm:px-5"
                >
                  {event.eventTimeEt ? (
                    (() => {
                      const times = timePair(
                        event.eventDate,
                        event.eventTimeEt,
                        locale,
                      );
                      return (
                        <span>
                          <span className="numeral block text-sm font-semibold leading-tight text-strong">
                            {times.primary}
                          </span>
                          <span className="numeral block text-[11px] leading-tight text-muted">
                            {times.secondary} {tags.secondary}
                          </span>
                        </span>
                      );
                    })()
                  ) : (
                    <span className="numeral text-sm text-muted">—</span>
                  )}
                  <ImpactDots
                    importance={event.importance}
                    label={impactLabel[event.importance] ?? event.importance}
                  />
                  <span className="min-w-0 truncate text-sm text-body">
                    {locale === "tr" ? event.titleTr : event.titleEn}
                  </span>
                  <span className="numeral hidden text-right text-sm font-semibold text-strong sm:block">
                    {event.actual ?? "—"}
                  </span>
                  <span className="numeral hidden text-right text-sm text-soft sm:block">
                    {event.forecast ?? "—"}
                  </span>
                  <span className="numeral hidden text-right text-sm text-muted sm:block">
                    {event.previous ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}

      {/* Makro takvimin altında halka arz takvimi: ikisi de "önümüzdeki
          günlerde ne olacak" sorusuna cevap veriyor. */}
      <IpoCalendar locale={locale} t={t} />

      <GuideHint
        label={t.guide.contextLabel}
        slugs={["sahin-guvercin", "enflasyon"]}
        className="pt-1"
      />
    </div>
  );
}
