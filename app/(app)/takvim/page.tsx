import { GuideHint } from "@/components/article/GuideHint";
import { IpoCalendar } from "@/components/markets/IpoCalendar";
import Link from "next/link";
import {
  EmptyState,
  ImpactDots,
  Panel,
} from "@/components/ui/primitives";
import { CalendarPlus } from "@phosphor-icons/react/dist/ssr";
import { eventExplainer } from "@/lib/event-explainers";
import { getEventsBetween } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { timePair, zoneTag } from "@/lib/session-clock";
import {
  cn,
  formatEtDateLong,
  formatEventValue,
} from "@/lib/utils";
import type { EconomicEventRow } from "@/lib/schema";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/takvim",
  tr: {
    title: "Ekonomik Takvim",
    description:
      "ABD makro veri açıklamaları ve Fed toplantıları — saatleriyle.",
  },
  en: {
    title: "Economic Calendar",
    description:
      "US macro releases and Fed meetings — with the times.",
  },
});

const VIEWS = ["day", "week", "month"] as const;
type View = (typeof VIEWS)[number];

/**
 * İki ET takvim günü arasındaki fark.
 *
 * Tarihler "YYYY-MM-DD" düz gün damgası — saat taşımıyorlar. UTC gece
 * yarısından kurup çıkarmak yaz saati kaymasından etkilenmez; yerel
 * `new Date(str)` ile kurmak, DST sınırını geçen aralıklarda bir gün
 * kaydırabilirdi.
 */
