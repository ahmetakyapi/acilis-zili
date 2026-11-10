import { DataError, EmptyState } from "@/components/ui/primitives";
import { getEventsBetweenResult, getTodayEvents } from "@/lib/data";
import { addEtDays, etDateTimeToUtc, todayEt } from "@/lib/market-hours";
import { displayZone, readerDayOffset, timePair, zoneDateKey, zoneTag } from "@/lib/session-clock";
import { type Dictionary, type Locale } from "@/lib/i18n";
import type { EconomicEventRow } from "@/lib/schema";
import { cn, formatEventValue, NO_VALUE } from "@/lib/utils";
import styles from "./WeekAhead.module.css";

export async function ScheduleList({ locale, t }: { locale: Locale; t: Dictionary }) {
  const events = await getTodayEvents();

  if (events.length === 0) {
    return <EmptyState compact title={t.today.scheduleEmpty} />;
  }

  return <ScheduleListView events={events} locale={locale} t={t} />;
}

type ScheduleEvent = Pick<
  EconomicEventRow,
  "id" | "eventDate" | "eventTimeEt" | "titleTr" | "titleEn" | "importance" | "forecast" | "actual" | "unit"
>;

/**
 * Bugünün takvimi — saf görünüm (veri `ScheduleList`te; `olcum` skill'i:
 * yükleyici ile çizim ayrı).
 *
 * ÖNEM DOLGUYLA DEĞİL BASAMAKLA (10 Kasım, görsel tur). Yüksek önemli satır
 * `--down-wash` zemin taşıyordu: canlıda (10 Kasım, TÜFE günü) panelin iki
 * satırı da pembe doluydu ve liste "kötü haber" gibi okunuyordu — oysa
 * `down` bu sitede yalnız YÖN rengi (arayuz.md → "renk anlam taşır") ve
 * önem bir yön değil. Açıklanan değer de yüksek önemde kırmızı yazıyordu;
 * verinin beklentinin altında mı üstünde mi geldiği bile bilinmeden.
 * Artık satır nötr zeminde; önemi hemen altındaki "Haftaya Bakış" ile AYNI
 * üç basamaklı çubuk söylüyor (yüksek üçü, orta ikisi, düşük biri dolu;
 * `--impact-*` mürekkebi, basamak sayısı renk körlüğünde de okunur) ve
 * yüksek olayın saati ile adı kalın. Nokta (`ImpactDot`) kalktı: iki
 * komşu panel aynı ölçüyü iki ayrı imle anlatıyordu. Açıklanan değer güçlü
 * mürekkeple, beklenti gövde tonunda; hangisi olduğu altındaki künyede.
 * Ölçüm WeekAhead.module.css → "BUGÜNÜN TAKVİMİ".
 */
