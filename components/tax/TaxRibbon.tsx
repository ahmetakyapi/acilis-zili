import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Tax.module.css";

/**
 * KAZANÇTAN VERGİYE ŞERİDİ (6 Kasım, sahibinin sözü: "daha görsel ve
 * gerçekten UI/UX olarak daha iyi seviyeye"). Dolu sonuç kartında büyük
 * sayının hemen altında, iki küçük çizim:
 *
 *   1. Kazançtan vergiye — Net Kazanç, Matrah, Tahmini Vergi aynı TL
 *      ölçeğinde üç kulvar (5 piksel şerit, CLAUDE.md "Grafik dili ince").
 *      Okuyucu "kazancımın ne kadarı vergi" sorusunu çubukların boyundan
 *      okuyor. Eski `.figures` bloğu (Matrah + Dilim, iki ayrı sayı) bu
 *      şeridin içine indi: aynı sayı kartta iki kez yazılmıyor.
 *   2. Kazancın kaynağı — TL kazancın ne kadarı hissenin dolar fiyatından,
 *      ne kadarı kurdaki artıştan geliyor; endeksleme varsa düşülen kısım.
 *      Ayrıştırma TAM (yeni bir vergi kuralı değil, aritmetik özdeşlik):
 *        fiyat = (satış $ − maliyet $) × satış kuru
 *        kur   = maliyet $ × (satış kuru − alış kuru)
 *        endeks = −(endeksli maliyet − TL maliyet)
 *      fiyat + kur + endeks = kazanç (`lib/tax.ts` → `lotResult`). Satırlar
 *      sıfırdan ve İŞARETİYLE çiziliyor: çubuk büyüklük, renk yalnız yön
 *      (CLAUDE.md "Çubuk büyüklüktür, yargı değil").
 *
 * Bileşen hesap yapmıyor: sayıları hesaplayıcı veriyor; boş sonuçtaki
 * "Sonuç Böyle Görünecek" önizlemesi aynı bileşeni varsayımsal örnekle
 * (`TAX_EXAMPLE`) çiziyor, yani okuyucu dolu kartın neye benzeyeceğini
 * boşken görüyor.
 */
export type RibbonLabels = {
  title: string;
  gain: string;
  loss: string;
  base: string;
  tax: string;
  taxNote: string;
  sourceTitle: string;
  price: string;
  priceNote: string;
  fx: string;
  fxNote: string;
  index: string;
  fxShare: string;
};

export type RibbonValues = {
  gainTl: number;
  baseTl: number;
  taxTl: number;
  bracketRate: string;
  /** Kazancın kaynağı; tek kurla hesaplanamayan durumda null. */
  source: { priceTl: number; fxTl: number; indexTl: number } | null;
};

type Lane = { key: string; name: string; note?: string; value: number; tone: string; text: ReactNode };

function LaneList({ lanes, scale, signed }: { lanes: Lane[]; scale: number; signed?: boolean }) {
  return (
    <ul className={styles.ribbonLanes}>
      {lanes.map((lane, i) => {
        const share = scale > 0 ? Math.min(1, Math.abs(lane.value) / scale) : 0;
        return (
          <li key={lane.key} className={styles.ribbonLane} data-tone={lane.tone} style={{ "--i": i } as React.CSSProperties}>
            <span className={styles.ribbonName}>
              {lane.name}
              {lane.note && <span className={styles.ribbonNote}>{lane.note}</span>}
            </span>
            <span className={cn(styles.ribbonValue, "numeral")}>{lane.text}</span>
            <span className={styles.ribbonTrack} aria-hidden data-signed={signed || undefined}>
              <i style={{ "--span": share } as React.CSSProperties} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function TaxRibbon({
  values,
  labels,
  money,
  moneySigned,
  sketch = false,
}: {
  values: RibbonValues;
  labels: RibbonLabels;
  money: (value: number) => string;
  moneySigned: (value: number) => string;
  /** Boş sonuçtaki önizleme: aynı çizim, soluk. */
  sketch?: boolean;
}) {
  const { gainTl, baseTl, taxTl, source } = values;
  const loss = gainTl < 0;
  const scale = Math.max(Math.abs(gainTl), baseTl, taxTl);
  const top: Lane[] = [
    { key: "gain", name: loss ? labels.loss : labels.gain, value: gainTl, tone: loss ? "down" : "up", text: moneySigned(gainTl) },
    { key: "base", name: labels.base, value: baseTl, tone: "base", text: money(baseTl) },
    {
      key: "tax",
      name: labels.tax,
      note: baseTl > 0 ? labels.taxNote.replace("{rate}", values.bracketRate) : undefined,
      value: taxTl,
      tone: "tax",
      text: money(taxTl),
    },
  ];
  const parts: Lane[] = source
    ? [
        { key: "price", name: labels.price, note: labels.priceNote, value: source.priceTl, tone: source.priceTl < 0 ? "down" : "up", text: moneySigned(source.priceTl) },
        { key: "fx", name: labels.fx, note: labels.fxNote, value: source.fxTl, tone: source.fxTl < 0 ? "down" : "up", text: moneySigned(source.fxTl) },
        ...(Math.abs(source.indexTl) >= 0.005
          ? [{ key: "index", name: labels.index, value: source.indexTl, tone: "index", text: moneySigned(source.indexTl) }]
          : []),
      ]
    : [];
  const partScale = Math.max(0, ...parts.map((p) => Math.abs(p.value)));
  /* Kurun payı yalnız iki parça da artıyken anlamlı bir oran. */
  const fxShare =
    source && source.priceTl > 0 && source.fxTl > 0 ? Math.round((source.fxTl / (source.priceTl + source.fxTl)) * 100) : null;

  return (
    <div className={styles.ribbon} data-sketch={sketch || undefined}>
      <div className={styles.ribbonGrid}>
        <figure className={styles.ribbonGroup}>
          <figcaption className={styles.ribbonTitle}>{labels.title}</figcaption>
          <LaneList lanes={top} scale={scale} />
        </figure>
        {parts.length > 0 && (
          <section className={styles.ribbonGroup}>
            <h4 className={styles.ribbonTitle}>{labels.sourceTitle}</h4>
            <LaneList lanes={parts} scale={partScale} signed />
            {fxShare !== null && <p className={styles.ribbonFoot}>{labels.fxShare.replace("{pct}", String(fxShare))}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
