import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, Cards, Check } from "@phosphor-icons/react/dist/ssr";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { MAX_GUESSES, TILE_KINDS, isClose, isJoker, type GuessRow, type GuessTile, type TileKind } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { tileValue } from "./puzzle-format";
import styles from "./GuessList.module.css";

/**
 * Tahmin satırları ve karşılaştırma karoları (25 Ekim; tek ekran için
 * aynı gün sıkılaştı).
 *
 * Altı SABİT YUVA: yapılan tahmin 38 piksellik satır (aralık 4) (logo, sembol, geniş
 * kapta ad; dört karo), kalan hak 12 piksellik kesik çizgili ince yer
 * tutucu. Tablonun kaç hak kaldığını göstermesi için ayrı bir "3 Hak
 * Kaldı" şeridi gerekmiyor, yuvalar söylüyor; ve en kötü durumda (altı
 * tahmin) tablonun boyu bilindiği için tahta tek ekrana göre ölçülebiliyor.
 *
 * Karoda TAHMİN EDİLEN şirketin değeri yazar; renk cevaba yakınlığı
 * (yumuşak yeşil tutuyor, pirinç yakın, nötr uzak), ok cevabın yönünü
 * söyler. Kural `lib/stock-puzzle.ts` → `compareGuess`. Sütun başlıkları
 * tek kez, karoların hizasında; lejant tek satır (uzun açıklaması tahtanın
 * altındaki "Nasıl Oynanır"da).
 *
 * Son gönderilen satırın karoları sırayla çevrilir (110 ms arayla; karo
 * tek küçük öğe, `--ease-spring-soft`); geri yüklenen satırlar durağan.
 * Aynı sektör ve aynı büyüklük bandındaki yanlış tahmin "Çok Yakın!"
 * rozeti taşır (`isClose`); rozet sembolün ALTINDA, adın yerinde (yanında
 * dururken 1280'de dar şirket sütunundan taşıp ilk karonun üstüne
 * biniyordu). Joker satırı karosuz, tek kesik çizgili şerit.
 */
export function GuessList({
  guesses,
  freshSymbol,
  labels,
  locale,
}: {
  guesses: GuessRow[];
  /** Bu oturumda az önce gönderilen tahmin — karoları çevrilir. */
  freshSymbol: string | null;
  labels: StockPuzzleLabels;
  locale: Locale;
}) {
  const empty = Math.max(0, MAX_GUESSES - guesses.length);
  return (
    <div className={styles.list}>
      <div aria-hidden className={styles.head}>
        <span />
        <span className={styles.tiles}>
          {TILE_KINDS.map((kind) => (
            <span key={kind}>{labels.tile[kind]}</span>
          ))}
        </span>
      </div>
      <ol className={styles.rows}>
        {guesses.map((row, rowIndex) =>
          isJoker(row.symbol) ? (
            <li key={`joker-${rowIndex}`} className={cn(styles.jokerRow, rowIndex === guesses.length - 1 && freshSymbol === row.symbol && styles.fresh)} data-tahta="tahmin">
              <Cards aria-hidden size={15} weight="bold" />
              {labels.jokerRow}
            </li>
          ) : (
            <li key={row.symbol} className={cn(styles.row, row.correct && styles.correct, row.symbol === freshSymbol && styles.fresh)} data-tahta="tahmin">
              <span className={styles.company}>
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                <span className={styles.names}>
                  <span className={styles.symbolLine}>
                    <span className={styles.symbol}>{row.symbol}</span>
                    {row.correct && (
                      <span className={styles.check}>
                        <Check aria-hidden size={10} weight="bold" />
                        <span className="sr-only">{labels.correct}</span>
                      </span>
                    )}
                  </span>
                  {isClose(row) ? <span className={styles.close}>{labels.closeBadge}</span> : <span className={styles.name}>{row.name}</span>}
                </span>
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
        {Array.from({ length: empty }, (_, i) => (
          <li key={`slot-${i}`} aria-hidden className={styles.slot} data-tahta="tahmin" />
        ))}
      </ol>

      <ul className={styles.legend}>
        <li><span aria-hidden className={styles.swatch} data-grade="match" />{labels.legendMatch}</li>
        <li><span aria-hidden className={styles.swatch} data-grade="near" />{labels.legendNear}</li>
        <li><span aria-hidden className={styles.swatch} data-grade="far" />{labels.legendFar}</li>
        <li><ArrowUp aria-hidden size={12} weight="bold" />{labels.legendArrow}</li>
      </ul>
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
    <span className={styles.tile} data-grade={tile ? (grade ?? "far") : "none"} style={{ "--i": index } as CSSProperties} title={spoken}>
      <span aria-hidden className={cn(styles.tileValue, !value && styles.tileEmpty)}>{value ?? labels.noData}</span>
      {toward === "up" && <ArrowUp aria-hidden size={12} weight="bold" className={styles.arrow} />}
      {toward === "down" && <ArrowDown aria-hidden size={12} weight="bold" className={styles.arrow} />}
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
