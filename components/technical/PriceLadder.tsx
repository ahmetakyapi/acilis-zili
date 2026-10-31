import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  distancePct,
  formatRange,
  ladderOf,
  openPlan,
  priceLadderLayout,
  type LadderMark,
} from "@/lib/technical";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import { crossedState } from "./PriceMap";
import styles from "./Technical.module.css";

/* Etiket bloğunun dikey payı: ad satırı (12/16) + fiyat satırı (15/19) ve
   arada 5 piksel. 390'da ölçüldü: blok 36 piksel, 40 ile iki komşu blok
   arasında 4 piksel hava kalıyor. */
const LABEL_GAP = 40;
/* Eksenin üst ve alt payı: en uç seviyenin etiketi kutudan taşmasın
   (bloğun yarısı + 8). */
const INSET = 30;
const MIN_HEIGHT = 360;
/* Stop varken altına ayrılan şerit: "plan geçersiz" alanı görünür olsun ve
   künyesi sığsın. Şerit yoksa stop en alttaki seviyeyse alan iki piksele
   iniyordu (eski haritanın aynı dersi, PriceMap → VOID_STRIP). */
const STOP_PAD = 40;
/* Etiket ile eksen arasındaki bağ çizgilerinin alanı (SVG genişliği). */
const LINK_W = 28;

type Segment = { from: number; to: number; tone: "up" | "down" | "flat" };

/**
 * Fiyat merdiveni — detay sayfasında bütün seviyeler TEK GÖRSEL EKSENDE
 * (31 Ekim, sahibinin isteği: "çok daha görsel bir şekilde ele alalım,
 * teknik analiz için çok önemli").
 *
 * Yerine geçtiği `PriceMap presentation="levels"` bir tabloydu: eşit
 * aralıklı satırlar ve her satırda bir uzaklık çubuğu; altındaki not
 * "satır aralıkları fiyat mesafesi değildir" diye uyarıyordu. Merdivende
 * aralık fiyat mesafesinin TA KENDİSİ (doğrusal ölçek, `priceLadderLayout`):
 *   · her seviye eksen boyunca ince bir yatay çizgi — direnç ve destek
 *     nötr (`--line-strong`), hedef yükseliş, SAT'ın tepki seviyesi ve stop
 *     düşüş renginde. Renk yönden geliyor, "yeşil iyi" süsünden değil.
 *   · alım bölgesi mavi bir bant (sitenin etkileşim mavisi; bant bir alan,
 *     seviye değil), stopun altı soluk düşüş yıkaması ve adı.
 *   · güncel fiyat koyu mürekkep bir imleç — mavi banttan ayrılsın diye mavi
 *     değil.
 *   · solda 5 piksellik kulvar (`--line-soft`) ve üstünde fiyattan planın
 *     iki ucuna şeritler: AL/TUT'ta ilk hedefe (yükseliş) ve stopa (düşüş),
 *     plansız görüşte kart rayıyla aynı bacaklar (`openPlan`). Grafik dili
 *     sitenin geri kalanıyla aynı: kulvar üstünde ince şerit.
 * Etiketler sağda; yakın seviyelerde çakışmasınlar diye itiliyor ve ince bir
 * bağ çizgisi etiketi seviyenin asıl yerine bağlıyor.
 *
 * Çizim `aria-hidden`; etiket listesi gerçek bir `<ol>` (yüksekten düşüğe),
 * ekran okuyucu seviyeleri adı, fiyatı ve uzaklığıyla okuyor.
 */
