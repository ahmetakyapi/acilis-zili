import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { ReleaseCountdown } from "@/components/calendar/ReleaseCountdown";
import { eventExplainer } from "@/lib/event-explainers";
import type { Dictionary, Locale } from "@/lib/i18n";
import { etDateTimeToUtc } from "@/lib/market-hours";
import { timePair, zoneTag } from "@/lib/session-clock";
import { etDateParts, formatEventValue, relativeDayLabel } from "@/lib/utils";
import type { EconomicEventRow } from "@/lib/schema";

/**
 * Kapağın sağındaki "sıradaki açıklama" kartı.
 *
 * KAPSAM GÖRÜNÜMDEN BAĞIMSIZ. Eski kart, EKRANDAKİ aralığın ilk yüksek
 * etkili olayıydı: haftada yüksek etkili açıklama yoksa kart yok oluyor ve
 * kapağın sağ yarısı boş kalıyordu (ölçüldü: 1440'ta 554 piksellik kolonda
 * 46 piksel denetim, altı boş). Kart artık altı haftalık tek sorgudan
 * seçiliyor; görünüm ve önem süzgeci onu değiştirmiyor.
 *
 * KART BİR ÖZET, BİR ETİKET DEĞİL (18 Ekim, sahibinin itirazı: "çok zayıf
 * duruyor"). Önceki kart tarih + başlık + saatten ibaretti ve sessiz bir
 * haftada sayfanın tek dolu yeriydi; okuyucuya "ne zaman"ı söylüyor, "ne"
 * ve "neden"i söylemiyordu. Şimdi dört kat:
 *   1. künye satırı: kartın adı + göreli gün rozeti,
 *   2. tarih karosu + başlık + gün · TR · NY saati,
 *   3. olayın TÜRÜNE bağlı tek cümle (`lib/event-explainers.ts`; tanınmayan
 *      türde satır yok),
 *   4. hairline altında geri sayım ve — varsa — Beklenti / Önceki.
 * Geri sayım yalnız SAATİ BİLİNEN olayda: dakika bilinmiyorsa "Saat
 * Belirsiz" yazar (veri dürüstlüğü 1). Değer yuvaları boşsa hiç basılmaz;
 * tohumlanan takvimde beklenti çoğu zaman yok ve iki boş yuva kartı
 * eksikmiş gibi gösterirdi.
 *
 * `href` null ise kart bağlantı değil: tarih ay görünümünün de ötesinde
 * (30 günden uzak) ve gidilecek bir satır yok.
 */
export function NextRelease({
  event,
  label,
  away,
  href,
  inPage,
  nowMs,
  locale,
  t,
}: {
  event: EconomicEventRow;
  /** "Sıradaki Yüksek Etkili Açıklama" ya da yedek "Sıradaki Açıklama". */
  label: string;
  /** Okuyucunun gününe göre uzaklık (`readerDayOffset`, saatli): ana
      sayfanın zil künyesiyle aynı tanım. */
  away: number;
  href: string | null;
  /** Hedef satır bu sayfada mı — değilse görünüm değiştiren bağlantı. */
  inPage: boolean;
  /** Sayfanın tek `now`u — geri sayımın ilk karesi sunucuyla aynı. */
  nowMs: number;
  locale: Locale;
  t: Dictionary;
}) {
  const { day, month } = etDateParts(event.eventDate, locale);
  const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${event.eventDate}T12:00:00Z`));
  const tags = zoneTag(locale);
  /* Saatsiz olayda saat UYDURULMAZ; yalnızca gün yazılır. */
  const times = event.eventTimeEt
    ? timePair(event.eventDate, event.eventTimeEt, locale)
    : null;
  const title = locale === "tr" ? event.titleTr : event.titleEn;
  const explainer = eventExplainer(event.slug, locale);
  const c = t.calendar;
  const values = [
    { label: c.forecast, value: formatEventValue(event.forecast, event.unit, locale) },
    { label: c.previous, value: formatEventValue(event.previous, event.unit, locale) },
  ].filter((slot) => slot.value !== null);

  const body = (
    <>
      <span className={styles.nextTop}>
        <span className={styles.nextLabel}>{label}</span>
        <span className={styles.nextPill} data-today={away === 0 || undefined}>
          {relativeDayLabel(away, c)}
        </span>
      </span>
      <span className={styles.nextMain}>
        <span className={styles.nextBadge}>
          <strong className="numeral">{day}</strong>
          <span>{month}</span>
        </span>
        <span className={styles.nextBody}>
          <strong className={styles.nextTitle}>{title}</strong>
          <span className={styles.nextMeta}>
            {weekday}
            {times && (
              <>
                <span aria-hidden> · </span>
                <span className="numeral">
                  {times.primary} {tags.primary}
                </span>
                <span aria-hidden> · </span>
                <span className="numeral">
                  {times.secondary} {tags.secondary}
                </span>
              </>
            )}
          </span>
        </span>
      </span>
      {explainer && <span className={styles.nextWhy}>{explainer}</span>}
      <span className={styles.nextFoot}>
        {/* Geri sayım kart bağlantısının ADINA girmesin: saniyede bir
            değişen metin bağlantının erişilebilir adını da değiştirirdi.
            Aynı bilgi künye satırındaki göreli gün rozetinde. */}
        <span className={styles.nextCount} aria-hidden={times ? true : undefined}>
          <span className={styles.nextFootLabel}>{c.countdown}</span>
          {times && event.eventTimeEt ? (
            <span>
              <ReleaseCountdown
                targetIso={etDateTimeToUtc(event.eventDate, event.eventTimeEt).toISOString()}
                initialNowMs={nowMs}
                units={{ d: c.unitDay, h: c.unitHour, m: c.unitMinute, s: c.unitSecond }}
                dueLabel={t.dayFlow.awaiting}
              />
            </span>
          ) : (
            <span className={styles.countDue}>{t.earnings.timeUnknown}</span>
          )}
        </span>
        {values.map((slot) => (
          <span key={slot.label} className={styles.nextValue}>
            <span className={styles.nextFootLabel}>{slot.label}</span>
            <strong className="numeral">{slot.value}</strong>
          </span>
        ))}
      </span>
    </>
  );

  if (!href) {
    return <div className={styles.next}>{body}</div>;
  }
  /* Sayfa içi çapa düz `<a>`: aynı adreste kalıyor, gezinme yok. Görünüm
     değiştiren bağlantı `LocaleLink` — `/en` önekini o taşıyor. */
  return inPage ? (
    <a className={styles.next} href={href}>
      {body}
    </a>
  ) : (
    <Link className={styles.next} href={href}>
      {body}
    </Link>
  );
}
