import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { median, type MoveSet } from "@/lib/theme-stats";
import { barScale } from "@/lib/theme-view";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, directionOf, directionText, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./ThemeDetail.module.css";
import { ThemeStrip } from "./ThemeStrip";

/**
 * Detay kapağının okuması — temanın günü tek bakışta (10 Kasım 2026).
 *
 * ÖNCE: kapağın sağ sütununda üyelerin logo kümesi duruyordu (sabit 184
 * piksellik kutu; beş üyeli temada kutunun ortasında tek sıra, 1440'ta
 * 140 piksel boş). Kapak temanın adını söylüyor ama GÜNÜNÜ söylemiyordu:
 * medyan ilk ekranın altında, ölçü ızgarasındaydı; ölçüt kıyası haritanın
 * yanındaki 272 piksellik sütunda, haritayı daraltarak.
 *
 * ŞİMDİ: sayfanın en büyük puntosu günün medyanında (ilk ekran; yüklemede
 * bir kez yuvarlanır — `ui/RollingFigure`). Altında dizin panosundaki
 * satırın AYNI şeridi, bu kez temanın kendi ölçeğinde: her üye bir çentik,
 * medyan düğme, ölçüt fonu içi boş im. Fon varsa adı, yüzdesi ve aradaki
 * fark tek cümleyle. Logolar haritada ve tabloda zaten var; küme kalktı.
 *
 * ÖLÇÜT KIYASI ancak ikisi AYNI SEANSI anlatıyorsa (kural eski
 * `BenchmarkAside`ten, aynen): açılış öncesinde ETF bu sabah işlem görmüş,
 * üyeler görmemiş olabilir (ya da tersi). O hâlde fonun yüzdesi yine
 * yazılıyor ama şeritte imi ve "kaç puan üstünde" cümlesi yok; iki ayrı
 * günden bir fark üretmek, fark göstermemekten kötü.
 *
 * `data === null` yedek: aynı kutu, sayısız; akış inince kapak oynamıyor.
 */

/** Bu farkın altında "aynı yerde" denir: iki basamaklı yazımda 0,00. */
const EVEN_POINTS = 0.005;

export type ReadingLabels = {
  median: string;
  coverage: string;
  medianMissing: string;
  spreadLabel: string;
  spreadMissing: string;
  lastClose: string;
  benchAbove: string;
  benchBelow: string;
  benchEven: string;
  benchMixed: string;
};

export function ThemeReading({
  data,
  hasBenchmark,
  locale,
  labels,
}: {
  data: {
    rows: ThemeRow[];
    moves: MoveSet | null;
    benchmark: (ThemeRow & { displayName: string }) | null;
  } | null;
  /** Yedekte ölçüt satırının yeri tutulsun diye (durağan bilgi). */
  hasBenchmark: boolean;
  locale: string;
  labels: ReadingLabels;
}) {
  const moves = data?.moves ?? null;
  const mid = moves ? median(moves.values) : null;
  const benchmark = data?.benchmark ?? null;
  const themeSession = moves?.basis === "session";
  const benchSession = benchmark !== null && benchmark.basis !== null && benchmark.basis !== "lastClose";
  const comparable =
    mid !== null && benchmark !== null && benchmark.changePct !== null && themeSession === benchSession;
  const diff = comparable ? mid - benchmark.changePct! : null;
  const scale = moves && moves.values.length > 0
    ? barScale([...(mid === null ? [] : [mid]), ...(comparable ? [benchmark.changePct!] : [])])
    : null;
  const points = data && moves
    ? data.rows.flatMap((row, i) => (moves.included[i] ? [{ symbol: row.symbol, change: row.changePct! }] : []))
    : [];
  const up = moves ? moves.values.filter((value) => value > 0).length : 0;
  const down = moves ? moves.values.filter((value) => value < 0).length : 0;
  const total = moves?.values.length ?? 0;
  const clippedLow = false;
  const clippedHigh = false;

  return (
    <div className={styles.reading} aria-busy={data === null || undefined}>
      <div className={styles.readHead}>
        <span className={styles.readLabel}>{labels.median}</span>
        {data !== null && moves !== null && total < data.rows.length && (
          <span className={cn("numeral", styles.readMeta)}>
            {labels.coverage.replace("{count}", String(total)).replace("{total}", String(data.rows.length))}
          </span>
        )}
      </div>
      {/* Renk son kapanışta nötr: yeşil ve kırmızı "bugün" der (ölçü
          ızgarasıyla aynı kural, ThemeStats). */}
      <p
        className={cn(
          "numeral",
          styles.readFig,
          mid === null ? "text-muted" : themeSession ? directionText(directionOf(mid)) : "text-body",
        )}
      >
        {mid === null ? NO_VALUE : <RollingFigure value={formatPercent(mid, locale)} />}
      </p>
      <div className={styles.readStrip} data-draw>
        <ThemeStrip
          points={points}
          median={mid}
          bench={comparable ? benchmark.changePct! : undefined}
          scale={scale}
          label={
            moves === null
              ? labels.spreadMissing
              : labels.spreadLabel
                  .replace("{count}", String(total))
                  .replace("{up}", String(up))
                  .replace("{down}", String(down))
          }
        />
        <div className={cn("numeral", styles.readAxis)} aria-hidden>
          <span>{scale === null ? " " : `${clippedLow ? "≤ " : ""}${formatPercent(-scale, locale, 0)}`}</span>
          <span>{scale === null ? " " : "0"}</span>
          <span>{scale === null ? " " : `${clippedHigh ? "≥ " : ""}${formatPercent(scale, locale, 0)}`}</span>
        </div>
      </div>
      {hasBenchmark && (
        <div className={styles.readBench}>
          <span className={styles.readBenchId}>
            <i className={styles.readBenchKey} aria-hidden />
            {benchmark ? (
              /* Fonun kendi sayfası: tablodaki ölçüt satırı kalktı (10
                 Kasım), bağlantısı burada. */
              <Link href={`/hisse/${benchmark.symbol}`} prefetch={false} className={styles.readBenchLink}>
                <b className="numeral">{benchmark.symbol}</b>
                <span>{benchmark.displayName}</span>
              </Link>
            ) : (
              <span className="skeleton h-4 w-40 rounded" />
            )}
          </span>
          <b
            className={cn(
              "numeral",
              styles.readBenchPct,
              !benchmark || benchmark.changePct === null
                ? "text-muted"
                : benchSession
                  ? directionText(directionOf(benchmark.changePct))
                  : "text-body",
            )}
          >
            {!benchmark || benchmark.changePct === null ? NO_VALUE : formatPercent(benchmark.changePct, locale)}
          </b>
          <p className={styles.readNote}>
            {data === null
              ? " "
              : benchmark === null || diff === null
                ? labels.benchMixed
                : Math.abs(diff) < EVEN_POINTS
                  ? labels.benchEven
                  : (diff > 0 ? labels.benchAbove : labels.benchBelow).replace("{diff}", formatPrice(Math.abs(diff), locale))}
          </p>
        </div>
      )}
      {data !== null && moves === null && <p className={styles.readNote}>{labels.medianMissing}</p>}
    </div>
  );
}
