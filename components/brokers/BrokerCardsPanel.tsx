import { BrokerCards } from "@/components/brokers/BrokerCards";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { Broker } from "@/content/brokers";
import { brokerCardView } from "@/lib/broker-cards";
import { costLine, LINE_STEPS_USD } from "@/lib/broker-line";
import { formatIsoDate } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * Kartlar paneli (25 Ekim görsel turu) — sunucu kabuğu. Görünüm modeli
 * burada kuruluyor (`brokerCardView`: metin dile göre seçilmiş, kaynak
 * numaraları çözülmüş); istemciye tarife modeli değil yalnız okunacak
 * metin ve maliyet çizgisinin hazır durakları iniyor.
 *
 * `lines` maliyet çizgisiyle (BrokerLinePanel) AYNI hesap: kartın büyük
 * rakamı ile çizginin satırı aynı kaynaktan (CLAUDE.md veri dürüstlüğü 3).
 */
export function BrokerCardsPanel({
  brokers,
  locale,
  t,
}: {
  brokers: readonly Broker[];
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.brokerCards;
  const lines = LINE_STEPS_USD.map((amount) => costLine(brokers, amount));
  const cards = brokers.map((broker) => {
    const view = brokerCardView(broker, locale, t.brokers.sourceRef);
    return { ...view, checked: L.checked.replace("{date}", formatIsoDate(view.checked, locale, "long")) };
  });
  return (
    <Panel id="kurumlar" aria-label={L.title} className="scroll-mt-28">
      <PanelHeader title={L.title} meta={L.meta.replace("{count}", String(brokers.length))} />
      <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5">
        <p className="-mt-1 max-w-3xl text-sm leading-relaxed text-body lg:max-w-none">{L.intro}</p>
        <BrokerCards
          cards={cards}
          lines={lines}
          locale={locale}
          path="/araci-kurumlar"
          labels={{
            ...L,
            columns: t.brokers.columns,
            unspecified: t.brokers.unspecified,
            counterparty: t.brokers.counterparty,
          }}
        />
      </div>
    </Panel>
  );
}