export function PriceLadder({
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
  if (levels.length + (price !== null ? 1 : 0) < 2) return null;

  const { marks, height, scale } = priceLadderLayout(levels, price, {
    gap: LABEL_GAP,
    inset: INSET,
    minHeight: MIN_HEIGHT,
    bottomPad: stop !== null ? STOP_PAD : 0,
    /* Etiket bloğu fiyat satırından 27 piksel yukarı uzanıyor (CSS,
       `.ladderLabel`); en üstteki blok kutudan taşmasın. */
    labelTop: 30,
    labelBottom: 12,
  });
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const sellSide = verdict === "sell";
  const kindOf = (mark: LadderMark) => (mark.kind === "target" && sellSide ? "sellLevel" : mark.kind);
  const labelOf = (mark: LadderMark): string => {
    switch (mark.kind) {
      case "target":
        return (sellSide ? t.technical.sellLevel : t.technical.target).replace("{n}", String(mark.order ?? 1));
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

  /* Kulvar şeritleri. Planlı görüşte fiyattan ilk hedefe ve stopa — kart
     rayındaki risk/getiri bacaklarının dikey karşılığı, ama çapası fiyat:
     burada okunan "şu andan nereye kadar". Plansızda `PlanRail` ile aynı
     üç hâl (seviyeye doğru, geçilmiş). */
  const segments: Segment[] = [];
  if (price !== null) {
    const open = openPlan(verdict, price, { entryLow, entryHigh, targets, supports, resistances });
    if (open) {
      const { buy, sell } = open;
      if (buy && buy.state !== "at") {
        segments.push(buy.state === "beyond" ? { from: buy.level, to: price, tone: "down" } : { from: price, to: buy.level, tone: "flat" });
      }
      if (sell && sell.state !== "at") {
        segments.push(
          sell.state === "beyond"
            ? { from: sell.level, to: price, tone: "up" }
            : { from: price, to: sell.level, tone: sellSide ? "down" : "flat" },
        );
      }
    } else {
      const nextTarget = [...targets].filter((value) => value > price).sort((a, b) => a - b)[0];
      if (nextTarget !== undefined) segments.push({ from: price, to: nextTarget, tone: "up" });
      if (stop !== null && stop < price) segments.push({ from: price, to: stop, tone: "down" });
    }
  }

  const stopY = stop !== null ? scale(stop) : null;
  const bandTop = entryLow !== null && entryHigh !== null ? scale(entryHigh) : null;
  const bandBottom = entryLow !== null && entryHigh !== null ? scale(entryLow) : null;
  const priceY = price !== null ? scale(price) : null;

  return (
    <>
    <div
      className={styles.ladder}
      data-verdict={verdict}
      style={{ height, "--link-w": `${LINK_W}px` } as React.CSSProperties}
    >
      {/* STOP ALTI MERDİVENİN TAMAMINDA, etiketlerin arkasında da: stopun
          altındaki destek de "plan geçersiz" alanında duruyor ve bunu
          görmek okumanın parçası. Künyesi alanın içinde değil merdivenin
          altında, lejant satırı olarak: çizim kolonunda 390'da üç satıra
          sarıyordu (kolon 110 piksel, ölçüldü), tam genişlikte en alttaki
          etiketin altına girebiliyordu. */}
      {stopY !== null && <span className={styles.ladderVoid} style={{ top: stopY }} aria-hidden />}
      <div className={styles.ladderPlot} aria-hidden>
        {bandTop !== null && bandBottom !== null && (
          <span className={styles.ladderBand} style={{ top: bandTop, height: Math.max(6, bandBottom - bandTop) }} />
        )}
        <span className={styles.ladderLane} />
        {segments.map((segment) => {
          const a = scale(segment.from);
          const b = scale(segment.to);
          return (
            <span
              key={`${segment.tone}-${segment.from}-${segment.to}`}
              className={styles.ladderSeg}
              data-tone={segment.tone}
              style={{ top: Math.min(a, b), height: Math.max(4, Math.abs(b - a)) }}
            />
          );
        })}
        {marks
          .filter((mark) => mark.kind !== "price" && mark.kind !== "entry")
          .map((mark) => (
            <span
              key={`line-${mark.kind}-${mark.price}`}
              className={styles.ladderLine}
              data-kind={kindOf(mark)}
              style={{ top: mark.y }}
            />
          ))}
        {priceY !== null && (
          <>
            <span className={styles.ladderNowLine} style={{ top: priceY }} />
            <span className={styles.ladderNow} style={{ top: priceY }} />
          </>
        )}
      </div>

      {/* Bağ çizgileri: seviyenin asıl yerinden (sol, `y`) etiketin itilmiş
          yerine (sağ, `labelY`). Aynı hizadaysa düz bir çizgi; yumuşak S
          eğrisi, çünkü kırık çizgi komşu bağlarla kesişince hangi etiketin
          hangi seviyeye gittiği okunmuyordu. */}
      <svg
        className={styles.ladderLinks}
        width={LINK_W}
        height={height}
        viewBox={`0 0 ${LINK_W} ${height}`}
        aria-hidden
        focusable="false"
      >
        {marks.map((mark) => (
          <path
            key={`link-${mark.kind}-${mark.price}`}
            data-kind={kindOf(mark)}
            d={`M0 ${mark.y.toFixed(1)} C${LINK_W / 2} ${mark.y.toFixed(1)} ${LINK_W / 2} ${mark.labelY.toFixed(1)} ${LINK_W} ${mark.labelY.toFixed(1)}`}
          />
        ))}
      </svg>

      <ol className={styles.ladderLabels}>
        {marks.map((mark) => {
          const kind = kindOf(mark);
          const reference = mark.kind === "entry" && "high" in mark && mark.high !== undefined ? mark.high : mark.price;
          const distance = mark.kind === "price" ? null : distancePct(reference, price);
          const crossed = mark.kind === "price" ? null : crossedState(mark.kind, distance);
          const value =
            mark.kind === "entry" && "high" in mark && mark.high !== undefined
              ? formatRange(mark.price, mark.high, locale)
              : money(mark.price);
          return (
            <li
              key={`label-${mark.kind}-${mark.price}`}
              className={styles.ladderLabel}
              data-kind={kind}
              style={{ top: mark.labelY }}
            >
              <span className={styles.ladderName}>
                {labelOf(mark)}
                {mark.kind === "price" && priceBadge && <span className={styles.delayBadge}>{priceBadge}</span>}
                {crossed && (
                  <b className={styles.mapCrossed} data-state={crossed}>
                    {crossed === "passed" ? t.technical.levelPassed : t.technical.levelBroken}
                  </b>
                )}
              </span>
              <span className={styles.ladderValue}>
                <strong className="numeral">{value}</strong>
                {distance !== null && (
                  <span className={cn(styles.ladderAway, "numeral")}>
                    <span className="sr-only">{t.technical.levelsNote} </span>
                    {formatPercent(distance, locale, 1)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
    {stop !== null && (
      <p className={styles.ladderNote}>
        <i aria-hidden />
        {money(stop)} · {t.technical.zoneBelowStop}
      </p>
    )}
    </>
  );
}
