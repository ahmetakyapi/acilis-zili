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

  return (
    <Panel className={styles.panel}>
      <PanelHeader title={d.atTitle} />
      <div className={styles.body}>
        {/* TEPEDE TEK CÜMLE (25 Ekim): grafiğin söylediği, veriden. Sayılar
            çizginin üstündeki etiketlerle aynı yuvarlama (`buyShareShift`). */}
        {sentence && <p className={visuals.shiftSentence}>{sentence}</p>}
        {/* AY BAŞINA YATAY %100 ŞERİT (14 Kasım 2026, görsel tur). 25 Ekim'de
            39 sayılık tablonun yerine dört YIĞILI SÜTUN gelmişti; canlıda
            sütunlar neredeyse özdeş çıktı (NVDA: %94 / %94 / %96 / %96) ve
            150 piksellik çizim alanı iki puanlık farkı okutamıyordu, üstüne
            binen kesik "Al Tarafı Payı" çizgisi de düz bir hat. Aynı veri
            şimdi alt alta dört yatay şerit (12 piksel, sitenin kalın şerit
            dili): yeşil kütlenin bittiği yer al tarafının payı, aylar tek
            eksende olduğu için sınırın kayması bir basamak olarak okunuyor;
            pay sağda yazıyla. Değişimin asıl taşıyıcısı kovaların kendi
            sayısı: lejant son ayın sayısını ve dönem başına göre farkı
            (renksiz, gerekçe yukarıda) birlikte basıyor. Çizim alanı 132
            piksellik sütunlardan dört satıra (4 × 28) indi; tablo katlamada
            duruyor. */}
        <figure className={visuals.shareWrap} style={{ marginTop: sentence ? 12 : 4 } as CSSProperties} aria-label={v.stackLabel}>
          <ol className={visuals.shareRows}>
            {trend.periods.map((period, i) => {
              const total = trend.totals[i]!;
              const share = trend.buyShare[i] ?? null;
              const label = v.columnAria
                .replace("{month}", `${monthOf(period)} ${yearOf(period)}`)
                .replace("{n}", String(total))
                .replace("{share}", share === null ? "–" : String(Math.round(share)));
              return (
                <li key={period} role="img" aria-label={label} data-last={i === n - 1 || undefined}>
                  <span className={visuals.shareMonth} aria-hidden>
                    {monthOf(period)} <b>{yearOf(period)}</b>
                  </span>
                  <span className={cn(visuals.shareStrip, "bar-fill")} data-draw="" aria-hidden>
                    {ANALYST_BUCKETS.map((bucket) => {
                      const value = trend.rows.find((row) => row.bucket === bucket)!.values[i]!;
                      return value > 0 ? <i key={bucket} style={{ flexGrow: value, background: BUCKET_INK[bucket] }} /> : null;
                    })}
                  </span>
                  <span className={cn("numeral", visuals.shareValue)} aria-hidden>
                    {share === null ? "–" : formatPercentPlain(share, locale, 0)}
                  </span>
                  <span className={cn("numeral", visuals.shareTotal)} aria-hidden>
                    {v.analysts.replace("{n}", String(total))}
                  </span>
                </li>
              );
            })}
          </ol>
          {/* KOVA KOVA "ÖNCE → SONRA" (14 Kasım 2026). Lejant yalnız son ayın
              sayısını basıyordu; değişimin kendisi ("Tut 4 → 2") katlı
              tablodaydı. Beş kova, dönemin ilk ve son ayı, renksiz fark:
              panelin başlığındaki soruya ("nasıl değişti") açık cevap.
              Şeritlerin lejantı da bu liste (renk karosu aynı). */}
          <figcaption className={visuals.bucketList}>
            <span className={visuals.bucketHead} aria-hidden>
              <span />
              <span className="numeral">{monthOf(trend.periods[0]!)} {yearOf(trend.periods[0]!)}</span>
              <span />
              <span className="numeral">{monthOf(trend.periods[n - 1]!)} {yearOf(trend.periods[n - 1]!)}</span>
              <span>{d.atChangeShort}</span>
            </span>
            {trend.rows.map((row) => (
              <span key={row.bucket} className={visuals.bucketRow} data-changed={row.delta !== 0 || undefined}>
                <span className={visuals.bucketName}>
                  <i aria-hidden style={{ background: BUCKET_INK[row.bucket] }} />
                  {labels[row.bucket]}
                </span>
                <span className="numeral">{row.values[0]}</span>
                <span aria-hidden className={visuals.bucketArrow}>→</span>
                <b className="numeral">{row.values.at(-1)}</b>
                <em className="numeral">{signed(row.delta)}</em>
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
