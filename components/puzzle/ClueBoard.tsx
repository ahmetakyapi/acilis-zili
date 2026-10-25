import type { Icon } from "@phosphor-icons/react";
import { Buildings, ChartLineUp, Coins, Factory, Flag, HandCoins, Keyboard, LockSimple, Percent, Pulse, TextAa, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { cn, formatPercent, formatPercentPlain } from "@/lib/utils";
import { CAP_BANDS, CLUE_STEPS, IPO_YEAR_FLOOR, stepOf, type Clue, type ClueKind, type GuessRow, type PuzzleStatus } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { clueValue, fill } from "./puzzle-format";
import styles from "./ClueBoard.module.css";

/**
 * İpucu yolu ve kartları (25 Ekim).
 *
 * YOL: ipuçları bir merdivenin basamakları; iki basamak arasındaki kulvar
 * bir TAHMİN. Yanlış tahmin kulvarı doldurur ve sıradaki basamağı açar,
 * doğru tahmin kulvarı yeşile boyar. Böylece "tahmin noktaları" ile
 * "ipucu sırası" aynı çizgide okunuyor; eskiden ikisi ayrı panellerdeydi
 * ve kartın "2 Yanlış Tahmin Sonra" yazısı tek bağdı.
 *
 * KARTLAR: açık kart değerini bir görselle taşır (piyasa değeri bandı
 * cetveli, halka arz zaman çizgisi, büyüme çubuğu, baş harf karosu);
 * kapalı kart sırtı dönük bir kart: kilit, ad, kaç yanlış kaldığı ve o
 * kadar boş nokta. Bu oturumda açılan kart çevrilerek gelir (yukarıdan
 * menteşeli, `--ease-brand`); kartın kilit simgesi yerine oturan küçük
 * simge `--ease-spring-soft` (tek küçük öğenin geri bildirimi, CLAUDE.md).
 *
 * Renk: açık basamak ve cetvel yumuşak mavi (etkileşim değil, büyüklük —
 * renk kararı), büyüme yön renginde (gelir artışı/azalışı bir yön), doğru
 * tahmin yeşil. Durumsuz: sunucuda da çizilir.
 */

export const CLUE_ICONS: Record<ClueKind, Icon> = {
  silhouette: ChartLineUp,
  sector: Buildings,
  capBand: Coins,
  ipoYear: Flag,
  revenueGrowth: TrendUp,
  initial: TextAa,
  dividend: HandCoins,
  beta: Pulse,
  industry: Factory,
  netMargin: Percent,
  letters: Keyboard,
};

/** Büyüme ve marj çubuğunun tavanı — ±%50 dışı tavanda durur (uçlarda yazıyor). */
const GROWTH_SCALE = 50;
/** Temettü kulvarının tavanı (%) ve beta kulvarının tavanı. */
const DIVIDEND_SCALE = 6;
const BETA_SCALE = 3;

type Step = "start" | "opened" | "revealed" | "next" | "locked";
type Link = "miss" | "hit" | "open";

export function ClueBoard({
  clues,
  upcoming,
  guesses,
  status,
  fresh,
  year,
  labels,
  locale,
}: {
  clues: Clue[];
  upcoming: ClueKind[];
  guesses: GuessRow[];
  status: PuzzleStatus;
  /** Bu oturumda yeni açılan ipuçları — giriş hareketi yalnız onlara. */
  fresh: ReadonlySet<ClueKind>;
  /** Halka arz çizgisinin sağ ucu — bulmacanın yılı. */
  year: number;
  labels: StockPuzzleLabels;
  locale: Locale;
}) {
  const misses = guesses.filter((row) => !row.correct).length;
  const present = new Set<ClueKind>([...clues.map((clue) => clue.kind), ...upcoming]);
  const steps = CLUE_STEPS.map((step) => (step as readonly ClueKind[]).filter((kind) => present.has(kind)));
  const stateOf = (index: number): Step => {
    if (index === 0) return "start";
    if (index <= misses) return "opened";
    if (status !== "playing") return "revealed";
    return index === misses + 1 ? "next" : "locked";
  };
  const linkOf = (index: number): Link => {
    const row = guesses[index];
    return !row ? "open" : row.correct ? "hit" : "miss";
  };
  const cards = clues.filter((clue) => clue.kind !== "silhouette");
  const locked = upcoming.filter((kind) => kind !== "silhouette");

  return (
    <div className={styles.board}>
      <ol className={styles.ladder} aria-label={labels.ladderNote}>
        {CLUE_STEPS.map((step, index) => {
          const kinds = steps[index];
          const Glyph = CLUE_ICONS[kinds[0] ?? step[0]];
          const state = stateOf(index);
          return (
            <li key={index} className={styles.step} data-step={state}>
              {index > 0 && <span aria-hidden className={styles.link} data-link={linkOf(index - 1)} />}
              <span className={cn(styles.node, kinds.some((kind) => fresh.has(kind)) && styles.nodeFresh)}>
                {state === "locked" || state === "next" ? (
                  <LockSimple aria-hidden size={14} weight="bold" />
                ) : (
                  <Glyph aria-hidden size={16} weight="bold" />
                )}
              </span>
              <span className={styles.stepLabel}>{(kinds.length ? kinds : [...step]).map((kind) => labels.clue[kind]).join(", ")}</span>
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>{labels.ladderNote}</p>

      <ul className={styles.cards}>
        {cards.map((clue) => {
          const Glyph = CLUE_ICONS[clue.kind];
          return (
            <li key={clue.kind} className={cn(styles.card, fresh.has(clue.kind) && styles.fresh)}>
              <span className={styles.cardHead}>
                <span className={styles.cardIcon}><Glyph aria-hidden size={14} weight="bold" /></span>
                <span className={styles.cardLabel}>{labels.clue[clue.kind]}</span>
              </span>
              <span className={cn(styles.value, clue.kind === "initial" && styles.initial, (clue.kind === "revenueGrowth" || clue.kind === "netMargin") && (clue.pct >= 0 ? styles.up : styles.down))}>
                {clueValue(clue, locale, labels)}
              </span>
              <ClueVisual clue={clue} year={year} labels={labels} locale={locale} />
            </li>
          );
        })}
        {locked.map((kind) => {
          /* Kartın açılması için gereken yanlış sayısı: yoldaki sırası. */
          const need = stepOf(kind) - misses;
          return (
            <li key={kind} className={cn(styles.card, styles.locked)}>
              <span className={styles.cardHead}>
                <span className={cn(styles.cardIcon, styles.lockIcon)}><LockSimple aria-hidden size={14} weight="bold" /></span>
                <span className={styles.cardLabel}>{labels.clue[kind]}</span>
              </span>
              <span className={styles.lockLine}>{need <= 1 ? labels.locked : fill(labels.lockedLater, { n: need })}</span>
              <span aria-hidden className={styles.pips}>
                {Array.from({ length: need }, (_, i) => (
                  <span key={i} className={styles.pip} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Kartın görseli — değerin ölçek üstündeki yeri. Baş harf ve sektör
    görselsiz: harf kendisi büyük karo, sektör adı yeterince somut. */
function ClueVisual({ clue, year, labels, locale }: { clue: Clue; year: number; labels: StockPuzzleLabels; locale: Locale }) {
  if (clue.kind === "capBand") {
    const total = CAP_BANDS.length;
    return (
      <span className={styles.visual}>
        <span aria-hidden className={styles.bands}>
          {CAP_BANDS.map((_, i) => (
            <span key={i} className={styles.band} data-on={i === clue.band ? "" : undefined} data-below={i < clue.band ? "" : undefined} />
          ))}
        </span>
        <span className={styles.caption}>{fill(labels.bandOf, { n: clue.band + 1, total })}</span>
      </span>
    );
  }
  if (clue.kind === "ipoYear") {
    const span = Math.max(1, year - IPO_YEAR_FLOOR);
    const at = Math.min(1, Math.max(0, (clue.year - IPO_YEAR_FLOOR) / span));
    return (
      <span className={styles.visual}>
        <span aria-hidden className={styles.lane}>
          <span className={styles.laneFill} style={{ width: `${at * 100}%` }} />
          <span className={styles.laneDot} style={{ left: `${at * 100}%` }} />
        </span>
        <span aria-hidden className={styles.laneEnds}>
          <span>{IPO_YEAR_FLOOR}</span>
          <span>{year}</span>
        </span>
      </span>
    );
  }
  if (clue.kind === "dividend") {
    if (clue.yieldPct <= 0) return null;
    const at = Math.min(1, clue.yieldPct / DIVIDEND_SCALE);
    return (
      <span className={styles.visual}>
        <span aria-hidden className={styles.lane}>
          <span className={styles.laneFill} style={{ width: `${at * 100}%` }} />
          <span className={styles.laneDot} style={{ left: `${at * 100}%` }} />
        </span>
        <span aria-hidden className={styles.laneEnds}>
          <span>{formatPercentPlain(0, locale, 0)}</span>
          <span>{formatPercentPlain(DIVIDEND_SCALE, locale, 0)}</span>
        </span>
        <span className={styles.caption}>{labels.dividendYield}</span>
      </span>
    );
  }
  if (clue.kind === "beta") {
    const at = Math.min(1, Math.max(0, clue.beta / BETA_SCALE));
    return (
      <span className={styles.visual}>
        <span aria-hidden className={cn(styles.lane, styles.marked)} style={{ "--mark": `${(1 / BETA_SCALE) * 100}%` } as CSSProperties}>
          <span className={styles.laneDot} style={{ left: `${at * 100}%` }} />
        </span>
        <span aria-hidden className={styles.laneEnds}>
          <span>0</span>
          <span>{BETA_SCALE}</span>
        </span>
        <span className={styles.caption}>{labels.betaNote}</span>
      </span>
    );
  }
  if (clue.kind === "letters") {
    return (
      <span className={styles.visual}>
        <span aria-hidden className={styles.letterBoxes}>
          {[...clue.shape].map((char, i) =>
            char === "•" ? <span key={i} className={styles.letterBox} /> : <span key={i} className={styles.letterMark}>{char}</span>,
          )}
        </span>
      </span>
    );
  }
  if (clue.kind === "revenueGrowth" || clue.kind === "netMargin") {
    const share = Math.min(1, Math.abs(clue.pct) / GROWTH_SCALE) * 50;
    return (
      <span className={styles.visual}>
        <span aria-hidden className={cn(styles.lane, styles.centered)}>
          <span
            className={cn(styles.growthBar, clue.pct >= 0 ? styles.growthUp : styles.growthDown)}
            style={clue.pct >= 0 ? { left: "50%", width: `${share}%` } : { right: "50%", width: `${share}%` }}
          />
        </span>
        <span aria-hidden className={styles.laneEnds}>
          <span>{formatPercent(-GROWTH_SCALE, locale, 0)}</span>
          <span>{formatPercent(GROWTH_SCALE, locale, 0)}</span>
        </span>
        <span className={styles.caption}>{clue.kind === "revenueGrowth" ? labels.revenueGrowthNote : labels.marginNote}</span>
      </span>
    );
  }
  return null;
}
