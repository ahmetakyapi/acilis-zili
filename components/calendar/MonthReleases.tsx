import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { MonthFill } from "@/components/calendar/MonthFill";
import { ImpactDots } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { timePair, zoneTag } from "@/lib/session-clock";
import { cn, formatEventValue, relativeDayLabel } from "@/lib/utils";
import type { EconomicEventRow } from "@/lib/schema";

export type MonthState = "released" | "awaiting" | "passed" | "ahead";

export type MonthItem = {
  event: EconomicEventRow;
  state: MonthState;
  /** Okuyucunun gününe göre uzaklık (saatli `readerDayOffset`). */
  away: number;
  /** Gündemdeki yeri; geçmiş günde ya da pencere dışında null. */
  href: string | null;
  inPage: boolean;
  /** Kapak kartındaki olay — satır o kartın ikizi olarak vurgulanır. */
  next: boolean;
  /** `MonthFill` açılma sırası; küçük olan önce. */
  rank: number;
};

/** Telefonda (ve JavaScript kapalıyken) açık satır sayısı. */
export const MONTH_BASE_ROWS = 5;

/**
 * Kapağın sol kolonu: bu ayın önemli veri açıklamaları (18 Ekim).
 *
 * NEDEN (sahibinin itirazı: "header'ın sol tarafı çok boş"). Sol kolon
 * başlık + tek satır açıklamaydı; sağdaki sıradaki açıklama kartı kapağı
 * ~330 piksele çıkarıyor ve 1440'ta başlığın altında ~200 piksellik boş
 * alan kalıyordu. Kart "SIRADAKİ"ni söylüyor; bu liste aynı soruya AYIN
 * ölçeğinde cevap veriyor: ayın yüksek etkili açıklamaları (azsa ortalar
 * da), geçenleri soluk ve — varsa — değeriyle, gelenleri "X Gün Sonra"
 * ile. Sıradaki satır kartın ikizi: aynı `--primary-tint` tonu.
 *
 * İKİ KOLON AYNI HATTA BİTER. Kutu `contain: size` ile kapağın satır
 * boyuna hiç katkı vermiyor ve sağ kolonun boyuna geriliyor; kutunun dibi
 * kartın dibi (ölçüm CSS `.keyBox` yorumunda). Satırlar kutunun içine
 * SIĞDIĞI KADAR açılıyor (`MonthFill`), boşluk esnetilmiyor; kalan ölü
 * alan bir satırdan kısa ve "+N Veri Daha" künyesinin üstünde duruyor.
 *
 * VERİ DÜRÜSTLÜĞÜ. Geçmiş satırda değer ancak veri tabanında `actual`
 * varsa yazılır; yoksa "Geçti" (yayın iddiası değil — `actual` çoğu olayda
 * geri doldurulmuyor, bkz. sayfadaki "saati geçmiş satır" notu). Geçmiş
 * günler için sağlayıcıya ayrıca sorulmuyor: ayın bütün geçmiş satırlarını
 * FRED'e yelpazelemek kapağı her istekte on ayrı okumaya bağlardı.
 * Saatsiz olayda saat uydurulmaz: "Saat Belirsiz".
 */
