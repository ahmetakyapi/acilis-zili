import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, formatRange, ladderOf, type Level } from "@/lib/technical";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import { crossedState } from "./PriceMap";
import styles from "./LevelList.module.css";

/* Çubuğun en kısa boyu (kulvarın yarısının oranı): %0,2 uzaklıktaki destek
   de görünür bir im bıraksın. */
const MIN_BAR = 0.03;

type Row =
  | { key: string; kind: "price"; price: number }
  | { key: string; kind: Level["kind"]; tone: Level["kind"] | "sellLevel"; level: Level; distance: number | null };

/**
 * SEVİYE DEFTERİ — fiyat merdiveninin yerine (14 Kasım 2026, görsel tur).
 *
 * `PriceLadder` (31 Ekim) seviyeleri dikey bir fiyat ekseninde çiziyordu:
 * solda ince ray ve şeritler, ortada kıvrımlı bağ çizgileri, sağda itilmiş
 * etiketler. Seviyelerin fiyat EKSENİNDEKİ yeri artık kapaktaki grafikte
 * (`PriceChart`), üstelik fiyatın geçmişiyle birlikte; merdiven aynı
 * geometrinin ikinci, daha zor okunan çizimiydi (rayı ve S eğrilerini okurun
 * çözmesi gerekiyordu; sahibinin 10 Kasım "nokta/çentik" itirazıyla aynı
 * sınıf). Kalan ihtiyaç SAYILAR: her seviyenin adı, fiyatı ve şu anki
 * fiyata uzaklığı. Bu yüzden bir defter: yüksekten düşüğe satırlar, güncel
 * fiyat kendi yerinde koyu satır, her satırda uzaklığın kalın yatay çubuğu
 * (ortadaki çentik fiyat; yukarıdaki seviye sağa, aşağıdaki sola uzanır,
 * ortak ölçek en uzak seviye). Çubuk büyüklüktür, yargı değil: tonu nötr
 * (`--bar-soft`); yön satırın fiyat satırına göre YERİNDEN okunur, geçilmiş
 * seviye tek kelimelik çiple yazılır (`crossedState` kaydı, PriceMap.tsx).
 *
 * Liste gerçek bir `<ol>`; ekran okuyucu ad, fiyat ve uzaklığı sırayla okur.
 * Çubuklar `bar-fill` ile bir kez dolar (`data-draw`).
 *
 * Ölçüm (NVDA, sekiz satır; seviye panelinin boyu, önce canlı): 1440'ta
 * 542 → 457, 390'da 571 → 467 piksel (dayanak künyesi hariç); satır 40
 * piksel; fiyat sütununun sağ kenarı sekiz satırda tek hat (x=616).
 */
export function LevelList({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  verdict,
  priceLabel,
  priceBadge = null,
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
  priceBadge?: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = ladderOf({ entryLow, entryHigh, stop, targets, supports, resistances });
  if (levels.length === 0) return null;
  const sellSide = verdict === "sell";
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const rows: Row[] = levels.map((level) => {
    /* Bölgenin uzaklığı fiyata YAKIN ucundan: fiyat bandın içindeyse 0. */
    const reference =
      level.high !== undefined && price !== null
        ? price > level.high
          ? level.high
          : price < level.price
            ? level.price
            : price
        : level.price;
    return {
      key: `${level.kind}-${level.price}`,
      kind: level.kind,
      tone: level.kind === "target" && sellSide ? "sellLevel" : level.kind,
      level,
      distance: distancePct(reference, price),
    };
  });
  if (price !== null) rows.push({ key: "price", kind: "price", price });
  const sortKey = (row: Row) => (row.kind === "price" ? row.price : (row.level.high ?? row.level.price));
  rows.sort((a, b) => sortKey(b) - sortKey(a));
  const reach = Math.max(0, ...rows.map((row) => (row.kind === "price" ? 0 : Math.abs(row.distance ?? 0))));
  const nameOf = (row: Exclude<Row, { kind: "price" }>) => {
    switch (row.tone) {
      case "target":
        return t.technical.target.replace("{n}", String(row.level.order ?? 1));
      case "sellLevel":
        return t.technical.sellLevel.replace("{n}", String(row.level.order ?? 1));
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

  return (
    <div className={styles.wrap}>
    <ol className={styles.list} data-draw>
      {rows.map((row) => {
        if (row.kind === "price") {
          return (
            <li key={row.key} className={styles.row} data-kind="price">
              <span className={styles.name}>
                {priceLabel}
                {priceBadge && <span className={styles.badge}>{priceBadge}</span>}
              </span>
              <span className={styles.lane} aria-hidden>
                <span className="value-lane">
                  <i className="value-notch" style={{ left: "50%" }} />
                </span>
              </span>
              <strong className={cn(styles.value, "numeral")}>{money(row.price)}</strong>
              <span className={styles.away} />
            </li>
          );
        }
        const crossed = crossedState(row.kind, row.distance);
        const size = row.distance === null || reach === 0 ? 0 : Math.max(MIN_BAR, Math.abs(row.distance) / reach) * 50;
        const up = (row.distance ?? 0) >= 0;
        return (
          <li key={row.key} className={styles.row} data-kind={row.tone}>
            <span className={styles.name}>
              {nameOf(row)}
              {crossed && (
                <b className={styles.crossed} data-state={crossed}>
                  {crossed === "passed" ? t.technical.levelPassed : t.technical.levelBroken}
                </b>
              )}
            </span>
            <span className={styles.lane} aria-hidden>
              <span className="value-lane">
                {row.distance !== null && row.distance !== 0 && (
                  <i
                    className="value-bar bar-fill"
                    data-end={up ? "end" : "start"}
                    style={up ? { left: "50%", width: `${size.toFixed(2)}%` } : { right: "50%", width: `${size.toFixed(2)}%` }}
                  />
                )}
                <i className="value-notch" data-quiet="" style={{ left: "50%" }} />
              </span>
            </span>
            <strong className={cn(styles.value, "numeral")}>
              {row.level.high !== undefined && row.level.high !== row.level.price
                ? formatRange(row.level.price, row.level.high, locale)
                : money(row.level.price)}
            </strong>
            <span className={cn(styles.away, "numeral")}>
              {row.distance !== null && (
                <>
                  <span className="sr-only">{t.technical.levelsNote} </span>
                  {row.kind === "entry" && row.distance === 0 ? t.technicalVisuals.inZone : formatPercent(row.distance, locale, 1)}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}
