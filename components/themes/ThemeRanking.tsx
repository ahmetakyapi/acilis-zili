import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { themeTitle } from "@/content/themes";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ThemeCard } from "@/lib/theme-board";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./Themes.module.css";

/**
 * Kapaktaki sıralama — temalar medyana göre, sıfırdan iki yana açılan
 * çubuklarla. Ekran kuralı: karşılaştırılan büyüklük bir de ÇİZGİ olarak
 * okunur. Çubuk yalnızca aynı seansı anlatan medyanlara basılıyor; ötekiler
 * listenin dibinde sayısız duruyor.
 *
 * Dizinin kapağında ve ana sayfanın temalar bandında (28 Eylül'de
 * `/tema/page.tsx`ten buraya taşındı; iki ekran aynı çizimi kullanıyor).
 *
 * Yedek aynı on satırı editoryal sırayla ve çubuksuz basıyor: veri inince
 * yalnızca satırların sırası ve içi değişiyor, kutu değil.
 */
export function ThemeRanking({
  cards,
  basis = null,
  locale,
  t,
  heading: Heading = "h2",
  className,
}: {
  cards: readonly ThemeCard[];
  basis?: "session" | "lastClose" | null;
  locale: Locale;
  t: Dictionary;
  /** Dizinde kapağın h2'si; ana sayfada bandın h2'sinin altında h3. */
  heading?: "h2" | "h3" | "h4";
  className?: string;
}) {
  const inScale = (card: ThemeCard) => basis !== null && card.basis === basis && card.median !== null;
  const sorted = basis
    ? [...cards].sort((a, b) => {
        if (inScale(a) !== inScale(b)) return inScale(a) ? -1 : 1;
        return (b.median ?? 0) - (a.median ?? 0);
      })
    : cards;
  const peak = Math.max(0, ...sorted.filter(inScale).map((card) => Math.abs(card.median!)));

  return (
    <div className={cn(styles.rank, className)}>
      <div className={styles.rankHead}>
        <Heading>{t.themes.rankTitle}</Heading>
        <span>
          {t.themes.median}
          {basis === "lastClose" ? ` · ${t.themes.medianLastClose}` : ""}
        </span>
      </div>
      <ol className={styles.rankList}>
        {sorted.map((card) => {
          const ratio = inScale(card) && peak > 0 ? card.median! / peak : null;
          const neutral = card.basis !== "session";
          return (
            <li key={card.theme.slug}>
              <Link href={`/tema/${card.theme.slug}`} prefetch={false} className={styles.rankRow}>
                <span className={styles.rankName}>{themeTitle(card.theme, locale)}</span>
                <span className={styles.rankTrack} aria-hidden>
                  {ratio !== null && ratio !== 0 && (
                    <i
                      className={styles.rankBar}
                      data-tone={neutral ? "flat" : ratio > 0 ? "up" : "down"}
                      data-motion-draw="line"
                      style={
                        ratio > 0
                          ? { left: "50%", width: `${ratio * 50}%`, transformOrigin: "left center" }
                          : { right: "50%", width: `${-ratio * 50}%`, transformOrigin: "right center" }
                      }
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "numeral",
                    styles.rankValue,
                    card.median === null
                      ? "text-muted"
                      : neutral
                        ? "text-body"
                        : directionText(directionOf(card.median)),
                  )}
                >
                  {card.median === null ? NO_VALUE : formatPercent(card.median, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
