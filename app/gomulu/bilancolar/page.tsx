import type { Metadata } from "next";
import { BellMark } from "@/components/brand/BellMark";
import { timingOf } from "@/components/earnings/EarningsCalendar";
import { LogoTile, TimingChip } from "@/components/ui/primitives";
import { getHolidays, getUpcomingEarnings, weekAnchor } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { SESSION_BOUNDS, addEtDays, closeMinutesFor, todayEt } from "@/lib/market-hours";
import { clockOf, timePair } from "@/lib/session-clock";
import { SITE_URL } from "@/lib/site";
import { formatEtDateCompact } from "@/lib/utils";
import styles from "../Embed.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.about.embed.metaEarnings };
}

/** Kutuda kaç şirket. Yedi satırla kutu 535-571 piksel ölçüldü; altıyla
    önerilen 524 piksellik çerçeveye (Hakkında → Sitene Ekle) kaydırmasız
    sığıyor. */
const EMBED_EARNINGS_LIMIT = 6;
/** İşlem haftası pazartesiden cumaya: çapa + 4 gün. */
const TRADING_WEEK_SPAN = 4;
/** Cumartesi ve pazar — hafta sonu gelecek haftayı gösterir. */
const WEEKEND_DAYS = new Set([0, 6]);

/**
 * Hangi hafta: hafta içindeyse bu hafta, hafta sonundaysa GELECEK hafta.
 * Cumartesi günü "bu haftanın bilançoları" bitmiş bir listedir; okuyucunun
 * sorusu pazartesi kimin açıklayacağı.
 */
function weekOf(today: string): { from: string; to: string } {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const from = WEEKEND_DAYS.has(weekday) ? addEtDays(weekAnchor(today), 7) : weekAnchor(today);
  return { from, to: addEtDays(from, TRADING_WEEK_SPAN) };
}

/**
 * Gömülü bilanço listesi — haftanın öne çıkan açıklamaları.
 *
 * Seçim `getUpcomingEarnings`in kuralı: piyasa değeri en büyükler, sıra
 * zamana göre. Her satır sitedeki hisse sayfasına YENİ SEKMEDE açılıyor;
 * çerçevenin içinde gezinmek gömen sitenin sayfasını bizim sitemize
 * çevirirdi.
 *
 * SAAT YAZILMIYOR, PENCERE YAZILIYOR. Sağlayıcı dakika vermiyor, yalnızca
 * "açılış öncesi / kapanış sonrası" diyor (CLAUDE.md "Veri dürüstlüğü" 1).
 * Pencerenin Türkiye saatiyle nereye düştüğü altta tek satırda: zilin saati
 * gerçek bir saat, bilançonunki değil.
 */
export default async function EarningsEmbed() {
  const { locale, t } = await getI18n();
  const today = todayEt();
  const { from, to } = weekOf(today);
  const [rows, holidays] = await Promise.all([
    getUpcomingEarnings(from, to, EMBED_EARNINGS_LIMIT),
    getHolidays(),
  ]);
  const open = timePair(from, clockOf(SESSION_BOUNDS.regularOpen), locale);
  const close = timePair(from, clockOf(closeMinutesFor(from, holidays)), locale);
  const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const home = `${SITE_URL}${withLocale("/", locale)}`;
  const calendar = `${SITE_URL}${withLocale("/bilancolar", locale)}`;

  return (
    <section className={styles.widget} aria-labelledby="embed-earnings-title">
      <div className={styles.head}>
        <BellMark size={22} />
        <h1 id="embed-earnings-title" className={styles.title}>
          {t.about.embed.earningsTitle}
        </h1>
        <span className={`${styles.meta} numeral ml-auto whitespace-nowrap`}>
          {formatEtDateCompact(from, locale)} - {formatEtDateCompact(to, locale)}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>{t.about.embed.earningsEmpty}</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => {
            const timing = timingOf(row.hour, t);
            return (
              <li key={row.id} className={styles.row}>
                <a
                  className={styles.rowLink}
                  href={`${SITE_URL}${withLocale(`/hisse/${row.symbol}`, locale)}`}
                  target="_blank"
                  rel="noopener"
                >
                  <span className={`${styles.day} numeral`}>
                    <strong>{formatEtDateCompact(row.reportDate, locale)}</strong>
                    {weekday.format(new Date(`${row.reportDate}T12:00:00Z`))}
                  </span>
                  <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="xs" />
                  <span className={styles.who}>
                    <span className={styles.symbol}>{row.symbol}</span>
                    {row.name && <span className={styles.name}>{row.name}</span>}
                  </span>
                  <TimingChip tone={timing.tone} size="sm">
                    {timing.short}
                  </TimingChip>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.meta}>
        {t.about.embed.earningsNote
          .replace("{open}", open.primary)
          .replace("{close}", close.primary)}
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
        <span>
          {t.about.embed.earningsSource} ·{" "}
          <a className={styles.credit} href={calendar} target="_blank" rel="noopener">
            {t.about.embed.allEarnings}
          </a>
        </span>
      </div>
    </section>
  );
}
