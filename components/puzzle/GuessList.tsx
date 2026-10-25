import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, Cards, Check } from "@phosphor-icons/react/dist/ssr";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { MAX_GUESSES, TILE_KINDS, isClose, isJoker, type GuessRow, type GuessTile, type PuzzleStatus, type TileKind } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { fill, tileValue } from "./puzzle-format";
import styles from "./GuessList.module.css";

/**
 * Tahmin satırları ve karşılaştırma karoları (25 Ekim).
 *
 * Her satır: şirket, sonra dört karo (sektör, piyasa değeri, halka arz,
 * büyüme). Karoda TAHMİN EDİLEN şirketin değeri yazar; renk cevaba
 * yakınlığı (yumuşak yeşil tutuyor, pirinç yakın, nötr uzak), ok cevabın
 * yönünü söyler. Kural `lib/stock-puzzle.ts` → `compareGuess`.
 *
 * BOŞ SATIR YOK: eskiden altı kesik çerçeveli "N. Tahmin" satırı panelin
 * yarısını boş kutuyla dolduruyordu (1440'ta 330 piksel). Kalan haklar
 * şimdi tek ince şerit; başlıktaki altı nokta da aynı şeyi söylüyor.
 *
 * Son gönderilen satırın karoları sırayla çevrilir (Wordle'ın açılışı,
 * 110 ms arayla; karo tek küçük öğe, `--ease-spring-soft` hafifçe aşıp
 * oturur); geri yüklenen satırlar durağan. Aynı sektör ve aynı büyüklük
 * bandındaki yanlış tahmin "Çok Yakın!" rozeti taşır (`isClose`). Joker
 * satırı karosuz, tek kesik çizgili şerit.
 */
export function GuessList({
  guesses,
  status,
  freshSymbol,
  labels,
  locale,
}: {
  guesses: GuessRow[];
  status: PuzzleStatus;
  /** Bu oturumda az önce gönderilen tahmin — karoları çevrilir. */
  freshSymbol: string | null;
  labels: StockPuzzleLabels;
  locale: Locale;
}) {
  const left = status === "playing" ? MAX_GUESSES - guesses.length : 0;
  return (
    <div className={styles.list}>
      {guesses.length > 0 && (
        <>
          <div aria-hidden className={styles.head}>
            <span className={styles.headCompany} />
            <span className={styles.tiles}>
              {TILE_KINDS.map((kind) => (
                <span key={kind}>{labels.tile[kind]}</span>
              ))}
            </span>
          </div>
          <ol className={styles.rows}>
            {guesses.map((row, rowIndex) =>
              isJoker(row.symbol) ? (
                <li key={`joker-${rowIndex}`} className={cn(styles.jokerRow, rowIndex === guesses.length - 1 && freshSymbol === row.symbol && styles.fresh)}>
                  <Cards aria-hidden size={16} weight="bold" />
                  {labels.jokerRow}
                </li>
              ) : (
              <li key={row.symbol} className={cn(styles.row, row.correct && styles.correct, row.symbol === freshSymbol && styles.fresh)}>
                <span className={styles.company}>
                  <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                  <span className={styles.names}>
                    <span className={styles.symbol}>{row.symbol}</span>
                    <span className={styles.name}>{row.name}</span>
                  </span>
                  {row.correct && (
                    <span className={styles.verdict}>
                      <span className={styles.check} aria-hidden><Check size={12} weight="bold" /></span>
                      <span className="sr-only">{labels.correct}</span>
                    </span>
                  )}
                  {isClose(row) && <span className={styles.close}>{labels.closeBadge}</span>}
                </span>
                <span className={styles.tiles}>
                  {TILE_KINDS.map((kind, index) => (
                    <Tile
                      key={kind}
                      kind={kind}
                      index={index}
                      tile={row.tiles[kind]}
                      value={tileValue(kind, row.values, locale, labels)}
                      labels={labels}
                    />
                  ))}
                </span>
              </li>
              ),
            )}
          </ol>
        </>
      )}

      {left > 0 && (
        <div className={styles.slots}>
          <span aria-hidden className={styles.slotBars}>
            {Array.from({ length: left }, (_, i) => (
              <span key={i} className={styles.slotBar} />
            ))}
          </span>
          <span className={cn(styles.slotLabel, "numeral")}>{fill(labels.slotsLeft, { n: left })}</span>
        </div>
      )}

      <div className={styles.legend}>
        <ul className={styles.keys}>
          <li><span aria-hidden className={styles.swatch} data-grade="match" />{labels.legendMatch}</li>
          <li><span aria-hidden className={styles.swatch} data-grade="near" />{labels.legendNear}</li>
          <li><span aria-hidden className={styles.swatch} data-grade="far" />{labels.legendFar}</li>
          <li><ArrowUp aria-hidden size={12} weight="bold" />{labels.legendArrow}</li>
        </ul>
        <p className={styles.legendNote}>{labels.legendNote}</p>
      </div>
    </div>
  );
}

function Tile({
  kind,
  index,
  tile,
  value,
  labels,
}: {
  kind: TileKind;
  index: number;
  tile: GuessTile | null;
  value: string | null;
  labels: StockPuzzleLabels;
}) {
  const grade = tile?.grade ?? null;
  const toward = tile?.toward ?? null;
  const towardText = toward && kind !== "sector" ? labels.toward[kind][toward] : null;
  const spoken = [`${labels.tile[kind]}: ${value ?? labels.noData}`, grade ? labels.grade[grade] : null, towardText].filter(Boolean).join(", ");
  return (
    <span className={styles.tile} data-grade={tile ? (grade ?? "far") : "none"} style={{ "--i": index } as CSSProperties}>
      <span aria-hidden className={cn(styles.tileValue, !value && styles.tileEmpty)}>{value ?? labels.noData}</span>
      {toward === "up" && <ArrowUp aria-hidden size={13} weight="bold" className={styles.arrow} />}
      {toward === "down" && <ArrowDown aria-hidden size={13} weight="bold" className={styles.arrow} />}
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
