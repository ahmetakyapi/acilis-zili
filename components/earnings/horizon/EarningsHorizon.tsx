import { Panel, PanelHeader } from "@/components/ui/primitives";
import { analysisHref } from "@/lib/analysis";
import type { AnalysisBadge } from "@/lib/data";
import { earningsHref } from "@/lib/earnings-company";
import { capCell, horizonLead, laneSlots, peakCell, peakDay, tileScale, tileTierOf } from "@/lib/earnings-horizon";
import { loadHorizonKarne } from "@/lib/earnings-horizon-data";
import { dayLabel, epsSurprise, laneOf, WEEK_MAX_NAMES, weekRangeLabel, type ScheduleRow, type WeekLane } from "@/lib/earnings-week";
import type { EarningsWeek } from "@/lib/earnings-week-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { zoneTag } from "@/lib/session-clock";
import { etDateParts, formatMoneyCompact, formatPrice } from "@/lib/utils";
import { HorizonGrid, type HorizonDay, type HorizonLane, type HorizonTile } from "./HorizonGrid";
import styles from "./EarningsHorizon.module.css";

/**
 * HAFTANIN BİLANÇO UFKU — Bilançolar'ın zirvesi (25 Ekim).
 *
 * NEDEN: takvim sekmesi bir kart duvarıydı. Gün başına 927 piksel (1440,
 * ölçüldü), her kartta üç yalın sayı ve oy düğmeleri; "bu hafta neyi
 * izlemeliyim" sorusunun cevabı kartlar tek tek okunarak çıkıyordu. Kapakta
 * duran yoğunluk grafiği (kaç bilanço) ve "Öne Çıkanlar" (en büyük üç
 * şirket) cevabın iki yarısını iki ayrı panelde veriyordu.
 *
 * Ufuk ikisini tek görselde birleştiriyor: sütunlar gün, satırlar pencere
 * (açılış öncesi / kapanış sonrası), her hücrede o pencerede açıklayan
 * kayda değer şirketler (`getEarningsWeek` → haftalık sekmenin seçimi,
 * aynı kaynak). Kartlar büyükten küçüğe, büyük şirket çerçeveli
 * (`tileTierOf`; kart turunda boy tekleşti), altındaki dört parçalı şerit
 * (31 Ekim'e dek dört kare) son dört çeyreğin beklenti karnesi (hisse sayfasındaki "3/4
 * Çeyrekte Aşıldı" dili, aynı kaynak — `loadHorizonKarne`). Gün başlığında
 * günün TÜM açıklayanlarının sayısı ve yoğunluk çizgisi: kapaktaki eski
 * grafiğin bilgisi burada. Tepede veriden tek cümle (`horizonLead`).
 *
 * Ayrıntı karonun üstüne gelince ya da dokununca alttaki okuma satırında:
 * gelir ve EPS beklentisi, piyasa değeri, karne cümlesi, bilanço sayfası
 * bağlantısı. Karo bir düğme (klavyede odakla seçiliyor); ayrıntıyı balon
 * yerine satıra koymak telefonda ekran dışına taşan balonu ortadan
 * kaldırıyor. Kart listesi ve oylama ızgaranın altında, değişmeden.
 *
 * Hafta HAFTALIK SEKMENİN haftası (`currentWeekStart`): iş günü içinde bu
 * hafta, hafta sonu gelecek hafta. Takvimin "Hafta/Ay" anahtarı listeyi
 * yönetiyor; ufuk her zaman bir iş haftası.
 */
