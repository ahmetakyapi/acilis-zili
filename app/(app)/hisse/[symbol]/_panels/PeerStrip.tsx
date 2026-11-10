import type { PeerSpread } from "@/lib/peer-spread";
import styles from "./visuals.module.css";

/**
 * Sektör kulvarı — Temel Göstergeler'de değerin altında (25 Ekim).
 *
 * Hisse Skor Kartı'nın şeridiyle AYNI DİL (depth.module.css → `.strip`):
 * 5 piksellik kulvar, üstünde 8 piksellik dolu çubuk, koyu ince medyan
 * çentiği. Fark: skor kartı YÜZDELİK uzayında (çubuk sıfırdan başlar), bu
 * kulvar DEĞER uzayında — "F/K 39,85" ile sektör medyanı 31,2 arasındaki
 * mesafe gerçek mesafe; çubuk MEDYANDAN değere uzanır ve o farkın
 * uzunluğudur.
 *
 * NOKTA KALKTI (10 Kasım 2026, sahibinin sözü: "böyle nokta nokta ne
 * anlatıyor anlamıyorum; yatayda uzun kalın çizgi seviyorum"). Önceki
 * hâlde aynı 15 piksellik rayda dört im vardı: kulvar, medyandan uzanan 5
 * piksellik ince çubuk, medyan çentiği, değerin 11 piksellik noktası (ölçek
 * dışındaysa içi boş halka). Şimdi tek çubuk + tek kıyas imi: çubuğun dış
 * ucu değerin yeri (yuvarlak), medyana dayanan ucu düz. Ölçeğin dışındaki
 * değerde çubuk kulvarın ucuna kadar gider; gerçek sayı hücrede yazılı.
 *
 * Hareket sitenin ortak sözleşmesi (components/motion/PremiumMotion.tsx):
 * çubuk medyandan büyüyor (`line`). Hareketi azaltana ve JS'siz hâlde son
 * kare.
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
  const width = Math.abs(spread.at - spread.medianAt);
  const growsLeft = spread.at < spread.medianAt;
  return (
    <span className={styles.peer} role="img" aria-label={aria} title={aria}>
      <span className={styles.peerRail} aria-hidden>
        <i
          className={styles.peerGap}
          data-side={growsLeft ? "below" : "above"}
          data-motion-draw="line"
          /* En az 1,5: medyanın dibindeki değerde de çubuğun yönü görünsün. */
          style={{
            ...(growsLeft ? { right: `${100 - spread.medianAt}%` } : { left: `${spread.medianAt}%` }),
            width: `${Math.max(width, 1.5)}%`,
            transformOrigin: growsLeft ? "right center" : "left center",
          }}
        />
        <i className={styles.peerMedian} style={{ left: `${spread.medianAt}%` }} />
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
