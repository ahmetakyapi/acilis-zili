import { EmptyState, ImpactDot } from "@/components/ui/primitives";
import { getEventsBetween, getTodayEvents } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { timePair, zoneTag } from "@/lib/session-clock";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatEtDateLong, formatEventValue, NO_VALUE } from "@/lib/utils";

export async function ScheduleList({ locale, t }: { locale: Locale; t: Dictionary }) {
  const events = await getTodayEvents();

  if (events.length === 0) {
    return <EmptyState compact title={t.today.scheduleEmpty} />;
  }

  const tags = zoneTag(locale);

  return (
    <ul>
      {events.map((event) => {
        /* Büyük satır okuyucunun saati, altındaki küçük satır kaynağın
           saati. TR'de sıra dönüyor: "16:30" üstte, "09:30 NY" altta. */
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        const high = event.importance === "high";
        /* Biçim paylaşılan yardımcıdan: elden yazılan satır yüzdeyi İNGİLİZCE
           kuralıyla sona koyuyordu ("3.46353%") ve ondalık ayracını
           yerelleştirmiyordu — aynı sayı sayfanın üstündeki şeritte "%3,46"
           yazıyordu. */
        const forecast = formatEventValue(event.forecast, event.unit, locale);
        const actual = formatEventValue(event.actual, event.unit, locale);
        return (
          <li
            key={event.id}
            className={cn(
              "flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5",
              high && "bg-down-wash",
            )}
          >
            <span className="w-[52px] shrink-0">
              <span
                className={cn(
                  "numeral block text-base leading-tight",
                  high ? "font-bold text-strong" : "font-semibold text-body",
                )}
              >
                {times ? times.primary : NO_VALUE}
              </span>
              {times && (
                <span className="numeral block text-tiny leading-tight text-muted">
                  {times.secondary} {tags.secondary}
                </span>
              )}
            </span>
            <ImpactDot
              importance={event.importance ?? "low"}
              label={t.calendar.impact}
              lineHeight={20}
            />
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                high ? "font-semibold text-strong" : "text-body",
              )}
            >
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
            {/* TEK SAYI SÜTUNU, İKİ DEĞİL. Kart ana kolondayken beklenti ve
                gerçekleşen ayrı sütunlardaydı; yan kolona taşınınca (376px)
                ikisi de çoğu satırda boş olduğu için yan yana iki tire
                genişliğin üçte birini yiyor, olayın adı üç satıra
                kırılıyordu. Gerçekleşen varsa o yazılıyor, yoksa beklenti —
                ve altındaki künye hangisi olduğunu söylüyor. İkisini birden
                görmek isteyen /takvim'e gidiyor. */}
            {(actual || forecast) && (
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    "numeral block text-base leading-tight",
                    actual
                      ? high
                        ? "font-bold text-down"
                        : "font-semibold text-strong"
                      : "text-body",
                  )}
                >
                  {actual ?? forecast}
                </span>
                <span className="block text-tiny leading-tight text-muted">
                  {actual ? t.calendar.actual : t.calendar.forecast}
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* Sağ kolonun yedek kapasitesi — gerekçe `WeekAhead` içinde. */
const WEEK_AHEAD_BASE = 3;
const WEEK_AHEAD_MAX = 6;

/**
 * Haftaya bakış — önümüzdeki 7 günün yüksek ve orta önemli olayları.
 */
export async function WeekAhead({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const events = (
    await getEventsBetween(addEtDays(today, 1), addEtDays(today, 7))
  ).filter((event) => event.importance !== "low");

  if (events.length === 0) {
    return <EmptyState compact title={t.today.weekAheadEmpty} />;
  }

  const tags = zoneTag(locale);

  /* ÜÇ SATIR TABAN, ALTIYA KADAR YEDEK — sağ kolonun doldurma kapasitesi.
     Kapasite bir dönem YALNIZCA favoriler listesindeydi ve o liste giriş
     yapmamış okuyucuda hiç yok: ölçüldü, 1024–1100 pikselde sağ kolon 114 ile
     244 piksel kısa kalıyordu ve açılacak tek bir satır bile bulunmuyordu.
     Haftaya bakış her okuyucuda var ve zaten kırpılmış bir liste. */
  return (
    <ul>
      {events.slice(0, WEEK_AHEAD_MAX).map((event, index) => {
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        return (
          /* TELEFONDA TARİH SÜTUNU DEĞİL KÜNYE SATIRI.
             Sütun 86 piksel genişti ve "24 Eylül Perşembe" oraya sığmıyor:
             tarih üç satıra (gün, gün adı, saat) çıkarken olayın adı tek
             satırda kalıyor, satır sağı boş bir L'ye dönüyordu (ölçüldü,
             390). Dar ekranda sıra değişiyor — önce etki noktası ve olayın
             adı, altında tarih ile saat tek satırda. Sütun düzeni yalnızca
             1024'ten geniş ekranda geri geliyor — panel orada yan kolonda
             (350 piksel) ve sütun o dar kap için tasarlanmıştı; 768'de pano
             tek kolon ve panel tam genişlikte, orada da yığılmış hâli
             doğru okunuyor. Sıra `order` ile çevriliyor, DOM
             sırası telefondaki okuma sırası. */
          <li
            key={event.id}
            data-fill={index >= WEEK_AHEAD_BASE ? "" : undefined}
            hidden={index >= WEEK_AHEAD_BASE}
            suppressHydrationWarning
            className="flex flex-wrap items-start gap-x-2.5 gap-y-1 border-t border-line px-4 py-3 sm:px-5 lg:flex-nowrap lg:gap-3"
          >
            <span className="lg:order-2">
              <ImpactDot
                importance={event.importance ?? "medium"}
                label={t.calendar.impact}
              />
            </span>
            <span className="min-w-0 flex-1 text-base leading-snug text-body lg:order-3">
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
            <span className="flex w-full flex-wrap items-baseline gap-x-2 pl-[18px] lg:order-1 lg:w-[86px] lg:shrink-0 lg:flex-col lg:items-start lg:gap-x-0 lg:pl-0">
              <span className="text-tiny font-semibold leading-tight text-strong">
                {formatEtDateLong(event.eventDate, locale)}
              </span>
              {times && (
                <span className="numeral text-tiny leading-tight text-muted">
                  {times.primary} {tags.primary}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
