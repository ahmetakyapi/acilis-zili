import { BellMark } from "@/components/brand/BellMark";
import styles from "./BellMood.module.css";

/**
 * Zilin iki hâli — boş ve kayıp ekranların küçük karakteri.
 *
 * Boş durumlar ve 404 yalnızca metinden oluşuyordu; okuyucuya "burada bir
 * şey yok" diyen ekran, sitenin geri kalanıyla aynı soğuklukta duruyordu.
 * Marka işareti zaten bir karakter: zil. Bu iki hâl ona küçük bir ruh
 * veriyor ve durumu metinden önce anlatıyor.
 *
 * - `sleep` — BOŞ LİSTE. Zil hafifçe eğik uyuyor, yanından üç küçük "z"
 *   sırayla yükselip sönüyor. Takip edilecek bir şey yok, zil de dinleniyor.
 * - `lost` — BULUNAMADI. Zil sağa sola bakınır gibi yavaşça sallanıyor,
 *   arada duruyor. Aranan sayfa yok ve zil de onu arıyor.
 *
 * İkisi de süs — `aria-hidden`; anlamı yanındaki başlık taşıyor. Azaltılmış
 * harekette zil yerinde durur, "z"ler görünmez.
 */
export function BellMood({
  mood,
  size = 48,
}: {
  mood: "sleep" | "lost";
  size?: number;
}) {
  return (
    <span aria-hidden="true" className={styles.mood} data-mood={mood}>
      <span className={styles.bell}>
        <BellMark size={size} />
      </span>
      {mood === "sleep" && (
        <span className={styles.zs}>
          <span>z</span>
          <span>z</span>
          <span>z</span>
        </span>
      )}
    </span>
  );
}
