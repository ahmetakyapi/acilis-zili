import type { Metadata } from "next";
import styles from "./Embed.module.css";

/**
 * Gömülü parçalar — başka sitelerin `<iframe>`inde çizilen küçük kutular.
 *
 * SİTENİN KABUĞUNUN DIŞINDA, `/admin` ile aynı gerekçe: `(app)` grubunun
 * içinde olsalardı üstlerinde başlık, piyasa şeridi ve alt sekme çubuğu
 * dururdu; 360 piksellik bir çerçevede kutunun kendisi görünmezdi. Kök
 * düzen yine sarıyor (tema, yazı ailesi), ama açılış sahnesi burada
 * açılmıyor (`INK_SPLASH_SCRIPT`), sayfa ölçümü de yok (`ViewBeacon` kabuğun
 * içinde).
 *
 * DİZİNE KAPALI. Bir arama sonucunda tek başına bir geri sayım kutusu
 * işe yaramaz ve aynı içerik ana sayfada zaten var. Künye burada, aynı söz
 * yol düzeyinde `X-Robots-Tag` olarak da veriliyor (next.config.ts).
 * Çerçeveye izin veren başlık da orada, gerekçesiyle.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <main className={styles.frame}>{children}</main>;
}
