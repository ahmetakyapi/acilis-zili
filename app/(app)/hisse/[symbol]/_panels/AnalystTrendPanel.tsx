import { DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import type { Dictionary, Locale } from "@/lib/i18n";
import { ANALYST_BUCKETS, analystTrend, buyShareShift, type AnalystBucket } from "@/lib/analyst-trend";
import { getRecommendations } from "@/lib/providers/finnhub";
import { cn, formatPercentPlain } from "@/lib/utils";
import type { CSSProperties } from "react";
import { BUCKET_INK } from "./analyst-tones";
import styles from "./depth.module.css";
import visuals from "./visuals.module.css";

/* Kova renkleri Analist kartıyla AYNI kaynaktan (`analyst-tones.ts`) —
   iki panel aynı beş kovayı anlatıyor. Görüş renklerinin gerekçesi orada. */

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

  const shift = buyShareShift(trend);
  const v = t.stockVisuals;
  const sentence = shift
    ? (shift.delta < 0 ? v.shiftDown : shift.delta > 0 ? v.shiftUp : v.shiftFlat)
        .replace("{m}", String(shift.months))
        .replace("{d}", String(Math.abs(shift.delta)))
        .replace("{a}", String(shift.from))
        .replace("{b}", String(shift.to))
    : null;
  const n = trend.periods.length;
  const monthOf = (period: string) => monthName.format(new Date(`${period}T12:00:00Z`));
  const yearOf = (period: string) => monthYear.format(new Date(`${period}T12:00:00Z`));
  /* Çizginin noktaları: sütun ortası (i + .5) / n, yükseklik al tarafının
     payı — sütunda Güçlü Al ile Al'ın bittiği sınırın kendisi. */
  const points = trend.buyShare.map((share, i) => (share === null ? null : { x: ((i + 0.5) / n) * 100, y: share }));
  const drawn = points.filter((p): p is { x: number; y: number } => p !== null);

  return (
    <Panel className={styles.panel}>
      <PanelHeader title={d.atTitle} />
      <div className={styles.body}>
        {/* TEPEDE TEK CÜMLE (25 Ekim): grafiğin söylediği, veriden. Sayılar
            çizginin üstündeki etiketlerle aynı yuvarlama (`buyShareShift`). */}
        {sentence && <p className={visuals.shiftSentence}>{sentence}</p>}
        {/* %100 YIĞILI SÜTUNLAR (25 Ekim). 39 sayılık tablo dört ayın
            dağılımını okutmak için her hücreyi tek tek karşılaştırtıyordu;
            sütun aynı ayı bir şekil olarak gösteriyor ve yeşil kütlenin boyu
            al tarafının payı. Çizgi o sınırın aydan aya yolu. Tablo silinmedi,
            aşağıda katlı: sayıyı arayan bir dokunuşla buluyor. Sütun odakta
            ve dokunuşta o ayın beş sayısını açıyor. */}
        <figure
          className={visuals.stackWrap}
          style={{ "--n": n, marginTop: sentence ? 12 : 4 } as CSSProperties}
          aria-label={v.stackLabel}
        >
          <div className={visuals.stackShares} aria-hidden>
            {trend.buyShare.map((share, i) => (
              <span key={trend.periods[i]} className="numeral">
                {share === null ? "–" : formatPercentPlain(share, locale, 0)}
              </span>
            ))}
          </div>
          <div className={visuals.stackPlot}>
            {trend.periods.map((period, i) => {
              const total = trend.totals[i]!;
              let start = 0;
              const share = trend.buyShare[i];
              const label = v.columnAria
                .replace("{month}", `${monthOf(period)} ${yearOf(period)}`)
                .replace("{n}", String(total))
                .replace("{share}", share === null ? "–" : String(Math.round(share)));
              return (
                <div key={period} className={visuals.stackCol} tabIndex={0} role="img" aria-label={label}>
                  <span className={visuals.stackBar} data-motion-draw="bar" style={{ transformOrigin: "center bottom" }} aria-hidden>
                    {ANALYST_BUCKETS.map((bucket) => {
                      const value = trend.rows.find((row) => row.bucket === bucket)!.values[i]!;
                      const len = total > 0 ? (value / total) * 100 : 0;
                      const top = start;
                      start += len;
                      /* Dilimler mutlak konumda: sınırlar tam payında, 2 px
                         kart zemini aralık her dilimden yarımşar kesiliyor —
                         çizgi Güçlü Al + Al sınırına piksel piksel oturuyor. */
                      return len > 0 ? (
                        <i
                          key={bucket}
                          style={{
                            position: "absolute",
                            insetInline: 0,
                            top: `calc(${top}% + 1px)`,
                            height: `max(1px, calc(${len}% - 2px))`,
                            background: BUCKET_INK[bucket],
                          }}
                        />
                      ) : null;
                    })}
                  </span>
                  <span className={visuals.stackTip} aria-hidden>
                    <b>
                      {monthOf(period)} {yearOf(period)} · {v.analysts.replace("{n}", String(total))}
                    </b>
                    {trend.rows.map((row) => (
                      <span key={row.bucket}>
                        <em>
                          <i style={{ background: BUCKET_INK[row.bucket] }} />
                          {labels[row.bucket]}
                        </em>
                        <span className="numeral">{row.values[i]}</span>
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
            {drawn.length > 1 && (
              <svg className={cn(visuals.stackLine, "spark-line")} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polyline className={visuals.stackLineHalo} points={drawn.map((p) => `${p.x},${p.y}`).join(" ")} />
                <polyline className={visuals.stackLineInk} points={drawn.map((p) => `${p.x},${p.y}`).join(" ")} />
              </svg>
            )}
            {drawn.map((p) => (
              <i key={p.x} aria-hidden className={cn(visuals.stackPoint, "spark-dot")} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
            ))}
          </div>
          <div className={visuals.stackMonths} aria-hidden>
            {trend.periods.map((period) => (
              <span key={period}>
                {monthOf(period)} <b>{yearOf(period)}</b>
              </span>
            ))}
          </div>
          <figcaption className={visuals.stackLegend}>
            <span>
              <i className={visuals.stackLegendLine} aria-hidden />
              {v.lineLabel}
            </span>
            {trend.rows.map((row) => (
              <span key={row.bucket}>
                <i aria-hidden style={{ background: BUCKET_INK[row.bucket] }} />
                {labels[row.bucket]} <b className="numeral">{row.values.at(-1)}</b>
              </span>
            ))}
          </figcaption>
        </figure>
        {/* TABLO KATLAMADA (25 Ekim): sayıların tamamı ve Değişim sütunu
            burada; ekran okuyucu için asıl kaynak da bu tablo. */}
        <details className={styles.how}>
          <summary>{v.tableShow}</summary>
        <ScrollEdges className="scroll-x" tabIndex={0} role="region" aria-label={d.atTitle}>
          <table className={cn(styles.table, styles.trendTable)}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t.stock.analysts}</span>
                </th>
                {trend.periods.map((period) => (
                  <th key={period} scope="col" className="numeral">
                    <span className={styles.trendMonth}>{monthOf(period)}</span>{" "}
                    <span className={styles.trendYear}>{yearOf(period)}</span>
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
                    <span aria-hidden className={styles.dot} style={{ background: BUCKET_INK[row.bucket] }} />
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
        </details>
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
