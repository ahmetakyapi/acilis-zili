import { Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  BROKER_COLUMNS,
  type Broker,
  type BrokerCell,
  sourceNumbers,
} from "@/content/brokers";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import styles from "./Brokers.module.css";

/**
 * KURUM KURUM ABD TARİFESİ — sayfanın ana görseli.
 *
 * Satır kurum, sütun ücret kalemi. Kurum adı yapışkan: sekiz sütun 1280'de
 * de sığmıyor (taban genişlik aşağıda) ve kayan bir tabloda hangi satırın
 * hangi kuruma ait olduğu kaybolmamalı (CLAUDE.md, "Kaydırma saklanmaz").
 * Sağ kenar `ScrollEdges` ile solar: devamı var.
 *
 * Yapışkan hücrenin zemini `--premium-surface`: bu sayfanın panelleri o
 * tonda (UtilityExperience `.page`) ve `--panel-fixed` koyu temada ondan
 * açık kalıyordu; kayan metin etiketin altına girerken iki ton görünürdü.
 *
 * HÜCRE ÜÇ KATMAN: değer (kalın), not (küçük, sönük), kaynak numaraları.
 * Numara aynı sayfadaki kaynak listesine çapa: adresi, okunduğu günü ve
 * belgenin kendi tarihini orada okuyorsun. Tablo kalabalıklaşmasın diye
 * adres hücreye yazılmıyor.
 *
 * "Belirtilmemiş" sönük ve kalın değil: bir değer gibi okunmamalı. Not
 * varsa (ör. "W-8BEN belirtilmemiş ama temettüde %20 yazıyor") yine basılıyor.
 *
 * Renk YOK: hiçbir hücre "iyi" ya da "kötü" diye boyanmıyor. Ucuzu yeşil
 * yapmak bir öneri olurdu ve bu sayfa öneri yapmıyor.
 */

/** Etiket sütunu ve bir değer sütununun taban genişliği, piksel. */
const LABEL_COL_PX = 148;
const VALUE_COL_PX = 168;

export function BrokerTable({
  brokers,
  locale,
  t,
}: {
  brokers: readonly Broker[];
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.brokers;
  const pick = (bi: { tr: string; en: string }) => (locale === "en" ? bi.en : bi.tr);
  const sticky = "sticky left-0 z-10 bg-(--premium-surface)";

  const refs = (broker: Broker, ids: readonly string[] | undefined) => {
    if (!ids || ids.length === 0) return null;
    const numbers = sourceNumbers(broker, ids);
    const order = Object.keys(broker.sources);
    return (
      <span className={styles.refs}>
        {numbers.map((n) => {
          const source = broker.sources[order[n - 1]];
          return (
            <a
              key={n}
              href={`#kaynak-${broker.id}-${n}`}
              className={styles.ref}
              aria-label={L.sourceRef.replace("{n}", String(n)).replace("{title}", pick(source.title))}
            >
              {n}
            </a>
          );
        })}
      </span>
    );
  };

  const cell = (broker: Broker, value: BrokerCell) => (
    <>
      {value.kind === "value" ? (
        <span className="block text-small font-semibold text-strong">{pick(value.value)}</span>
      ) : (
        <span className="block text-small text-muted">{L.unspecified}</span>
      )}
      {value.note && <span className="mt-0.5 block text-tiny leading-snug text-muted">{pick(value.note)}</span>}
      {refs(broker, value.src)}
    </>
  );

  return (
    <Panel id="tarifeler" aria-label={L.tableTitle}>
      <PanelHeader title={L.tableTitle} meta={L.tableMeta.replace("{count}", String(brokers.length))} />
      <p className="max-w-3xl px-4 pb-4 text-sm leading-relaxed text-body sm:px-5">{L.tableLead}</p>
      <ScrollEdges
        className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
        tabIndex={0}
        role="region"
        aria-label={L.tableRegion}
        fixedStart
      >
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth: `${LABEL_COL_PX + BROKER_COLUMNS.length * VALUE_COL_PX}px` }}
        >
          <thead>
            <tr className="border-y border-line-soft text-left text-nano text-muted">
              <th scope="col" className={cn(sticky, "px-4 py-2.5 font-medium sm:px-5")} style={{ width: LABEL_COL_PX }}>
                {L.columns.broker}
              </th>
              {BROKER_COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-3 py-2.5 align-bottom font-medium" style={{ width: VALUE_COL_PX }}>
                  {L.columns[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {brokers.map((broker) => (
              <tr key={broker.id} id={`kurum-${broker.id}`}>
                <th scope="row" className={cn(sticky, "px-4 py-3 text-left align-top font-normal sm:px-5")}>
                  <span className="block text-small font-bold text-strong">{broker.name}</span>
                  {broker.channel && <span className="block text-tiny text-muted">{pick(broker.channel)}</span>}
                  {!broker.domestic && <span className="block text-tiny text-muted">{L.foreign}</span>}
                </th>
                {BROKER_COLUMNS.map((column) => (
                  <td key={column} className="px-3 py-3 align-top">
                    {cell(broker, broker.cells[column])}
                    {column === "license" && broker.counterparty && (
                      <span className="mt-1.5 block text-tiny leading-snug text-muted">
                        {L.counterparty.replace("{name}", pick(broker.counterparty.value))}
                        {refs(broker, broker.counterparty.src)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollEdges>
    </Panel>
  );
}
