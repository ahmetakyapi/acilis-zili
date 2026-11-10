import type { CSSProperties } from "react";
import { type Locale } from "@/lib/i18n";
import { laneOverflows } from "@/lib/home-figures";
import { cn, directionOf, formatPercent } from "@/lib/utils";
import styles from "./HomeLanes.module.css";

/**
 * Ana sayfanın yan kolon şeridi — Dünya Piyasaları ve Günün Hareketleri
 * (8 Kasım görsel tur; ölçüm ve kararlar HomeLanes.module.css başında).
 *
 * NEDEN `MiniLane` DEĞİL. Bülten bandının şeridi (PosterLanes) ucunda bir
 * işaret taşımıyor ve iki kart daha onu kullanıyor; buraya gereken UÇ NOKTASI
 * (değerin bittiği yer, lolipop) o bileşeni değiştirmeyi gerektiriyordu.
 * Dil aynı: `--line-soft` kulvar, ortada `--line-strong` sıfır, 5 piksel,
 * renk yalnız işaretten. Ölçek panel başına TEK (`sharedLaneScale`).
 *
 * 10 KASIM (gece) — KALIN ÇUBUK, NOKTA YOK (ana oturumun kararı; sahibinin
 * aynı günkü sözü: "böyle nokta nokta ne anlatıyor anlamıyorum; yatayda
 * uzun kalın çizgi seviyorum"). 8 Kasım'ın lolipopu (5 piksellik ince dolgu
 * + ucunda 9 piksellik nokta) tam da o itirazın çizimiydi ve aynı sayfadaki
 * "Sektörler ve Temalar" bandı (`RankBars`) aynı gün kalın çubuğa geçmişti:
 * yan ray başka bir dil konuşuyordu. Şimdi bandın dili: 5 piksellik kulvarın
 * üstünde sıfırdan değere uzanan 10 piksellik DOLU çubuk (eksen tarafı düz,
 * uzak ucu yuvarlak), nokta yok. Çizim globals'ın `bar-fill`i (modüldeki
 * `lane-grow` / `lane-dot` keyframes'i silindi; katalogda karşılığı vardı),
 * kapı panelin `data-draw`ında, kademe `--i` × `--step` (en çok 10 satır).
 * `RankBars` doğrudan kullanılmadı: onun satırı ad | kulvar | yüzde ve
 * kırılımları görüntü alanına göre; ray 350 pikselde iki katlı, işaret
 * sütunlu (bayrak / logo) ve kapsayıcı sorgulu. Ölçüler ve tonlar aynı.
 *
 * 10 KASIM (telefon turu) — TEK UÇ DEĞER ÖLÇEĞİ BELİRLEMEZ: ölçek artık
 * `sharedLaneScale`in ikinci-değer kuralından; aşan çubuk kola dayanır,
 * ucundan 4 piksel içeride 2 piksellik kesik taşır (`data-over`). Ölçüm:
 * 390, kol 135 piksel; −%6,93 · −%1,54 · −%1,20 gününde öteki çubuklar
 * 13–30 → 105–135 piksel.
 *
 * Sıfır ORTADA (bantta veriden): iki panel de iki yönlü okunuyor
 * (yükselenler / düşenler alt alta tek ayrışan grafik) ve eksenin üstündeki
 * etiket simetrik ±ölçek.
 */
export function HomeLane({
  change,
  scale,
  index = 0,
}: {
  change: number;
  scale: number;
  /** Giriş sırası (gecikme). */
  index?: number;
}) {
  const dir = directionOf(change);
  /* Ölçeği aşan değer (tek uç değerli gün; `sharedLaneScale`) kola dayanır
     ve ucunda kesik taşır: tabloların dili (BoardTable → `.fill[data-over]`). */
  const over = laneOverflows(change, scale);
  const len = scale > 0 ? (Math.min(Math.abs(change), scale) / scale) * 50 : 0;
  return (
    <span aria-hidden data-lane="" className={styles.track}>
      {dir !== "flat" && (
        <i
          className={cn("bar-fill", styles.bar)}
          data-dir={dir}
          data-over={over ? "" : undefined}
          style={{ width: `${len.toFixed(2)}%`, "--i": Math.min(index, 10) } as CSSProperties}
        />
      )}
    </span>
  );
}

/**
 * Ölçeğin EKSENİ — "Ortak Ölçek ±%4,1" künyesinin yerine (8 Kasım).
 * Künye başlığın sağında bir sayıydı; okur onu şeritlere kendisi taşımak
 * zorundaydı. Eksen şeritlerle aynı ızgara sütununda, aynı sol ve sağ
 * hatta: uçlar −/+ ölçek, ortada 0 ve sıfır çizgisine inen kısa çentik.
 * Görsel bir kopya; ekran okuyucuya tek cümle (`label`).
 */
export function LaneAxis({
  scale,
  locale,
  label,
  className,
}: {
  scale: number;
  locale: Locale;
  label: string;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={cn(styles.row, styles.axisRow, className)}>
      <span aria-hidden className={styles.axis}>
        <span className={styles.axisMin}>{formatPercent(-scale, locale, 1)}</span>
        <span className={styles.axisZero}>0</span>
        <span className={styles.axisMax}>{formatPercent(scale, locale, 1)}</span>
      </span>
    </div>
  );
}
