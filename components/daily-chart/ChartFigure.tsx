import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody } from "@/components/article/ArticleBody";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { DailyChartBlock } from "@/lib/daily-chart";
import { barSpan, divergingScale, sectorFundOf } from "@/lib/daily-chart-figure";
import { cn, formatPercent } from "@/lib/utils";
import { SECTOR_ICONS } from "./sector-icons";
import styles from "./ChartFigure.module.css";

/** Eksen künyesinin basamağı: uçlar tek ondalık ("−%2,0", "+%2,6"). */
const AXIS_DIGITS = 1;

/**
 * GÜNÜN GRAFİĞİ'NİN ÇİZİCİSİ (25 Ekim, görsel tur).
 *
 * Sahibinin isteği: "çok daha görsel, insanlar kolay anlamalı." Grafik
 * önceden makale gövdesinin `bar` bloğuyla çiziliyordu: on bir ince çubuk,
 * hepsi soldan başlıyor, işaret yalnız renkte. Bu çizici aynı bloğu
 * (`checkChartBlock` → `parse-blocks.ts`, ayrıştırma değişmedi) bir
 * grafiğin diliyle çiziyor:
 *
 * - SIFIRDAN İKİ YÖNE, TEK ÖLÇEK (`divergingScale`): eksiler sola, artılar
 *   sağa; sıfır çizgisi alanın gerçek yerinde ve üstte eksen künyesiyle
 *   yazılı. Kulvar `--line-soft`, sıfır `--line-strong` (CLAUDE.md "Grafik
 *   dili ince"); çubuk 5 değil 8 piksel: bu sayfada grafik ekranın tek işi.
 * - SATIRIN KİMLİĞİ: ad bir sektörse fon simgesi ve sembolü
 *   (`SECTOR_ICONS`), satır fonun sayfasına bağlanıyor. Bağlantı satırın
 *   tamamı: 44 piksel, üstüne gelince ve odakta ton değişiyor (klavyede aynı
 *   ayrıntı). Eşleşmeyen satır simgesiz ve bağlantısız.
 * - SAHNELİ GİRİŞ: çubuklar sıfırdan sırayla uzuyor (`--ease-brand`, bir
 *   kez); hareketi azaltana son kare.
 *
 * Yalnız işaretli `bar` bloğu bu çizimi alıyor. `pay`, `oncesi`, `bar notr`
 * ve ölçeksiz blok makale çizimiyle kalıyor: onlarda sıfırın iki yanı yok.
 */
export function ChartFigure({
  block,
  chartMd,
  locale,
  label,
  caption,
}: {
  block: DailyChartBlock;
  /** Diğer bloklar için: makale çizimine olduğu gibi verilen metin. */
  chartMd: string;
  locale: string;
  /** Listenin ekran okuyucu adı (grafiğin etiketi). */
  label: string;
  /** Görünür etiket: grafiğin neyi ölçtüğü. Etiket panel başlığındaysa verilmez. */
  caption?: string;
}) {
  if (block.kind !== "bars" || block.neutral || block.unscaled) {
    return <ArticleBody markdown={chartMd} locale={locale} />;
  }

  const scale = divergingScale(block.items.map((item) => item.value));
  const percent = block.items.some((item) => item.display.includes("%"));
  const axisValue = (value: number) =>
    value === 0
      ? "0"
      : percent
        ? formatPercent(value, locale, AXIS_DIGITS)
        : `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: AXIS_DIGITS })}`;
  /* Uç künyesi yalnız o yönde değer varsa: tek yönlü blokta sol uç sıfırın
     kendisi ve iki "0" yan yana basılmasın. */
  const ticks = [
    scale.lo < 0 ? { at: 0, text: axisValue(scale.lo), edge: "start" } : null,
    { at: scale.zero, text: "0", edge: scale.zero <= 0 ? "start" : scale.zero >= 100 ? "end" : "mid" },
    scale.hi > 0 ? { at: 100, text: axisValue(scale.hi), edge: "end" } : null,
  ].filter((tick): tick is { at: number; text: string; edge: string } => tick !== null);

  return (
    <div className={styles.figure} style={{ "--zero": `${scale.zero}%` } as CSSProperties}>
      {caption && <p className={cn("plate text-nano", styles.caption)}>{caption}</p>}
      <div className={styles.axis} aria-hidden>
        <span className={styles.axisTrack}>
          {ticks.map((tick) => (
            <span key={tick.at} className={styles.tick} data-edge={tick.edge} style={{ "--at": `${tick.at}%` } as CSSProperties}>
              {tick.text}
            </span>
          ))}
        </span>
      </div>
      <ol className={styles.rows} aria-label={label}>
        {block.items.map((item, index) => {
          const fund = sectorFundOf(item.name);
          const Icon = fund ? SECTOR_ICONS[fund] : undefined;
          const dir = item.value > 0 ? "up" : item.value < 0 ? "down" : "flat";
          const span = barSpan(item.value, scale);
          const body = (
            <>
              <span className={styles.mark} aria-hidden>
                {Icon && <Icon size={18} weight="duotone" />}
              </span>
              <span className={styles.name}>
                {item.name}
                {fund && <span className={styles.symbol}>{fund}</span>}
              </span>
              <span className={styles.lane} aria-hidden>
                {dir !== "flat" && (
                  <span
                    className={styles.bar}
                    data-dir={dir}
                    style={{ "--start": `${span.start}%`, "--size": `${span.size}%` } as CSSProperties}
                  />
                )}
              </span>
              <span className={cn(styles.value, dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-strong")}>
                {item.display}
              </span>
              {fund && <ArrowUpRight className={styles.go} size={14} weight="bold" aria-hidden />}
            </>
          );
          return (
            <li key={`${index}-${item.name}`} style={{ "--i": index } as CSSProperties}>
              {fund ? (
                <Link href={`/hisse/${fund}`} prefetch={false} className={styles.row} data-link="">
                  {body}
                </Link>
              ) : (
                <div className={styles.row}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
