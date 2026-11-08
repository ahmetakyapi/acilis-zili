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
 *      şeridin içine indi: Matrah ve Dilim kartta bir kez yazılıyor.
 *      Tahmini Vergi BİLEREK iki yerde (6 Kasım, inceleme): şeritte ölçek
 *      okunuyor, aşağıdaki vergi bloğunda alt/üst uç ve gerekçesi. İkisi
 *      aynı kaynaktan (`taxTl`/`taxHighTl`) ve aynı biçimde: üst uç alt
 *      uçtan büyükse şerit de ARALIĞI yazar ("22.500,00 ₺ – 40.000,00 ₺")
 *      ve kulvarda alt uç dolu, alt uçtan üst uca soluk (`TaxRange` ile
 *      aynı dil). Önceden yalnız alt uç basılıyordu; kart "X ile Y arası"
 *      derken şerit tek sayı veriyordu — uydurma kesinlik (CLAUDE.md
 *      "Veri Dürüstlüğü" 1).
 *   2. Kazancın kaynağı — TL kazancın ne kadarı hissenin dolar fiyatından,
 *      ne kadarı kurdaki artıştan geliyor; endeksleme varsa düşülen kısım.
 *      Ayrıştırma TAM (yeni bir vergi kuralı değil, aritmetik özdeşlik):
 *        fiyat = (satış $ − maliyet $) × satış kuru
 *        kur   = maliyet $ × (satış kuru − alış kuru)
 *        endeks = −(endeksli maliyet − TL maliyet)
 *      fiyat + kur + endeks = kazanç (`lib/tax.ts` → `lotResult`). Çubuk
 *      sıfırdan ve MUTLAK büyüklükle çiziliyor; işaret çubuğun yönünde
 *      değil, rengindedir (`--up`/`--down`, endeks pirinç tarama) ve
 *      değerin kendisinde (`−`). (6 Kasım, inceleme: yorum "işaretiyle
 *      çiziliyor" diyordu, `data-signed` için hiç CSS yoktu; öznitelik
 *      kalktı, yorum çizilenin doğrusunu söylüyor.) Çubuk büyüklük, renk
 *      yalnız yön (CLAUDE.md "Çubuk büyüklüktür, yargı değil").
 *
 * Bileşen hesap yapmıyor: sayıları hesaplayıcı veriyor; boş sonuçtaki
 * "Sonuç Böyle Görünecek" önizlemesi aynı bileşeni varsayımsal örnekle
 * (`TAX_EXAMPLE`) çiziyor, yani okuyucu dolu kartın neye benzeyeceğini
 * boşken görüyor.
 */
type RibbonLabels = {
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
  fxShareIndexed: string;
};

export type RibbonValues = {
  gainTl: number;
  baseTl: number;
  taxTl: number;
  /** Üst uç (en yüksek dilim); alt uçtan büyükse şerit aralığı yazar. */
  taxHighTl?: number;
  bracketRate: string;
  /** Kazancın kaynağı; tek kurla hesaplanamayan durumda null. */
  source: { priceTl: number; fxTl: number; indexTl: number } | null;
};

type Lane = {
  key: string;
  name: string;
  note?: string;
  value: number;
  /** Aralıklı değerde üst uç: kulvarda `value`dan buraya soluk parça. */
  high?: number;
  tone: string;
  text: ReactNode;
};

function LaneList({ lanes, scale }: { lanes: Lane[]; scale: number }) {
  return (
    <ul className={styles.ribbonLanes}>
      {lanes.map((lane, i) => {
        const share = scale > 0 ? Math.min(1, Math.abs(lane.value) / scale) : 0;
        const spread =
          lane.high !== undefined && scale > 0 ? Math.max(0, Math.min(1, lane.high / scale) - share) : 0;
        return (
          <li key={lane.key} className={styles.ribbonLane} data-tone={lane.tone} style={{ "--i": i } as React.CSSProperties}>
            <span className={styles.ribbonName}>
              {lane.name}
              {lane.note && <span className={styles.ribbonNote}>{lane.note}</span>}
            </span>
            <span className={cn(styles.ribbonValue, "numeral")}>{lane.text}</span>
            <span className={styles.ribbonTrack} aria-hidden>
              <i style={{ "--span": share } as React.CSSProperties} />
              {spread > 0 && <i data-part="spread" style={{ "--from": share, "--span": spread } as React.CSSProperties} />}
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
  const taxHigh = values.taxHighTl !== undefined && values.taxHighTl > taxTl ? values.taxHighTl : undefined;
  const loss = gainTl < 0;
  const scale = Math.max(Math.abs(gainTl), baseTl, taxTl, taxHigh ?? 0);
  const top: Lane[] = [
    { key: "gain", name: loss ? labels.loss : labels.gain, value: gainTl, tone: loss ? "down" : "up", text: moneySigned(gainTl) },
    { key: "base", name: labels.base, value: baseTl, tone: "base", text: money(baseTl) },
    {
      key: "tax",
      name: labels.tax,
      note: baseTl > 0 ? labels.taxNote.replace("{rate}", values.bracketRate) : undefined,
      value: taxTl,
      high: taxHigh,
      tone: "tax",
      /* Aralık biçimi: sitenin aralık tiresi (`spaceRanges`, lib/utils.ts)
         gibi önü bölünmez ince boşluk, ardı ince boşluk. */
      text: taxHigh !== undefined ? `${money(taxTl)}\u202F–\u2009${money(taxHigh)}` : money(taxTl),
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
  /* Kurun payı yalnız iki parça da artıyken anlamlı bir oran. Payda
     fiyat + kur, yani ENDEKSLEME ÖNCESİ TL kazancı; endeksleme varken
     üstteki Net Kazanç endeksleme SONRASI olduğundan cümle bunu açıkça
     söylüyor (6 Kasım, inceleme: "TL kazancının %X'i" üstteki sayıya
     oranlanmış gibi okunuyordu). */
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
            <LaneList lanes={parts} scale={partScale} />
            {fxShare !== null && (
              <p className={styles.ribbonFoot}>
                {(Math.abs(source?.indexTl ?? 0) >= 0.005 ? labels.fxShareIndexed : labels.fxShare).replace("{pct}", String(fxShare))}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
