import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ladderOf, type Level } from "@/lib/technical";
import { spreadLabels } from "@/lib/technical-visuals";
import { formatPrice } from "@/lib/utils";
import styles from "./LevelScale.module.css";

/* Etiketler arası en az pay (eksenin oranı): 1024'te eksen ~930 piksel,
   en uzun etiket ("1.255,35 $") ~75 piksel → %9,5 ≈ 88 piksel. Ölçek
   768'in altında gösterilmiyor (CSS) — orada aynı plan aşağıdaki fiyat
   merdiveninde dikey ve sığıyor. */
const LABEL_GAP = 0.095;
/* Eksenin iki ucundaki pay: uç etiketin yarısı kutudan taşmasın. */
const EDGE = 0.045;

type Mark = { key: string; kind: Level["kind"] | "sellLevel" | "price"; at: number; name: string; value: string };

/**
 * KAPAKTA TEK YATAY FİYAT ÖLÇEĞİ (8 Kasım, sahibinin isteği: "çok daha
 * görsel, daha anlaşılabilir").
 *
 * Kapağın plan bandı iki-üç kart (Nerede Satılır / Nereden Alınır / Nerede
 * Vazgeçilir) ve her kartın dibinde "Fiyata Uzaklık" yüzdesi: okuyucu
 * "728,80 → 755,26 $" ile "689,40 $"ın fiyata göre nerede durduğunu iki
 * yüzdeden kafasında kuruyordu. CLAUDE.md'nin kuralı: karşılaştırılan
 * büyüklük bir de ÇİZGİ olarak okunur. Kartların üstünde bütün seviyeler
 * ve fiyat tek doğrusal eksende — aralık fiyat mesafesinin kendisi.
 *
 * NEDEN BU KEZ VAR (kayıt TechnicalCover → "SEVİYE ÇİZGİSİ BURADAN
 * KALKTI"): kapaktaki eski çizgi etiketsizdi ve `aria-hidden` bir sürgü
 * gibi okunuyordu. Bu ölçekte her işaretin adı üstte, fiyatı altta; yakın
 * seviyelerin etiketleri itiliyor (`spreadLabels`), çentikler yerinde. Renk
 * merdivenin diliyle aynı: destek/direnç nötr, hedef yükseliş, SAT'ın
 * tepki seviyesi ve stop düşüş, alım bölgesi mavi bant, fiyat koyu mürekkep
 * imleç. Kaynak aynı beş sayı (`ladderOf`) — merdivenle aynı fonksiyon.
 *
 * Çizim `aria-hidden`; sayılar hemen altındaki kartlarda metin olarak var.
 * Giriş: imleç fiyata soldan kayar (bir kez, `--ease-brand`); hareketi
 * azaltana son kare.
 */
export function LevelScale({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  verdict,
  priceLabel,
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
  verdict: VerdictKey;
  priceLabel: string;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = ladderOf({ entryLow, entryHigh, stop, targets, supports, resistances });
  if (price === null || levels.length === 0) return null;
  const points = [price, ...levels.flatMap((level) => (level.high !== undefined ? [level.price, level.high] : [level.price]))];
  const minV = Math.min(...points);
  const maxV = Math.max(...points);
  const span = maxV - minV || maxV * 0.02 || 1;
  /* Eksen değerden orana; iki uçta `EDGE` payı. */
  const at = (value: number) => EDGE + ((value - minV) / span) * (1 - EDGE * 2);
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const sellSide = verdict === "sell";
  const nameOf = (level: Level) => {
    switch (level.kind) {
      case "target":
        return (sellSide ? t.technical.sellLevel : t.technical.target).replace("{n}", String(level.order ?? 1));
      case "resistance":
        return t.technical.resistance;
      case "entry":
        return t.technical.entryZone;
      case "support":
        return t.technical.support;
      case "stop":
        return t.technical.stop;
    }
  };
  const marks: Mark[] = [
    ...levels.map((level) => ({
      key: `${level.kind}-${level.price}`,
      kind: level.kind === "target" && sellSide ? ("sellLevel" as const) : level.kind,
      at: at(level.high !== undefined ? (level.price + level.high) / 2 : level.price),
      name: nameOf(level),
      value:
        level.high !== undefined && level.high !== level.price
          ? `${formatPrice(level.price, locale)}–${money(level.high)}`
          : money(level.price),
    })),
    { key: "price", kind: "price" as const, at: at(price), name: priceLabel, value: money(price) },
  ];
  /* Fiyatın etiketi eksenin ÜSTÜNDE, seviyelerinki ALTINDA: imleç ile en
     yakın seviye çoğu zaman birkaç yüzde içinde (MU: fiyat 694,79, destek
     689,40) ve aynı sırada itilselerdi ikisi de yerinden kayardı. İtme
     yalnız seviyeler arasında. */
  const levelMarks = marks.filter((mark) => mark.kind !== "price");
  const spread = spreadLabels(
    levelMarks.map((mark) => mark.at),
    LABEL_GAP,
    EDGE,
    1 - EDGE,
  );
  const labelAt = marks.map((mark) => (mark.kind === "price" ? mark.at : spread[levelMarks.indexOf(mark)]!));
  const entry = levels.find((level) => level.kind === "entry");
  /* Fiyattan iki yandaki EN YAKIN seviyeye şerit — kartların "Fiyata
     Uzaklık" yüzdesinin çizgisi; renk yön (yukarı yükseliş, aşağı düşüş),
     kartlardaki yüzdenin rengiyle aynı. */
  const edges = levels.flatMap((level) => (level.high !== undefined ? [level.price, level.high] : [level.price]));
  const above = edges.filter((value) => value > price).sort((a, b) => a - b)[0];
  const below = edges.filter((value) => value < price).sort((a, b) => b - a)[0];
  const pct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

  return (
    <div className={styles.scale} aria-hidden>
      <span className={styles.caption}>{t.technical.levelScale}</span>
      <div className={styles.axis}>
        <span className={styles.lane} />
        {entry && entry.high !== undefined && (
          <span className={styles.band} style={{ left: pct(at(entry.price)), width: pct(at(entry.high) - at(entry.price)) }} />
        )}
        {above !== undefined && (
          <span className={styles.leg} data-tone="up" style={{ left: pct(at(price)), width: pct(at(above) - at(price)) }} />
        )}
        {below !== undefined && (
          <span className={styles.leg} data-tone="down" data-from="end" style={{ left: pct(at(below)), width: pct(at(price) - at(below)) }} />
        )}
        {marks.map((mark, index) => {
          const shift = labelAt[index]! - mark.at;
          return (
            <span
              key={mark.key}
              className={styles.mark}
              data-kind={mark.kind}
              /* Fiyat etiketi uca yakınsa ortalanmıyor, içe yaslanıyor. */
              data-align={mark.kind === "price" ? (mark.at < 0.14 ? "start" : mark.at > 0.86 ? "end" : undefined) : undefined}
              style={{ left: pct(mark.at) }}
            >
              <span className={styles.tick} />
              {/* İtilen etiketin kayması eksen oranında; `cqw` eksenin kendi
                  genişliği (eksen `container-type: inline-size`). */}
              <span className={styles.label} style={{ "--shift": `${(shift * 100).toFixed(2)}cqw` } as React.CSSProperties}>
                <small>{mark.name}</small>
                <b className="numeral">{mark.value}</b>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
