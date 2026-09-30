import { DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import type { Dictionary, Locale } from "@/lib/i18n";
import { analystTrend, type AnalystBucket } from "@/lib/analyst-trend";
import { getRecommendations } from "@/lib/providers/finnhub";
import { cn, formatPercentPlain } from "@/lib/utils";
import styles from "./depth.module.css";

/* Kova noktaları Analist kartıyla AYNI ton sırası — iki panel aynı beş
   kovayı anlatıyor ve renk eşlemesi ikisinde de aynı olmalı. */
const BUCKET_DOT: Record<AnalystBucket, string> = {
  strongBuy: "bg-up",
  buy: "bg-up/60",
  hold: "bg-flat",
  sell: "bg-down/60",
  strongSell: "bg-down",
};

/**
 * Analist dağılımının son dört aydaki değişimi — "Al: 38 → 41".
 *
 * Analist kartına EKLENMEDİ, ayrı panel: o kartın yorumu ("BURAYA YENİ VERİ
 * EKLENMEZ") ölçülmüş bir ızgara satırının boyunu koruyor. Aynı uç, aynı
 * önbellek anahtarı (`getRecommendations`, bir gün): ek sağlayıcı turu yok.
 * Değişim sütunu RENKSİZ: Sat kovasındaki artı "kötü", Al'daki artı "iyi"
 * diye boyanırsa ekran bir hüküm vermiş olurdu; işaret yazıyla duruyor.
 */
export async function AnalystTrendPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const d = t.stockDepth;
  const result = await getRecommendations(symbol);
  const trend = result.ok ? analystTrend(result.data) : null;
  if (!result.ok || !trend) return null;

  const labels: Record<AnalystBucket, string> = {
    strongBuy: t.stock.strongBuy,
    buy: t.stock.buy,
    hold: t.stock.hold,
    sell: t.stock.sell,
    strongSell: t.stock.strongSell,
  };
  /* Ay ve yıl AYRI parça: telefonda başlık iki satıra bölünüyor ("Haz" /
     "26") ki altı sütun kaydırmasız sığsın (depth.module.css). */
  const intl = locale === "tr" ? "tr-TR" : "en-US";
  const monthName = new Intl.DateTimeFormat(intl, { month: "short", timeZone: "UTC" });
  const monthYear = new Intl.DateTimeFormat(intl, { year: "2-digit", timeZone: "UTC" });
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
  const listing = result.data[0]?.symbol?.toUpperCase();

  return (
    <Panel className={styles.panel}>
      <PanelHeader title={d.atTitle} />
      <div className={styles.body}>
        <ScrollEdges className="scroll-x" tabIndex={0} role="region" aria-label={d.atTitle}>
          <table className={cn(styles.table, styles.trendTable)}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t.stock.analysts}</span>
                </th>
                {trend.periods.map((period) => (
                  <th key={period} scope="col" className="numeral">
                    <span className={styles.trendMonth}>{monthName.format(new Date(`${period}T12:00:00Z`))}</span>{" "}
                    <span className={styles.trendYear}>{monthYear.format(new Date(`${period}T12:00:00Z`))}</span>
                  </th>
                ))}
                <th scope="col" className={styles.trendDelta}>
                  <span className={styles.trendLong}>{d.atChange}</span>
                  <span className={styles.trendShort} aria-hidden>{d.atChangeShort}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {trend.rows.map((row) => (
                <tr key={row.bucket}>
                  <th scope="row" className="text-left font-semibold text-strong">
                    <span aria-hidden className={cn(styles.dot, BUCKET_DOT[row.bucket])} />
                    {labels[row.bucket]}
                  </th>
                  {row.values.map((value, i) => (
                    <td key={trend.periods[i]} className="numeral text-body">
                      {value}
                    </td>
                  ))}
                  <td className={cn("numeral", styles.trendDelta, row.delta !== 0 ? "font-semibold text-strong" : "text-muted")}>
                    {signed(row.delta)}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="text-left font-semibold text-strong">{d.atTotal}</th>
                {trend.totals.map((total, i) => (
                  <td key={trend.periods[i]} className="numeral font-semibold text-strong">
                    {total}
                  </td>
                ))}
                <td className={cn("numeral text-body", styles.trendDelta)}>{signed(trend.totals.at(-1)! - trend.totals[0]!)}</td>
              </tr>
              <tr>
                <th scope="row" className="text-left font-semibold text-strong">{d.atBuyShare}</th>
                {trend.buyShare.map((share, i) => (
                  <td key={trend.periods[i]} className="numeral text-body">
                    {formatPercentPlain(share, locale, 0)}
                  </td>
                ))}
                <td aria-hidden className={styles.trendDelta} />
              </tr>
            </tbody>
          </table>
        </ScrollEdges>
        {/* Yöntem notu katlamada (30 Eylül, "daha kompakt"); kotasyon notu
            bu hisseye özgü, açıkta kalıyor. */}
        <details className={styles.how}>
          <summary>{d.howRead}</summary>
          <p>{d.atNote}</p>
        </details>
        {/* Analist kartındaki kotasyon notunun eşi: TSM'de dağılım Tayvan
            kotasyonunu izleyen analistlerden. */}
        {listing && listing !== symbol.toUpperCase() && (
          <p className={styles.note}>{t.stock.analystListingNote.replace("{code}", listing)}</p>
        )}
        <DataStamp labels={t.data} source={result.source} at={result.fetchedAt} stale={result.stale} locale={locale} className={styles.stamp} />
      </div>
    </Panel>
  );
}
