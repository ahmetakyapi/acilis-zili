import { EmptyState, EmptyValue } from "@/components/ui/primitives";
import { getEarningsForSymbol, type AnalysisIndexRow } from "@/lib/data";
import { fiscalLabel, fiscalOf } from "@/lib/fiscal";
import { EpsTrack } from "@/components/stock/EpsTrack";
import { buildPastQuarters, epsSurprise, formatEpsSurprise, type EpsSurprise, type PastQuarter } from "@/components/stock/past-quarters";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getEarningsSurprises } from "@/lib/providers/finnhub";
import { todayEt } from "@/lib/market-hours";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { cn, directionWash, formatMoneyCompact, formatEtDateMedium, formatPrice } from "@/lib/utils";
import { type EarningsItem, symbolEarnings, paraSecenegi, paraKoduOf } from "./shared";

/**
 * Geçmiş bilançolar — dönem başına sapma, sonra onu üreten EPS beklentisi
 * ve gerçekleşeni;
 * gelir verisi varsa ikinci satırda okunur. Açıklanmamış (gelecek) kayıtlar
 * bu listede yer almaz, onlar Yaklaşan Bilanço kartındadır.
 */
export async function PastEarnings({
  symbol,
  locale,
  t,
  analyses,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
  analyses: AnalysisIndexRow[];
}) {
  const today = todayEt();
  /* Bu tablo bir dönem koşulsuz dolar basıyordu — gerekçe `paraSecenegi`de. */
  const paraOpt = await paraSecenegi(symbol);

  /* TAKVİM İKİ KAYNAKTAN. Yerel tablo geçmiş tarafında sembol başına TEK
     satır tutuyor (ölçüldü, UpcomingEarnings künyesi) ve sağlayıcının sembol
     takvimine yalnızca yerel tablo BOŞKEN gidiliyordu: NVDA'da dört çeyreğin
     üçü rapor tarihsiz kalıyordu. İki liste birleşiyor, aynı gün tek satır
     (yerel önce: gelir alanları orada). Sağlayıcı çağrısı yeni bir tur
     açmıyor — Yaklaşan Bilanço kartı aynı ucu aynı parametrelerle çağırıyor
     ve `finnhubFetch` altı saat önbellekliyor. */
  const [yerel, saglayici, surprises] = await Promise.all([
    getEarningsForSymbol(symbol, 12),
    symbolEarnings(symbol),
    /* Kanonik EPS kaynağı earnings surprises'tır: çeyrek başına TEK kayıt
       ve rapor günündeki nihai beklentiyi taşır. Takvim beslemesi aynı
       çeyrek için revizyon kopyaları düşürebiliyor (AAPL'da iki farklı
       beklenti görüldü) — bu yüzden takvim yalnızca gelir/rapor-tarihi
       zenginleştirmesi yapar. */
    getEarningsSurprises(symbol),
  ]);
  const byDate = new Map<string, EarningsItem>();
  for (const row of [...yerel, ...saglayici]) {
    if (row.reportDate > today && row.epsActual === null) continue;
    const held = byDate.get(row.reportDate);
    if (!held || (row.epsActual !== null && held.epsActual === null)) byDate.set(row.reportDate, row);
  }
  const calRows = [...byDate.values()];

  let rows: PastQuarter[];
  if (surprises.ok) {
    rows = buildPastQuarters(surprises.data, calRows, analyses, locale, today);
  } else {
    // Surprises yoksa takvimden devam: satır zaten açıklama gününe bağlı.
    rows = calRows
      .filter((row) => row.reportDate <= today)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
      .map((row) => {
        const fiscal = fiscalOf(row);
        return {
          key: row.reportDate,
          fiscal,
          label: fiscal ? fiscalLabel(fiscal, locale) : null,
          shortLabel: null,
          quarterEnd: null,
          reportDate: row.reportDate,
          epsEstimate: row.epsEstimate,
          epsActual: row.epsActual,
          revenueEstimate: row.revenueEstimate,
          revenueActual: row.revenueActual,
        };
      });
  }

  if (rows.length === 0) {
    return <EmptyState title={t.common.noData} />;
  }
  const shown = rows.slice(0, 8);

  /* Ay satırı çeyreğin bittiği ayı söyler; mali yıl etiketi (NVDA'nın
     FY2027'si) tek başına takvimde nereye düştüğünü söylemiyor. İkisi
     birlikte: ad üstteki analiz paneliyle aynı, ay altında sessiz. */
  const periodLabel = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );

  /* GELİR SÜTUNLARI YA İKİ SATIRDA DEĞER VARSA YA DA BİR SATIR TAMSA.
     Tek dolu hücre için iki sütun tablonun üçte birini (1440'ta 449 / 1318
     piksel) tireye harcıyordu. Ama beklentisi ve gerçekleşeni birlikte
     bilinen tek bir çeyrek kendi başına bir karşılaştırma: SNDK'nın analizi
     yayımlanmış çeyreği tam da bu (beklenti takvimden, gerçekleşen analiz
     kaydından). */
  const hasRevenue =
    shown.filter((row) => row.revenueActual !== null || row.revenueEstimate !== null).length >= 2 ||
    shown.some((row) => row.revenueActual !== null && row.revenueEstimate !== null);

  return (
    <div>
      <EpsTrack rows={shown} locale={locale} currency={paraOpt} t={t} />
      {/* Tablo dar ekranda kendi kabında kayar — sayfa yana kaymaz.
          KAP KLAVYEYLE ODAKLANABİLİR: 560px'lik tablo 352px'lik kapta kayıyor
          ve `tabindex` olmadan sağdaki sütunlara fare olmadan ulaşılamıyordu
          (WCAG 2.1.1). */}
      <ScrollEdges
        className="scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
        tabIndex={0}
        role="region"
        aria-label={t.stock.pastEarnings}
      >
        {/* DAR EKRANDA KAYDIRMASIZ. `min-w-[560px]` koşulsuzdu: 390 pikselde
            kaba 352 piksel kalıyor ve tablonun 208 pikseli (%37) görüş
            alanının dışında duruyordu — üstelik dışarıda kalan sütun
            tablonun TEK CEVABI olan sayıydı, yani şirketin gerçekten ne
            açıkladığı. Gelir sütunları zaten dar ekranda gizleniyordu ve
            üstündeki yorum "tablo kaydırmadan sığar" diyordu; taban genişlik
            o iddiayı boşa çıkarıyordu. */}
        <table className="w-full min-w-0 text-sm sm:min-w-[560px]">
        <thead>
          <tr className="border-b border-line-soft text-left text-nano text-muted">
            <th className="px-4 py-2.5 font-medium sm:px-5">
              {t.earnings.period}
            </th>
            {/* Tablo tam genişlikte olduğu için rapor tarihi kendi kolonunda
                durur; dar ekranda dönem hücresinin altına iner. */}
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">
              {t.earnings.reportDate}
            </th>
            {/* SAPMA EPS SÜTUNLARININ ÖNÜNDE. Tablo bir aritmetik defteri
                değil, bir karne: okuyucunun aradığı cevap "tutturdu mu",
                girdi sayıları değil. Sapma en sağdayken göz her satırda dört
                sayı geçip sonuca varıyordu; artık dönemin hemen yanında
                duruyor ve isteyen sağdaki iki sütunda nasıl hesaplandığını
                görüyor. Dar ekranda rapor tarihi sütunu gizli, yani sıra
                doğrudan Dönem → Sapma oluyor. */}
            {/* SAYI SÜTUNLARI ORTALI, SAĞA DAYALI DEĞİL. Tablo hisse
                sayfasının tam genişliğinde (1400 piksele kadar) ve beş
                sütunlu: sağa dayandığında her sayı kendi sütununun uzak
                kenarına yapışıyor, sütunlar arasında avuç içi kadar boşluk
                kalıyor ve göz dönem ile değer arasında uzun bir yol
                yürüyordu. Hane hizası burada bedeli küçük bir ödün: en fazla
                sekiz satır var ve değerler aynı büyüklük sınıfında. */}
            <th className="px-2 py-2.5 text-center font-medium sm:px-3">
              {t.earnings.surprise}
            </th>
            <th className="px-2 py-2.5 text-center font-medium sm:px-3">
              EPS · {t.calendar.forecast}
            </th>
            <th className="px-2 py-2.5 text-center font-medium sm:px-3">
              EPS · {t.calendar.actual}
            </th>
            {hasRevenue && (
              <>
                {/* Gelir beklentisi EPS kadar önemli: piyasa çoğu zaman kârı
                    tutturup geliri ıskalayan şirketi de satar. Beklenen ve
                    gerçekleşen ayrı kolonlarda durur ki karşılaştırılabilsin.
                    Dar ekranda ikisi de gizlenir — tablo kaydırmadan sığar. */}
                <th className="hidden px-2 py-2.5 text-center font-medium sm:px-3 lg:table-cell">
                  {t.earnings.revenueShort} · {t.calendar.forecast}
                </th>
                <th className="hidden px-4 py-2.5 text-center font-medium sm:table-cell sm:px-5">
                  {t.earnings.revenueShort} · {t.calendar.actual}
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {shown.map((row) => {
            const surprise = epsSurprise(row.epsEstimate, row.epsActual);
            return (
              <tr key={row.key}>
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="numeral block whitespace-nowrap text-sm font-semibold text-strong">
                    {row.label ?? <EmptyValue label={t.common.noData} />}
                  </span>
                  {row.quarterEnd && (
                    <span className="numeral hidden text-tiny text-muted md:block">
                      {periodLabel.format(new Date(`${row.quarterEnd}T12:00:00Z`))}
                    </span>
                  )}
                  {/* Rapor günü bilinmiyorsa dar ekranda alt satır HİÇ yok:
                      eskiden yerine dönem sonu basılıyordu. */}
                  {row.reportDate && (
                    <span className="numeral block text-tiny text-muted md:hidden">
                      {formatEtDateMedium(row.reportDate, locale)}
                    </span>
                  )}
                </td>
                <td className="numeral hidden px-3 py-2.5 text-sm text-body md:table-cell">
                  {row.reportDate ? (
                    formatEtDateMedium(row.reportDate, locale)
                  ) : (
                    <EmptyValue label={t.common.noData} />
                  )}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3">
                  {surprise ? (
                    <SurprisePill
                      surprise={surprise}
                      locale={locale}
                      currency={paraOpt}
                      title={`EPS · ${t.calendar.forecast} ${formatPrice(row.epsEstimate, locale, { currency: paraOpt })} · ${t.calendar.actual} ${formatPrice(row.epsActual, locale, { currency: paraOpt })}`}
                    />
                  ) : (
                    <EmptyValue label={t.common.noData} className="text-xs text-muted" />
                  )}
                </td>
                <td className="numeral px-2 py-2.5 text-center text-muted sm:px-3">
                  {row.epsEstimate !== null
                    ? formatPrice(row.epsEstimate, locale, {
                        currency: paraOpt,
                      })
                    : <EmptyValue label={t.common.noData} />}
                </td>
                <td className="numeral px-2 py-2.5 text-center font-semibold text-strong sm:px-3">
                  {row.epsActual !== null
                    ? formatPrice(row.epsActual, locale, { currency: paraOpt })
                    : <EmptyValue label={t.common.noData} />}
                </td>
                {hasRevenue && (
                  <>
                    <td className="numeral hidden px-2 py-2.5 text-center text-muted sm:px-3 lg:table-cell">
                      {row.revenueEstimate !== null
                        ? formatMoneyCompact(
                            row.revenueEstimate,
                            locale,
                            paraKoduOf(paraOpt),
                          )
                        : <EmptyValue label={t.common.noData} />}
                    </td>
                    <td className="numeral hidden px-4 py-2.5 text-center text-body sm:table-cell sm:px-5">
                      {row.revenueActual !== null ? (
                        <span className="font-semibold text-strong">
                          {formatMoneyCompact(
                            row.revenueActual,
                            locale,
                            paraKoduOf(paraOpt),
                          )}
                        </span>
                      ) : (
                        <EmptyValue label={t.common.noData} />
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        </table>
      </ScrollEdges>

      {/* AÇIKLAMA PARAGRAFI KÜNYEYE İNDİ. EPS'in ne olduğunu anlatan beş-
          sekiz satırlık paragraf (390'da ~190 piksel) her hisse sayfasında
          birebir tekrar ediyordu; kısaltmanın karşılığı tek satırda yetiyor,
          ayrıntısı sayfanın sonundaki rehber bağlantısında. */}
      <p className="border-t border-line-soft px-4 py-2.5 text-tiny text-muted sm:px-5">
        {t.earnings.epsFull}
      </p>
    </div>
  );
}

/**
 * Sapma hapı — `ChangePill` ile aynı yıkama ve ok, ama metin
 * `formatEpsSurprise`ten: yüzde tek ondalık ya da dolar farkı (gerekçe
 * components/stock/past-quarters.ts). `title` iki EPS'i birlikte yazıyor.
 */
function SurprisePill({
  surprise,
  locale,
  currency,
  title,
}: {
  surprise: EpsSurprise;
  locale: Locale;
  currency: string | true;
  title: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "numeral inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-tiny font-semibold",
        directionWash(surprise.direction),
      )}
    >
      {surprise.direction !== "flat" && (
        <span aria-hidden className="text-[0.85em] leading-none">
          {surprise.direction === "up" ? "▲" : "▼"}
        </span>
      )}
      {formatEpsSurprise(surprise, locale, currency)}
    </span>
  );
}
