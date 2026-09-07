import { cn, titleCaseLabel } from "@/lib/utils";
import { SpotlightCard } from "@/components/motion/PremiumMotion";
import styles from "@/components/earnings/EarningsReport.module.css";

/**
 * Altı metrik kartı — karnedeki 3×2 ızgaranın sayfa karşılığı.
 *
 * Eskiden sağ kolonda etiket–değer listesiydi ve sayfanın en önemli
 * rakamları, yanındaki dokuz paragraflık metnin gölgesinde kalıyordu.
 * Kart olarak ve ana kolonda: değer 21px, altında renkli tek satır bağlam.
 * Rakamı gören okuyucu metne inmek zorunda değil.
 *
 * Etiket de değer de SERBEST METİN, çünkü hangi ölçünün öne çıkacağı
 * şirkete göre değişiyor: bankada net faiz marjı, bellek üreticisinde brüt
 * marj. Site biçimlendirmiyor, analiz yazarken karar veriliyor.
 *
 * TEK istisna alttaki bağlam satırı: onun yazımı kayıttan kayda değişiyordu
 * ("▲ %372 yıllık" ile "Rekor · Öngörü %79-81 idi" yan yana) ve aynı ızgarada
 * iki ayrı imla duruyordu. `titleCaseLabel` onu Türkçe doğru biçimde
 * eşitliyor; sayı, işaret ve kısaltmalara dokunmuyor.
 */

export type Metric = {
  label: string;
  value: string;
  note?: string | null;
  tone?: string | null;
};

export function MetricCards({
  metrics,
  locale,
  className,
}: {
  metrics: Metric[];
  /** Büyük harf dönüşümü dile bağlı: Türkçede i → İ. */
  locale: string;
  className?: string;
}) {
  if (metrics.length === 0) return null;
  return (
    <ul
      data-motion-stagger
      data-count={metrics.length}
      className={cn(
        styles.metricGrid,
        className,
      )}
    >
      {metrics.map((metric) => (
        <li
          key={metric.label}
          className={styles.metricItem}
        >
          <SpotlightCard className={styles.metricCard}>
          <div className={styles.metricTop}>
          <p className={styles.metricLabel}>
            {metric.label}
          </p>
          </div>
          <p className={cn(styles.metricValue, "figure")}>
            {metric.value}
          </p>
          {metric.note && (
            /* Bağlam satırı KIRILMAZ: "▲ Yıllık %372 · Beklenti Üstü" iki
               satıra düşünce kartlar farklı yükseklikte kalıyor ve ızgara
               tırtıklı görünüyordu. Sığmazsa kesilir. */
            <p
              className={cn(
                styles.metricNote,
                "text-small font-bold",
                metric.tone === "up"
                  ? "text-up"
                  : metric.tone === "down"
                    ? "text-down"
                    : "text-primary",
              )}
            >
              {titleCaseLabel(metric.note, locale)}
            </p>
          )}
          </SpotlightCard>
        </li>
      ))}
    </ul>
  );
}
