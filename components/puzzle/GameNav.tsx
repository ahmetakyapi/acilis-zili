import { CalendarDots, CaretLeft, CaretRight, PuzzlePiece, Scales } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { cn } from "@/lib/utils";
import styles from "./GameNav.module.css";

/**
 * OYUN ŞERİDİ (29 Ekim, sahibinin isteği: "bunun bir oyun olduğu daha
 * belirgin olsun", "bir önceki günün bulmacasına gitmek kolay olsun",
 * "başka bu tarz bir oyun varsa ayrı bir tabda"). Başlığın hemen altında,
 * CLAUDE.md ekran sırasının ikinci katı (seçim şeridi):
 *
 *   solda OYUN SEKMELERİ — Hisseyi Bil · Hangisi Büyük? · Arşiv; ayrı
 *   adresler arasında gezinti, seçili olan `aria-current="page"`.
 *   sağda GÜN OKLARI (yalnız Hisseyi Bil'de) — önceki ve sonraki bulmaca,
 *   ortada numara ve tarih. Bugünde "sonraki" yok (yarının bulmacası
 *   açılmaz), ilk bulmacada "önceki" yok; ok yoksa yeri boş kalır, öteki
 *   kaymaz (Bugünün Akışı'ndaki gün seçicinin kuralı).
 *
 * Eskiden yalnız arşivden "Bugünün Bulmacası"na dönüş vardı; dünün
 * bulmacasına gitmek arşiv ızgarasına inip kartı bulmak demekti.
 */
export type GameKey = "stock" | "bigger" | "archive";

export type DayNav = {
  number: number;
  /** Kısa tarih — "28 Eki". */
  dateLabel: string;
  /** Tam tarih — ekran okuyucu ve `title`. */
  dateLong: string;
  prevHref: string | null;
  nextHref: string | null;
};

export function GameNav({ active, labels, day }: { active: GameKey; labels: StockPuzzleLabels; day?: DayNav }) {
  const G = labels.games;
  const tabs = [
    { key: "stock", href: "/bulmaca", icon: PuzzlePiece, text: labels.title },
    { key: "bigger", href: "/bulmaca/hangisi-buyuk", icon: Scales, text: G.biggerTitle },
    { key: "archive", href: "/bulmaca/arsiv", icon: CalendarDots, text: labels.archiveLink },
  ] as const;
  return (
    <div className={styles.strip}>
      <nav aria-label={G.navLabel} className={styles.tabs}>
        {tabs.map(({ key, href, icon: Icon, text }) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className={cn(styles.tab, active === key && styles.tabActive)}
          >
            <Icon aria-hidden size={15} weight={active === key ? "fill" : "bold"} />
            <span>{text}</span>
          </Link>
        ))}
      </nav>
      {day && (
        <nav aria-label={G.dayNavLabel} className={styles.days}>
          {day.prevHref ? (
            <Link href={day.prevHref} className={styles.arrow} title={G.prevPuzzle} aria-label={G.prevPuzzle}>
              <CaretLeft aria-hidden size={16} weight="bold" />
            </Link>
          ) : (
            <span aria-hidden className={cn(styles.arrow, styles.arrowOff)}>
              <CaretLeft size={16} weight="bold" />
            </span>
          )}
          <span className={styles.day} title={day.dateLong}>
            <b className="numeral">#{day.number}</b>
            <span aria-hidden>{day.dateLabel}</span>
            <span className="sr-only">{day.dateLong}</span>
          </span>
          {day.nextHref ? (
            <Link href={day.nextHref} className={styles.arrow} title={G.nextPuzzle} aria-label={G.nextPuzzle}>
              <CaretRight aria-hidden size={16} weight="bold" />
            </Link>
          ) : (
            <span aria-hidden className={cn(styles.arrow, styles.arrowOff)}>
              <CaretRight size={16} weight="bold" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
