import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, ladderOf, type Level, type TechnicalCopy } from "@/lib/technical";
import { cn, directionOf, directionText, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

type Rung = Level | { kind: "price"; price: number };

/**
 * Seviye merdiveni — yüksekten düşüğe, fiyat kendi basamağında.
 *
 * Kartın çizgisi "nerede" sorusunu gösteriyor; burası "ne kadar uzakta"yı
 * sayıyla veriyor. Her satırda fiyata uzaklık var: "Hedef 1 · +%4,2" alım
 * kararını bir cümleden daha hızlı anlatıyor.
 *
 * UZAKLIK SEVİYEDEN FİYATA DEĞİL FİYATTAN SEVİYEYE: "hedefe %4,2 var"
 * okunuşu. Yani hedef için pozitif, stop için negatif; işaret yönü söylüyor.
 *
 * FİYAT SATIRININ ADI ÇAĞIRANDAN GELİR. Satır bir süre koşulsuz "Şu An"
 * yazıyordu; kapak aynı sayfada seans dışında "Son Fiyat", kotasyon yokken
 * "Analiz Anında" derken merdiven eski fiyata "Şu An" diyordu. Etiket
 * kapakla tek yerde hesaplanıyor ve buraya geçiyor.
 */
export function LevelLadder({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  copy,
  verdict,
  priceLabel,
  lang,
  locale,
  t,
}: {
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  copy: TechnicalCopy;
  verdict: VerdictKey;
  priceLabel: string;
  /** Notların dili — İngilizce sayfada çevrilmemiş metin Türkçe okunur. */
  lang: string;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = ladderOf({ entryLow, entryHigh, stop, targets, supports, resistances });
  const rungs: Rung[] = [...levels];
  if (price !== null) {
    /* Fiyat, üst ucu kendisinden düşük olan ilk basamağın önüne. Alım
       bölgesinin İÇİNDEYSE bölgenin hemen üstünde duruyor: "bölgedesin". */
    const at = rungs.findIndex((rung) => ("high" in rung && rung.high !== undefined ? rung.high : rung.price) < price);
    rungs.splice(at === -1 ? rungs.length : at, 0, { kind: "price", price });
  }

  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const labelOf = (rung: Rung): string => {
    switch (rung.kind) {
      case "target":
        /* SAT'ta hedef "tepkide satılacak seviye" (bkz. LevelTrack). */
        return (verdict === "sell" ? t.technical.sellLevel : t.technical.target).replace(
          "{n}",
          String(rung.order ?? 1),
        );
      case "resistance":
        return t.technical.resistance;
      case "entry":
        return t.technical.entryZone;
      case "support":
        return t.technical.support;
      case "stop":
        return t.technical.stop;
      case "price":
        return priceLabel;
    }
  };
  const noteOf = (rung: Rung): string | null => {
    if (rung.kind === "entry") return copy.entryNote ?? null;
    if (rung.kind === "stop") return copy.stopNote ?? null;
    if (rung.kind === "target" && rung.order === 1) return copy.targetsNote ?? null;
    return null;
  };

  return (
    <ol className={styles.ladder} data-motion-stagger>
      {rungs.map((rung) => {
        const value =
          rung.kind === "entry" && "high" in rung && rung.high !== undefined
            ? rung.price === rung.high
              ? money(rung.price)
              : `${money(rung.price)} – ${money(rung.high)}`
            : money(rung.price);
        /* Alım bölgesinde uzaklık bölgenin ÜST ucuna: fiyat oraya indiğinde
           bölgeye girmiş olur. */
        const reference =
          rung.kind === "entry" && "high" in rung && rung.high !== undefined ? rung.high : rung.price;
        const distance = rung.kind === "price" ? null : distancePct(reference, price);
        const note = noteOf(rung);
        return (
          <li
            key={`${rung.kind}-${rung.price}`}
            className={styles.rung}
            data-kind={rung.kind === "target" && verdict === "sell" ? "sellLevel" : rung.kind}
          >
            <span aria-hidden className={styles.rungMark} />
            <span className={styles.rungLabel}>{labelOf(rung)}</span>
            <span className={styles.rungPrice}>{value}</span>
            <span className={cn(styles.rungDistance, distance !== null && directionText(directionOf(distance)))}>
              {distance !== null ? formatPercent(distance, locale, 1) : ""}
            </span>
            {note && (
              <span className={styles.rungNote} lang={lang}>
                {note}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
