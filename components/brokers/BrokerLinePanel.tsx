import { BrokerCostLine } from "@/components/brokers/BrokerCostLine";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { SCENARIO_SHARE_PRICE, type Broker } from "@/content/brokers";
import { costLine, LINE_STEPS_USD } from "@/lib/broker-line";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";

/**
 * Aracı kurum sayfasının ANA GÖRSELİ (25 Ekim): okuyucunun kendi alım
 * tutarında komisyon, tek ölçekte. Eski "Tek Alımın Komisyonu" tablosunun
 * (1.000 $ ve 10.000 $, iki ayrı ölçek) yerini aldı — o iki tutar
 * kaydırıcının durakları arasında, hesap aynı (`commissionFor`). Matris
 * (`BrokerTable`) kaynak katmanı olarak altta kalıyor.
 *
 * Hesap burada, sunucuda: dokuz durağın hepsi hazır gidiyor; istemciye
 * tarife verisi değil yalnız sonuç iniyor. `id="senaryo"` eski çapa:
 * dışarıdan gelen bağlantılar kırılmasın.
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
  const F = t.brokerCards.panelFolds;
  const lines = LINE_STEPS_USD.map((amount) => costLine(brokers, amount));
  return (
    <Panel id="senaryo" aria-label={L.title} className="scroll-mt-28">
      <PanelHeader title={L.title} />
      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5">
        <p className="max-w-3xl text-sm leading-relaxed text-body">{L.lead}</p>
        <BrokerCostLine
          lines={lines}
          locale={locale}
          labels={{
            amountLabel: L.amountLabel,
            amountValue: L.amountValue,
            unpricedTitle: L.unpricedTitle,
            unpricedFallback: L.unpricedFallback,
            ofTrade: L.ofTrade,
            rowLabel: L.rowLabel,
            chartLabel: L.chartLabel,
          }}
        />
      </div>
      {/* Varsayımlar ve sıranın anlamı panelin İÇİNDE, hairline ile
          (CLAUDE.md ekran düzeni 6); yeni kutu açılmıyor. */}
      {/* Telefonda (640 altı) ölçeğin, hesaba girenlerin ve fiyat
          varsayımının notu katlı (25 Ekim, sayfa boyu); sıranın bir öneri
          olmadığını söyleyen not hep açık. */}
      <div className="border-t border-line-soft px-4 py-4 sm:px-5">
        <FoldToggle id="senaryo-notlar" hiddenCount={3} phone more={F.lineMore} less={F.lineLess}>
          <div className="flex max-w-3xl flex-col gap-2 text-tiny leading-relaxed text-muted">
            <p>{L.orderNote}</p>
            <p data-fold>{L.scaleNote}</p>
            <p data-fold>{t.brokers.scenarioIncluded}</p>
            <p data-fold>{L.priceNote.replace("{price}", formatPrice(SCENARIO_SHARE_PRICE, locale, { currency: true, digits: 0 }))}</p>
          </div>
        </FoldToggle>
      </div>
    </Panel>
  );
}
