import { HeroAccent } from "@/components/motion/HeroAccent";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { CalendarStrip } from "@/components/calendar/CalendarStrip";
import { DayPicker } from "@/components/calendar/DayPicker";
import { NextRelease } from "@/components/calendar/NextRelease";
import { GuideHint } from "@/components/article/GuideHint";
import { IpoCalendar } from "@/components/markets/IpoCalendar";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  DataError,
  EmptyState,
  ImpactDots,
  Panel,
  PanelHeader,
  Segment,
  SegmentItem,
} from "@/components/ui/primitives";
import { CalendarPlus } from "@phosphor-icons/react/dist/ssr";
import { eventExplainer } from "@/lib/event-explainers";
import { getEventsBetweenResult, getHolidays } from "@/lib/data";
import {
  addEtDays,
  daysBetweenEt,
  etParts,
  todayEt,
  type MarketHoliday,
} from "@/lib/market-hours";
import { getI18n, type Locale } from "@/lib/i18n";
import { hasActual } from "@/lib/day-flow";
import { getReleasedObservation } from "@/lib/providers/fred";
import {
  displayZone,
  readerDayOffset,
  timePair,
  zoneDateKey,
  zoneTag,
} from "@/lib/session-clock";
import {
  cn,
  formatEtDateLong,
  formatEventValue,
  relativeDayLabel,
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
      "ABD makro veri açıklamaları ve Fed toplantıları, saatleriyle.",
  },
  en: {
    title: "Economic Calendar",
    description:
      "US macro releases and Fed meetings, with the times.",
  },
});

const VIEWS = ["day", "week", "month"] as const;
type View = (typeof VIEWS)[number];

/* ÖNEM DEĞERİ DOĞRULANIYOR. `?onem=` süzgeci doğrulanmıyordu: tanınmayan
   bir değer (`?onem=kritik`) listeyi tümüyle boşaltıyor ve sayfa "bu
   aralıkta planlanmış veri açıklaması yok" diye YANLIŞ bir olgu yazıyordu.
   Tanınmayan değer artık yok sayılıyor. */
const IMPACTS = ["high", "medium", "low"] as const;
type Impact = (typeof IMPACTS)[number];

/** Görünümün bugünden sonraki gün sayısı: Gün 0, Hafta 6, Ay 29. */
const VIEW_SPAN: Record<View, number> = { day: 0, week: 6, month: 29 };

/* TEK SORGU, ALTI HAFTA. Görünüm başına ayrı aralık sorgulanıyordu ve kapak
   kartı o aralığın içinden seçiliyordu — haftada yüksek etkili açıklama
   yoksa kart kayboluyordu. 41 gün (bugün + 6 hafta) halka arz takviminin
   penceresiyle aynı (`IpoCalendar` → WEEKS_AHEAD); üç görünüm de bu diziden
   bellekte türüyor, Gün/Hafta/Ay geçişi hâlâ tek sorgu. */
const LOOKAHEAD_DAYS = 41;

type AgendaItem =
  | { kind: "day"; date: string; events: EconomicEventRow[]; next?: boolean }
  | { kind: "quiet"; from: string; to: string; sentence?: string }
  | { kind: "holiday"; date: string; holiday: MarketHoliday };

