import type { CSSProperties } from "react";
import { checkChartBlock } from "@/lib/daily-chart";
import { barSpan, divergingScale } from "@/lib/daily-chart-figure";
import styles from "./DailyChart.module.css";

/**
 * Grafiğin küçük hâli — arşiv kartı ve ana sayfa paneli (24 Ekim).
 *
 * TAM GRAFİK DEĞİL, ŞEKLİ. Kartta on iki çubuk ve uzun adlar okunmuyor;
 * `rows` satır kendi adı ve değeriyle, geri kalanı "+N" künyesiyle. Kesim
 * ORTADAN: baştaki ve sondaki uçlar kalır — blok çoğunlukla sıralı ve
 * hikâye uçlarda; ilk beşi almak önizlemede en büyük düşüşü siliyordu
 * (paylaşım görseli aynı kuralla, `lib/daily-chart-og.tsx`).
 * Ölçek yine grubun EN BÜYÜĞÜ (gösterilmeyen satırlar dahil) — küçük hâl
 * tam grafikten başka bir oran söylemesin. Blok sayfadaki çizimle aynı
 * ayrıştırmadan geliyor (`checkChartBlock` → `parse-blocks.ts`).
 *
 * Bozuk blok hiçbir şey çizmez: yazma yolu bozuk bloğu zaten kabul etmiyor,
 * ama elle düzeltilmiş eski bir kayıt kartı kırmasın.
 */
export function ChartThumb({
  chartMd,
  locale,
  rows = 5,
}: {
  chartMd: string;
  locale: string;
  rows?: number;
}) {
  const check = checkChartBlock(chartMd, locale);
  if (!check.ok) return null;
  const { block } = check;

  if (block.kind === "share") {
    const total = block.items.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return null;
    return (
      <div className={styles.thumb} aria-hidden>
        <div className={styles.shareStrip}>
          {block.items.map((item, index) => (
            <span
              key={index}
              style={{
                width: `${(item.value / total) * 100}%`,
                background: index < 4 ? `var(--share-${index + 1})` : "var(--share-rest)",
              }}
            />
          ))}
        </div>
        {block.items.slice(0, rows).map((item, index) => (
          <div key={index} className={styles.thumbRow}>
            <span className={styles.thumbName}>{item.name}</span>
            <span />
            <span className={styles.thumbValue}>{item.display}</span>
          </div>
        ))}
      </div>
    );
  }

  const items =
    block.kind === "bars"
      ? block.items.map((item) => ({ name: item.name, value: item.value, display: item.display }))
      : [
          { name: block.from.label, value: block.from.value ?? 0, display: block.from.display },
          { name: block.to.label, value: block.to.value ?? 0, display: block.to.display },
        ];
  const peak = Math.max(...items.map((item) => Math.abs(item.value)), 0.01);
  const cut = items.length > rows;
  const headCount = Math.ceil(rows / 2);
  const head = cut ? items.slice(0, headCount) : items;
  const tail = cut ? items.slice(items.length - (rows - headCount)) : [];
  const rest = items.length - head.length - tail.length;
  /* `oncesi` yön taşımıyor (iki hâlin büyüklüğü): iki çubuk da nötr ton.
     `::: bar notr` de öyle (parse-blocks.ts → NEUTRAL_FLAG). */
  const signed = block.kind === "bars" && !block.neutral;
  /* İşaretli blok sayfadaki çizimle AYNI ölçekte: sıfırdan iki yöne, alan
     bütün satırlardan (gösterilmeyenler dahil) — `divergingScale`. Nötr
     blok ve `oncesi` soldan, grubun en büyüğüne göre. */
  const scale = signed ? divergingScale(items.map((item) => item.value)) : null;

  return (
    <div className={styles.thumb} aria-hidden>
      {[...head, null, ...tail].map((item, index) => {
        if (item === null) return rest > 0 ? <span key="rest" className={styles.more}>+{rest}</span> : null;
        const tone = !signed ? "up" : item.value < 0 ? "down" : "up";
        return (
          <div key={index} className={styles.thumbRow}>
            <span className={styles.thumbName}>{item.name}</span>
            <span className={styles.lane} data-zero={scale && scale.zero > 0 && scale.zero < 100 ? "" : undefined} style={scale ? ({ "--zero": `${scale.zero}%` } as CSSProperties) : undefined}>
              <span
                className={styles.bar}
                data-tone={signed ? tone : undefined}
                style={
                  scale
                    ? { left: `${barSpan(item.value, scale).start}%`, width: `${barSpan(item.value, scale).size}%` }
                    : { left: 0, width: `${(Math.abs(item.value) / peak) * 100}%`, background: "var(--primary)" }
                }
              />
            </span>
            <span className={styles.thumbValue} data-tone={signed ? tone : undefined}>
              {item.display}
            </span>
          </div>
        );
      })}
    </div>
  );
}
