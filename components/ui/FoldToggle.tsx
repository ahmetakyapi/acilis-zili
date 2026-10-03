import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./FoldToggle.module.css";

/**
 * Uzun listeyi dar ekranda katlayan anahtar — JS'siz (28 Eylül).
 *
 * Gündem bölümü telefonda 3.395 piksel ölçüldü ve payın yarısı iki uzun
 * listeydi: içeriden işlemlerin on satırı (her satırda iki satırlık görev)
 * ve ünlü yatırımcıların sekiz satırı. Satırları kesmek bilgi kaybı olurdu;
 * ikisinin de sembole süzülmüş bir "tümü" sayfası yok. Satırlar sunucuda
 * YİNE çiziliyor, fazlası `data-fold` işaretiyle katlı geliyor ve bu
 * anahtar onları açıyor.
 *
 * NEDEN ONAY KUTUSU, DÜĞME DEĞİL: satırlar sunucu bileşeninde; istemci
 * düğmesi ya satırları istemciye taşırdı ya da hidrasyondan sonra katlayıp
 * sayfayı zıplatırdı. Görsel olarak gizli ama odaklanabilen bir kutu +
 * etiketi JS gelmeden çalışıyor ve ilk karede son hâlinde. Klavyede boşluk
 * tuşuyla açılıyor, odak halkası etikette görünüyor.
 *
 * `narrow`: katlama yalnızca 1100'ün altında. Geniş ekranda paneller iki
 * sütuna açılıyor ve liste zaten kısa; orada anahtar hiç görünmüyor.
 * `phone` (3 Ekim): katlama yalnızca 640'ın altında — /piyasalar'daki
 * bileşen tablosu telefonda 60 satır, 4.600 piksel ölçüldü; tablette ve
 * geniş ekranda liste yerinde.
 *
 * Paylaşılan bileşen (3 Ekim'de şirket sayfasının panel klasöründen
 * taşındı): /piyasalar da aynı anahtarı kullanıyor.
 */
export function FoldToggle({
  id,
  hiddenCount,
  more,
  less,
  narrow = true,
  phone = false,
  children,
}: {
  /** Sayfada tekil olmalı: etiket kutuyu bununla buluyor. */
  id: string;
  /** Katlı satır sayısı; sıfırsa anahtar hiç basılmıyor. */
  hiddenCount: number;
  more: string;
  less: string;
  narrow?: boolean;
  /** Katlama yalnızca telefonda (<640). `narrow`ın yerine geçer. */
  phone?: boolean;
  children: ReactNode;
}) {
  if (hiddenCount <= 0) return <>{children}</>;
  return (
    <div className={cn(styles.fold, phone ? styles.foldPhone : narrow && styles.foldNarrow)}>
      <input type="checkbox" id={id} className={cn("sr-only", styles.foldInput)} />
      {children}
      <label htmlFor={id} className={styles.foldButton}>
        <span className={styles.foldMore}>{more}</span>
        <span className={styles.foldLess}>{less}</span>
      </label>
    </div>
  );
}
