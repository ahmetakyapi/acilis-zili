import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { MetricStrip } from "@/components/earnings/MetricStrip";
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
  revenueScale,
  epsScale,
  filtered,
}: {
  rows: AnalysisRowView[];
  labels: AnalysisCardLabels;
  /** Ortak tepki ölçeği, yüzde. */
  scale: number;
  /** Gelir ve HBK sürprizinin ortak ölçekleri, yüzde. */
  revenueScale: number;
  epsScale: number;
  /** Okuyucu süzgeci kullandı mı — kalan kartlar bir kez oturur. */
  filtered: boolean;
}) {
  return (
    <ol className={styles.grid}>
      {rows.map((row, index) => {
        /* ÜÇ ÖLÇÜ, TEK DİL (30 Ekim). Tepki gri bir kutuda şeritli, gelir ve
           HBK altında çıplak iki sayıydı ve işaretleri farklıydı ("▲ %36"
           ile "+%8,0"); göz neyin önemli olduğunu seçemiyordu. Artık üçü
           alt alta aynı satır: etiket · sıfırı ortada şerit · işaretli
           değer. Her ölçünün ölçeği listede ortak (künyede yazılı), yani
           kartlar arası karşılaştırma da çizgiyle okunuyor. Sıra çeyreğin
           hikâyesi: ne açıklandı (gelir), beklentiye göre (HBK), piyasa ne
           dedi (tepki). */
        const metrics = [
          row.revenueYoyPct !== null && row.revenueYoyText
            ? { key: "revenue", label: labels.revenueLabel, value: row.revenueYoyPct, text: row.revenueYoyText, scale: revenueScale }
            : null,
          row.epsSurprisePct !== null && row.epsSurpriseText
            ? { key: "eps", label: labels.epsLabel, value: row.epsSurprisePct, text: row.epsSurpriseText, scale: epsScale }
            : null,
          row.reactionPct !== null
            ? { key: "reaction", label: labels.reactionLabel, value: row.reactionPct, text: row.reaction, scale }
            : null,
        ].filter((metric) => metric !== null);
        return (
          <li
            key={row.key}
            className={cn(styles.card, filtered && "filter-settle")}
            style={{ "--i": Math.min(index, 12) } as CSSProperties}
            data-verdict={row.verdict}
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

            {/* ÇEYREĞİN CÜMLESİ — sayılar ne anlatıyor. Yoksa kart sayılarla
                başlıyor; boş bir yer tutucu basılmıyor. */}
            {row.teaser && (
              <p lang={row.teaserLocale} className={styles.teaser}>
                {row.teaser}
              </p>
            )}

            {metrics.length > 0 ? (
              <dl className={styles.metrics}>
                {metrics.map((metric) => (
                  <div key={metric.key} className={styles.metric}>
                    <dt>{metric.label}</dt>
                    <dd>
                      <MetricStrip value={metric.value} scale={metric.scale} />
                      <span className={cn("numeral", styles.metricValue, metric.value >= 0 ? "text-up" : "text-down")}>
                        {metric.text}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.muted}>{labels.noReaction}</p>
            )}

            <p className={styles.date}>{row.reported}</p>
          </li>
        );
      })}
    </ol>
  );
}