export function ScheduleListView({
  events,
  locale,
  t,
}: {
  events: readonly ScheduleEvent[];
  locale: Locale;
  t: Dictionary;
}) {
  const tags = zoneTag(locale);

  return (
    <ul className={styles.today}>
      {events.map((event) => {
        /* Büyük satır okuyucunun saati, altındaki küçük satır kaynağın
           saati. TR'de sıra dönüyor: "16:30" üstte, "09:30 NY" altta. */
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        const importance = event.importance === "high" ? "high" : event.importance === "medium" ? "medium" : "low";
        const high = importance === "high";
        /* Biçim paylaşılan yardımcıdan: elden yazılan satır yüzdeyi İNGİLİZCE
           kuralıyla sona koyuyordu ("3.46353%") ve ondalık ayracını
           yerelleştirmiyordu — aynı sayı sayfanın üstündeki şeritte "%3,46"
           yazıyordu. */
        const forecast = formatEventValue(event.forecast, event.unit, locale);
        const actual = formatEventValue(event.actual, event.unit, locale);
        const level = `${t.calendar.impact}: ${
          high ? t.calendar.impactHigh : importance === "medium" ? t.calendar.impactMedium : t.calendar.impactLow
        }`;
        return (
          <li key={event.id} className={styles.todayRow} data-high={high || undefined}>
            <span className={styles.todayTime}>
              <span className="numeral">{times ? times.primary : NO_VALUE}</span>
              {times && (
                <small className="numeral">
                  {times.secondary} {tags.secondary}
                </small>
              )}
            </span>
            <span className={styles.title}>{locale === "tr" ? event.titleTr : event.titleEn}</span>
            {/* TEK SAYI SÜTUNU, İKİ DEĞİL. Kart ana kolondayken beklenti ve
                gerçekleşen ayrı sütunlardaydı; yan kolona taşınınca (376px)
                ikisi de çoğu satırda boş olduğu için yan yana iki tire
                genişliğin üçte birini yiyor, olayın adı üç satıra
                kırılıyordu. Gerçekleşen varsa o yazılıyor, yoksa beklenti —
                ve altındaki künye hangisi olduğunu söylüyor. İkisini birden
                görmek isteyen /takvim'e gidiyor. */}
            {actual || forecast ? (
              <span className={styles.todayValue} data-actual={actual ? "" : undefined}>
                <span className="numeral">{actual ?? forecast}</span>
                <small>{actual ? t.calendar.actual : t.calendar.forecast}</small>
              </span>
            ) : (
              <span aria-hidden />
            )}
            <span className={styles.impact} data-level={importance} title={level}>
              <i aria-hidden />
              <i aria-hidden />
              <i aria-hidden />
              <span className="sr-only">{level}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* Sağ kolonun yedek kapasitesi — gerekçe `WeekAheadList` içinde. */
const WEEK_AHEAD_BASE = 3;
const WEEK_AHEAD_MAX = 6;

/**
 * Haftaya bakış — önümüzdeki 7 günün yüksek ve orta önemli olayları.
 */
export async function WeekAhead({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const result = await getEventsBetweenResult(addEtDays(today, 1), addEtDays(today, 7));
  /* Okunamayan hafta boş bir hafta değil — gerekçe EarningsToday'de. */
  if (!result.ok) {
    return <DataError className="py-6" message={t.data.failed} hint={t.today.calendarFailedHint} />;
  }
  const events = result.rows.filter((event) => event.importance !== "low");

  if (events.length === 0) {
    return <EmptyState compact title={t.today.weekAheadEmpty} />;
  }

  return <WeekAheadList events={events.slice(0, WEEK_AHEAD_MAX)} locale={locale} t={t} />;
}

type WeekAheadEvent = Pick<
  EconomicEventRow,
  "id" | "eventDate" | "eventTimeEt" | "titleTr" | "titleEn" | "importance"
>;

/**
 * HAFTANIN ZAMAN ÇİZELGESİ (8 Kasım, sahibinin isteği: "çok daha görsel,
 * çok daha iyi"). Satır başına "10 Kasım Salı / 16:30 TR" künyesi vardı:
 * aynı günün iki olayı tarihi iki kez yazıyor, göz haftanın hangi
 * günlerinin dolu olduğunu satırları tek tek okuyarak buluyordu ve dar
 * kapta "12 Kasım Perşembe" üç satıra kırılıyordu. Artık:
 *  - GÜN KAROSU: günün ilk olayının solunda takvim yaprağı (gün adı ve
 *    gün numarası). Ay satırı denendi: karoyu 46'dan 60 piksele çıkarıyor,
 *    liste zaten "önümüzdeki yedi gün" olduğu için numara yeterince
 *    tekil; tam tarih ekran okuyucuda. "Bugün" ve "Yarın" gün adının
 *    yerine geçer; uzaklık
 *    `readerDayOffset`ten, takvimin rozetleriyle AYNI kaynak. Liste ET'de
 *    yarından başladığı için "geçmiş" durumu oluşmuyor; en yakın gün
 *    okuyucuya göre "Bugün" olabilir (TR'de gece yarısından sonra, ET'de
 *    hâlâ dün). Yakın gün karosu dolu tonda, ötekiler çukur zeminde.
 *  - GÜN OKUYUCUNUN GÜNÜ: olay okuyucunun saatiyle gruplanıyor (20:00 ET
 *    açıklaması TR'de ertesi günün 03:00'ü, karosu da o günün). Saatsiz
 *    olay ET tarihinde kalıyor — `readerDayOffset` ile aynı kabul.
 *  - AYNI GÜNÜN ARDINDAKİ OLAY karosuz; karo sütununda dikey ray ve
 *    düğüm. Yedek satır (`data-fill`) tek başına açılabildiği için
 *    (`FillColumn` sığmayanı atlayıp sonrakini açabiliyor) her satır kendi
 *    karosunu TAŞIYOR; karo yalnız bir önceki görünür kardeş aynı günse
 *    CSS'te düşüyor. Hiçbir açılış sırasında satır günsüz kalmaz.
 *  - ÖNEM ÇUBUĞU: sağda üç basamaklı çubuk — yüksek üçü, orta ikisi dolu,
 *    `--impact-high` / `--impact-med` tonunda. Renk tek taşıyıcı değil,
 *    basamak SAYISI da anlatıyor (ImpactDot'un renk körlüğü gerekçesi);
 *    ekran okuyucuya "Etki: Yüksek". Yüksek olayın adı da kalın.
 *  - SAAT kendi sütununda; dört sütun `subgrid` ile bütün satırlarda aynı
 *    hatta (saat sütunu `max-content`, sıkışmaz). Tablo rakamı denendi:
 *    iki noktayı rakam genişliğine açıp "16 : 30" yazıyordu.
 * Ölçüm `WeekAhead.module.css` başında.
 *
 * ESKİ KARAR (TELEFONDA TARİH SÜTUNU DEĞİL KÜNYE SATIRI): 86 piksellik tarih
 * sütunu "24 Eylül Perşembe"yi üç satıra kırıyor, satır sağı boş bir L'ye
 * dönüyordu (ölçüldü, 390); dar ekranda tarih olayın altına iniyordu. Karo
 * 44 piksel ve tarihi iki KISA satıra bilerek bölüyor (gün adı, numara),
 * sorun böylece her genişlikte tek düzenle çözüldü — `order` takası kalktı.
 *
 * ÜÇ SATIR TABAN, ALTIYA KADAR YEDEK — sağ kolonun doldurma kapasitesi.
 * Kapasite bir dönem YALNIZCA favoriler listesindeydi ve o liste giriş
 * yapmamış okuyucuda hiç yok: ölçüldü, 1024–1100 pikselde sağ kolon 114 ile
 * 244 piksel kısa kalıyordu ve açılacak tek bir satır bile bulunmuyordu.
 * Haftaya bakış her okuyucuda var ve zaten kırpılmış bir liste.
 */
export function WeekAheadList({
  events,
  locale,
  t,
  now,
}: {
  events: readonly WeekAheadEvent[];
  locale: Locale;
  t: Dictionary;
  /** Göreli günün ("Bugün", "Yarın") anı; varsayılan şimdi. */
  now?: Date;
}) {
  const tags = zoneTag(locale);
  const zone = displayZone(locale);
  const tag = locale === "en" ? "en-US" : "tr-TR";
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" });
  const full = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const at = now ?? new Date();
  /* Kısaltmanın noktası karoda gürültü ("Sal." / "Kas."). */
  const short = (format: Intl.DateTimeFormat, date: Date) => format.format(date).replace(/\.$/, "");

  const rows = events.map((event) => ({
    event,
    /* Okuyucunun günü — saatli olayda ET anının o dilimdeki günü. */
    day: event.eventTimeEt
      ? zoneDateKey(etDateTimeToUtc(event.eventDate, event.eventTimeEt), zone)
      : event.eventDate,
  }));

  return (
    <ul className={styles.list}>
      {rows.map(({ event, day }, index) => {
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        const continues = index > 0 && rows[index - 1]!.day === day;
        const date = new Date(`${day}T12:00:00Z`);
        const offset = readerDayOffset(event.eventDate, event.eventTimeEt, locale, at);
        const relative = offset === 0 ? t.calendar.today : offset === 1 ? t.calendar.tomorrow : null;
        const high = event.importance === "high";
        const level = `${t.calendar.impact}: ${high ? t.calendar.impactHigh : t.calendar.impactMedium}`;
        return (
          <li
            key={event.id}
            data-fill={index >= WEEK_AHEAD_BASE ? "" : undefined}
            hidden={index >= WEEK_AHEAD_BASE}
            suppressHydrationWarning
            data-continues={continues || undefined}
            data-high={high || undefined}
            className={styles.row}
          >
            <span className={styles.day}>
              <time dateTime={day} className={styles.tile} data-near={relative ? "" : undefined}>
                <span aria-hidden className={styles.tileWeekday}>{relative ?? short(weekday, date)}</span>
                <span aria-hidden className={cn("numeral", styles.tileNumber)}>{date.getUTCDate()}</span>
                <span className="sr-only">{relative ? `${relative}, ${full.format(date)}` : full.format(date)}</span>
              </time>
            </span>
            <span className={styles.time}>
              {times ? (
                <>
                  <span className="numeral">{times.primary}</span>
                  <span className={styles.zone}>{tags.primary}</span>
                </>
              ) : (
                <span className={styles.noTime}>{NO_VALUE}</span>
              )}
            </span>
            <span className={styles.title}>{locale === "tr" ? event.titleTr : event.titleEn}</span>
            <span className={styles.impact} data-level={high ? "high" : "medium"} title={level}>
              <i aria-hidden />
              <i aria-hidden />
              <i aria-hidden />
              <span className="sr-only">{level}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
