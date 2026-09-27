import type { Metadata } from "next";
import { cache } from "react";
import { BellMark } from "@/components/brand/BellMark";
import { Countdown } from "@/components/today/Countdown";
import { SessionRefresh } from "@/components/today/SessionRefresh";
import { getHolidays, getStatus } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { SESSION_BOUNDS, closeMinutesFor, etParts } from "@/lib/market-hours";
import { clockOf, timePair, zoneTag } from "@/lib/session-clock";
import { SITE_URL } from "@/lib/site";
import { formatEtDateLong } from "@/lib/utils";
import styles from "../Embed.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.about.embed.metaCountdown };
}

/* Sunucunun "şimdi"si istek içinde tek: sayaç hidrasyonda aynı damgayla
   başlıyor (Countdown.tsx), ana sayfadaki kalıbın aynısı. */
const getPageTimestamp = cache(() => Date.now());

/**
 * Gömülü geri sayım — sıradaki zile kalan süre, Türkiye saatiyle.
 *
 * Ana sayfanın kahramanındaki sayaçla AYNI bileşen ve aynı hedef kuralı:
 * seans açıksa kapanış zili, değilse sıradaki açılış. Sınır geçildiğinde
 * `SessionRefresh` sayfayı tazeliyor ve yeni hedef geliyor; başka bir
 * sitenin içinde günlerce açık kalan bir sekmede de sayaç "00"da donmuyor.
 *
 * Altındaki satır HEDEFİN GÜNÜNÜ söylüyor: cuma akşamı sayılan açılış
 * pazartesinin açılışı ve "16:30" tek başına hangi gün olduğunu söylemiyor.
 * Saatler o günün tarihiyle hesaplanıyor (ABD yaz saati kayması).
 */
export default async function CountdownEmbed() {
  const { locale, t } = await getI18n();
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  const trading = status.session === "regular";
  const target = trading ? status.nextClose : status.nextOpen;
  const label = trading ? t.today.countdownClose : t.today.countdownOpen;
  const day = trading ? status.etDate : etParts(status.nextOpen).dateStr;
  const open = timePair(day, clockOf(SESSION_BOUNDS.regularOpen), locale);
  const close = timePair(day, clockOf(closeMinutesFor(day, holidays)), locale);
  const zone = zoneTag(locale).primary;
  const home = `${SITE_URL}${withLocale("/", locale)}`;

  return (
    <section className={styles.widget} aria-labelledby="embed-countdown-title">
      <SessionRefresh atIso={status.nextTransition.toISOString()} />
      <div className={styles.head}>
        <BellMark size={22} />
        <h1 id="embed-countdown-title" className={styles.title}>
          {label}
        </h1>
      </div>
      <div className={styles.dial}>
        <Countdown
          targetIso={target.toISOString()}
          initialNowMs={getPageTimestamp()}
          units={{
            d: t.today.countdownDays,
            h: t.today.countdownHours,
            m: t.today.countdownMinutes,
            s: t.today.countdownSeconds,
          }}
          unitsShort={{ d: t.today.unitD, h: t.today.unitH, m: t.today.unitM, s: t.today.unitS }}
          label={label}
        />
      </div>
      <p className={`${styles.meta} numeral`}>
        {formatEtDateLong(day, locale)} · {t.about.embed.openAt}{" "}
        <strong>{open.primary}</strong> · {t.about.embed.closeAt}{" "}
        <strong>{close.primary}</strong> {zone}
      </p>
      <div className={styles.foot}>
        <a
          className={styles.credit}
          href={home}
          target="_blank"
          rel="noopener"
          aria-label={t.about.embed.attributionLabel}
        >
          <BellMark size={16} />
          {t.about.embed.attribution}
        </a>
      </div>
    </section>
  );
}