export function EarningsHorizon({
  week,
  today,
  watchSet,
  badges,
  listedDays,
  locale,
  t,
}: {
  week: EarningsWeek;
  /** ET takvim günü. */
  today: string;
  /** Aynı sayfadaki listenin kapsadığı günler: "+N" çipi o günün
      bölümüne (`#earnings-day-…`) iner; listede olmayan gün (haftanın
      geçmiş günleri) Haftalık sekmenin gün gün takvimine gider. */
  listedDays?: ReadonlySet<string>;
  watchSet: ReadonlySet<string>;
  /** `SEMBOL:TARİH` → yayımlanmış analiz. */
  badges: Record<string, AnalysisBadge>;
  locale: Locale;
  t: Dictionary;
}) {
  if (week.failed || week.picked === 0) return null;
  const h = t.calendarVisuals.horizon;
  const w = t.earningsExtra.week;
  const laneTitle: Record<WeekLane, string> = { bmo: w.beforeOpen, amc: w.afterClose, other: w.otherTime };

  const picked: ScheduleRow[] = week.days.flatMap((day) => [...day.bmo, ...day.amc, ...day.other]);
  const weekMax = Math.max(0, ...picked.map((row) => row.marketCap ?? 0));
  const totals = new Map(week.schedule.map((day) => [day.date, day.total]));
  const peakTotal = Math.max(1, ...week.schedule.map((day) => day.total));

  const tile = (row: ScheduleRow): HorizonTile => {
    const lane = laneOf(row.hour);
    const label = dayLabel(row.reportDate, locale);
    const currency = row.currency || true;
    const surprise = epsSurprise(row.epsActual, row.epsEstimate);
    const badge = badges[`${row.symbol}:${row.reportDate}`];
    return {
      symbol: row.symbol,
      name: row.name ?? row.symbol,
      logoUrl: row.logoUrl,
      scale: tileScale(row.marketCap, weekMax),
      tier: tileTierOf(tileScale(row.marketCap, weekMax)),
      capText: row.marketCap !== null ? formatMoneyCompact(row.marketCap, locale) : null,
      revenueText: row.revenueEstimate !== null ? formatMoneyCompact(row.revenueEstimate, locale, row.currency) : null,
      epsText: row.epsEstimate !== null ? formatPrice(row.epsEstimate, locale, { currency }) : null,
      /* Açıklanmışsa gerçekleşen EPS ve yönü (beklentiye göre). */
      epsActualText: row.epsActual !== null ? formatPrice(row.epsActual, locale, { currency }) : null,
      surprise: surprise?.direction ?? null,
      whenText: `${label.weekday} ${label.day}`,
      lane,
      laneText: laneTitle[lane],
      watched: watchSet.has(row.symbol),
      href: earningsHref(row.symbol),
      analysisHref: badge ? analysisHref(badge.symbol, badge.period) : null,
      label: h.tileLabel
        .replace("{symbol}", row.symbol)
        .replace("{name}", row.name ?? row.symbol)
        .replace("{day}", label.weekday)
        .replace("{window}", laneTitle[lane]),
    };
  };

  /* Hücre en çok sekiz yuva, saati belirsiz satırı iki (`laneSlots`):
     sığmayan küçükler "+N" çipinde. */
  const cut = (rows: ScheduleRow[], lane: WeekLane) => capCell(rows, laneSlots(lane));
  const cap = (rows: ScheduleRow[], lane: WeekLane) => cut(rows, lane).shown.map(tile);
  const peakDate = peakDay(week.schedule);
  const days: HorizonDay[] = week.days.map((day) => {
    const label = dayLabel(day.date, locale);
    const parts = etDateParts(day.date, locale);
    const total = totals.get(day.date) ?? 0;
    return {
      date: day.date,
      weekday: label.weekday,
      short: label.short,
      count: total,
      dayNumber: parts.day,
      month: parts.month,
      state: day.date === today ? "today" : day.date < today ? "past" : "ahead",
      closed: day.closed !== null,
      countText: h.countCompanies.replace("{count}", String(total)),
      density: total / peakTotal,
      peak: day.date === peakDate && day.closed === null,
      lanes: { bmo: cap(day.bmo, "bmo"), amc: cap(day.amc, "amc"), other: cap(day.other, "other") },
      more: { bmo: cut(day.bmo, "bmo").more, amc: cut(day.amc, "amc").more, other: cut(day.other, "other").more },
      moreHref: listedDays?.has(day.date) ? `#earnings-day-${day.date}` : `/bilancolar/hafta#week-schedule-${day.date}`,
      moreLabel: h.moreLabel.replace("{day}", label.weekday),
    };
  });

  /* Şerit adları ve saatleri ilk açık günden: ABD saat değişimi pazar günü,
     bir iş haftasının saatleri beş günde aynı (WeekBoard'un kuralı). */
  const open = week.days.find((day) => !day.closed) ?? week.days[0];
  const tags = zoneTag(locale);
  const lanes: HorizonLane[] = (["bmo", "amc", "other"] as const)
    .filter((key) => key !== "other" || week.days.some((day) => day.other.length > 0))
    .map((key) => {
      const clock = key === "bmo" ? open.bmoClock : key === "amc" ? open.amcClock : null;
      return {
        key,
        title: laneTitle[key],
        tone: key === "bmo" ? "pre" : key === "amc" ? "post" : "neutral",
        clock: clock ? `~${clock.primary}` : null,
        clockAlt: clock ? `~${clock.secondary} ${tags.secondary}` : null,
      };
    });

  const peak = peakCell(picked);
  const listFormat = new Intl.ListFormat(locale === "tr" ? "tr-TR" : "en-US", { type: "conjunction" });
  const numberFormat = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US");
  const lead = horizonLead({
    count: week.total,
    upcoming: today < week.monday,
    peak,
    weekday: peak ? dayLabel(peak.date, locale).weekday : null,
    words: h,
    listFormat: (items) => listFormat.format(items),
    formatCount: (value) => numberFormat.format(value),
  });
  /* AÇILIŞTA BUGÜN (27 Ekim, sahibinin isteği: "ilk açılırken o gün
     hangileri varsa o gözüksün"). Açık gün haftanın zirvesiydi: salı
     sabahı telefon çarşambayı açıyor, bugün açıklayanlar bir dokunuş
     uzaktaydı. Sıra: bugün (piyasa açık ve kayda değer şirket varsa) →
     önümüzdeki ilk dolu gün (hafta sonu bakılan gelecek hafta pazartesiye
     açılır) → zirve. Seçili karo o günün en büyüğü; geniş ekranda da aynı
     karo seçili ki okuma şeridi bugünü anlatsın. */
  const filled = (day: (typeof week.days)[number]) => day.closed === null && day.bmo.length + day.amc.length + day.other.length > 0;
  const openDay =
    week.days.find((day) => day.date === today && filled(day)) ??
    week.days.find((day) => day.date >= today && filled(day)) ??
    (peak ? week.days.find((day) => day.date === peak.date) : undefined) ??
    week.days.find(filled) ??
    null;
  const openTiles = days.find((day) => day.date === openDay?.date)?.lanes;
  const initial =
    (openTiles ? [...openTiles.bmo, ...openTiles.amc, ...openTiles.other].sort((a, b) => b.scale - a.scale)[0]?.symbol : undefined) ??
    peak?.symbols[0] ??
    picked[0]?.symbol ??
    null;
  /* Karne yalnız ÇİZİLEN karolar için: "+N"e düşenler okuma satırına
     gelemiyor ve sağlayıcı kotası (Finnhub) boşa harcanmasın. */
  const karne = loadHorizonKarne(days.flatMap((day) => [...day.lanes.bmo, ...day.lanes.amc, ...day.lanes.other].map((tile) => tile.symbol)));

  return (
    <Panel className={styles.panel} data-motion-reveal>
      <PanelHeader title={h.title} meta={<span className={styles.meta}>{weekRangeLabel(week.monday, locale)}</span>} />
      <p className={styles.lead}>{lead}</p>
      <HorizonGrid
        days={days}
        lanes={lanes}
        karne={karne}
        initial={initial}
        initialDay={openDay?.date ?? null}
        labels={{
          revenueEstimate: t.earnings.revenueEstimate,
          epsEstimate: t.earnings.epsEstimate,
          marketCap: h.marketCap,
          reported: t.earnings.epsActual,
          beatRecord: t.earnings.beatRecord,
          beatRecordLine: t.earnings.beatRecordLine,
          peak: h.peak,
          peakLabel: h.peakLabel,
          beatRecordAll: t.earnings.beatRecordAll,
          beatRecordNone: t.earnings.beatRecordNone,
          beatCount: t.earnings.epsBeatCount,
          noKarne: h.noKarne,
          karneLoading: h.karneLoading,
          companyPage: h.companyPage,
          analysis: h.analysis,
          marketClosed: h.marketClosed,
          emptyLane: h.emptyLane,
          today: t.calendar.today,
          hint: h.readoutHint,
          pickDay: h.pickDay,
          more: h.more,
        }}
      />
      {/* KÜNYE TEK SATIR + KATLI AYRINTI (25 Ekim, kart turu). Burada iki
          uzun paragraf vardı (büyük karo kuralı, seçim kuralı): 1440'ta 77,
          390'da 171 piksel ve ızgaranın asıl lejantı (kareler) cümlenin
          ortasında kalıyordu. Şimdi kare lejantı görsel olarak tek satırda;
          iki paragraf "Nasıl Okunur" katlamasında (`<details>`, JS'siz;
          açılınca `ExpandInPlace` bastığın yerde uzatıyor). */}
      <div className={styles.foot}>
        <p className={styles.legend}>
          <span className={styles.legendItem}>
            <i aria-hidden className={styles.square} data-mark="beat" />
            {h.legendBeat}
          </span>
          <span className={styles.legendItem}>
            <i aria-hidden className={styles.square} data-mark="miss" />
            {h.legendMiss}
          </span>
          <span className={styles.legendItem}>
            <i aria-hidden className={styles.square} data-mark="none" />
            {h.legendNone}
          </span>
          <span className={styles.legendNote}>{h.legendNote}</span>
        </p>
        <details className={styles.how}>
          <summary>{h.howTitle}</summary>
          <p>{h.caption}</p>
          <p>{w.noteSelection.replace("{max}", String(WEEK_MAX_NAMES))}</p>
        </details>
      </div>
    </Panel>
  );
}
