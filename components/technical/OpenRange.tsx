import { CaretDown, CaretUp, HourglassMedium } from "@phosphor-icons/react/dist/ssr";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  openPlan,
  openRangeLayout,
  openWhere,
  type OpenPlan,
  type OpenRangeLayout,
  type OpenSide,
} from "@/lib/technical";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import { openSideLabel, openWatchText } from "./open-plan";
import styles from "./Technical.module.css";

/* Şeridin üstündeki yüzde ancak şerit yeterince uzunsa eksende: kartta
   ray ~300–520 piksel ve "▾ %13,3" etiketi ~50 piksel, yani payın %18'i
   altında etiket imlece ya da çentiğe biniyordu. Sığmayan yüzde eksenden
   kalkıp ucun etiketine iner (kayıp yok). Detayda eksen ~800 piksel. */
const AXIS_LABEL_MIN = { card: 0.18, lg: 0.1 } as const;

type Size = keyof typeof AXIS_LABEL_MIN;

/* Detaydaki fiyat etiketi (~150 piksel) eksenin bu payından yakın uçta
   ortalanırsa kutudan taşıyor. */
const PRICE_EDGE = 0.15;

/** Kartın ve detayın ortak kapısı: yalnız bölgesiz TUT, fiyat ve en az bir seviye varken. */
export function openRangeOf(
  verdict: VerdictKey,
  price: number | null,
  row: {
    entryLow: number | null;
    entryHigh: number | null;
    targets: readonly number[];
    supports: readonly number[];
    resistances: readonly number[];
  },
): { open: OpenPlan; layout: OpenRangeLayout; price: number } | null {
  if (verdict !== "hold" || price === null) return null;
  const open = openPlan(verdict, price, row);
  if (!open || openWhere(open) === null) return null;
  const layout = openRangeLayout(open, price);
  return layout ? { open, layout, price } : null;
}

/**
 * Bölgesiz TUT — "alım bölgesi yok" bir boşluk değil, bir DURUM (31 Ekim,
 * sahibinin isteği: "SanDisk'te alım kısmı yok … böyle olunca ne anlama
 * geliyor bilmiyorum, iyileştirelim").
 *
 * Eskiden bölgeli kartın kalıbı boş dolduruluyordu: "Nereden Alınır — Bölge
 * Yok · Destek 998,19 $", "Nerede Satılır — Direnç 1.255,35 $" ve altında
 * "Desteğe / Dirence" bacakları. Soru başlıkta duruyor, cevabı "yok"tu;
 * direnç "satış yeri" gibi okunuyordu. Şimdi üç parça:
 *   · DURUMUN ADI. Pirinç bir etiket ("Alım Bölgesi Yok", kum saati — TUT
 *     görüşünün kendi rengi, "bekleme") ve yanında fiyatın yeri ("Fiyat
 *     Destekle Direnç Arasında"; `openWhere`). Yeşil YOK: alım bölgesi yok,
 *     yükseliş rengi "burada alınır" diye okunurdu. Mavi de yok: mavi
 *     sitede etkileşim ve alım bandı.
 *   · EKSEN. Destek ve direnç eksenin iki ucu, fiyat koyu mürekkep imleç
 *     (merdiven ve kart rayıyla aynı imleç), fiyattan iki uca nötr şerit ve
 *     üstünde uzaklık. Geçilmiş seviye geçilmiş diye: şerit seviyeden
 *     fiyata, yön renginde (`openRangeLayout`).
 *   · KOŞUL CÜMLESİ (yalnız kartta). İki seviye ve kırılırlarsa ne olacağı,
 *     rutinin kendi kuralından (`openWatchText`). Detayda aynı cümle kapağın
 *     "Planın Okuması" kutusunda, burada tekrar edilmiyor.
 * Detayda (`size="lg"`) eksen büyük ve altında iki seviye kartı (ad, sayı,
 * fiyata uzaklık). Çizim `aria-hidden`; sayıların tamamı metinde.
 */
