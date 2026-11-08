import themeStyles from "@/components/themes/Themes.module.css";
import type { Locale } from "@/lib/i18n";
import type { HeatTone } from "@/lib/theme-view";
import { formatPercent } from "@/lib/utils";
import styles from "./MarketExperience.module.css";

/**
 * Piyasalar renk ölçeği — dokuz kademe, ısı tokenlarıyla aynı
 * (Themes.module.css → `.heat`, globals.css → `--heat-*`).
 *
 * YÖN RENGİ YALNIZCA BU SEANSTA (veri dürüstlüğü 4). Açılış öncesinin ilk
 * dakikalarında yarısı dünü, yarısı bu sabahı anlatan yüzdeler aynı renk
 * diliyle duramaz: renk yalnız `sameSessionMoves` kümesine giren satırda,
 * ötekiler nötr tonda (tema haritasının kuralı, aynı fonksiyon). Künye
 * hangi günün boyandığını söylüyor (`app/(app)/piyasalar/page.tsx` →
 * IndexToolbar).
 *
 * TAŞINDI (8 Kasım): ölçek `IndexTreemap.tsx`teydi. O dosyanın ağaç
 * düzenli ısı haritası (18 Ekim) sayfadan kart panolarına geçişte
 * (8558b52) çizilmez olmuş, hiçbir yerden çağrılmıyordu; silindi. Lejantın
 * üzerine gelince haritada aynı kademedeki karoları vurgulayan kural da
 * vurgulayacak karo kalmadığı için kalktı.
 */
type Tone = { tone: HeatTone; level: 0 | 1 | 2 | 3 | 4 };

export function HeatScale({ locale, label, steps }: { locale: Locale; label: string; steps: string }) {
  const levels = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
  return (
    <div className={styles.heatLegend} role="img" aria-label={label}>
      <div className={styles.heatSwatches} aria-hidden>
        {levels.map((level) => {
          const heat: Tone = { tone: level < 0 ? "down" : level > 0 ? "up" : "flat", level: Math.abs(level) as Tone["level"] };
          return <i key={level} className={themeStyles.heat} data-heat-tone={heat.tone} data-heat-level={heat.level} />;
        })}
      </div>
      <div className={styles.heatLegendLabels} aria-hidden>
        <span>≤ {formatPercent(-3, locale, 0)}</span>
        <span>0</span>
        <span>≥ {formatPercent(3, locale, 0)}</span>
      </div>
      <span className={styles.heatLegendHint} aria-hidden>{steps}</span>
    </div>
  );
}