export function MonthReleases({
  items,
  monthName,
  highCount,
  constrained,
  placement = "hero",
  locale,
  t,
}: {
  items: MonthItem[];
  monthName: string;
  highCount: number;
  /** Sağda kart var mı — yoksa kutu gerilmez, içeriği kadar uzar. */
  constrained: boolean;
  /** `hero`: kapağın sol kolonu (768 ve üstü). `board`: telefonda takvim
   *  panelinin altındaki kendi paneli. Gerekçe aşağıda. */
  placement?: "hero" | "board";
  locale: Locale;
  t: Dictionary;
}) {
  const tags = zoneTag(locale);
  const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const c = t.calendarMonth;
  const hiddenAtBase = items.filter((item) => item.rank >= MONTH_BASE_ROWS).length;

  const row = (item: MonthItem, index: number) => {
    const { event } = item;
    const times = event.eventTimeEt ? timePair(event.eventDate, event.eventTimeEt, locale) : null;
    const title = locale === "tr" ? event.titleTr : event.titleEn;
    const value =
      item.state === "released" && event.actual !== null
        ? (formatEventValue(event.actual, event.unit, locale) ?? event.actual.trim())
        : null;
    const impact =
      event.importance === "high" ? t.calendar.impactHigh : t.calendar.impactMedium;
    const body = (
      <>
        <span className={styles.keyDate}>
          <strong className="numeral">{Number(event.eventDate.slice(8, 10))}</strong>
          <span>{weekday.format(new Date(`${event.eventDate}T12:00:00Z`)).replace(/\.$/, "")}</span>
        </span>
        <span className={styles.keyBody}>
          <span className={styles.keyTitle}>{title}</span>
          <span className={styles.keyMeta}>
            <ImpactDots importance={event.importance} label={impact} />
            {times ? (
              <span className="numeral">
                {times.primary}
                <span aria-hidden> · </span>
                {times.secondary} {tags.secondary}
              </span>
            ) : (
              <span>{t.earnings.timeUnknown}</span>
            )}
          </span>
        </span>
        <span className={styles.keyStatus} data-state={item.state}>
          {value !== null ? (
            <>
              <span className="sr-only">{t.calendar.actual} </span>
              <strong className="numeral">{value}</strong>
            </>
          ) : item.state === "awaiting" ? (
            t.dayFlow.awaiting
          ) : item.state === "passed" ? (
            c.passed
          ) : (
            relativeDayLabel(item.away, t.calendar)
          )}
        </span>
      </>
    );
    return (
      <li
        key={event.id}
        className={styles.keyRow}
        data-state={item.state}
        data-next={item.next || undefined}
        data-base={item.rank < MONTH_BASE_ROWS || undefined}
        data-rank={item.rank}
        hidden={item.rank >= MONTH_BASE_ROWS}
        /* Kademe görünen sıradan: önündeki TABAN satır sayısı. DOM sırası
           kullanılınca ayın başındaki gizli geçmiş satırlar ilk görünen
           satırı 385 ms'ye itiyordu (ölçüldü, `getAnimations()`). */
        style={{ "--i": items.slice(0, index).filter((other) => other.rank < MONTH_BASE_ROWS).length } as CSSProperties}
      >
        {item.href === null ? (
          <span className={styles.keyLine}>{body}</span>
        ) : item.inPage ? (
          <a className={styles.keyLine} href={item.href}>
            {body}
          </a>
        ) : (
          <Link className={styles.keyLine} href={item.href}>
            {body}
          </Link>
        )}
      </li>
    );
  };

  /* TELEFONDA KAPAKTAN ÇIKTI (25 Ekim). 767 ve altında kapak tek kolon ve
     bu liste sıradaki açıklama kartının altına iniyordu: kapak 736 piksel,
     Ekonomik/Temettü sekmesi y=839, önem süzgeci 972 — ikisi de ilk
     ekranın dışında. Telefonda liste artık takvim panelinin ALTINDA kendi
     panelinde; geniş ekranda kapağın sol kolonunda kalıyor (sahibinin
     "header'ın sol tarafı çok boş" itirazının cevabı, yukarıda).
     İki kopya, biri her genişlikte `display: none` — bu sayfanın görünüm
     seçimi ve paylaş düğmesiyle aynı yöntem; erişilebilirlik ağacında tek
     liste, `id`ler ayrı. Ölçüm sayfadaki kapak yorumunda. */
  const headingId = placement === "hero" ? "takvim-ay-baslik" : "takvim-ay-baslik-pano";
  return (
    <section
      className={cn(styles.keyBox, placement === "hero" ? styles.keyBoxHero : styles.keyBoxBoard)}
      data-month
      data-constrained={constrained ? "true" : undefined}
      aria-labelledby={headingId}
    >
      <div className={styles.keyHead}>
        {/* Panel başlığının kalıbı (`PanelHeader`): 16 piksel, sıkı degrade. */}
        <h2 id={headingId} className="display-ink display-ink-tight w-fit text-lead font-bold tracking-[-0.015em]">
          {c.title}
        </h2>
        <span className={styles.keyTag}>
          {monthName}
          {highCount > 0 && (
            <>
              <span aria-hidden> · </span>
              <span className="numeral">{highCount}</span> {t.calendar.highImpactShort}
            </>
          )}
        </span>
        {/* "+N" VE AY GÖRÜNÜMÜ BAŞLIK SATIRINDA. Alt künye satırıydı ve
            1440'ta 164 piksellik kutunun 27'sini yiyordu — bir satırlık yer
            (ölçüm `.keyBox` yorumunda). "+N" geniş ekranda ölçüye göre açılıp
            kapanıyor; satır başlıkta olduğu için listenin kutusu değişmiyor. */}
        <span className={styles.keyMore}>
          <span data-month-more hidden={hiddenAtBase === 0}>
            +<span data-month-count className="numeral">{hiddenAtBase}</span> {c.more}
          </span>
          <Link href="/takvim?g=month" scroll={false} className={cn(styles.keyLink, "tap-44")}>
            {c.monthView}
          </Link>
        </span>
      </div>
      <ul className={styles.keyList} data-month-list aria-label={c.listLabel}>
        {items.map(row)}
      </ul>
      {/* Ölçücü tek: sayfadaki bütün listeleri o geziyor. */}
      {placement === "hero" && <MonthFill />}
    </section>
  );
}
