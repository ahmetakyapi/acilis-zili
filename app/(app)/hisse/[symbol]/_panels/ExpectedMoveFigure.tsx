import { PlayOnView } from "@/components/motion/PlayOnView";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercentPlain } from "@/lib/utils";
import styles from "./depth.module.css";

/** Ölçeğin iki ucundaki pay: en uzak nokta kenara yapışmasın. */
const SCALE_PAD = 1.15;
/** İki nokta bu kadar yakınsa (genişliğin yüzdesi) üst üste değil alt satıra. */
const MIN_GAP_PCT = 3.5;
/** Nokta satırı en çok bu kadar; fazlası son satırda üst üste biner. */
const MAX_ROWS = 3;

/**
 * BANT VE GEÇMİŞ RAPORLAR — açıklayıcı figür (12 Ekim; motion-film
 * `aciklayici-figur.md`, `sayilar.md`). Nesnenin kendisi açıklama: iki
 * okumayı (fiyatlanan ± ve geçmiş hareketler) aynı eksene koyar, "kaç
 * rapor bandı aştı" sorusunu okuyucu saymadan görür. Sayı uydurulmaz:
 * bant `implied.pct`, noktalar `history.movePct`; künye ikisinden sayılır.
 *
 * Sekiz satır:
 *  GOAL    Fiyatlanan bandın geçmiş rapor hareketlerine göre ne kadar geniş
 *          olduğunu tek bakışta göstermek.
 *  OUTPUT  Panel içi figür, sunucu son kareyi basar (PlayOnView).
 *  TIME    ~2 sn (ölçüldü: 1.970 ms, 8 noktayla), bir kez; döngü yok.
 *  LOOK    İnce dil: kulvar `--line-soft`, sıfır `--line-strong`, bant nötr
 *          ton; renk yalnız işaretten (`--up`/`--down`).
 *  MOTION  Kahraman bant: sıfırdan iki yana açılır, 600 ms ease-out-quint.
 *          İkincil noktalar: 150 ms sonra, en eskiden yeniye 70 ms kademe,
 *          10 px düşüş (bandın yolunun ~%60'ı), 360 ms. Künye en son, yalnız
 *          opaklık.
 *  SHOTS   Tek plan: bant → noktalar → künye.
 *  BANNED  Zıplayan opaklık, sayan rakam, döngü, bandın içinde yazı.
 *  QA      Hareket azaltılmışsa ve ilk ekranda son kare; 390'da taşma yok; animasyon yalnız `scale`/`translate`/`opacity`.
 */
export function ExpectedMoveFigure({
  band,
  moves,
  locale,
  d,
}: {
  band: number;
  /** Tarih sırasıyla (eskiden yeniye) ölçülmüş hareketler, yüzde. */
  moves: readonly { date: string; pct: number }[];
  locale: Locale;
  d: Dictionary["stockDepth"];
}) {
  const max = Math.max(band, ...moves.map((m) => Math.abs(m.pct))) * SCALE_PAD;
  const x = (value: number) => 50 + (value / max) * 50;
  const bandLeft = x(-band);
  const outside = moves.filter((m) => Math.abs(m.pct) > band).length;

  /* Satırlama değere göre sıralı yapılır, kademe tarih sırasını korur. */
  const rowOf = new Map<string, number>();
  const lastInRow: number[] = [];
  for (const move of [...moves].sort((a, b) => a.pct - b.pct)) {
    const at = x(move.pct);
    let row = lastInRow.findIndex((end) => at - end >= MIN_GAP_PCT);
    if (row === -1) row = lastInRow.length < MAX_ROWS ? lastInRow.length : MAX_ROWS - 1;
    lastInRow[row] = at;
    rowOf.set(move.date, row);
  }
  const rows = Math.max(1, lastInRow.length);
  const bandText = formatPercentPlain(band, locale, 1);
  const n = String(moves.length);
  const readout = outside === 0
    ? d.emFigReadoutNone.replace("{n}", n)
    : d.emFigReadout.replace("{n}", n).replace("{k}", String(outside));

  return (
    <figure className={styles.emFig}>
      <figcaption className={styles.emFigHead}>
        <h3>{d.emFigTitle}</h3>
        <p>{d.emFigHint}</p>
      </figcaption>
      <PlayOnView className={styles.emFigStage}>
        <div
          className={styles.emFigPlot}
          style={{ "--rows": rows } as React.CSSProperties}
          role="img"
          aria-label={d.emFigAria.replace("{band}", bandText).replace("{n}", n).replace("{k}", String(outside))}
        >
          <i className={styles.emFigBand} style={{ left: `${bandLeft}%`, right: `${bandLeft}%` }} />
          <i className={styles.emFigZero} />
          {moves.map((move, i) => (
            <i
              key={move.date}
              className={styles.emFigDot}
              data-dir={move.pct < 0 ? "down" : "up"}
              data-out={Math.abs(move.pct) > band ? "" : undefined}
              style={{ left: `${x(move.pct)}%`, "--row": rowOf.get(move.date) ?? 0, "--i": i } as React.CSSProperties}
            />
          ))}
        </div>
        {/* Tek etiket, bandın ortasında: iki uca konan etiketler dar bantta
            birbirine, geniş bantta panelin kenarına taşıyordu. */}
        <p className={`numeral ${styles.emFigScale}`} aria-hidden>±{bandText}</p>
        <p className={styles.emFigReadout} style={{ "--n": moves.length } as React.CSSProperties}>{readout}</p>
      </PlayOnView>
    </figure>
  );
}
