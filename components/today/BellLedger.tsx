import type { Dictionary, Locale } from "@/lib/i18n";
import { SESSION_BOUNDS, etParts, type MarketStatus } from "@/lib/market-hours";
import {
  displayZone,
  formatInZone,
  secondaryZone,
  zoneDateKey,
  zoneTag,
} from "@/lib/session-clock";
import { relativeDayLabel } from "@/lib/utils";
import styles from "./BellLedger.module.css";

/**
 * ZİL KÜNYESİ — geri sayımın altındaki iki hücre.
 *
 * Yerinde tek bir tarih satırı duruyordu ("22 Eylül Salı 23:00 TR") ve iki
 * şeyi söylemiyordu: New York saatini (kaynakların hepsi o saatle yayın
 * yapıyor) ve SAYAÇ SIFIRLANINCA ne olacağını. Künye artık iki zili yazıyor:
 *
 * - Seans açıkken: [Kapanış Zili, bugün] ve [Sonraki Açılış]. İkincisi hafta
 *   sonunu ve tatili atlıyor, çünkü `status.nextOpen` zaten
 *   `nextTradingDay` ile kuruluyor.
 * - Kapalıyken: [Açılış Zili] ve aynı seansın [Kapanış Zili]. `nextClose`
 *   kapalıyken sıradaki işlem gününün kapanışı; yarım günse
 *   `closeMinutesFor` onu zaten 13:00 ET'ye çekmiş oluyor ve hücre
 *   "Erken Kapanış" rozetini taşıyor.
 *
 * Hiçbir sağlayıcıya gidilmiyor: her değer önbellekli `getStatus()`ten ve
 * saat biçimi `lib/session-clock.ts`ten geliyor. Göreli gün OKUYUCUNUN
 * takvim gününden hesaplanıyor, 24 saatlik farktan değil — kışın 16:00 ET
 * kapanışı 00:00 TR'ye, yani TR okuyucu için "Yarın"a düşüyor.
 *
 * Sunucu bileşeni: saniyede bir değişen hiçbir şey yok. Okuyucunun gece
 * yarısında "Bugün / Yarın" kaymasın diye sayfa o an tazeleniyor
 * (`nextZoneMidnight`, page.tsx → SessionRefresh).
 */
export function BellLedger({
  locale,
  t,
  status,
  nowMs,
  className,
}: {
  className?: string;
  locale: Locale;
  t: Dictionary;
  status: MarketStatus;
  nowMs: number;
}) {
  const trading = status.session === "regular";
  const readerZone = displayZone(locale);
  const altZone = secondaryZone(locale);
  const tags = zoneTag(locale);
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: readerZone,
    day: "numeric",
    month: "long",
    weekday: "long",
  });

  const cells = trading
    ? [
        { key: "close", kicker: t.today.bellClose, at: status.nextClose, isClose: true, target: true },
        { key: "next", kicker: t.today.nextOpen, at: status.nextOpen, isClose: false, target: false },
      ]
    : [
        { key: "open", kicker: t.today.bellOpen, at: status.nextOpen, isClose: false, target: true },
        { key: "close", kicker: t.today.bellClose, at: status.nextClose, isClose: true, target: false },
      ];

  const todayKey = zoneDateKey(new Date(nowMs), readerZone);

  /* "Bugün" · "Yarın" · ötesi hafta günüyle tarih ("28 Eylül Pazartesi").
     Paylaşılan `relativeDayLabel` "3 Gün Sonra" da yazabiliyor ama zil için
     o cümle eksik: okuyucu pazartesiyi arıyor, üç günü saymıyor. */
  function dayOf(at: Date): { label: string; today: boolean } {
    const away = Math.round(
      (Date.parse(`${zoneDateKey(at, readerZone)}T00:00:00Z`) -
        Date.parse(`${todayKey}T00:00:00Z`)) /
        86_400_000,
    );
    return {
      label: away <= 1 ? relativeDayLabel(away, t.calendar) : dateFormat.format(at),
      today: away <= 0,
    };
  }

  return (
    <dl className={[styles.bells, className].filter(Boolean).join(" ")} aria-label={t.today.bellsLabel}>
      {cells.map((cell) => {
        const early = cell.isClose && etParts(cell.at).minutes !== SESSION_BOUNDS.regularClose;
        const day = dayOf(cell.at);
        return (
          <div key={cell.key} className={styles.cell} data-target={cell.target || undefined}>
            <dt className={styles.kicker}>
              {cell.kicker}
              {early ? <span className={styles.early}>{t.market.earlyClose}</span> : null}
            </dt>
            <dd className={styles.reading}>
              <time dateTime={cell.at.toISOString()} className={styles.times}>
                <strong className={styles.primary}>
                  {formatInZone(cell.at, readerZone)}
                  <small>{tags.primary}</small>
                </strong>
                <span className={styles.alt}>
                  {formatInZone(cell.at, altZone)} {tags.secondary}
                </span>
              </time>
              <span className={styles.day} data-today={day.today || undefined}>{day.label}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