function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function minutesOf(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * Gündem: gün grupları, sessiz satırlar, tatil satırları.
 *
 * Eskiden her olaylı gün kendi panelini açıyordu ve panelin solunda 190
 * piksellik bir başlık sütunu duruyordu. Ölçüldü (1440, ay): iki olaylı bir
 * panel 261 piksel, başlık sütununun içeriği 105'te bitiyor — sütunun
 * %60'ı boş. Boş günler ise hiç yazılmıyordu; okuyucu "Çarşamba boş mu,
 * yoksa veri mi yok" diye soruyordu.
 *
 * Şimdi tek liste: olaylı gün bir GRUP, ardışık boş iş günleri TEK bir
 * sessiz satır ("25–28 Eylül · Açıklama Yok"; aradaki hafta sonu satırı
 * kesmez), tatil kendi adıyla. Hafta sonu yazılmaz — orada açıklama
 * olmaması bir bilgi değil.
 */
function buildAgenda(
  dates: string[],
  byDay: Map<string, EconomicEventRow[]>,
  holidays: Map<string, MarketHoliday>,
  filtered: boolean,
): AgendaItem[] {
  const items: AgendaItem[] = [];
  let run: { from: string; to: string } | null = null;
  /* Süzgeç açıkken sessiz satır YOK: "24 Eylül · Açıklama Yok" orta
     etkili bir açıklamanın olduğu günde yanlış olurdu. Liste yalnızca
     eşleşen günleri gösterir; süzgeç çipte görünüyor. */
  const flush = () => {
    if (run && !filtered) items.push({ kind: "quiet", ...run });
    run = null;
  };

  for (const date of dates) {
    const events = byDay.get(date);
    if (events?.length) {
      flush();
      items.push({ kind: "day", date, events });
      continue;
    }
    if (isWeekend(date)) continue;
    const holiday = holidays.get(date);
    if (holiday) {
      flush();
      items.push({ kind: "holiday", date, holiday });
      continue;
    }
    run = run ? { from: run.from, to: date } : { from: date, to: date };
  }
  flush();
  return items;
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
 *
 * Biçimlendirme `lib/utils.ts` içindeki paylaşılan yardımcıda: ana
 * sayfadaki Gün Şeridi de aynı değeri basıyor ve iki kopya birbirinden
 * ayrı düşmüştü. BİRİM GEÇİLİYOR: `null` yazılıydı ve yüzde işareti hiç
 * basılmıyordu — aynı TÜFE rakamı ana sayfada "%3,46", takvimde çıplak
 * "3,46" olarak duruyordu.
 */
function ValueSlot({
  label,
  value,
  unit,
  locale,
  strong = false,
}: {
  label: string;
  value: string | null;
  unit: string | null;
  locale: Locale;
  strong?: boolean;
}) {
  /* BOŞ YUVA BOŞ KALIR, TİRE BASILMAZ. Yuva yine de yerinde duruyor:
     üç sütun sabit sırada (Gerçekleşen · Beklenti · Önceki) ve bir satırda
     beklenti yoksa öteki satırların "Önceki" değeri sola kaymıyor. */
  if (value === null) return <span className={styles.value} data-empty="true" aria-hidden />;
  const shown = formatEventValue(value, unit, locale) ?? value.trim();
  return (
    <span className={styles.value} data-strong={strong || undefined}>
      <span>{label}</span>
      <span className="numeral">{shown}</span>
    </span>
  );
}

export default async function CalendarPage(
  props: PageProps<"/takvim">,
) {
  const search = await props.searchParams;
  const view: View = VIEWS.includes(search.g as View) ? (search.g as View) : "week";
  const impact: Impact | null = IMPACTS.includes(search.onem as Impact)
    ? (search.onem as Impact)
    : null;

  const { locale, t } = await getI18n();
  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  const today = todayEt();
  const now = new Date();
  /* OKUYUCUNUN BUGÜNÜ. Sayfanın bütün "bugün" işaretleri New York
     tarihindendi: TR'de 00:00–07:00 arası (kışın 06:00) ET hâlâ önceki
     gün, yani okuyucu için DÜN olan grup "Bugün" rozeti taşıyor, bugünün
     15:30 açıklaması "Yarın" diye yazılıyordu — ana sayfanın zil künyesi
     aynı anda aynı günü "Bugün" diyordu (24 Eylül 00:30 TR, ölçüldü).
     Sorgu penceresi, gruplama, çapa (`#gun-`) ve `isAhead` ET'de kalıyor;
     okuyucuya GÖRÜNEN aralık ve Gün görünümü ikisinin geç olanından
     başlıyor. Düşen ET grubunda ileride hiçbir şey yok: tohumlanan en geç
     olay 14:30 ET (21:30 TR, ölçüldü: 105 olayın saatleri 08:30 / 14:00 /
     14:30), yani TR gece yarısından önce olmuş. EN'de dilim ET, ikisi eşit;
     hiçbir şey değişmiyor. */
  const readerToday = zoneDateKey(now, displayZone(locale));
  const start = readerToday > today ? readerToday : today;
  const to = addEtDays(start, VIEW_SPAN[view]);

  const [result, holidayRows] = await Promise.all([
    getEventsBetweenResult(today, addEtDays(today, LOOKAHEAD_DAYS)),
    getHolidays(),
  ]);
  const nowMinutes = etParts(now).minutes;
  /* SAATİ GEÇMİŞ SATIR "PLANLANDI" DEMEZ. Veri tabanındaki `actual` çoğu
     olayda geri doldurulmuyor (ölçüldü: 17 Eylül işsizlik başvuruları ve
     16 Eylül FOMC satırları hâlâ boş) ve satır günün geri kalanında
     "Planlandı" yazıyordu; ana sayfanın Bugünün Akışı aynı satıra
     "Sonuç Bekleniyor" ya da değeriyle "Açıklandı" diyordu. İki ekran aynı
     satır için anlaşmıyordu. Artık Gün Akışı'nın yolu: bugünün (ET) saati
     geçmiş FRED satırı için `getReleasedObservation`, aynı anahtar, aynı
     önbellek (60 sn), yani ana sayfayla aynı sayı. Yalnızca BUGÜNÜN
     satırları sorulur: altı haftalık liste sağlayıcıya yelpazelenmez
     (bugün en çok birkaç satır). Saatin geçmesi yine yayın KANITI değil:
     değer gelmediyse "Sonuç Bekleniyor", bir yayın iddiası taşımaz. */
  const passed = (event: EconomicEventRow) =>
    event.eventDate < today ||
    (event.eventDate === today && event.eventTimeEt !== null && minutesOf(event.eventTimeEt) <= nowMinutes);
  const all = result.ok
    ? await Promise.all(
        result.rows.map(async (event) => {
          if (event.eventDate !== today || !event.fredSeriesId || hasActual(event.actual) || !passed(event)) {
            return event;
          }
          const fresh = await getReleasedObservation(event.fredSeriesId, today);
          return fresh
            ? { ...event, actual: fresh.actual, previous: fresh.previous ?? event.previous }
            : event;
        }),
      )
    : [];
  const holidays = new Map(holidayRows.map((holiday) => [holiday.date, holiday]));

  const matches = (event: EconomicEventRow) => !impact || event.importance === impact;
  const inRange = all.filter((event) => event.eventDate >= start && event.eventDate <= to);
  /* Çip sayıları SÜZGEÇTEN ÖNCE: okuyucu "Yüksek 0"ı tıklamadan görsün. */
  const counts: Record<Impact, number> = { high: 0, medium: 0, low: 0 };
  for (const event of inRange) {
    if (event.importance in counts) counts[event.importance as Impact] += 1;
  }
  const listed = inRange.filter(matches);

  const byDay = new Map<string, EconomicEventRow[]>();
  for (const event of listed) {
    const list = byDay.get(event.eventDate) ?? [];
    list.push(event);
    byDay.set(event.eventDate, list);
  }

  const dates = Array.from({ length: VIEW_SPAN[view] + 1 }, (_, index) => addEtDays(start, index));

  /* Aralık boşsa tek bir cümle, ardından SIRADAKİ açıklama günü. Gün
     görünümü bugün boşken iki boş kutu basıyordu (1316×97 tek hücrelik şerit
     + 102 piksellik boş durum paneli); okuyucunun asıl sorusu "peki ne
     zaman?" ve cevabı altı haftalık pencerede zaten var. */
  let agenda: AgendaItem[] = [];
  if (listed.length > 0) {
    agenda = view === "day" ? [{ kind: "day", date: start, events: listed }] : buildAgenda(dates, byDay, holidays, impact !== null);
  } else if (result.ok) {
    const todayHoliday = holidays.get(start);
    agenda =
      view === "day" && todayHoliday
        ? [{ kind: "holiday", date: start, holiday: todayHoliday }]
        : [{ kind: "quiet", from: start, to, sentence: impact ? t.calendar.emptyFiltered : view === "day" ? t.calendar.todayEmpty : t.calendar.empty }];
    const nextDate = all.find((event) => event.eventDate > to && matches(event))?.eventDate;
    if (nextDate) {
      agenda.push({
        kind: "day",
        date: nextDate,
        events: all.filter((event) => event.eventDate === nextDate && matches(event)),
        next: true,
      });
    }
  }
  const renderedDays = new Set(agenda.flatMap((item) => (item.kind === "day" ? [item.date] : [])));
  const shownEvents = agenda.flatMap((item) => (item.kind === "day" ? item.events : []));
  /* DEĞER SÜTUNU YALNIZCA DEĞER VARSA. Sabit 264 piksellik üç yuvalı sütun
     sayıları günler boyunca hizalıyor — ama tohumlanan takvimde beklenti
     ve önceki değer çoğu zaman henüz yok ve ölçüldüğünde (22 Eylül, altı
     haftalık pencere) 19 olayın hiçbiri değer taşımıyordu. Sütun o zaman
     her satırın sağında 264 piksellik boş bir şerit olurdu. Listede tek bir
     değer bile varsa sütun hepsinde açılır ve hizayı korur. */
  const hasValues = shownEvents.some(
    (event) => event.actual !== null || event.forecast !== null || event.previous !== null,
  );

  /* Sıradaki açıklama: henüz açıklanmamış (`actual` boş) ve saati geçmemiş.
     Saati geçmiş ama değeri gelmemiş olay (FRED gecikmesi) "sıradaki"
     sayılmaz; saatsiz bir olay bugünse geçtiği kanıtlanamadığı için sayılır.
     `nowMinutes` yukarıda, sayfanın tek `now`undan. */
  const isAhead = (event: EconomicEventRow) =>
    event.actual === null &&
    (event.eventDate > today ||
      event.eventTimeEt === null ||
      minutesOf(event.eventTimeEt) > nowMinutes);
  const nextHigh = all.find((event) => event.importance === "high" && isAhead(event));
  const next = nextHigh ?? all.find(isAhead);
  const nextHref = !next
    ? null
    : renderedDays.has(next.eventDate)
      ? `#gun-${next.eventDate}`
      : daysBetweenEt(today, next.eventDate) <= VIEW_SPAN.month
        ? `/takvim?g=month#gun-${next.eventDate}`
        : null;

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
  const countLabel = (count: number) =>
    `${count} ${count === 1 ? t.calendar.eventOne : t.calendar.eventMany}`;

  // Saat sütunu: üstte okuyucunun saati, altında kaynağın saati.
  const tags = zoneTag(locale);

  const dayMonth = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long", timeZone: "UTC" });
  const noon = (date: string) => new Date(`${date}T12:00:00Z`);
  const spanLabel = (from: string, until: string) =>
    from === until ? formatEtDateLong(from, locale) : dayMonth.formatRange(noon(from), noon(until));
  /* Başlık okuyucuya GÖRÜNEN aralık: `start`tan (TR gece yarısından sonra
     "22 – 29 Eylül" yazıp listeyi 23’ten başlatıyordu). */
  const rangeTitle = spanLabel(start, to);

  const renderEvent = (event: EconomicEventRow) => {
    const times = event.eventTimeEt ? timePair(event.eventDate, event.eventTimeEt, locale) : null;
    const explainer = eventExplainer(event.slug, locale);
    const high = event.importance === "high";
    return (
      <li key={event.id} className={styles.event} data-impact={event.importance}>
        {/* SAAT BİR KARO. Satırın solunda çıplak iki satır metin duruyordu
            ve satırların hiçbir görsel çapası yoktu. Bu ekranın anlattığı
            şey bir PROGRAM ve programın çapası saattir — bilanço takviminde
            o çapa şirket logosu, burada saat. */}
        <span className={styles.time} data-high={high || undefined}>
          {times ? (
            <>
              <span className="numeral">{times.primary}</span>
              {/* KARONUN İÇİNDE KÜNYE TONU YETMİYOR. Karo koyu temada %12
                  beyaz zemin taşıyor: `--text-muted` orada 10 pikselde
                  4,09'a iniyor (ölçüldü, gereken 4,5). Gövde tonu karoyu
                  bozmuyor; punto ve ağırlık farkı ikincil olduğunu zaten
                  söylüyor. */}
              <span className="numeral">
                {times.secondary} {tags.secondary}
              </span>
            </>
          ) : (
            /* Saatsiz olayda tire değil, adı: "Saat Belirsiz". */
            <span className={styles.timeUnknown}>{t.earnings.timeUnknown}</span>
          )}
        </span>

        {/* Noktalar başlığın İLK SATIRIYLA hizalı: kendi yükseklikleri 6
            piksel, satır `items-start` olduğu için hizalanmadan bırakılırsa
            metnin üstünde asılı kalıyorlar. */}
        <span className={styles.impact}>
          <ImpactDots importance={event.importance} label={impactLabel[event.importance] ?? event.importance} />
        </span>

        {/* Başlık + açıklama. Açıklama olayın TÜRÜNE bağlı (bkz.
            `lib/event-explainers.ts`); tanınmayan türde satır tek satır kalır. */}
        <span className={styles.body}>
          <span className={styles.title} data-high={high || undefined}>
            {locale === "tr" ? event.titleTr : event.titleEn}
          </span>
          {explainer && <span className={styles.explainer}>{explainer}</span>}
          {/* DURUM VE EYLEM AYNI SATIRDA. "Takvime Ekle" sağ uçta ayrı bir
              hap olarak duruyordu ve değeri olmayan satırlarda satırın sağ
              yarısı yalnızca o hapı taşıyordu. Şimdi durumun yanında, aynı
              taban çizgisinde; yalnızca yüksek etkili olaylarda — her
              satıra düğme koymak takvimi bir düğme listesine çeviriyordu. */}
          <span className={styles.statusLine}>
            {/* Yayın ancak sağlayıcı `actual` verince kanıtlanmış olur;
                saatin geçmesi açıklandı demek değil. */}
            <span className={styles.status} data-published={hasActual(event.actual) || undefined}>
              {hasActual(event.actual)
                ? t.calendar.released
                : passed(event)
                  ? t.dayFlow.awaiting
                  : t.calendar.scheduled}
            </span>
            {high && (
              <a
                href={`/api/takvim?tip=olay&slug=${event.slug}`}
                /* `download` ŞART — gerekçe components/earnings/AddToCalendar.tsx
                   künyesinde: bu uç dosya indiriyor, gezinme olmuyor ve
                   `RouteProgress` şeridi kendiliğinden durmuyordu. */
                download
                className={cn(styles.addCal, "tap-44")}
              >
                <CalendarPlus weight="duotone" size={14} aria-hidden />
                {t.earnings.addToCalendar}
              </a>
            )}
          </span>
        </span>

        {hasValues && (
          <span className={styles.values}>
            <ValueSlot label={t.calendar.actual} value={event.actual} unit={event.unit} locale={locale} strong />
            <ValueSlot label={t.calendar.forecast} value={event.forecast} unit={event.unit} locale={locale} />
            <ValueSlot label={t.calendar.previous} value={event.previous} unit={event.unit} locale={locale} />
          </span>
        )}
      </li>
    );
  };

  const renderItem = (item: AgendaItem) => {
    if (item.kind === "quiet") {
      return (
        <p key={`quiet-${item.from}`} className={styles.quiet}>
          {item.sentence ?? (
            <>
              <span className="numeral">{spanLabel(item.from, item.to)}</span>
              <span aria-hidden> · </span>
              {t.calendar.noRelease}
            </>
          )}
          {item.sentence && impact && (
            <Link href={`/takvim?g=${view}`} scroll={false} className={cn(styles.quietAction, "tap-44")}>
              {t.earnings.clearFilter}
            </Link>
          )}
        </p>
      );
    }
    if (item.kind === "holiday") {
      return (
        <p key={`holiday-${item.date}`} className={styles.quiet} data-holiday="true">
          <span className="numeral">{formatEtDateLong(item.date, locale)}</span>
          <span aria-hidden> · </span>
          <span className={styles.holidayTag}>
            {item.holiday.earlyCloseEt ? t.market.earlyClose : t.market.closed}
          </span>
          <span aria-hidden> · </span>
          {locale === "tr" ? item.holiday.nameTr : item.holiday.nameEn}
        </p>
      );
    }

    /* Göreli gün OKUYUCUNUN gününden (`readerDayOffset`); grup ET tarihi
       ve saatsiz sayılıyor. Geçmiş bir gün (eksi) rozetsiz kalıyor —
       "Bugün" yalnızca okuyucunun bugünü. */
    const away = readerDayOffset(item.date, null, locale, now);
    const highCount = item.events.filter((event) => event.importance === "high").length;
    const holiday = holidays.get(item.date);
    return (
      <section
        key={item.date}
        id={`gun-${item.date}`}
        className={styles.group}
        data-today={away === 0 || undefined}
        aria-labelledby={`gun-${item.date}-baslik`}
      >
        {/* YAPIŞKAN GÜN BAŞLIĞI. 190 piksellik sol sütunun yerine satır
            başlığı: uzun bir günde tarih kaydırırken ekranda kalıyor.
            Panel `overflow: clip` taşıyor — `hidden` onu kaydırma kabı yapıp
            yapışkanlığı öldürürdü (bkz. modül). */}
        <div className={styles.groupHead}>
          <h3 id={`gun-${item.date}-baslik`}>{formatEtDateLong(item.date, locale)}</h3>
          {/* Uzaklık rozeti: takvimde asıl soru "ne zaman"; "30 Eylül"ün kaç
              gün sonra olduğu ancak kafadan hesaplanıyordu. */}
          {away >= 0 && (
            <span className={styles.rel} data-today={away === 0 || undefined}>
              {relativeDayLabel(away, t.calendar)}
            </span>
          )}
          {item.next && <span className={styles.groupTag}>{t.calendar.nextDay}</span>}
          {holiday && (
            <span className={styles.groupTag} data-holiday="true">
              {holiday.earlyCloseEt ? t.market.earlyClose : t.market.closed}
              {" · "}
              {locale === "tr" ? holiday.nameTr : holiday.nameEn}
            </span>
          )}
          <span className={styles.groupCount}>
            {countLabel(item.events.length)}
            {highCount > 0 && (
              <>
                <span aria-hidden> · </span>
                <strong>{highCount}</strong> {t.calendar.highImpactShort}
              </>
            )}
          </span>
        </div>
        <ul className={styles.events}>{item.events.map(renderEvent)}</ul>
      </section>
    );
  };

  /* Önem çipleri takvim panelinin başlığında: pencere seçimi (Gün/Hafta/Ay)
     kapağın sağında kalıyor — Ahmet'in açık isteği, c9b4e8f — ama süzgeç
     LİSTEYİ süzüyor, pencereyi değil; yeri listenin başı. Sayı taşıyorlar:
     "Yüksek 0" tıklamadan önce görünüyor. Okuma başarısızsa sayı yok —
     sıfır, bilinmeyen bir şeyi "yok" diye yazmak olurdu. */
  /* GÜN GÖRÜNÜMÜNDE SAYI YOK. Sayılar bugünü sayıyor; bugün boşsa liste
     sıradaki açıklama gününe geçiyor ve okuyucu "Orta 0" çipinin hemen
     altında orta etkili bir satır görüyordu (390 ve 1440'ta ölçüldü) —
     çip kendi listesiyle çelişiyordu. Tek günlük listede sayı zaten bir şey
     katmıyor; hafta ve ayda kalıyor. */
  const showCounts = result.ok && view !== "day";
  const chips = (
    <nav className={styles.chips} aria-label={t.calendar.impact}>
      {IMPACTS.map((level) => (
        <Link
          key={level}
          href={impact === level ? `/takvim?g=${view}` : `/takvim?g=${view}&onem=${level}`}
          scroll={false}
          aria-current={impact === level ? "true" : undefined}
          className={styles.chip}
          data-zero={showCounts && counts[level] === 0 ? "true" : undefined}
        >
          <ImpactDots importance={level} label={impactLabel[level]} />
          <span aria-hidden>{impactLabel[level]}</span>
          {showCounts && <span className={cn(styles.chipCount, "numeral")}>{counts[level]}</span>}
        </Link>
      ))}
    </nav>
  );

  const viewSwitch = (className: string) => (
    <span className={className}>
      <Segment label={t.calendar.viewLabel}>
        {VIEWS.map((option) => (
          <SegmentItem
            key={option}
            href={`/takvim?g=${option}${impact ? `&onem=${impact}` : ""}`}
            active={view === option}
          >
            {viewLabel[option]}
          </SegmentItem>
        ))}
      </Segment>
    </span>
  );

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <header className={`${styles.hero} page-frame`}>
        <HeroAccent />
        <div className="page-heading-copy">
          <p className="page-eyebrow">{t.calendar.eyebrow}</p>
          <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
            {t.calendar.title}
          </h1>
          <p>{t.calendar.subtitle}</p>
        </div>
        {/* KAPAĞIN SAĞI: görünüm seçimi üstte, sıradaki açıklama altında.
            Seçim burada kalıyor (Ahmet'in açık isteği: "Gün/hafta/ay seçimi
            üst kartın sağına"). Önceki hâlde bu kolon yalnızca denetimleri
            taşıyordu ve ölçüldü: 1440'ta 554 piksel genişliğindeki kolonda
            46 piksel içerik, altı boş — kart yalnızca haftada yüksek etkili
            açıklama varsa çıkıyordu. Kart artık altı haftalık pencereden
            geliyor; kolon her zaman dolu. Okuma başarısızsa kart yok, kolon
            yalnızca seçimi taşır. */}
        <div className={styles.heroSide}>
          {viewSwitch(styles.heroSeg)}
          {next && (
            <NextRelease
              event={next}
              label={nextHigh ? t.calendar.nextHigh : t.calendar.nextRelease}
              away={readerDayOffset(next.eventDate, next.eventTimeEt, locale, now)}
              href={nextHref}
              inPage={nextHref?.startsWith("#") ?? false}
              locale={locale}
              t={t}
            />
          )}
        </div>
      </header>

      {/* PANO: takvim solda, halka arz sağda (≥1100). Seyrek bir hafta
          halka arzın ÜSTÜNDE bir boşluk olarak değil, yanında duruyor.
          Aralık sabit `gap`, kolonlar eşitlenmiyor — kısa olan erken biter
          (CLAUDE.md, `justify-between` kuralı). */}
      <div className={styles.board}>
        <QueryTransition label={t.common.loading}>
          <Panel className={styles.calendar} data-motion-reveal>
            {/* GÖRÜNÜM SEÇİMİ TELEFONDA PANELİN BAŞINDA. Kapağın "sağı"
                telefonda yok; seçim orada kartın üstüne ayrı bir satır
                olarak iniyor ve kapağı 340 piksele çıkarıyordu (390,
                ölçüldü; önceki hâl 288). Aynı denetim burada aralık
                başlığının yanına oturuyor ve kapak yalnızca başlık ile
                sıradaki açıklamayı taşıyor. İki kopyadan biri her
                genişlikte `display: none` — erişilebilirlik ağacında
                tek denetim var. */}
            <PanelHeader
              title={rangeTitle}
              action={
                <>
                  {chips}
                  {viewSwitch(styles.headSeg)}
                </>
              }
              className={styles.panelHead}
            />
            {!result.ok ? (
              /* Okunamadı: hiçbir boşluk iddiası yok — ne şerit, ne sessiz
                 satır, ne kapak kartı. */
              <DataError message={t.common.noData} hint={t.common.noDataHint} />
            ) : (
              <>
                {/* Süzgeç aralıkta hiçbir şey bırakmadıysa şerit çizilmiyor:
                    yedi boş karo (1440'ta ~170 piksel) cümlenin ve sıradaki
                    günün söylediğini tekrarlıyor, üstelik başka önemde
                    açıklaması olan günü boş gibi gösteriyordu. */}
                {view !== "day" && !(impact !== null && listed.length === 0) && (
                  <CalendarStrip
                    view={view}
                    dates={dates}
                    byDay={byDay}
                    holidays={holidays}
                    today={readerToday}
                    locale={locale}
                    t={t}
                  />
                )}
                {agenda.length > 0 ? (
                  <>
                  {view !== "day" && (
                    <DayPicker
                      key={`${view}-${impact ?? "all"}`}
                      note={t.calendar.pickedNote}
                      showAll={t.calendar.allDays}
                    />
                  )}
                  <div className={styles.agenda} data-agenda data-values={hasValues || undefined}>
                    {agenda.map(renderItem)}
                  </div>
                  </>
                ) : (
                  <EmptyState
                    compact
                    title={impact ? t.calendar.emptyFiltered : view === "day" ? t.calendar.todayEmpty : t.calendar.empty}
                    action={
                      impact ? (
                        <Link href={`/takvim?g=${view}`} scroll={false} className={cn(styles.quietAction, "tap-44")}>
                          {t.earnings.clearFilter}
                        </Link>
                      ) : undefined
                    }
                  />
                )}
                <p className={styles.foot}>{t.calendar.timesNote}</p>
              </>
            )}
          </Panel>
        </QueryTransition>

        {/* Halka arz takvimi: ikisi de "önümüzdeki günlerde ne olacak"
            sorusuna cevap veriyor. Geçiş maskesinin DIŞINDA — kendi akışı
            görünüm değişirken örtülmesin. */}
        <aside className={styles.aside}>
          <IpoCalendar locale={locale} t={t} compact />
        </aside>
      </div>

      {/* DÖRT SLUG, İKİ DEĞİL — sayfa iki yarım taşıyor. Üstteki ekonomik
          takvim Fed ve enflasyona bakıyor, halka arz takvimi bambaşka bir
          konuya; rehber satırı yalnızca ilk yarıyı karşılıyordu. Halka
          arz künyesindeki "Hisse Senedi ve Likidite rehberlerine
          bakabilirsin" cümlesi de düz metindi, yani tıklanmıyordu — o
          yönlendirme buraya taşındı ve gerçek bağlantı oldu.
          Sayı ÇİFT olmalı: GuideHint birden çok yazıda `sm:grid-cols-2`
          veriyor, üçüncü slug ikinci satırda yarım kart bırakırdı. */}
      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["sahin-guvercin", "enflasyon", "halka-arz", "spread-likidite"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}

