import { BrokerBoard } from "@/components/brokers/BrokerBoard";
import { BrokerFold } from "@/components/brokers/BrokerFold";
import { BrokerLead } from "@/components/brokers/BrokerLead";
import { BrokerMark } from "@/components/brokers/BrokerMark";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { SCENARIO_SHARE_PRICE, type Broker } from "@/content/brokers";
import {
  CURVE_POINTS,
  CURVE_RANGE,
  feeCurves,
  leaderSegments,
  logGrid,
  YEARLY_FREQUENCIES,
  yearlyCosts,
} from "@/lib/broker-board";
import { brokersLeadFacts } from "@/lib/broker-cards";
import { costLine, LINE_DEFAULT_USD, LINE_STEPS_USD } from "@/lib/broker-line";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import styles from "./Brokers.module.css";

/**
 * Aracı kurum sayfasının ANA GÖRSELİ — "Alımına Göre Komisyon" (25 Ekim).
 * İlk sürüm tam genişlikte tek bir maliyet çizgisiydi; kurum logoları
 * turunda üç karta bölündü (gerekçe `BrokerBoard.tsx`). Matris
 * (`BrokerTable`) kaynak katmanı olarak altta kalıyor.
 *
 * Hesap burada, sunucuda: kaydırıcının dokuz durağı, eğrilerin 97 noktası,
 * en ucuz dilimleri ve her durak × sıklık için yıllık maliyet hazır
 * gidiyor; istemciye tarife verisi değil yalnız sonuç iniyor. Hepsi aynı
 * `commissionFor`dan: kürsüdeki rakam, eğrinin noktası ve yıllık çubuğun
 * komisyonu aynı kaynaktan (CLAUDE.md veri dürüstlüğü 3). `id="senaryo"`
 * eski çapa: dışarıdan gelen bağlantılar kırılmasın.
 *
 * KOMPAKT TUR (25 Ekim). Sahibi: "çok yer kaplıyor; detayları görmek
 * isteyen açarak baksın." Sayfanın tepe cümlesi (`BrokerLead`) kapağın
 * altındaki kalın iki satırdan panonun başına, açıklama satırının yerine
 * geçti; kaydırıcıyla birlikte değişiyor. Panonun dibi: "sıra öneri
 * değildir" künyesi tek satır ve KATLANMIYOR; altında iki katlı satır
 * (Hesaplanamayanlar: kapalıyken logolu adlar; Varsayımlar: kapalıyken tek
 * cümle). Eski açıklama satırı ve iki varsayım paragrafı Varsayımlar'ın
 * içinde. Ölçüldü (1440×900, TR): kapak 180 → 106 piksel, pano dibi
 * y=1213 → 841 (ilk ekranda tamamı), sayfa boyu 5.770 → 3.551; 390'da
 * 9.051 → 8.253 (kalanı kurum kartları, alt alta).
 */
export function BrokerLinePanel({
  brokers,
  locale,
  t,
}: {
  brokers: readonly Broker[];
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.personalVisuals.brokerLine;
  const B = t.brokerCards.board;
  const lines = LINE_STEPS_USD.map((amount) => costLine(brokers, amount));
  const facts = brokersLeadFacts(brokers, costLine(brokers, LINE_DEFAULT_USD));
  const curves = feeCurves(brokers, logGrid(CURVE_RANGE[0], CURVE_RANGE[1], CURVE_POINTS));
  const segments = leaderSegments(brokers);
  const yearly = LINE_STEPS_USD.map((amount) =>
    YEARLY_FREQUENCIES.map((perMonth) => yearlyCosts(brokers, amount, perMonth)),
  );
  /* Hangi tutarda olursa olsun tarifesinden komisyon çıkmayan kurumlar —
     `costLine`ın `unpriced` listesi her durakta aynı. */
  const unpriced = lines[0].unpriced;
  const C = t.brokerCards.compact;

  return (
    <Panel id="senaryo" aria-label={L.title} className="scroll-mt-28">
      <PanelHeader title={L.title} />
      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5">
        {/* Hesaplanamayan kurum sayısı cümleden çıktı (`unpriced: 0`): aynı
            bilgi panonun dibindeki katlı satırda, logolarıyla. */}
        <BrokerLead
          lines={lines}
          total={facts.total}
          fractional={facts.fractional}
          templates={t.brokerCards.lead}
          locale={locale}
          omitUnpriced
          className="-mt-1 max-w-4xl text-sm leading-relaxed text-body"
        />
        <BrokerBoard
          lines={lines}
          curves={curves}
          segments={segments}
          yearly={yearly}
          locale={locale}
          labels={{ ...B, amountLabel: L.amountLabel, amountValue: L.amountValue, ofTrade: L.ofTrade }}
        />
      </div>
      {/* Panonun dibi (CLAUDE.md ekran düzeni 6): künye panelin İÇİNDE,
          hairline ile; uyarı için yeni kutu yok. Sıranın öneri olmadığını
          söyleyen not katlanmıyor. Kartlara girmeyen kurumlar: bilmediğimiz
          bir ücrete kürsüde ya da eğride yer vermek onu biliyormuş gibi
          göstermek olurdu. */}
      <div className="border-t border-line-soft">
        <p className="px-4 pt-3 text-tiny leading-relaxed text-muted sm:px-5">{L.orderNote}</p>
        <div className="grid px-0 py-1 lg:grid-cols-2">
          {unpriced.length > 0 && (
            <BrokerFold
              id="pano-hesaplanamayan"
              level={3}
              title={B.unpriced.title}
              summary={
                <span className={styles.markList}>
                  {unpriced.map((entry) => (
                    <span key={entry.id} className={styles.markItem}>
                      <BrokerMark id={entry.id} name={entry.name} size="xs" />
                      {entry.name}
                    </span>
                  ))}
                </span>
              }
            >
              <ul className="flex max-w-3xl flex-col gap-1.5">
                {unpriced.map((entry) => (
                  <li key={entry.id} className="text-small leading-snug text-body">
                    <b className="font-semibold text-strong">{entry.name}.</b>{" "}
                    {entry.reason ? entry.reason[locale] : L.unpricedFallback}
                  </li>
                ))}
              </ul>
            </BrokerFold>
          )}
          <BrokerFold id="senaryo-notlar" level={3} title={C.assumptionsTitle} summary={C.assumptionsSummary}>
            <div className="flex max-w-3xl flex-col gap-2 text-small leading-relaxed text-body">
              <p>{L.lead}</p>
              <p>{t.brokers.scenarioIncluded}</p>
              <p>{L.priceNote.replace("{price}", formatPrice(SCENARIO_SHARE_PRICE, locale, { currency: true, digits: 0 }))}</p>
            </div>
          </BrokerFold>
        </div>
      </div>
    </Panel>
  );
}
