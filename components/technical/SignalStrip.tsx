import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, indicatorSignals, type TechnicalSnapshot } from "@/lib/technical";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

type Tile = { key: string; label: string; value: string; detail: string | null; tone: "up" | "down" | "flat" | "primary" };

/**
 * Gösterge özeti — dört kelime: trend, momentum, hacim, 52 haftalık yer.
 *
 * Altı panel göstergeyi bilen okuyucu için ayrıntı; bu şerit "yani ne
 * diyor" sorusunun cevabı. Kelimeler `indicatorSignals`tan (kural orada),
 * altındaki künye kelimenin dayandığı sayıyı söylüyor — "Yukarı" tek
 * başına bir iddia olurdu, "50 ve 200 Günlüğün Üstünde" bir ölçüm.
 */
export function SignalStrip({
  snapshot,
  price,
  locale,
  t,
}: {
  snapshot: TechnicalSnapshot;
  price: number | null;
  locale: Locale;
  t: Dictionary;
}) {
  const { trend, momentum, volume } = indicatorSignals(snapshot, price);
  const tiles: Tile[] = [];

  if (trend) {
    const detail =
      trend.above50 !== null && trend.above200 !== null
        ? trend.above50 && trend.above200
          ? t.technical.trendAboveBoth
          : !trend.above50 && !trend.above200
            ? t.technical.trendBelowBoth
            : trend.above50
              ? t.technical.trendAbove50Below200
              : t.technical.trendBelow50Above200
        : trend.above50 !== null
          ? (trend.above50 ? t.technical.aboveMa : t.technical.belowMa).replace("{n}", "50")
          : (trend.above200 ? t.technical.aboveMa : t.technical.belowMa).replace("{n}", "200");
    tiles.push({
      key: "trend",
      label: t.technical.signalTrend,
      value: trend.tone === "up" ? t.technical.trendUp : trend.tone === "down" ? t.technical.trendDown : t.technical.trendMixed,
      detail,
      tone: trend.tone === "up" ? "up" : trend.tone === "down" ? "down" : "flat",
    });
  }

  if (momentum) {
    const rsi = formatPrice(momentum.rsi, locale, { digits: 0 });
    tiles.push({
      key: "momentum",
      label: t.technical.signalMomentum,
      value:
        momentum.tone === "overbought"
          ? t.technical.rsiOverbought
          : momentum.tone === "oversold"
            ? t.technical.rsiOversold
            : momentum.tone === "strong"
              ? t.technical.momentumStrong
              : t.technical.momentumWeak,
      detail:
        momentum.macdAbove === null
          ? t.technical.momentumDetailRsi.replace("{rsi}", rsi)
          : t.technical.momentumDetail
              .replace("{rsi}", rsi)
              .replace("{macd}", momentum.macdAbove ? t.technical.macdAbove : t.technical.macdBelow),
      /* Aşırı alım bir uyarı (düşüş rengi), aşırı satım bir fırsat işareti
         (yükseliş rengi) — RSI panelindeki renklendirmeyle aynı. */
      tone:
        momentum.tone === "overbought" ? "down" : momentum.tone === "oversold" ? "up" : momentum.tone === "strong" ? "up" : "down",
    });
  }

  if (volume) {
    tiles.push({
      key: "volume",
      label: t.technical.volume,
      value: volume.tone === "heavy" ? t.technical.volumeHeavy : volume.tone === "light" ? t.technical.volumeLight : t.technical.volumeNormal,
      detail: t.technical.volumeDetail.replace("{n}", formatPrice(volume.ratio, locale, { digits: 1 })),
      /* Hacim yön söylemez: yoğun hacim düşüşte de yükselişte de olur. */
      tone: volume.tone === "heavy" ? "primary" : "flat",
    });
  }

  const fromHigh = distancePct(price, snapshot.high52);
  if (fromHigh !== null && snapshot.low52 !== null && snapshot.high52 !== null) {
    tiles.push({
      key: "range",
      label: t.technical.signalRange,
      value:
        fromHigh < -0.05
          ? t.technical.range52Below.replace("{n}", formatPercentPlain(Math.abs(fromHigh), locale, 1))
          : t.technical.range52AtHigh,
      detail: t.technical.rangeDetail
        .replace("{low}", formatPrice(snapshot.low52, locale, { currency: true }))
        .replace("{high}", formatPrice(snapshot.high52, locale, { currency: true })),
      tone: "flat",
    });
  }

  if (tiles.length === 0) return null;

  return (
    <dl className={styles.signals} aria-label={t.technical.signalsLabel} data-motion-stagger>
      {tiles.map((tile) => (
        <div key={tile.key} className={styles.signal} data-tone={tile.tone}>
          <dt>{tile.label}</dt>
          <dd>
            <strong className={cn(tile.tone === "up" && "text-up", tile.tone === "down" && "text-down", tile.tone === "primary" && "text-primary-ink")}>
              {tile.value}
            </strong>
            {tile.detail && <span className="numeral">{tile.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
