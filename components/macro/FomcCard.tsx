import type { CSSProperties } from "react";
import { DataStamp } from "@/components/ui/primitives";
import { FedOddsTag, fedOddsFor } from "@/components/probabilities/FedOddsTag";
import { addEtDays, todayEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getNextFomc } from "@/lib/macro-data";
import { readerDayOffset, timePair, zoneTag } from "@/lib/session-clock";
import {
  formatEtDateLong,
  formatEtDateMedium,
  formatPercentPlain,
  relativeDayLabel,
} from "@/lib/utils";
import styles from "./MacroExperience.module.css";

/**
 * Sonraki FOMC — tarih, saat ve bugünkü hedef aralık.
 *
 * PİYASA FİYATLAMASI ARTIK KAYNAĞIYLA (25 Ekim). Kart önceden fiyatlama
 * basmıyordu: elimizde kontrat fiyatı veren bir kaynak yoktu ve başka bir
 * sitenin sayısını kopyalamak nereden geldiğini söyleyemediğimiz bir sayı
 * olurdu. /olasiliklar ile Kalshi'nin karar kontratları geldi; künye o
 * sayfanın AYNI kaydından okunuyor ve yalnız takvimdeki toplantı günü
 * kaynaktakiyle eşleşirse basılıyor (`fedOddsFor`). Eşleşmezse ya da
 * kaynak düşmüşse eski not ("fiyatlama yok") yerinde. Kart geri kalanında
 * yalnızca bildiğini yazıyor: takvimdeki tarih (federalreserve.gov, elle
 * tohumlanan takvim) ve FRED'in yayımladığı hedef aralık.
 *
 * Hedef aralık TOPLANTIDAN SONRA değişir; gözlem tarihi künyede.
 */
/** Takvim şeridinin gün sınırı: getNextFomc'nin bakış penceresiyle aynı büyüklükte. */
const STRIP_MAX_DAYS = 120;
const SATURDAY = 6;
const SUNDAY = 0;

/**
 * Bugünden toplantıya kadar her ET günü bir çizgi: hafta sonları kısa,
 * bugün ve toplantı günü tam boy (bugün soluk mürekkep, toplantı
 * markanın yumuşak mavisi; 25 Ekim'e dek doygun etkileşim mavisiydi ve
 * şeridin anahtarı yoktu). Tarih UYDURULMUYOR; şerit
 * takvimdeki tarihle bugünün arasındaki günlerden başka bir şey çizmiyor.
 * Dökülme (sağa doğru sırayla uzama) CSS'te, hareketi azaltana düz basılır.
 */
function dayStrip(today: string, meeting: string) {
  const days: { date: string; kind: "today" | "weekend" | "day" | "meeting" }[] = [];
  for (let date = today, i = 0; date <= meeting && i <= STRIP_MAX_DAYS; date = addEtDays(date, 1), i++) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    days.push({
      date,
      kind: date === meeting ? "meeting" : date === today ? "today" : weekday === SATURDAY || weekday === SUNDAY ? "weekend" : "day",
    });
  }
  return days;
}

export async function FomcCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const x = t.marketExtras;
  const v = t.macroVisual;
  const next = await getNextFomc();
  if (!next) return null;
  const odds = await fedOddsFor(next.date);
  const times = next.timeEt ? timePair(next.date, next.timeEt, locale) : null;
  const tags = zoneTag(locale);
  const away = readerDayOffset(next.date, next.timeEt, locale);
  const strip = dayStrip(todayEt(), next.date);

  /* KOMPAKT ŞERİT (29 Eylül). Kart önce küçük çoklu ızgaranın ilk
     hücresiydi, sonra para politikası bölümünde sahnenin yanında 300
     piksellik bir sütundu. Bölümler geniş ekranda ikişer yan yana dizilince
     yarım genişlikte sahnenin yanına sığmadı; şimdi bölümün içinde,
     grafiğin altında. Üst satır geri sayım, tarih ve hedef aralık; altında
     takvim şeridi; dipte fiyatlama notu. Damga başlık satırının sağında.
     İçerik aynı, yalnızca dizilişi değişti. Yarım genişlikte ölçüldü:
     dikey kart dizilişi 195, bu diziliş ~130 piksel; aradaki fark yan
     bölümün grafiğine ekleniyor (MacroExperience.module.css). Ton farkı (marka mavisinin en açık yıkaması)
     kalıyor: bir seri değil, bir takvim olayı. */
  return (
    <section className={styles.fomc} aria-labelledby="makro-fomc">
      <div className={styles.fomcHead}>
        <h3 id="makro-fomc" className={styles.fomcTitle}>{x.fomcTitle}</h3>
        {next.withProjections && <span className={styles.status}>{x.fomcProjections}</span>}
        {next.target && (
          <DataStamp labels={t.data} source="fred" at={next.target.fetchedAt} locale={locale} className={styles.fomcStamp} />
        )}
      </div>

      <div className={styles.fomcRow}>
        <div className={styles.fomcCount}>
          {away >= 1 ? (
            <>
              <b className="numeral">{away}</b>
              <span>{x.fomcDaysLeft}</span>
            </>
          ) : (
            <b>{relativeDayLabel(Math.max(away, 0), t.calendar)}</b>
          )}
        </div>
        <p className={styles.fomcDate}>
          {formatEtDateLong(next.date, locale)}
          {times && (
            <span className="numeral"> {times.primary} <small>· {times.secondary} {tags.secondary}</small></span>
          )}
        </p>
        <dl className={styles.fomcTarget}>
          <div>
            <dt>{x.fomcTarget}</dt>
            <dd className="numeral">
              {next.target
                ? `${formatPercentPlain(next.target.lower, locale, 2)} - ${formatPercentPlain(next.target.upper, locale, 2)}`
                : t.common.noData}
            </dd>
          </div>
          {next.target && (
            <div>
              <dt>{x.observed}</dt>
              <dd className="numeral">{formatEtDateMedium(next.target.date, locale)}</dd>
            </div>
          )}
        </dl>
      </div>

      {strip.length > 1 && (
        <div className={styles.fomcStrip} role="img" aria-label={`${x.fomcCalendar}: ${strip.length - 1}`}>
          {strip.map((day, i) => (
            <span key={day.date} data-kind={day.kind} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
      )}
      {/* Şeridin anahtarı (25 Ekim son düzeltme): renkler etiketsizdi.
          Hafta sonu yalnız şeritte varsa yazılıyor. */}
      {strip.length > 1 && (
        <p className={styles.fomcKey} aria-hidden>
          <span><i data-kind="today" />{v.fomcToday}</span>
          {strip.some((day) => day.kind === "weekend") && <span><i data-kind="weekend" />{v.fomcWeekend}</span>}
          <span><i data-kind="meeting" />{v.fomcMeeting}</span>
        </p>
      )}

      {odds ? (
        <FedOddsTag odds={odds} locale={locale} t={t} className={styles.fomcNote} />
      ) : (
        <p className={styles.fomcNote}>{x.fomcNoPricing}</p>
      )}
    </section>
  );
}
