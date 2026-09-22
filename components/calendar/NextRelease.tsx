import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { daysBetweenEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { timePair, zoneTag } from "@/lib/session-clock";
import { etDateParts, relativeDayLabel } from "@/lib/utils";
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
 * `href` null ise kart bağlantı değil: tarih ay görünümünün de ötesinde
 * (30 günden uzak) ve gidilecek bir satır yok.
 */
export function NextRelease({
  event,
  label,
  today,
  href,
  inPage,
  locale,
  t,
}: {
  event: EconomicEventRow;
  /** "Sıradaki Yüksek Etkili Açıklama" ya da yedek "Sıradaki Açıklama". */
  label: string;
  today: string;
  href: string | null;
  /** Hedef satır bu sayfada mı — değilse görünüm değiştiren bağlantı. */
  inPage: boolean;
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
  const away = daysBetweenEt(today, event.eventDate);
  const title = locale === "tr" ? event.titleTr : event.titleEn;

  const body = (
    <>
      <span className={styles.nextBadge}>
        <strong className="numeral">{day}</strong>
        <span>{month}</span>
      </span>
      <span className={styles.nextBody}>
        <span className={styles.nextLabel}>{label}</span>
        <strong className={styles.nextTitle}>{title}</strong>
        <span className={styles.nextMeta}>
          <span>
            {weekday}
            {times && (
              <>
                <span aria-hidden> · </span>
                <span className="numeral">
                  {times.primary} {tags.primary}
                </span>
                {/* Telefonda ikincil saat düşüyor: künye tek satırda kalsın
                    diye (390'da iki satıra kırılıp kartı 131 piksele
                    çıkarıyordu). Saatin iki dilimi aşağıda her satırda var. */}
                <span className={styles.nextSecondary}>
                  <span aria-hidden> · </span>
                  <span className="numeral">
                    {times.secondary} {tags.secondary}
                  </span>
                </span>
              </>
            )}
          </span>
          <span className={styles.nextPill} data-today={away === 0 || undefined}>
            {relativeDayLabel(away, t.calendar)}
          </span>
        </span>
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
