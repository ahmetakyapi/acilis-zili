import type { CSSProperties } from "react";
import type { ExpectationReading } from "@/lib/analysis-visuals";
import styles from "./ReportVisuals.module.css";

/**
 * BEKLENTİ ÇİZGİSİ (25 Ekim görsel zirve) — kapaktaki öncü ölçünün altında.
 *
 * Künye "Beklenti 63,4 Mr $ · %1,9 Aştı" diyordu ve okuyucu farkın büyüklüğünü
 * sayıdan çıkarıyordu. Çizgi aynı iki sayıyı ORTAK EKSENDE gösteriyor:
 * beklenti bir çentik, gerçekleşen bir nokta, arası yön renginde bir bant
 * (aştıysa yükseliş yeşili, kaldıysa düşüş kırmızısı — sapmanın işareti,
 * yargı değil). Dil `/karsilastir`'daki RangeTrack ile aynı: ince kulvar,
 * çentik, nokta.
 *
 * Sayılar kaydın künyesinden (`expectationReading`, `lib/analysis-visuals.ts`);
 * künyede açık bir beklenti sayısı yoksa çizgi HİÇ basılmaz, yüzde
 * kalıbından beklenti türetilmez. Çizim `aria-hidden`: iki sayı hemen
 * üstündeki künyede metin olarak yazılı.
 *
 * Giriş bir kez: bant beklenti çentiğinden açılıyor, nokta çentikten kendi
 * yerine kayıyor (`--ease-brand`). Hareketi azaltana son kare.
 */
export function ExpectationLine({
  reading,
  labels,
}: {
  reading: ExpectationReading;
  labels: { expected: string; actual: string };
}) {
  const left = Math.min(reading.expectedAt, reading.actualAt) * 100;
  const width = Math.abs(reading.actualAt - reading.expectedAt) * 100;
  return (
    <span className={styles.expectation} data-outcome={reading.outcome}>
      <span
        aria-hidden
        className={styles.expectationTrack}
        style={
          {
            "--e": `${reading.expectedAt * 100}%`,
            "--a": `${reading.actualAt * 100}%`,
            "--from": reading.actualAt >= reading.expectedAt ? "left" : "right",
          } as CSSProperties
        }
      >
        <span className={styles.expectationBand} style={{ left: `${left}%`, width: `${width}%` }} />
        <span className={styles.expectationNotch} />
        <span className={styles.expectationDot} />
      </span>
      <span aria-hidden className={styles.expectationLegend}>
        <span data-key="expected">{labels.expected}</span>
        <span data-key="actual">{labels.actual}</span>
      </span>
    </span>
  );
}
