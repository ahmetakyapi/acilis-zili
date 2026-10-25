import type { CSSProperties } from "react";
import type { PosterBreadth } from "@/lib/day-poster";
import { cn } from "@/lib/utils";
import styles from "./PosterMarks.module.css";

/**
 * Posterin küçük izi — poster sayfası ve arşiv kartı AYNI çizimi
 * (kapanış künyesi `DaySeal` 25 Ekim'de kalktı) kullanıyor (25 Ekim). Önceden üçü kendi şeridini
 * ayrı CSS'le basıyordu ve arşiv bambaşka bir dil konuşuyordu (dolu
 * bloklu histogram, sahibinin 10 Ekim "tablo programı" itirazı).
 *
 * - `BreadthStrip`: Nasdaq 100 genişliği, 5 piksellik şerit `--line-soft`
 *   kulvarı üstünde; parçaların boyu üye sayısı, renk yalnız işaretten.
 *   `animate` verilirse girişte soldan `--ease-brand` ile doluyor (poster
 *   sayfası; arşivin otuz kartında değil, orası sayfa açılınca
 *   ekranda olmayan kartlarla dolu). Hareketi azaltana son kare.
 * Arşiv kartının on bir sektör kulvarı (`SectorLanes`) 25 Ekim'de kalktı:
 * kart artık günün sahnesinin minyatürünü taşıyor (`/gun/[tarih]/minyatur`).
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
