import type { Icon } from "@phosphor-icons/react";
import {
  Bank,
  Basket,
  Broadcast,
  Buildings,
  ChartLineUp,
  Coins,
  Cpu,
  Cube,
  Factory,
  FirstAidKit,
  Flag,
  GasPump,
  HandCoins,
  Keyboard,
  Lightning,
  LockSimple,
  Percent,
  Pulse,
  ShoppingBag,
  TextAa,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties, ReactNode } from "react";
import { cn, formatPercent, formatPercentPlain } from "@/lib/utils";
import { CAP_BANDS, CLUE_STEPS, IPO_YEAR_FLOOR, stepOf, type Clue, type ClueKind, type GuessRow, type PuzzleStatus } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { clueValue, fill } from "./puzzle-format";
import styles from "./ClueBoard.module.css";

/**
 * İpucu ızgarası (25 Ekim; aynı gün ikinci kez, tek ekran için yeniden).
 *
 * NEDEN IZGARA: ilk sürümde altı düğümlü bir yol şeridi ve altında on
 * kart vardı; kart başına ~120 piksel, üç sütun, 1500 genişlikte bile
 * hepsini görmek için kaydırmak gerekiyordu (sahibinin ekran görüntüsü:
 * "kabul edilemez"). Şimdi siluetin dışındaki on ipucu EŞİT KAROLAR ve
 * yolun kendisi ızgaranın düzeni: geniş kapta beş sütun × iki satır,
 * her SÜTUN bir basamak (1. yanlışta açılan ikili, 2. yanlışta açılan
 * ikili…); dar kapta iki sütun, her SATIR bir basamak. Yer kaplayan ayrı
 * bir yol şeridi yok, sıra yine okunuyor. Karonun yeri `--step`/`--slot`
 * ile açıkça verilir: verisi olmayan ipucu atlanınca öteki karolar
 * basamaktan kaymaz.
 *
 * KARO: simge + ad, değer, değerin altında 5 piksellik kulvar (temettü
 * 0-%6, oynaklık 0-3 ve piyasa çizgisi, halka arz 1980-bugün, büyüme ve
 * marj ±%50 ortalı, piyasa değeri yedi bant). Uç değerler kulvarın iki
 * yanında; açıklama cümlesi ("Piyasa 1; üstü daha hareketli") `title` ve
 * ekran okuyucu metninde, karoda tek satır yer yemesin.
 *
 * KİLİTLİ KARO aynı boyda: kilit, "3. Yanlışta" (sırtı aşağıda, "OYUN
 * MASASI"). Bu oturumda açılan karo yerinde çevrilir; geri yüklenen durum
 * durağan.
 *
 * Renk: kulvar ve bant yumuşak mavi (büyüklük, etkileşim değil), büyüme ve
 * marj yön renginde. Durumsuz: sunucuda da çizilir.
 *
 * OYUN MASASI (25 Ekim, üçüncü kurulum — "daha görsel, oynaması zevkli").
 * Kapalı karo bir KART SIRTI: sitenin ince taralı dokusu (135°, 1 piksel
 * `--line`; BriefLedger ve BrokerBoard'daki tarama), ortada kilit ve hangi
 * yanlışta açılacağı; sıradaki basamağın sırtı mavi tonda. Açılan karo
 * yerinde Y ekseninde çevrilir (kart dönüyor; tek küçük öğe olduğu için
 * `--ease-spring-soft`, CLAUDE.md). Her karonun simgesi yuvarlak bir
 * rozette; sektör karosunda simge sektörün kendisi (Günün Grafiği'nin
 * sektör simgeleriyle aynı eşleme). Görseller zenginleşti ama karo boyu
 * aynı bütçede: piyasa değeri yükselen yedi basamak (merdiven: bant
 * büyüdükçe çubuk uzar), halka arz on yıl çentikli zaman çizgisi, temettü
 * ödemeyende de kulvar (nokta sıfırda: "ödemiyor" da bir değer), baş harf
 * klavye tuşu.
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

/** Büyüme ve marj çubuğunun tavanı — ±%50 dışı tavanda durur. */
const GROWTH_SCALE = 50;
/** Temettü kulvarının tavanı (%) ve beta kulvarının tavanı. */
const DIVIDEND_SCALE = 6;
const BETA_SCALE = 3;

