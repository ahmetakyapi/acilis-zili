import type { PeerSpread } from "@/lib/peer-spread";
import styles from "./visuals.module.css";

/**
 * Sektör kulvarı — Temel Göstergeler'de değerin altında (25 Ekim).
 *
 * Hisse Skor Kartı'nın şeridiyle AYNI DİL (depth.module.css → `.strip`):
 * 5 piksellik kulvar, nötr medyan çizgisi, marka tonunda nokta. Fark: skor
 * kartı YÜZDELİK uzayında (medyan hep ortaya yakın), bu kulvar DEĞER
 * uzayında — "F/K 39,85" ile sektör medyanı 31,2 arasındaki mesafe gerçek
 * mesafe. Medyandan noktaya uzanan ince çubuk o farkın uzunluğu.
 *
 * Hareket sitenin ortak sözleşmesi (components/motion/PremiumMotion.tsx):
 * nokta medyandan kalkıp kendi yerine kayıyor (`travel`), fark çubuğu
 * medyandan büyüyor (`line`). Hareketi azaltana ve JS'siz hâlde son kare.
 *
 * Uçların dışındaki değer uçta AÇIK nokta: ölçeğin dışında olduğunu
 * söylüyor, sayı hücrede yazılı.
 */
export function PeerStrip({
  spread,
  position,
  aria,
}: {
  spread: PeerSpread;
  /** Yüzdelik künyesi ("Sektörün %72'sinden Yüksek"). */
  position: string;
  aria: string;
}) {
  const from = Math.min(spread.at, spread.medianAt);
  const width = Math.abs(spread.at - spread.medianAt);
  const growsLeft = spread.at < spread.medianAt;
  return (
    <span className={styles.peer} role="img" aria-label={aria} title={aria}>
      <span className={styles.peerRail} aria-hidden>
        {width > 0.5 && (
          <i
            className={styles.peerGap}
            data-motion-draw="line"
            style={{ left: `${from}%`, width: `${width}%`, transformOrigin: growsLeft ? "right center" : "left center" }}
          />
        )}
        <i className={styles.peerMedian} style={{ left: `${spread.medianAt}%` }} />
        <i
          className={styles.peerDot}
          data-clipped={spread.clipped !== 0 ? "" : undefined}
          data-motion-draw="travel"
          data-delta={(spread.medianAt - spread.at).toFixed(2)}
          style={{ left: `${spread.at}%` }}
        />
      </span>
      {/* Künye TEK SATIR: konum. Medyanın sayısı ekran okuyucu adında ve
          üzerine gelince (`title`); görünür ikinci satır kartı iki ızgara
          satırında 32 piksel uzatıyor, komşu Hareketli Ortalamalar'ın
          altında boşluk açıyordu (ölçüldü, 25 Ekim). Medyanın YERİ çentikte. */}
      <span className={styles.peerCaption} aria-hidden>
        <span>{position}</span>
      </span>
    </span>
  );
}
