import type { ReactNode } from "react";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { CalendarStrip } from "@/components/calendar/CalendarStrip";
import { CalendarSubscribe } from "@/components/calendar/CalendarSubscribe";
import { feedUrls } from "@/lib/calendar-feed";
import { DayPicker } from "@/components/calendar/DayPicker";
import { NextRelease } from "@/components/calendar/NextRelease";
import { MonthReleases, type MonthItem } from "@/components/calendar/MonthReleases";
import { WeekLookahead } from "@/components/calendar/WeekLookahead";
import { ReleasedData } from "@/components/calendar/ReleasedData";
import { buildLookahead } from "@/components/calendar/lookahead";
import { DeviationLine } from "@/components/calendar/DeviationLine";
import { ImpactTag } from "@/components/calendar/ImpactTag";
import { deviationSpans, deviationVerdict, legendMark, releaseDeviation, seriesKey, type LegendMark } from "@/lib/release-deviation";
import { FED_WAIT_MS, getFomcRelease } from "@/lib/providers/fed";
import { fedRange, isFomcFamily, previousRange } from "@/lib/fomc-statement";
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
import { FedOddsTag, fedOddsFor } from "@/components/probabilities/FedOddsTag";
import { eventExplainer } from "@/lib/event-explainers";
import { getEventsBetweenResult, getHolidays, type EventsResult } from "@/lib/data";
import {
  addEtDays,
  daysBetweenEt,
  etParts,
  todayEt,
  type MarketHoliday,
} from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { eventFamily, hasActual } from "@/lib/day-flow";
import { withTimeout } from "@/lib/providers/timeout";
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

import { RELEASED_WINDOW_DAYS, pickReleased } from "@/lib/release-notes-core";
import { insightsConfigured } from "@/lib/stock-insights";

/* EKONOMİK GÖRÜNÜM KENDİ MODÜLÜNDE (6 Kasım). Sayfa dosyası yalnız rota,
   künye ve tür seçimi; görünüm veri okuyucusunu (`load`) ve `now`u prop
   olarak alıyor. Neden: Next sayfa dosyası başka dışa aktarma kabul
   etmiyor ve ekran yalnız canlı veritabanıyla çizilebiliyordu — sahte
   satırla ölçüm (390/1440, iki tema) için aynı bileşen geçici bir
   önizleme rotasından çağrılabilmeli. Taşıma sırasında satırın değer
   çizimi de değişti (6 Kasım, inceleme ile düzeltildi — eski not "mantık
   değişmedi, yalnız taşındı" diyordu): üç sayının sıfırdan çubukları
   (`ScaleBar`) yerine sapma çizgisi (`DeviationLine`) ve künyesi; ayrıntı
   satırın içindeki yorumda. Veri okuma ve süzgeç mantığı aynı. */

/** Faiz kararı satırlarının slug öneki (lib/macro-data.ts ile aynı). */
const FOMC_RATE_PREFIX = "fomc-rate-";

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
  kind,
  label,
  value,
  unit,
  locale,
  mark = null,
  direction,
}: {
  kind: "actual" | "forecast" | "previous";
  label: string;
  value: string | null;
  unit: string | null;
  locale: Locale;
  /** Satırda sapma çizgisi varsa etiketin önündeki işaret — değerin
      çizgideki ROLÜ (`legendMark`); yoksa işaret yok. */
  mark?: LegendMark | null;
  direction?: string;
}) {
  /* BOŞ YUVA BOŞ KALIR, TİRE BASILMAZ. Yuva yine de yerinde duruyor:
     üç sütun sabit sırada (Gerçekleşen · Beklenti · Önceki) ve bir satırda
     beklenti yoksa öteki satırların "Önceki" değeri sola kaymıyor. */
  if (value === null) return <span className={styles.value} data-empty="true" aria-hidden />;
  const shown = formatEventValue(value, unit, locale) ?? value.trim();
  return (
    <span className={styles.value} data-kind={kind} data-dir={direction}>
      <span className={styles.valueLabel}>
        {/* ETİKETİN İŞARETİ ÇİZGİNİN LEJANTI (6 Kasım): nokta gerçekleşen,
            dik çizgi beklenti, gri çentik önceki — "Son Açıklanan
            Veriler" kartıyla aynı sözlük, ayrı lejant kutusu yok.
            İşaret türden değil TABANDAN (6 Kasım, inceleme): beklenti
            yokken dik çizgi öncekinin, düz sayı olmayan beklenti
            işaretsiz (`legendMark`, lib/release-deviation.ts). */}
        {mark && <i aria-hidden className={styles.valueKey} data-mark={mark} />}
        {label}
      </span>
      <span className="numeral">{shown}</span>
    </span>
  );
}