export function OpenRange({
  open,
  layout,
  price,
  priceLabel = null,
  size = "card",
  locale,
  t,
}: {
  open: OpenPlan;
  layout: OpenRangeLayout;
  /** İmlecin fiyatı (`layout.price` yalnız konumu taşıyor). */
  price: number;
  /** Detayda imlecin üstündeki ad ("Son Fiyat"); kartta fiyat zaten üstte. */
  priceLabel?: string | null;
  size?: Size;
  locale: Locale;
  t: Dictionary;
}) {
  const op = t.technical.openPlan;
  const where = openWhere(open);
  if (!where) return null;
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const pct = (value: number) => formatPercentPlain(value, locale, 1);
  const at = (value: number) => `${(value * 100).toFixed(2)}%`;
  const lg = size === "lg";
  const fits = (side: "buy" | "sell") => {
    const seg = layout.segments.find((s) => s.side === side);
    return seg ? seg.to - seg.from >= AXIS_LABEL_MIN[size] : true;
  };
  const caret = (side: "buy" | "sell") =>
    side === "buy" ? <CaretDown size={9} weight="fill" aria-hidden /> : <CaretUp size={9} weight="fill" aria-hidden />;
  const ends: { side: "buy" | "sell"; data: OpenSide }[] = [];
  if (open.buy) ends.push({ side: "buy", data: open.buy });
  if (open.sell) ends.push({ side: "sell", data: open.sell });

  return (
    <div className={styles.openRange} data-size={size} data-where={where}>
      <p className={styles.openHead}>
        <span className={styles.openTag}>
          <HourglassMedium size={13} weight="bold" aria-hidden />
          {op.noZoneTitle}
        </span>
        <span className={styles.openState}>{op.state[where]}</span>
      </p>

      <div className={styles.openAxis} aria-hidden>
        <span className={styles.openLane} />
        {layout.segments.map((seg) => (
          <span
            key={seg.side}
            className={styles.openSeg}
            data-tone={seg.tone}
            data-side={seg.side}
            style={{ left: at(seg.from), width: at(seg.to - seg.from) }}
          >
            {fits(seg.side) && (
              <b className={cn(styles.openPct, "numeral")}>
                {caret(seg.side)}
                {pct(seg.pct)}
              </b>
            )}
          </span>
        ))}
        {layout.support !== null && <span className={styles.openTick} style={{ left: at(layout.support) }} />}
        {layout.resistance !== null && <span className={styles.openTick} style={{ left: at(layout.resistance) }} />}
        {/* İmlecin üstündeki fiyat uca yakınsa ortalanmıyor, içe yaslanıyor:
            ortalı etiket eksenin dışına taşardı. */}
        <span
          className={styles.openNow}
          style={{ left: at(layout.price) }}
          data-align={layout.price < PRICE_EDGE ? "start" : layout.price > 1 - PRICE_EDGE ? "end" : undefined}
        >
          {lg && priceLabel && (
            <b>
              <span>{priceLabel}</span> <span className="numeral">{money(price)}</span>
            </b>
          )}
        </span>
      </div>

      {lg ? (
        <dl className={styles.openLevels}>
          {ends.map(({ side, data }) => (
            <div key={side} data-side={side} data-state={data.state}>
              <dt>{openSideLabel(data, "hold", t)}</dt>
              <dd className="numeral">{money(data.level)}</dd>
              <dd className={styles.openAway}>
                {data.state === "at" || data.pct === null ? (
                  op.atLevel
                ) : (
                  <>
                    {t.technical.levelsNote}{" "}
                    <b className="numeral">
                      {caret(side)}
                      {pct(data.pct)}
                    </b>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className={styles.openEnds}>
          {ends.map(({ side, data }) => (
            <div key={side} data-side={side}>
              <dt>{openSideLabel(data, "hold", t)}</dt>
              <dd className="numeral">
                {money(data.level)}
                {/* Uzaklık eksende yazılı; ekran okuyucu ve eksene sığmayan
                    kısa şerit için burada. */}
                {data.pct !== null && data.state !== "at" && (
                  <span className={fits(side) ? "sr-only" : styles.openEndPct}>
                    {" "}
                    · {pct(data.pct)}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!lg && <p className={styles.openWatch}>{openWatchText(open, money, t)}</p>}
    </div>
  );
}
