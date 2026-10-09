import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import styles from "../stock.module.css";
import { Panel } from "@/components/ui/primitives";
import { getNextEarnings } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getEarningsSurprises } from "@/lib/providers/finnhub";
import { todayEt } from "@/lib/market-hours";
import { cn, formatMoneyCompact, formatEtDateLong, formatPrice } from "@/lib/utils";
import { type EarningsItem, symbolEarnings, paraSecenegi } from "./shared";

/**
 * Yaklaşan bilanço — sağ kolonun tepesinde pirinç vurgulu kart.
 * Tarih, seans zamanı ve analistlerin EPS + gelir beklentisi bir arada.
 */

export async function UpcomingEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const paraOpt = await paraSecenegi(symbol);
  const today = todayEt();
  /* Tüm takvim satırları TEK SORGUDA: hem sıradaki bilanço hem son açıklanan
     aynı listeden çıkıyor, sağlayıcıya ikinci tur yok. */
  const tumu = await symbolEarnings(symbol);
  let next: EarningsItem | null = await getNextEarnings(symbol);
  if (!next) {
    next =
      tumu
        .filter((row) => row.reportDate >= today)
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0] ?? null;
  }
  if (!next) return null;

  /* BEKLENTİ KARNESİ — kartın boşluğunu dolduran şey tablonun KOPYASI değil,
     tablonun söylemediği ÖZET. Aşağıdaki Geçmiş Bilançolar zaten her çeyreğin
     tarihini, beklentisini, gerçekleşenini ve sapmasını satır satır yazıyor;
     bu kart forward bakıyor ve "şirket bu bilançoya nasıl giriyor" sorusunu
     yanıtlıyor. İlk hâlinde son çeyreğin ham sayılarını basıyordum ve o
     tablonun tam bir alt kümesiydi — aynı sayfada aynı sayı iki kez.

     Yalnızca İKİSİ DE bilinen çeyrekler sayılıyor: gerçekleşen var ama
     beklenti yoksa o çeyrek "aşıldı mı" sorusuna cevap veremez, sayıma
     girmiyor. Eşik yok: gerçekleşen beklentinin üstündeyse aşılmış sayılıyor.
     Dört çeyrek yeterli — daha uzun geçmiş şirketin bugünkü hâlini anlatmıyor
     ve kart bir özet, bir seri değil. */
  /* KAYNAK SÜRPRİZ GEÇMİŞİ, TAKVİM DEĞİL. Takvim tablosu geçmiş tarafında
     sembol başına TEK satır tutuyor (ölçüldü: NVDA ve SNOW'da birer tane) —
     bir çeyrekten karne kurulamaz. `getEarningsSurprises` dört çeyreği
     birden veriyor ve sayfanın Geçmiş Bilançolar tablosu da zaten onu
     kullanıyor; `finnhubFetch` altı saatlik `revalidate` ile önbelleklediği
     için ikinci bileşenden çağırmak yeni bir tur açmıyor. */
  const surpriz = await getEarningsSurprises(symbol);
  const karneler = (surpriz.ok ? surpriz.data : [])
    .filter((row) => row.epsActual !== null && row.epsEstimate !== null)
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 4)
    .map((row) => (row.epsActual! > row.epsEstimate! ? "asti" : "kaldi"));
  const asilan = karneler.filter((x) => x === "asti").length;

  const earningsHourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel className={styles.upcomingPanel}>
      <div className={styles.eventKicker}><h2 className="plate text-read">{t.stock.nextEarnings}</h2><CalendarBlank aria-hidden size={21} weight="duotone" /></div>
      <p className={cn("numeral", styles.earningsDate)}>
        {formatEtDateLong(next.reportDate, locale)}
      </p>
      <p className="mt-0.5 text-xs text-soft">
        {next.hour
          ? (earningsHourLabel[next.hour] ?? t.earnings.timeUnknown)
          : t.earnings.timeUnknown}
      </p>
      {/* TAKVİME EKLE (8 Ekim). Bilanço takvimi, rapor kapağı ve analiz
          listesi bu düğmeyi taşıyordu; tarihin en çok bakıldığı yer olan
          bu kartta yoktu. Aynı uç (`/api/takvim`), aynı .ics. */}
      <AddToCalendar
        symbol={symbol}
        date={next.reportDate}
        label={t.earnings.addToCalendar}
        className="mt-3 mb-0 w-fit self-start sm:mt-3 sm:mb-0"
      />
      {(next.epsEstimate !== null || next.revenueEstimate !== null) && (
        /* İKİ ÖLÇÜ AYNI HATTA. Etiketler 84 piksellik hücrede iki
           satıra düşüyor (768'de ölçüldü) ve İkisi aynı anda düşmezse
           değerler birbirinden kayıyor: İngilizce tarafta "EPS ESTIMATE"
           tek satır, "REVENUE ESTIMATE" iki. Alt ızgara etiketi ve değeri
           iki hücrede de aynı satıra bağlıyor. */
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
          {next.epsEstimate !== null && (
            <div className="row-span-2 grid grid-rows-subgrid gap-y-0.5">
              <dt className="text-nano text-muted">
                {t.earnings.epsEstimate}
              </dt>
              <dd className="numeral self-start text-sm font-semibold text-strong">
                {formatPrice(next.epsEstimate, locale, { currency: paraOpt })}
              </dd>
            </div>
          )}
          {next.revenueEstimate !== null && (
            <div className="row-span-2 grid grid-rows-subgrid gap-y-0.5">
              <dt className="text-nano text-muted">
                {t.earnings.revenueEstimate}
              </dt>
              <dd className="numeral self-start text-sm font-semibold text-strong">
                {formatMoneyCompact(
                  next.revenueEstimate,
                  locale,
                  typeof paraOpt === "string" ? paraOpt : null,
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* TEK ÇEYREK KARNE DEĞİLDİR. "Son 1 çeyreğin tamamında beklenti
          aşıldı" hem Türkçe olarak tuhaf hem de istatistik olarak boş;
          en az iki çeyrek gerekiyor. */}
      {karneler.length > 1 && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-nano text-muted">
            {t.earnings.beatRecord}
          </p>
          {/* Dört işaret: her çeyrek bir kutu, dolu olan aşılmış. Renk TEK
              TAŞIYICI DEĞİL — dolu/boş ayrımı gri tonlamada da okunuyor ve
              altındaki cümle sayıyı zaten yazıyor. Sıra ESKİDEN YENİYE:
              soldan sağa okuma yönü zamanla aynı. */}
          <div aria-hidden className="mt-1.5 flex gap-1">
            {[...karneler].reverse().map((durum, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  durum === "asti" ? "bg-up" : "bg-line-strong",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-tiny leading-relaxed text-body">
            {(asilan === karneler.length
              ? t.earnings.beatRecordAll
              : asilan === 0
                ? t.earnings.beatRecordNone
                : t.earnings.beatRecordLine
            )
              .replace("{total}", String(karneler.length))
              .replace("{beat}", String(asilan))}
          </p>
        </div>
      )}
    </Panel>
  );
}
