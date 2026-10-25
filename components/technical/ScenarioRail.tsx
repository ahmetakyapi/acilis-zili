import { InView } from "@/components/ai/InView";
import ai from "@/components/ai/AnalysisVisuals.module.css";
import type { Dictionary, Locale } from "@/lib/i18n";
import { triggerMath } from "@/lib/ai-analysis-core";
import type { TechnicalSnapshot } from "@/lib/technical";
import { scenarioPath } from "@/lib/technical-visuals";
import { cn, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./TechnicalVisuals.module.css";

/** Eksenin iki ucundaki pay (aralığın oranı) — uç seviye kenara yapışmasın. */
const EDGE_PAD = 0.06;

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/**
 * SENARYO RAYI — iki paragrafı fiyat ekseninde çiziyor (25 Ekim).
 *
 * "Senaryolar" iki kutu metindi; sayıların fiyata göre nerede durduğu
 * okuyucunun kafasında kuruluyordu. Claude ekranının senaryo ekseni
 * (`components/ai/AnalysisVisuals.tsx` → `ScenarioAxis`) aynı soruyu çizimle
 * cevaplıyor: düşüş tetiği ← fiyat → yükseliş tetiği, araya iki kulvar,
 * altında uzaklıklar. Bu bileşen o eksenin GÖRSEL DİLİNİ yeniden kullanıyor
 * (aynı CSS sınıfları, aynı `InView` girişi, aynı `triggerMath`); veri
 * tarafı farklı olduğu için bileşenin kendisi değil — orada seviyeler
 * raporun alanlarından, burada senaryo metninden (`scenarioPath`: yalnız
 * kayıttaki bir seviyeyle birebir eşleşen sayılar).
 *
 * Eksen tetiklerle bitmiyor: metnin saydığı sonraki duraklar (hedefler,
 * bant, stop) da eksende ince çentik, adları altta zincir hâlinde.
 */
export function ScenarioRail({
  bull,
  bear,
  lang,
  price,
  priceLabel,
  levels,
  snapshot,
  locale,
  t,
}: {
  bull: string;
  bear: string;
  /** Senaryo metninin dili (çeviri yoksa "tr"). */
  lang: Locale;
  price: number | null;
  priceLabel: string;
  levels: {
    entryLow: number | null;
    entryHigh: number | null;
    stop: number | null;
    targets: readonly number[];
    supports: readonly number[];
    resistances: readonly number[];
  };
  snapshot: TechnicalSnapshot;
  locale: Locale;
  t: Dictionary;
}) {
  if (price === null || !(price > 0)) return null;
  const v = t.technicalVisuals;
  const pivots = snapshot.pivots;
  const known = [
    levels.entryLow,
    levels.entryHigh,
    levels.stop,
    ...levels.targets,
    ...levels.supports,
    ...levels.resistances,
    snapshot.sma20,
    snapshot.sma50,
    snapshot.sma100,
    snapshot.sma200,
    snapshot.high52,
    snapshot.low52,
    ...(pivots ? [pivots.p, pivots.r1, pivots.r2, pivots.s1, pivots.s2] : []),
    ...snapshot.swingHighs,
    ...snapshot.swingLows,
  ].filter((value): value is number => typeof value === "number" && value > 0);

  const up = scenarioPath(bull, lang, known, "up", price, [...levels.resistances, ...levels.targets]);
  const down = scenarioPath(
    bear,
    lang,
    known,
    "down",
    price,
    [...levels.supports, ...(levels.stop === null ? [] : [levels.stop])],
  );
  if (!up || !down) return null;

  const all = [price, up.trigger, down.trigger, ...up.path, ...down.path];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * EDGE_PAD;
  const min = lo - pad;
  const span = hi + pad - min;
  const at = (value: number) => (value - min) / span;
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const math = triggerMath(price, up.trigger, down.trigger, snapshot.atr14);
  /* Değer grupları bölünmez (25 Ekim): telefonda künye "·" işaretinden
     kırılıp "Düşüş Tetiği · / 344,21 $" diye iki satıra dağılıyordu. Seviye
     adın altında kendi satırında, yüzde ve ATR ayrı `nowrap` gruplar —
     satır yalnız iki grubun ARASINDAN kırılabilir. */
  const atr = (value: number | null) =>
    value === null ? null : <span className={styles.railGroup}>{` · ${formatPrice(value, locale, { digits: 1 })} ATR`}</span>;
  const bullName = up.source === "text" ? v.railBullTrigger : v.railNearestResistance;
  const bearName = down.source === "text" ? v.railBearTrigger : v.railNearestSupport;
  /* Para birimi zincirin yalnız sonunda (`formatRange` ile aynı karar). */
  const chain = (values: number[]) =>
    values.map((value, i) => (i === values.length - 1 ? money(value) : formatPrice(value, locale))).join(" → ");

  return (
    <figure className={styles.rail}>
      <figcaption className={styles.railCaption}>{v.railTitle}</figcaption>
      <InView
        className={ai.axis}
        role="img"
        aria-label={`${v.railTitle}: ${bearName} ${money(down.trigger)}, ${priceLabel} ${money(price)}, ${bullName} ${money(up.trigger)}`}
      >
        <div className={cn(ai.axisTrack, styles.railTrack)} aria-hidden style={{ "--at": at(price) } as Vars}>
          <span
            className={styles.railSeg}
            data-tone="down"
            style={{ "--from": at(down.trigger), "--to": at(price) } as Vars}
          />
          <span
            className={styles.railSeg}
            data-tone="up"
            style={{ "--from": at(price), "--to": at(up.trigger) } as Vars}
          />
          {/* Sonraki duraklar: tetiğin ötesindeki yol, aynı yönün soluk tonu. */}
          {down.path.length > 0 && (
            <span
              className={styles.railSeg}
              data-tone="down"
              data-path
              style={{ "--from": at(down.path[down.path.length - 1]), "--to": at(down.trigger) } as Vars}
            />
          )}
          {up.path.length > 0 && (
            <span
              className={styles.railSeg}
              data-tone="up"
              data-path
              style={{ "--from": at(up.trigger), "--to": at(up.path[up.path.length - 1]) } as Vars}
            />
          )}
          {[...down.path.map((value) => ["down", value] as const), ...up.path.map((value) => ["up", value] as const)].map(
            ([tone, value]) => (
              <span key={`${tone}-${value}`} className={styles.railTick} data-tone={tone} style={{ "--x": at(value) } as Vars} />
            ),
          )}
          <span className={styles.railTick} data-tone="down" data-trigger style={{ "--x": at(down.trigger) } as Vars} />
          <span className={styles.railTick} data-tone="up" data-trigger style={{ "--x": at(up.trigger) } as Vars} />
          <span className={ai.axisNow}>
            <span className={styles.railNowLabel}>
              {priceLabel} · {money(price)}
            </span>
          </span>
        </div>
        {/* Uç künyeleri yalnız yol yokken: o zaman eksenin iki ucu tetiklerin
            kendisi. Yol varsa tetik eksenin ortasında kalıyor ve uçta onun
            adını yazmak yanlış yeri gösterirdi; tetik o zaman uzaklık
            satırında adıyla, yol zincirde. */}
        {down.path.length === 0 && up.path.length === 0 && (
          <div className={ai.axisEnds}>
            <span data-tone="down">
              <b className="figure">{money(down.trigger)}</b>
              {bearName}
            </span>
            <span data-tone="up">
              <b className="figure">{money(up.trigger)}</b>
              {bullName}
            </span>
          </div>
        )}
        {math && (
          <dl className={ai.axisMath}>
            <div>
              <dt>{bearName} <b className="figure">{money(down.trigger)}</b></dt>
              <dd className="figure" data-tone="down"><span className={styles.railGroup}>{formatPercent(math.downPct, locale, 1)}</span>{atr(math.downAtr)}</dd>
            </div>
            <div>
              <dt>{v.railRatio}</dt>
              <dd className="figure">{math.ratio === null ? "" : formatPrice(math.ratio, locale, { digits: 2 })}</dd>
            </div>
            <div>
              <dt>{bullName} <b className="figure">{money(up.trigger)}</b></dt>
              <dd className="figure" data-tone="up"><span className={styles.railGroup}>{formatPercent(math.upPct, locale, 1)}</span>{atr(math.upAtr)}</dd>
            </div>
          </dl>
        )}
        {(down.path.length > 0 || up.path.length > 0) && (
          <dl className={styles.railPaths}>
            <div data-tone="down">
              <dt>{v.railPath}</dt>
              <dd className="figure">{chain(down.path)}</dd>
            </div>
            <div data-tone="up">
              <dt>{v.railPath}</dt>
              <dd className="figure">{chain(up.path)}</dd>
            </div>
          </dl>
        )}
      </InView>
      <p className={styles.railNote}>{v.railNote}</p>
    </figure>
  );
}