function daysBetweenEt(from: string, to: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

/** "Bugün" · "Yarın" · "3 gün sonra" */
function relativeDayLabel(away: number, t: Dictionary) {
  if (away === 0) return t.calendar.today;
  if (away === 1) return t.calendar.tomorrow;
  return `${away} ${t.calendar.daysAway}`;
}

/**
 * Değer künyesi — etiket üstte küçük, sayı altında.
 *
 * Sayılar sağlayıcıdan METİN geliyor ("4.2", "129", bazen "250K" ya da
 * "3.1%"). BİRİM EKLEMİYORUZ: yüzde mi puan mı bin adet mi olduğunu
 * bilmiyoruz, uydurmak veri dürüstlüğüne aykırı. Yalnızca dizge baştan
 * sona sayıysa ondalık ayracı yerelleştiriliyor — sitenin geri kalanı
 * "4,25" yazarken bu sütunun "4.2" yazması tutarsızdı. Sayı olmayan
 * her şey olduğu gibi basılır.
 */
function ValueChip({
  label,
  value,
  locale,
  tone = "muted",
}: {
  label: string;
  value: string;
  locale: Locale;
  tone?: "strong" | "muted";
}) {
  /* Biçimlendirme `lib/utils.ts` içindeki paylaşılan yardımcıda: ana
     sayfadaki Gün Şeridi de aynı değeri basıyor ve iki kopya birbirinden
     ayrı düşmüştü. */
  const shown = formatEventValue(value, null, locale) ?? value.trim();

  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="text-micro font-semibold uppercase tracking-[0.07em] text-muted">
        {label}
      </span>
      <span
        className={cn(
          "numeral text-base",
          tone === "strong" ? "font-bold text-strong" : "text-soft",
        )}
      >
        {shown}
      </span>
    </span>
  );
}

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
          <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
            {t.calendar.title}
          </h1>
          <p className="mt-2 text-sm text-soft">{t.calendar.subtitle}</p>
        </div>
        <p className="text-tiny text-muted">{t.calendar.timesNote}</p>
      </header>

      {/* Görünüm + önem filtresi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label={t.calendar.title}>
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`/takvim?g=${v}${impactFilter ? `&onem=${impactFilter}` : ""}`}
              scroll={false}
              className={cn(
                "min-h-11 rounded-(--radius-sm) px-3 py-1.5 sm:min-h-[36px] text-sm font-medium transition-colors",
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
              scroll={false}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-(--radius-sm) px-2.5 py-1.5 sm:min-h-[36px] text-xs transition-colors",
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
        [...byDay.entries()].map(([date, dayEvents]) => {
          const away = daysBetweenEt(today, date);
          const isToday = away === 0;
          const highCount = dayEvents.filter(
            (event) => event.importance === "high",
          ).length;

          return (
            <Panel
              key={date}
              className={cn(
                "overflow-hidden",
                isToday && "border-primary-faint",
              )}
            >
              <div
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line-soft px-4 py-3 sm:px-5",
                  isToday && "bg-primary-tint",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h2 className="text-sm font-semibold text-strong">
                    {formatEtDateLong(date, locale)}
                  </h2>
                  {/* Uzaklık rozeti: takvimde asıl soru "ne zaman", ve
                      "12 Ağustos"un kaç gün sonrası olduğu ancak sağdaki
                      kısa tarihe bakıp kafadan çıkarılıyordu. */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-nano font-bold",
                      isToday
                        ? "bg-primary text-on-primary"
                        : "bg-surface-elevated text-soft",
                    )}
                  >
                    {relativeDayLabel(away, t)}
                  </span>
                </div>

                <span className="numeral text-tiny text-muted">
                  {dayEvents.length}{" "}
                  {dayEvents.length === 1
                    ? t.calendar.eventOne
                    : t.calendar.eventMany}
                  {highCount > 0 && (
                    <>
                      <span aria-hidden className="mx-1.5">
                        ·
                      </span>
                      <span className="font-semibold text-strong">
                        {highCount}
                      </span>{" "}
                      {t.calendar.highImpactShort}
                    </>
                  )}
                </span>
              </div>

              <ul className="divide-y divide-line-soft">
                {dayEvents.map((event) => {
                  const times = event.eventTimeEt
                    ? timePair(event.eventDate, event.eventTimeEt, locale)
                    : null;

                  return (
                    <li
                      key={event.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 px-4 py-3 sm:flex-nowrap sm:px-5"
                    >
                      <span className="w-16 shrink-0">
                        {times ? (
                          <>
                            <span className="numeral block text-sm font-semibold leading-tight text-strong">
                              {times.primary}
                            </span>
                            <span className="numeral block text-tiny leading-tight text-muted">
                              {times.secondary} {tags.secondary}
                            </span>
                          </>
                        ) : (
                          <span className="numeral text-sm text-muted">—</span>
                        )}
                      </span>

                      <ImpactDots
                        importance={event.importance}
                        label={impactLabel[event.importance] ?? event.importance}
                      />

                      {/* Başlık + açıklama. Satır eskiden yalnızca başlıktı
                          ve "TÜFE — Temmuz Verisi", TÜFE'nin ne olduğunu
                          bilmeyene hiçbir şey söylemiyordu; sitenin geri
                          kalanındaki öğretici ton takvimde kesiliyordu.
                          Açıklama olayın TÜRÜNE bağlı (bkz.
                          `lib/event-explainers.ts`), tanınmayan türde satır
                          eskisi gibi tek satır kalır. */}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-sm",
                            event.importance === "high"
                              ? "font-semibold text-strong"
                              : "text-body",
                          )}
                        >
                          {locale === "tr" ? event.titleTr : event.titleEn}
                        </span>
                        {eventExplainer(event.slug, locale) && (
                          <span className="max-w-[68ch] text-tiny leading-[17px] text-muted">
                            {eventExplainer(event.slug, locale)}
                          </span>
                        )}
                        {/* Takvime ekleme YALNIZCA yüksek etkili olaylarda.
                            Her satıra düğme koymak takvimi bir düğme
                            listesine çeviriyordu; okuyucunun kendi takvimine
                            geçirmek isteyeceği şey zaten bu üç beş olay. */}
                        {event.importance === "high" && (
                          <a
                            href={`/api/takvim?tip=olay&slug=${event.slug}`}
                            className="-my-1 mt-1 inline-flex w-fit min-h-8 items-center gap-1 rounded-full border border-line px-2 py-1 text-nano font-semibold text-muted transition-colors hover:border-line-strong hover:text-primary"
                          >
                            <CalendarPlus weight="duotone" size={13} aria-hidden />
                            {t.earnings.addToCalendar}
                          </a>
                        )}
                      </span>

                      {/* Değerler künye olarak, etiketi yanında. Eski hâlde
                          üç sabit sütun vardı ve açıklanmamış olaylarda
                          üçü de tire basıyordu: satırın yarısı boş tireydi.
                          Şimdi yalnızca DOLU olan yazılıyor. */}
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:shrink-0 sm:justify-end">
                        {event.actual !== null && (
                          <ValueChip
                            label={t.calendar.actual}
                            value={event.actual}
                            locale={locale}
                            tone="strong"
                          />
                        )}
                        {event.forecast !== null && (
                          <ValueChip
                            label={t.calendar.forecast}
                            value={event.forecast}
                            locale={locale}
                          />
                        )}
                        {event.previous !== null && (
                          <ValueChip
                            label={t.calendar.previous}
                            value={event.previous}
                            locale={locale}
                          />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })
      )}

      {/* Makro takvimin altında halka arz takvimi: ikisi de "önümüzdeki
          günlerde ne olacak" sorusuna cevap veriyor. */}
      <IpoCalendar locale={locale} t={t} />

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["sahin-guvercin", "enflasyon"]}
        className="pt-1"
      />
    </div>
  );
}
