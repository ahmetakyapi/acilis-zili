import { BrokerBoard } from "@/components/brokers/BrokerBoard";
import { BrokerMark } from "@/components/brokers/BrokerMark";
import { FoldToggle } from "@/components/ui/FoldToggle";
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
import { costLine, LINE_STEPS_USD } from "@/lib/broker-line";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";

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
  const F = t.brokerCards.panelFolds;
  const lines = LINE_STEPS_USD.map((amount) => costLine(brokers, amount));
  const curves = feeCurves(brokers, logGrid(CURVE_RANGE[0], CURVE_RANGE[1], CURVE_POINTS));
  const segments = leaderSegments(brokers);
  const yearly = LINE_STEPS_USD.map((amount) =>
    YEARLY_FREQUENCIES.map((perMonth) => yearlyCosts(brokers, amount, perMonth)),
  );
  /* Hangi tutarda olursa olsun tarifesinden komisyon çıkmayan kurumlar —
     `costLine`ın `unpriced` listesi her durakta aynı. */
  const unpriced = lines[0].unpriced;

  return (
    <Panel id="senaryo" aria-label={L.title} className="scroll-mt-28">
      <PanelHeader title={L.title} />
      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5">
        <p className="max-w-3xl text-sm leading-relaxed text-body">{L.lead}</p>
        <BrokerBoard
          lines={lines}
          curves={curves}
          segments={segments}
          yearly={yearly}
          locale={locale}
          labels={{ ...B, amountLabel: L.amountLabel, amountValue: L.amountValue, ofTrade: L.ofTrade }}
        />

        {/* Hesaplanamayanlar: tek satır künye, nedenleri katlı (her
            genişlikte). Kartlara girmiyorlar: bilmediğimiz bir ücrete
            kürsüde ya da eğride yer vermek onu biliyormuş gibi göstermek
            olurdu. */}
        {unpriced.length > 0 && (
          <FoldToggle id="pano-hesaplanamayan" hiddenCount={unpriced.length} narrow={false} more={B.unpriced.more} less={B.unpriced.less}>
            <div className="flex flex-col gap-2">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-body">
                <span className="font-semibold text-muted">{B.unpriced.title}</span>
                {unpriced.map((entry) => (
                  <span key={entry.id} className="inline-flex items-center gap-2 font-semibold text-strong">
                    <BrokerMark id={entry.id} name={entry.name} size="xs" />
                    {entry.name}
                  </span>
                ))}
              </p>
              <ul className="flex max-w-3xl flex-col gap-1">
                {unpriced.map((entry) => (
                  <li key={entry.id} data-fold className="text-small leading-snug text-body">
                    <b className="font-semibold text-strong">{entry.name}.</b>{" "}
                    {entry.reason ? entry.reason[locale] : L.unpricedFallback}
                  </li>
                ))}
              </ul>
            </div>
          </FoldToggle>
        )}
      </div>
      {/* Varsayımlar ve sıranın anlamı panelin İÇİNDE, hairline ile
          (CLAUDE.md ekran düzeni 6); yeni kutu açılmıyor. Telefonda (640
          altı) ölçeğin, hesaba girenlerin ve fiyat varsayımının notu katlı;
          sıranın bir öneri olmadığını söyleyen not hep açık. */}
      <div className="border-t border-line-soft px-4 py-4 sm:px-5">
        <FoldToggle id="senaryo-notlar" hiddenCount={2} phone more={F.lineMore} less={F.lineLess}>
          <div className="flex max-w-3xl flex-col gap-2 text-tiny leading-relaxed text-muted">
            <p>{L.orderNote}</p>
            <p data-fold>{t.brokers.scenarioIncluded}</p>
            <p data-fold>{L.priceNote.replace("{price}", formatPrice(SCENARIO_SHARE_PRICE, locale, { currency: true, digits: 0 }))}</p>
          </div>
        </FoldToggle>
      </div>
    </Panel>
  );
}
