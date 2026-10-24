import { ScaleBar } from "@/components/markets/CompareScale";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  SCENARIO_SHARE_PRICE,
  SCENARIO_TRADES_USD,
  type ScenarioRow,
} from "@/content/brokers";
import { scaleRatios } from "@/lib/compare";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";

/**
 * SENARYO — 1.000 $ ve 10.000 $'lık tek alımın komisyonu.
 *
 * Tablo kalemleri yan yana koyuyor ama "benim alımımda ne öderim" sorusunu
 * cevaplamıyor: binde 3 ile sabit 1,5 $'ı ya da %0,2 + 25 $ asgariyi
 * kafada karşılaştırmak gerekiyordu. Burada aynı alım her tarifeden geçiyor.
 *
 * Karşılaştırılan büyüklük bir de ÇİZGİ (CLAUDE.md; `CompareScale`):
 * sütun başına ölçek, en büyük ücret tam çubuk. ORTAK ÖLÇEK DEĞİL, bilerek:
 * 10.000 $ sütununun en büyüğü (30 $) 1.000 $ sütununun en büyüğünün on
 * katı; ortak ölçekte 1.000 $ sütununun bütün çubukları %10'un altında
 * kalıp kendi içinde okunmuyordu. Ayrı ölçek dipnotta açıkça yazıyor
 * (`scenarioPrice`). Çubuk büyüklük, yargı
 * değil — ton nötr, en ucuz vurgulanmıyor, sıra veri dosyasındaki sıra.
 *
 * Hesaplanamayan kurum (tarifesi çelişen ya da yalnız asgari veren)
 * satırda kalıyor ve nedenini söylüyor: satırı silmek, o kurumun ücretini
 * bilmediğimizi saklamak olurdu.
 */

const LABEL_COL_PX = 148;
const VALUE_COL_PX = 132;
/** Ücretin tutara oranı, yüzde — iki ondalık: 0,15 ile 0,25 ayrışsın. */
const PCT_DIGITS = 2;

export function BrokerScenario({
  rows,
  locale,
  t,
}: {
  rows: ScenarioRow[];
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.brokers;
  const pick = (bi: { tr: string; en: string }) => (locale === "en" ? bi.en : bi.tr);
  const usd = (value: number, digits = 2) => formatPrice(value, locale, { currency: true, digits });
  const sticky = "sticky left-0 z-10 bg-(--premium-surface)";

  const scales = SCENARIO_TRADES_USD.map((_, column) => scaleRatios(rows.map((row) => row.fees[column])));

  return (
    <Panel id="senaryo" aria-label={L.scenarioTitle}>
      <PanelHeader title={L.scenarioTitle} />
      <p className="max-w-3xl px-4 pb-4 text-sm leading-relaxed text-body sm:px-5">
        {L.scenarioLead.replace("{price}", usd(SCENARIO_SHARE_PRICE, 0))}
      </p>
      <ScrollEdges
        className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
        tabIndex={0}
        role="region"
        aria-label={L.scenarioRegion}
        fixedStart
      >
        {/* TAM GENİŞLİK (25 Ekim). Tablo 1280'de `max-w-3xl` ile 808
            pikselde bitiyordu: satır çizgileri yarıda kesiliyor, altındaki
            dipnot çizgisi panelin sonuna gidiyordu — iki ayrı hat. O
            daraltmanın gerekçesi (sayılar sağ uca kaçıp kurum adıyla
            arasında 700 piksel boşluk kalması) artık yok: her hücrenin
            altında hücre genişliğinde ölçek çizgisi var, göz adı çizgi
            boyunca sayıya taşıyor (ray `max-w-none`). Kurum sütunu geniş ekranda %28,
            dar ekranda 148 piksel; iki değer sütunu kalanı eşit bölüyor. */}
        <table
          className="w-full text-sm"
          style={{ minWidth: `${LABEL_COL_PX + SCENARIO_TRADES_USD.length * VALUE_COL_PX}px` }}
        >
          <colgroup>
            <col className="w-[148px] sm:w-[28%]" />
            {SCENARIO_TRADES_USD.map((trade) => (
              <col key={trade} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-y border-line-soft text-left text-nano text-muted">
              <th scope="col" className={cn(sticky, "px-4 py-2.5 font-medium sm:px-5")}>
                {L.columns.broker}
              </th>
              {SCENARIO_TRADES_USD.map((trade, column) => (
                <th
                  key={trade}
                  scope="col"
                  className={cn(
                    "py-2.5 text-right font-medium",
                    column === SCENARIO_TRADES_USD.length - 1 ? "pl-3 pr-4 sm:pr-5" : "px-3",
                  )}
                >
                  {L.scenarioTrade.replace("{amount}", usd(trade, 0))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((row, index) => {
              const priced = row.fees.some((fee) => fee !== null);
              return (
                <tr key={row.broker.id}>
                  <th scope="row" className={cn(sticky, "px-4 py-2.5 text-left align-top font-normal sm:px-5")}>
                    <span className="block text-small font-bold text-strong">{row.broker.name}</span>
                  </th>
                  {priced ? (
                    SCENARIO_TRADES_USD.map((trade, column) => {
                      const fee = row.fees[column];
                      const ratio = scales[column].ratios[index];
                      return (
                        <td
                          key={trade}
                          className={cn(
                            "py-2.5 text-right align-top",
                            column === SCENARIO_TRADES_USD.length - 1 ? "pl-3 pr-4 sm:pr-5" : "px-3",
                          )}
                        >
                          {fee === null ? (
                            <span className="text-small text-muted">{L.notPriced}</span>
                          ) : (
                            <>
                              <span className="numeral block text-small font-bold text-strong sm:text-base">
                                {usd(fee)}
                              </span>
                              <span className="numeral block text-tiny text-muted">
                                {formatPercentPlain((fee / trade) * 100, locale, PCT_DIGITS)}
                              </span>
                              {/* Ray hücre genişliğinde (`max-w-none`): 128 piksellik
                                  varsayılanla 1280'de ad ile ilk sayı arasında 330 piksel
                                  boşluk kalıyordu (ölçüldü); hücre boyu ray, adı sayıya
                                  bağlayan hat oluyor. Sağa yaslı, sayının altında biter. */}
                              {ratio != null && <ScaleBar ratio={ratio} signed={false} className="max-w-none" />}
                            </>
                          )}
                        </td>
                      );
                    })
                  ) : (
                    <td colSpan={SCENARIO_TRADES_USD.length} className="py-2.5 pl-3 pr-4 align-top sm:pr-5">
                      <span className="block text-small text-muted">{L.notPriced}</span>
                      {row.broker.commission.kind === "none" && (
                        <span className="block text-tiny leading-snug text-muted">
                          {pick(row.broker.commission.reason)}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollEdges>
      {/* Varsayımlar panelin İÇİNDE, hairline ile ayrılmış düz paragraf
          (CLAUDE.md ekran düzeni 6); yeni kutu açılmıyor. */}
      <div className="border-t border-line-soft px-4 py-4 sm:px-5">
        <div className="flex max-w-3xl flex-col gap-2 text-tiny leading-relaxed text-muted">
          <p>{L.scenarioIncluded}</p>
          <p>{L.scenarioPrice}</p>
        </div>
      </div>
    </Panel>
  );
}
