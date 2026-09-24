import { cn } from "@/lib/utils";
import {
  BELL_BODY_PATH,
  BELL_CLAPPER,
  BELL_HANGER,
  BELL_LIP,
  BELL_VIEWBOX,
} from "@/components/brand/BellMark";
import styles from "./BellLoader.module.css";

/**
 * Bekleyiş animasyonu — ZİL ÇALIYOR.
 *
 * Önceki gösterge marka karosunun etrafında dönen bir koni halkasıydı:
 * işareti kullanıyordu ama anlatmıyordu, her sitede görülen bir "yükleme
 * çemberi"nin ortasına logo konmuş gibi duruyordu. Oysa ürünün adı bir
 * olay: zil çalar, seans açılır. Bekleme anı da o olayın kendisi.
 *
 * Üç hareket, tek ritim (2,2 saniyelik döngü):
 *
 * 1. GÖVDE askıdan sallanır — sönümlü bir sarkaç: -13° → 11° → -7° → 4°
 *    → -1,5° ve durur. Askı yerinde kalır; dönen şey kubbe ile ağız
 *    çubuğu, dönme noktası askının dibi (128, 50). Tüm karo dönseydi
 *    zil değil bir rozet sallanıyor gibi okunurdu.
 * 2. TOKMAK gövdenin ARKASINDAN gelir: aynı sarkaç, yüzde dört geç ve
 *    %25 geniş. Gövde dönüş noktasına vardığında tokmak hâlâ gidiyor —
 *    göz bunu "vurdu" diye okuyor. İki öğe aynı eğriyle dönseydi zil tek
 *    parça bir heykel gibi kalırdı.
 * 3. SES karonun kenarından dışarı yayılır: ilk iki vuruşta birer halka,
 *    karonun kendi köşe yarıçapıyla büyüyüp söner. Daire değil yuvarlak
 *    kare, çünkü sesi çıkaran şey karo.
 *
 * Döngünün son %40'ı SESSİZ: zil durur, bekler, yeniden çalar. Durmadan
 * sallanan bir işaret göz yoruyor ve "takıldı" hissi veriyordu; aradaki
 * nefes ona bir ritim, dolayısıyla bir anlam veriyor.
 *
 * YÜZDE YOK — gösterge hâlâ ne kadar kaldığını bilmiyor (gerekçe
 * components/layout/RouteProgress.tsx). Azaltılmış hareket tercihinde zil
 * sallanmaz, halka çıkmaz; yalnızca karo yavaşça nefes alır.
 */
export function BellLoader({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(styles.stage, className)}
      style={{ "--bell-size": `${size}px` } as React.CSSProperties}
    >
      <span className={styles.ripple} />
      <span className={styles.ripple} data-late />
      <span className={styles.tile}>
        <svg width={size} height={size} viewBox={BELL_VIEWBOX}>
          <g fill="var(--mark-ink)">
            <rect {...BELL_HANGER} />
            <g className={styles.body}>
              <path d={BELL_BODY_PATH} />
              <rect {...BELL_LIP} fill="var(--mark-lip)" />
            </g>
            <circle className={styles.clapper} {...BELL_CLAPPER} />
          </g>
        </svg>
      </span>
    </span>
  );
}