export const CALENDAR_VIEWS = VIEWS;
export const CALENDAR_IMPACTS = IMPACTS;
export type CalendarView = View;
export type CalendarImpact = Impact;

type EventsLoad = (from: string, to: string) => Promise<[EventsResult, MarketHoliday[]]>;

export async function EconomicCalendar({
  view,
  impact,
  locale,
  t,
  share,
  tabs,
  now = new Date(),
  load = (from, to) => Promise.all([getEventsBetweenResult(from, to), getHolidays()]),
}: {
  view: View;
  impact: Impact | null;
  locale: Locale;
  t: Dictionary;
  share: (path: string, title: string) => ReactNode;
  tabs: ReactNode;
  /** Sayfanın tek `now`u; önizleme sabit bir an verir. */
  now?: Date;
  load?: EventsLoad;
}) {
  const intlLocale = locale === "tr" ? "tr-TR" : "en-US";
  const today = todayEt(now);
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

  /* AYIN BAŞINA KADAR GERİ (18 Ekim). Kapağın "Bu Ayın Önemli Verileri"
     listesi okuyucunun ayının geçmiş günlerini de istiyor; ayrı bir sorgu
     açmak yerine tek sorgunun alt sınırı ayın ilk gününe iniyor (bugünden
     önceyse). Üst sınır 41 gün: ayın sonu her zaman içeride (en çok 30
     gün ileride). Geçmiş satırlar `all`a KARIŞMIYOR — sıradaki açıklama,
     sayaçlar, altı hafta ve FRED tazelemesi eskisi gibi bugünden başlıyor
     (saatsiz geçmiş bir satır `isAhead`te "sırada" sayılırdı).
     SON ON GÜN DE (18 Ekim): "Son Açıklanan Veriler" paneli ayın başından
     geriye taşabiliyor (ayın 3'ünde pencere geçen ayın 23'ü). Alt sınır
     ikisinin erkeni; ayın listesi zaten `monthKey` ile süzülüyor, fazladan
     gelen satırlar oraya karışmaz. */
  const monthKey = start.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const releasedFrom = addEtDays(today, -RELEASED_WINDOW_DAYS);
  const queryFrom = [monthStart, today, releasedFrom].sort()[0];
  const [result, holidayRows] = await load(queryFrom, addEtDays(today, LOOKAHEAD_DAYS));
  const monthPast = result.ok ? result.rows.filter((event) => event.eventDate < today) : [];
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
  /* FOMC SONUCU FED'İN BÜLTENİNDEN (28 Ekim) — ana sayfanın akışıyla aynı
     kaynak ve önbellek (`getFomcRelease`); gerekçe `lib/fomc-statement.ts`.
     Faiz kararı gerçekleşen aralığı, projeksiyonlar ve basın toplantısı
     durumu buradan alıyor; bülten yoksa satır eskisi gibi bekler. */
  const fomcToday = result.ok && result.rows.some((event) => event.eventDate === today && isFomcFamily(eventFamily(event.slug)) && passed(event))
    ? await withTimeout(getFomcRelease(today), FED_WAIT_MS).catch(() => null)
    : null;
  const fomcSettled = (event: EconomicEventRow) => {
    if (!fomcToday || event.eventDate !== today || !passed(event)) return null;
    const family = eventFamily(event.slug);
    if (family === "fomc-presser") return "held" as const;
    if (family === "fomc-sep" && fomcToday.projections) return "released" as const;
    return family === "fomc-rate" ? ("released" as const) : null;
  };
  const all = result.ok
    ? await Promise.all(
        result.rows.filter((event) => event.eventDate >= today).map(async (event) => {
          const decision = fomcToday?.decision;
          if (decision && event.eventDate === today && eventFamily(event.slug) === "fomc-rate" && !hasActual(event.actual) && passed(event)) {
            return { ...event, actual: fedRange(decision, locale), previous: event.previous ?? fedRange(previousRange(decision), locale) };
          }
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
  /* FOMC SATIRINDA PİYASA FİYATLAMASI (25 Ekim): /olasiliklar'ın aynı
     kaydından, yalnız takvimin toplantı günü kaynaktakiyle eşleşirse
     (`fedOddsFor`). Faiz kararı satırları birkaç tane; kayıt istek içinde
     önbellekli, sağlayıcıya gidilmez. */
  const fomcOdds = new Map(
    await Promise.all(
      [...new Set(listed.filter((event) => event.slug.startsWith(FOMC_RATE_PREFIX)).map((event) => event.eventDate))].map(
        async (date) => [date, await fedOddsFor(date).catch(() => null)] as const,
      ),
    ),
  );

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
  /* Bir tarihin gündemdeki yeri: ekrandaysa sayfa içi çapa (DayPicker
     yakalıyor), ay penceresindeyse ay görünümü, ötesindeyse bağlantı yok.
     Kapak kartı ve altı haftalık görünüm aynı kuralı kullanıyor. */
  const hrefFor = (date: string) =>
    renderedDays.has(date)
      ? `#gun-${date}`
      : daysBetweenEt(today, date) <= VIEW_SPAN.month
        ? `/takvim?g=month#gun-${date}`
        : null;
  const nextHref = next ? hrefFor(next.eventDate) : null;
  /* BU AYIN ÖNEMLİ VERİLERİ: yüksek etkililer; altıdan azsa ortalar da
     (sessiz bir ayda liste iki satıra düşmesin). Düşükler hiç girmiyor —
     kapak "önemli olan"ı söylüyor, tam liste aşağıda. */
  const monthEvents = [...monthPast, ...all].filter((event) => event.eventDate.startsWith(monthKey));
  const monthHigh = monthEvents.filter((event) => event.importance === "high");
  const monthPicked =
    monthHigh.length >= 6
      ? monthHigh
      : monthEvents.filter((event) => event.importance === "high" || event.importance === "medium");
  /* Vurgulanan satır kapak kartının olayı; kart bu ayın dışındaysa ayın
     ilk "sıradaki" satırı. */
  const nextIndex = (() => {
    const card = next ? monthPicked.findIndex((event) => event.id === next.id) : -1;
    return card >= 0 ? card : monthPicked.findIndex((event) => event.eventDate >= today && isAhead(event));
  })();
  /* Açılma sırası: sıradaki, ondan sonraki, son geçen, ileri kalanlar,
     sonra geçmiş (yeniden eskiye). Telefonda ilk beşi görünür; ayın
     başındaki geçmiş satırlar "sırada ne var"ı aşağı itmesin. */
  const pivot = nextIndex >= 0 ? nextIndex : monthPicked.length;
  const order = [
    pivot,
    pivot + 1,
    pivot - 1,
    ...monthPicked.map((_, index) => index).filter((index) => index > pivot + 1),
    ...monthPicked.map((_, index) => index).filter((index) => index < pivot - 1).reverse(),
  ].filter((index, position, list) => index >= 0 && index < monthPicked.length && list.indexOf(index) === position);
  const monthItems: MonthItem[] = monthPicked.map((event, index) => {
    const state: MonthItem["state"] = hasActual(event.actual) || fomcSettled(event)
      ? "released"
      : event.eventDate < today
        ? "passed"
        : passed(event)
          ? "awaiting"
          : "ahead";
    const href = event.eventDate >= start ? hrefFor(event.eventDate) : null;
    return {
      event,
      state,
      away: readerDayOffset(event.eventDate, event.eventTimeEt, locale, now),
      href,
      inPage: href?.startsWith("#") ?? false,
      next: index === nextIndex,
      rank: order.indexOf(index),
    };
  });
  const monthName = new Intl.DateTimeFormat(intlLocale, { month: "long", timeZone: "UTC" }).format(
    new Date(`${monthStart}T12:00:00Z`),
  );
  /* Son açıklananlar HAM satırlardan: bugünkü FRED tazelemesi (`all`) notun
     okuduğu veritabanı değerini değiştirmesin (lib/release-notes-core.ts). */
  const released = result.ok ? pickReleased(result.rows, { from: releasedFrom, today }) : [];
  const lookahead = result.ok
    ? buildLookahead({ events: all, holidays, from: start, until: addEtDays(today, LOOKAHEAD_DAYS) })
    : [];

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

  /* Sapma çizgisinin ortak ölçeği: aynı serinin ekrandaki satırları
     (gerekçe `lib/release-deviation.ts` → "ortak ölçek"). */
  const spans = deviationSpans(shownEvents);
  const v = t.calendarVisuals.released;

  const renderEvent = (event: EconomicEventRow) => {
    const times = event.eventTimeEt ? timePair(event.eventDate, event.eventTimeEt, locale) : null;
    const explainer = eventExplainer(event.slug, locale);
    const high = event.importance === "high";
    /* Sapma yalnız AÇIKLANMIŞ ve düz sayılı satırda (`releaseDeviation`:
       "3.75-4.00" gibi aralıkta ya da gerçekleşen yokken çizgi yok). */
    const deviation = hasValues
      ? releaseDeviation(event.actual, event.forecast, event.previous, { span: spans.get(seriesKey(event.slug)) })
      : null;
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

        {/* Başlık + açıklama. Açıklama olayın TÜRÜNE bağlı (bkz.
            `lib/event-explainers.ts`); tanınmayan türde satır tek satır kalır. */}
        <span className={styles.body}>
          {/* ÖNEM ADIN YANINDA, SÖZLE (6 Kasım). Ayrı 20 piksellik bir
              sütunda üç nokta duruyordu ("Noktalar başlığın ilk satırıyla
              hizalı" kararı): yüksek önemde üç koyu nokta siyah bir leke
              gibi okunuyor, düzey ancak sayılarak çıkıyordu ve sütun her
              satırdan 34 piksel (20 + aralık) yiyordu. Şimdi adın hemen
              ardında bir hap: yükselen çubuklar + "Yüksek/Orta/Düşük".
              Hap adın ilk satırının taban çizgisinde (`baseline`); ad iki
              satıra kırılırsa hap da akışla iner, asılı kalmaz. */}
          <span className={styles.titleRow}>
            <span className={styles.title} data-high={high || undefined}>
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
            <ImpactTag importance={event.importance} label={impactLabel[event.importance] ?? event.importance} />
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
            <span className={styles.status} data-published={hasActual(event.actual) || !!fomcSettled(event) || undefined}>
              {hasActual(event.actual)
                ? t.calendar.released
                : fomcSettled(event)
                  ? fomcSettled(event) === "held" ? t.dayFlow.held : t.calendar.released
                  : passed(event)
                  ? t.dayFlow.awaiting
                  : t.calendar.scheduled}
            </span>
            {event.slug.startsWith(FOMC_RATE_PREFIX) && (
              <FedOddsTag odds={fomcOdds.get(event.eventDate)} locale={locale} t={t} />
            )}
            {high && (
              <a
                href={`/api/takvim?tip=olay&slug=${event.slug}`}
                /* `download` ŞART — gerekçe components/earnings/AddToCalendar.tsx
                   künyesinde: bu uç dosya indiriyor, gezinme olmuyor ve
                   `RouteProgress` şeridi kendiliğinden durmuyordu. */
                download
                rel="nofollow"
                className={cn(styles.addCal, "tap-44")}
              >
                <CalendarPlus weight="duotone" size={14} aria-hidden />
                {t.earnings.addToCalendar}
              </a>
            )}
          </span>
        </span>

        {/* AYNI SATIRIN ÜÇ SAYISI BİR DE ÇİZGİ (18 Ekim; 6 Kasım'da sapma
            çizgisine geçti). İlk sürüm her sayının altına sıfırdan başlayan
            kendi çubuğunu koyuyordu (`ScaleBar`, CompareScale): "165 bin /
            55 bin / 60 bin" üç ayrı minik çubuktu ve satırın asıl sorusu —
            gerçekleşen beklentiye göre NEREDE, ne kadar — çizimden
            okunmuyordu (sahibinin ekran görüntüsü). Şimdi "Son Açıklanan
            Veriler" kartının çizgisi (`DeviationLine`, ortak bileşen):
            ortası beklenti, nokta gerçekleşen, gri çentik önceki; altında
            yönü ve farkı birimiyle söyleyen künye ("▲ Beklentinin 110 Bin
            Üstünde"). Renk yalnız YÖN, yargı değil (yüksek işsizlik
            başvurusu da "üstünde"dir) — yön ayrıca glif ve sözle yazılı.
            Aynı serinin satırları ortak ölçekte (`deviationSpans`), iki
            haftanın işsizlik başvurusu yan yana kıyaslanabilir. Çizgi
            yalnız açıklanmış, düz sayılı satırda; "250K" gibi ekli metinde
            ya da açıklanmamış satırda yalnız sayılar. */}
        {hasValues && (
          <span className={styles.values} data-line={deviation ? "true" : undefined}>
            <span className={styles.valueSlots}>
              <ValueSlot kind="actual" label={t.calendar.actual} value={event.actual} unit={event.unit} locale={locale} mark={legendMark("actual", deviation)} direction={deviation?.direction} />
              <ValueSlot kind="forecast" label={t.calendar.forecast} value={event.forecast} unit={event.unit} locale={locale} mark={legendMark("forecast", deviation)} />
              <ValueSlot kind="previous" label={t.calendar.previous} value={event.previous} unit={event.unit} locale={locale} mark={legendMark("previous", deviation)} />
            </span>
            {deviation && (
              <>
                <DeviationLine
                  deviation={deviation}
                  below={v.sideBelow}
                  above={v.sideAbove}
                  baseLabel={deviation.base === "forecast" ? t.calendar.forecast : t.calendar.previous}
                  className={styles.valueLine}
                />
                <span className={styles.verdict} data-dir={deviation.direction}>
                  {deviation.direction !== "inline" && (
                    <span aria-hidden className={styles.verdictGlyph}>
                      {deviation.direction === "above" ? "▲" : "▼"}
                    </span>
                  )}
                  {deviationVerdict(deviation, event.unit, locale, v, "base")}
                </span>
              </>
            )}
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
      {/* KÖŞE MOTİFİ (`HeroAccent`) YOK (6 Kasım). Kapağın sağ üstünde iki
          yay sıradaki açıklama kartının köşesinden geçiyordu (sahibinin
          ekran görüntüsü: "yarım daire süs çizgileri"). Motifin kendi
          kuralı zaten bu: sağ sütunda veri taşıyan başlık onu basmaz
          (gerekçe components/motion/HeroAccent.tsx); görsel dil de süsü
          değil veriyi çiziyor. */}
      <header className={`${styles.hero} page-frame`}>
        {/* KAPAĞIN SOLU: başlık + bu ayın önemli verileri (18 Ekim; gerekçe
            MonthReleases.tsx). Liste kutusu sağdaki kart varken kartın
            boyuna geriliyor ve iki kolon aynı hatta bitiyor. */}
        <div className={styles.heroMain}>
          <div className="page-heading-copy">
            <div className="page-title-row">
              <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
                {t.calendar.title}
              </h1>
              <div className={cn("page-title-actions", styles.shareTitle)}>{share("/takvim", t.calendar.title)}</div>
            </div>
            <p>{t.calendar.subtitle}</p>
          </div>
          {monthItems.length > 0 && (
            <MonthReleases
              items={monthItems}
              monthName={monthName}
              highCount={monthHigh.length}
              constrained={next !== undefined}
              locale={locale}
              t={t}
            />
          )}
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
          <div className={styles.heroControls}>
            {viewSwitch(styles.heroSeg)}
            <span className={styles.shareSide}>{share("/takvim", t.calendar.title)}</span>
          </div>
          {next && (
            <NextRelease
              event={next}
              label={nextHigh ? t.calendar.nextHigh : t.calendar.nextRelease}
              away={readerDayOffset(next.eventDate, next.eventTimeEt, locale, now)}
              href={nextHref}
              inPage={nextHref?.startsWith("#") ?? false}
              nowMs={now.getTime()}
              locale={locale}
              t={t}
            />
          )}
        </div>
      </header>

      {tabs}

      {/* PANO: takvim tam genişlik; halka arz altında (29 Eylül). */}
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
                {/* 10 Kasım 2026: süzgeçsiz BOŞ aralıkta da çizilmiyor. Şerit
                    artık verinin şeklinde (CalendarStrip, modül CSS'i):
                    olaysız hafta yedi dar sırttan ibaret kalırdı; sessiz
                    satır ve sıradaki gün aynı şeyi söylüyor. */}
                {view !== "day" && listed.length > 0 && (
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
                {/* LEJANT KENDİNİ ANLATIYOR (18 Ekim). Önem çipleri yalnızca
                    "Yüksek / Orta / Düşük" diyordu; neyin yüksek olduğunu,
                    kulvardaki rengin ne demek olduğunu okuyucu tahmin
                    ediyordu. Künye panelin içinde, hairline altında düz
                    paragraf (ekran düzeni 6): üç renkli şerit + tek cümle,
                    ardından saat notu. */}
                <div className={styles.foot}>
                  <p className={styles.legend}>
                    {IMPACTS.map((level) => (
                      <span key={level} className={styles.legendItem}>
                        <span className={styles.legendSwatch} data-impact={level} aria-hidden />
                        {impactLabel[level]}
                      </span>
                    ))}
                  </p>
                  <p>{t.calendar.impactNote}</p>
                  <p>{t.calendar.timesNote}</p>
                  {/* TAKVİM ABONELİĞİ KÜNYEDE (14 Kasım 2026). "Takvime
                      Ekle" yalnız yüksek etkili satırlarda ve tek olay
                      indiriyor; abonelik bütün takvimi okurun Google/Apple
                      Takvim'ine taşır. Yeri panelin künyesi (ekran düzeni
                      6): listeyi okuyan kişinin son satırda bulduğu küçük
                      bir eylem, kapağa ya da başlığa üçüncü bir denetim
                      değil. Bağlantı ekrandaki önem süzgecini taşır
                      ("Yüksek" seçiliyken yalnız yüksek etkililer); ipucu
                      cümlesi bunu söyler. Yalnız okuma başarılıyken
                      basılıyor: veritabanı düşükken akış da 503 verir. */}
                  <CalendarSubscribe
                    {...feedUrls({ kind: "makro", locale, impact })}
                    labels={{ subscribe: t.calendarFeed.subscribe, copy: t.calendarFeed.copy, copied: t.calendarFeed.copied }}
                    hint={
                      impact
                        ? t.calendarFeed.macroHintFiltered.replace("{impact}", impactLabel[impact])
                        : t.calendarFeed.macroHint
                    }
                    className="pt-2"
                  />
                </div>
              </>
            )}
          </Panel>
        </QueryTransition>

        {/* AYIN ÖNEMLİ VERİLERİ TELEFONDA BURADA (25 Ekim). Kapakta kartın
            altındaydı ve sekme ile önem süzgecini ilk ekranın dışına
            itiyordu (390: sekme 839, süzgeç 972). Takvimin hemen ardında,
            kendi panelinde; 768 ve üstünde gizli, orada kapaktaki kopya
            görünür (gerekçe MonthReleases.tsx). Geçiş maskesinin DIŞINDA:
            görünüm değişince içeriği değişmiyor. */}
        {monthItems.length > 0 && (
          <MonthReleases
            items={monthItems}
            monthName={monthName}
            highCount={monthHigh.length}
            constrained={false}
            placement="board"
            locale={locale}
            t={t}
          />
        )}

        {/* ALTI HAFTA, GÖRÜNÜMDEN BAĞIMSIZ. Geçiş maskesinin DIŞINDA:
            Gün/Hafta/Ay değişirken içeriği değişmiyor, örtülmesi yanlış
            bir "yükleniyor" olurdu. Takvimin altında, sayfanın ikinci
            görseli olarak (ekran düzeni 3). */}
        <WeekLookahead weeks={lookahead} hrefFor={hrefFor} locale={locale} t={t} />

        {/* SON AÇIKLANANLAR İLERİYE BAKIŞIN ALTINDA (18 Ekim). Sayfa "ne
            olacak"ı anlatıyor; "ne oldu" onun devamı, kapağı itmesin. Yoksa
            panel hiç basılmaz (ReleasedData). Geçiş maskesinin DIŞINDA:
            görünüm değişince içeriği değişmiyor. */}
        <ReleasedData events={released} notes={insightsConfigured()} locale={locale} t={t} />
      </div>

      {/* HALKA ARZ TAKVİMİN ALTINDA, TAM GENİŞLİK (29 Eylül). Yan kolondu ve
          küçük bir liste için ekranı ikiye bölüyordu (gerekçe
          components/markets/IpoCalendar.tsx). Geçiş maskesinin DIŞINDA:
          görünüm değişirken örtülmüyor. */}
      <IpoCalendar locale={locale} t={t} />

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