/** Sektör karosunun simgesi — GICS adıyla (Günün Grafiği'ndeki
    `components/daily-chart/sector-icons.ts` ile aynı simgeler). */
const SECTOR_GLYPHS: Readonly<Record<string, Icon>> = {
  "Information Technology": Cpu,
  Financials: Bank,
  "Health Care": FirstAidKit,
  "Consumer Discretionary": ShoppingBag,
  "Consumer Staples": Basket,
  Energy: GasPump,
  Industrials: Factory,
  Materials: Cube,
  Utilities: Lightning,
  "Real Estate": Buildings,
  "Communication Services": Broadcast,
};

/** Halka arz çizgisinin on yıl çentikleri. */
const IPO_TICKS = [1990, 2000, 2010, 2020] as const;

/** Basamaktaki sırası (0 ya da 1) — karonun ızgaradaki satırı/sütunu. */
const slotOf = (kind: ClueKind) => (CLUE_STEPS[stepOf(kind)] as readonly ClueKind[]).indexOf(kind);

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
  const cards = clues.filter((clue) => clue.kind !== "silhouette");
  const locked = upcoming.filter((kind) => kind !== "silhouette");
  const place = (kind: ClueKind) => ({ "--step": stepOf(kind), "--slot": slotOf(kind) + 1 }) as CSSProperties;

  return (
    <div className={styles.board}>
    <ul className={styles.grid}>
      {cards.map((clue) => {
        const Glyph = (clue.kind === "sector" && clue.gics ? SECTOR_GLYPHS[clue.gics] : undefined) ?? CLUE_ICONS[clue.kind];
        const value = clueValue(clue, locale, labels);
        const note = noteOf(clue, labels);
        const tone = clue.kind === "revenueGrowth" || clue.kind === "netMargin" ? (clue.pct >= 0 ? styles.up : styles.down) : undefined;
        return (
          <li key={clue.kind} className={cn(styles.tile, fresh.has(clue.kind) && styles.fresh)} style={place(clue.kind)} title={note ? `${labels.clue[clue.kind]}: ${value}. ${note}` : undefined} data-tahta="ipucu">
            <span className={styles.head}>
              <span aria-hidden className={styles.badge}>
                <Glyph size={11} weight="bold" />
              </span>
              <span className={styles.label}>{labels.clue[clue.kind]}</span>
            </span>
            {clue.kind === "initial" ? (
              <span className={styles.keycap}>{value}</span>
            ) : (
              <span className={cn(styles.value, tone)}>{value}</span>
            )}
            <ClueVisual clue={clue} year={year} labels={labels} locale={locale} />
            {note && <span className="sr-only">{note}</span>}
          </li>
        );
      })}
      {locked.map((kind) => {
        const step = stepOf(kind);
        const next = status === "playing" && step === misses + 1;
        return (
          <li key={kind} className={cn(styles.tile, styles.locked, next && styles.next)} style={place(kind)} data-tahta="ipucu">
            <span className={styles.head}>
              <span aria-hidden className={styles.badge}>
                <LockSimple size={11} weight="bold" />
              </span>
              <span className={styles.label}>{labels.clue[kind]}</span>
            </span>
            <span className={styles.lockLine}>{fill(labels.lockedAt, { n: step })}</span>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

/** Karonun açıklama cümlesi — `title` ve ekran okuyucu; karoda yer yemez. */
function noteOf(clue: Clue, labels: StockPuzzleLabels): string | null {
  switch (clue.kind) {
    case "dividend":
      return clue.yieldPct > 0 ? labels.dividendYield : null;
    case "beta":
      return labels.betaNote;
    case "revenueGrowth":
      return labels.revenueGrowthNote;
    case "netMargin":
      return labels.marginNote;
    case "capBand":
      return fill(labels.bandOf, { n: clue.band + 1, total: CAP_BANDS.length });
    default:
      return null;
  }
}

/** Uçlu kulvar: [sol uç] ━━●━━ [sağ uç]. */
function Lane({ start, end, children, className, style }: { start: string; end: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden className={styles.visual}>
      <span className={styles.end}>{start}</span>
      <span className={cn(styles.lane, className)} style={style}>{children}</span>
      <span className={styles.end}>{end}</span>
    </span>
  );
}

/** Karonun görseli — değerin ölçek üstündeki yeri. Sektör ve endüstri
    görselsiz (ad yeterince somut), baş harf kendisi büyük harf. */
function ClueVisual({ clue, year, labels, locale }: { clue: Clue; year: number; labels: StockPuzzleLabels; locale: Locale }) {
  if (clue.kind === "capBand") {
    return (
      <span aria-hidden className={styles.visual}>
        <span className={styles.bands}>
          {CAP_BANDS.map((_, i) => (
            <span
              key={i}
              className={styles.band}
              style={{ "--h": (i + 1) / CAP_BANDS.length } as CSSProperties}
              data-on={i === clue.band ? "" : undefined}
              data-below={i < clue.band ? "" : undefined}
            />
          ))}
        </span>
        <span className={styles.end}>{fill(labels.bandShort, { n: clue.band + 1, total: CAP_BANDS.length })}</span>
      </span>
    );
  }
  if (clue.kind === "ipoYear") {
    const span = Math.max(1, year - IPO_YEAR_FLOOR);
    const at = Math.min(1, Math.max(0, (clue.year - IPO_YEAR_FLOOR) / span));
    return (
      <Lane start={String(IPO_YEAR_FLOOR)} end={String(year)}>
        {IPO_TICKS.filter((tick) => tick < year).map((tick) => (
          <span key={tick} className={styles.tick} style={{ left: `${((tick - IPO_YEAR_FLOOR) / span) * 100}%` }} />
        ))}
        <span className={styles.fill} style={{ width: `${at * 100}%` }} />
        <span className={styles.dot} style={{ left: `${at * 100}%` }} />
      </Lane>
    );
  }
  if (clue.kind === "dividend") {
    const at = Math.min(1, Math.max(0, clue.yieldPct) / DIVIDEND_SCALE);
    return (
      <Lane start={formatPercentPlain(0, locale, 0)} end={formatPercentPlain(DIVIDEND_SCALE, locale, 0)}>
        <span className={styles.fill} style={{ width: `${at * 100}%` }} />
        <span className={styles.dot} style={{ left: `${at * 100}%` }} />
      </Lane>
    );
  }
  if (clue.kind === "beta") {
    const at = Math.min(1, Math.max(0, clue.beta / BETA_SCALE));
    return (
      <Lane start="0" end={String(BETA_SCALE)} className={styles.marked} style={{ "--mark": `${(1 / BETA_SCALE) * 100}%` } as CSSProperties}>
        <span className={styles.dot} style={{ left: `${at * 100}%` }} />
      </Lane>
    );
  }
  if (clue.kind === "letters") {
    return (
      <span aria-hidden className={styles.letters}>
        {[...clue.shape].map((char, i) =>
          char === "•" ? <span key={i} className={styles.letterBox} /> : <span key={i} className={styles.letterMark}>{char}</span>,
        )}
      </span>
    );
  }
  if (clue.kind === "revenueGrowth" || clue.kind === "netMargin") {
    const share = Math.min(1, Math.abs(clue.pct) / GROWTH_SCALE) * 50;
    return (
      <Lane start={formatPercent(-GROWTH_SCALE, locale, 0)} end={formatPercent(GROWTH_SCALE, locale, 0)} className={styles.centered}>
        <span
          className={cn(styles.bar, clue.pct >= 0 ? styles.barUp : styles.barDown)}
          style={clue.pct >= 0 ? { left: "50%", width: `${share}%` } : { right: "50%", width: `${share}%` }}
        />
      </Lane>
    );
  }
  return null;
}
