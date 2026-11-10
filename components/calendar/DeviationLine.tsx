import type { Deviation } from "@/lib/release-deviation";
import { cn } from "@/lib/utils";
import styles from "./ReleasedData.module.css";

/**
 * Sapma çizgisi. Yüzde konum: orta = %50, uçlar ±`DEVIATION_REACH`.
 *
 * KALIN ÇUBUK, NOKTA YOK (10 Kasım 2026, sahibinin sözü: "böyle nokta
 * nokta ne anlatıyor anlamıyorum; çizgi grafiği yerine yatayda uzun KALIN
 * çizgi seviyorum"; "başka buna uyarlanacak ekran varsa onları da
 * yapalım"). Rayda dört im vardı: 2 piksellik eksen, beklentiden
 * gerçekleşene 4 piksellik yarı saydam "bacak", önceki değerin çentiği ve
 * gerçekleşenin 12 piksellik noktası. Bacak ile nokta aynı şeyi iki kez
 * söylüyordu ve göz ince bacağı değil noktayı okuyordu. Şimdi 5 piksellik
 * kulvarda beklentiden (sıfır çentiği) gerçekleşene uzanan 8 piksellik
 * dolu çubuk, yönü renginde, dış ucu yuvarlak; önceki değer ince gri
 * çentik olarak kaldı (tek kıyas imi). Sapma yoksa çubuk yok: sıfır
 * çentiği tek başına "tam beklenti" diyor.
 *
 * ORTAK BİLEŞEN (6 Kasım). "Son Açıklanan Veriler" kartının yerel
 * fonksiyonuydu; ana sayfanın "Bugünün Akışı" açılan satırı da aynı üç
 * değeri bu çizgiyle okutuyor (CLAUDE.md "karşılaştırılan büyüklük bir de
 * ÇİZGİ olarak okunur"). Biçim tek yerde: ReleasedData.module.css.
 *
 * `motion`: takvim kartında PremiumMotion çizgiyi görünüme girince çizer
 * (`data-motion-*`). Akışta gövde katlı başlıyor ve görünürlük gözlemcisi
 * katlı kutuyu "görünür" sanıp hareketi harcardı; orada `false` verilir ve
 * çubuk kendi CSS animasyonuyla, satır her açıldığında dolar (`[data-leg]`,
 * DayFlow.module.css → "SAPMA ÇİZGİSİ"; oradaki `[data-dot]` kuralı artık
 * eşleşmiyor, nokta kalktı).
 *
 * `compact` (6 Kasım, inceleme): ana sayfanın bülten kartındaki "Günün
 * Verileri" karosu. Kart kendi elle çizdiği bir mini çizgi taşıyordu —
 * önceki çentiği yoktu, ayrı bir dil olmuştu. Şimdi aynı bileşen, rayı
 * 14 piksele inmiş (işaretler orantılı) ve uç adları basılmadan: karoda
 * taban künyesi ve yön zaten yazılı. Ölçüler ReleasedData.module.css →
 * "KÜÇÜK HÂL".
 */
export function DeviationLine({
  deviation,
  below,
  above,
  baseLabel,
  motion = true,
  compact = false,
  className,
}: {
  deviation: Pick<Deviation, "direction" | "actualAt" | "previousAt">;
  below: string;
  above: string;
  baseLabel: string;
  motion?: boolean;
  /** Uç adları basılmaz, ray küçük (bülten kartı). */
  compact?: boolean;
  className?: string;
}) {
  const HALF = 50;
  const pos = (at: number) => HALF + at * HALF;
  const actual = pos(deviation.actualAt);
  const moves = deviation.actualAt !== 0;
  return (
    <div className={cn(styles.line, className)} aria-hidden data-dir={deviation.direction} data-size={compact ? "compact" : undefined} data-motion-track={motion || undefined}>
      <div className={styles.rail}>
        <span className={cn("value-lane", styles.axis)} />
        {/* Beklentiden gerçekleşene uzanan bacak: sıfırdan açılıyor. */}
        {moves && (
          <span
            className="value-bar"
            data-motion-draw={motion ? "line" : undefined}
            data-leg
            data-end={actual > HALF ? "end" : "start"}
            style={{
              left: `${Math.min(HALF, actual)}%`,
              width: `${Math.abs(actual - HALF)}%`,
              transformOrigin: actual > HALF ? "left center" : "right center",
            }}
          />
        )}
        <span className="value-notch" style={{ left: "50%" }} />
        {deviation.previousAt !== null && (
          <span className={styles.previous} style={{ left: `${pos(deviation.previousAt)}%` }} />
        )}
      </div>
      {!compact && (
        <div className={styles.ends}>
          <span>{below}</span>
          <span className={styles.endsZero}>{baseLabel}</span>
          <span>{above}</span>
        </div>
      )}
    </div>
  );
}
