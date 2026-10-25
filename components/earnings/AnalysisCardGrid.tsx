import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { reactionRatio } from "@/lib/analysis-visuals";
import { verdictTextClass, type AnalysisRowView } from "@/lib/analysis";
import { cn } from "@/lib/utils";
import styles from "./AnalysisCardGrid.module.css";

export type AnalysisCardLabels = {
  verdictLabel: string;
  reactionLabel: string;
  revenueLabel: string;
  epsLabel: string;
  noReaction: string;
};

/**
 * ANALİZ KARNE KARTLARI (25 Ekim görsel zirve) — `/bilancolar/analizler`
 * ve takip sekmesinin kart görünümü.
 *
 * Tablo dokuz sütunluk bir sayı dizisiydi ve telefonda 860 piksel enindeydi:
 * gelir, HBK, tepki ve skor ekranın dışında kalıyordu. Kart aynı satırı bir
 * bakışta okutuyor: skor halkası ve görüş (mürekkep tonunda — görüş bir
 * fiyat yönü değil), tepki şeridi, beklenti karnesi.
 *
 * TEPKİ ŞERİDİ ORTAK ÖLÇEKTE. Sıfır ortada; artı sağa yeşil, eksi sola
 * kırmızı. Ölçek listenin en büyük mutlak tepkisini kapsayan yuvarlak adım
 * (`reactionScale`), yani %1,8 ile %18 farklı boyda. Tepki yazılmadıysa
 * şerit yok, "Tepki yazılmadı".
 *
 * Kartın tamamı tıklanır (bağlantı şirket adında, `::after` yüzeyi
 * kaplıyor) — tablo satırıyla aynı kalıp, aynı erişilebilir ad.
 */
export function AnalysisCardGrid({
  rows,
  labels,
  scale,
  filtered,
}: {
  rows: AnalysisRowView[];
  labels: AnalysisCardLabels;
  /** Ortak tepki ölçeği, yüzde. */
  scale: number;
  /** Okuyucu süzgeci kullandı mı — kalan kartlar bir kez oturur. */
  filtered: boolean;
}) {
  return (
    <ol className={styles.grid}>
      {rows.map((row, index) => {
        const ratio = row.reactionPct === null ? null : reactionRatio(row.reactionPct, scale);
        return (
          <li
            key={row.key}
            className={cn(styles.card, filtered && "filter-settle")}
            style={{ "--i": Math.min(index, 12) } as CSSProperties}
          >
            <div className={styles.head}>
              <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
              <div className={styles.identity}>
                <h3 className={cn(styles.symbol, "text-base")} data-ink="plain">
                  <Link
                    href={row.href}
                    prefetch={false}
                    aria-label={row.linkLabel}
                    className={styles.link}
                    data-cc={row.symbol}
                  >
                    {row.symbol}
                  </Link>
                </h3>
                <span className={styles.company}>
                  {row.company} · {row.periodLabel}
                </span>
              </div>
              <div className={styles.verdict}>
                <ScoreRing score={row.score} verdict={row.verdict} size={44} />
                <span className={styles.verdictText}>
                  <span>{labels.verdictLabel}</span>
                  <b className={verdictTextClass(row.verdict)}>{row.verdictText}</b>
                </span>
              </div>
            </div>

            <div className={styles.reaction}>
              <span className={styles.metricLabel}>{labels.reactionLabel}</span>
              {ratio === null ? (
                <span className={styles.muted}>{labels.noReaction}</span>
              ) : (
                <>
                  <span
                    className={cn(
                      "numeral",
                      styles.reactionValue,
                      row.reactionTone === "up" ? "text-up" : "text-down",
                    )}
                  >
                    {row.reaction}
                  </span>
                  <span aria-hidden className={styles.strip}>
                    <span
                      className={styles.stripFill}
                      data-tone={ratio >= 0 ? "up" : "down"}
                      style={{
                        left: ratio >= 0 ? "50%" : `${50 + ratio * 50}%`,
                        width: `${Math.max(Math.abs(ratio) * 50, 1)}%`,
                      }}
                    />
                  </span>
                </>
              )}
            </div>

            {(row.revenueYoyText || row.epsSurpriseText) && (
              <dl className={styles.scorecard}>
                {row.revenueYoyText && (
                  <div>
                    <dt>{labels.revenueLabel}</dt>
                    <dd className={cn("numeral", row.revenueTone === "up" ? "text-up" : "text-down")}>
                      {row.revenueYoyText}
                    </dd>
                  </div>
                )}
                {row.epsSurpriseText && (
                  <div>
                    <dt>{labels.epsLabel}</dt>
                    <dd className={cn("numeral", row.epsTone === "up" ? "text-up" : "text-down")}>
                      {row.epsSurpriseText}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            <p className={styles.date}>{row.reported}</p>
          </li>
        );
      })}
    </ol>
  );
}
