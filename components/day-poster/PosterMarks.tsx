import type { CSSProperties } from "react";
import type { PosterBreadth, PosterMove } from "@/lib/day-poster";
import { cn } from "@/lib/utils";
import styles from "./PosterMarks.module.css";

/**
 * Posterin iki küçük izi — kapanış künyesi (`DaySeal`), poster sayfası ve
 * arşiv kartı AYNI çizimi kullanıyor (25 Ekim). Önceden üçü kendi şeridini
 * ayrı CSS'le basıyordu ve arşiv bambaşka bir dil konuşuyordu (dolu
 * bloklu histogram, sahibinin 10 Ekim "tablo programı" itirazı).
 *
 * - `BreadthStrip`: S&P 500 genişliği, 5 piksellik şerit `--line-soft`
 *   kulvarı üstünde; parçaların boyu üye sayısı, renk yalnız işaretten.
 *   `animate` verilirse girişte soldan `--ease-brand` ile doluyor (künye
 *   ve poster sayfası; arşivin otuz kartında değil, orası sayfa açılınca
 *   ekranda olmayan kartlarla dolu). Hareketi azaltana son kare.
 * - `SectorLanes`: on bir sektör kulvarı, sahnenin (lib/ink/poster.ts)
 *   statik küçük hâli: güçlüden zayıfa, sıfır çizgisi `--line-strong`,
 *   şerit sıfırdan sağa yükselişte, sola düşüşte; ölçek posterle tek
 *   (`posterScale`). SIFIR NÖTR: değişimi tam sıfır olan sektöre şerit
 *   basılmıyor (eski arşiv `>= 0` ile onu yükseliş renginde çiziyordu).
 */
export function BreadthStrip({
  breadth,
  label,
  animate = false,
  className,
}: {
  breadth: Pick<PosterBreadth, "advancing" | "unchanged" | "declining">;
  /** Ekran okuyucu cümlesi. */
  label: string;
  animate?: boolean;
  className?: string;
}) {
  const total = breadth.advancing + breadth.unchanged + breadth.declining;
  const part = (n: number) => ({ "--part": total > 0 ? n / total : 0 }) as CSSProperties;
  return (
    <span className={cn(styles.strip, animate && styles.fill, className)} role="img" aria-label={label}>
      <span className={styles.ink}>
        <span className={styles.up} style={part(breadth.advancing)} />
        <span className={styles.flat} style={part(breadth.unchanged)} />
        <span className={styles.down} style={part(breadth.declining)} />
      </span>
    </span>
  );
}

export function SectorLanes({
  sectors,
  scale,
  label,
  className,
}: {
  sectors: readonly PosterMove[];
  scale: number;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn(styles.lanes, className)} role="img" aria-label={label}>
      {sectors.map((move) => {
        const length = (Math.min(Math.abs(move.change), scale) / scale) * 50;
        const side = move.change > 0 ? styles.barUp : move.change < 0 ? styles.barDown : null;
        return (
          <span key={move.symbol} className={styles.lane}>
            {side && <span className={cn(styles.bar, side)} style={{ "--len": `${length}%` } as CSSProperties} />}
          </span>
        );
      })}
    </span>
  );
}
