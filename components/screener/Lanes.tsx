import { cn } from "@/lib/utils";
import styles from "./Lanes.module.css";

/**
 * Araç ekranlarının satır içi görselleri (25 Ekim görsel turu): /tarama ve
 * /sirketler tablolarında, /tarama kartlarında.
 *
 * RENK KARARI (sahibin güncel kararı, 25 Ekim — "renkli olsun, anlamı
 * tutarlı olsun"): büyüklük çubuğu markanın YUMUŞAK mavisi, sitenin tek
 * büyüklük token'ı `--bar-soft` (globals.css; `ScaleBar` ile aynı ton —
 * önceden burada `--primary-soft` %72 vardı, aynı "piyasa değeri"
 * /sirketler'de başka, hisse sayfasında başka maviydi). Doygun etkileşim
 * mavisi değil; konum imi metin mürekkebi; yön yalnız yeşil/kırmızı.
 * Kulvar kalınlığı tek ölçü: `var(--lane-h, 5px)`.
 *
 * Hepsi `aria-hidden`: sayının kopyası ya da (yüzdelikte) `title`ı olan bir
 * konum; ekran okuyucu satırı iki kez okumasın.
 */

/** Büyüklük çubuğu — işaretsiz, 0..1, sağa yaslı (sayının sağ kenarıyla aynı hat). */
export function SizeBar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.min(1, Math.max(0, ratio)) * 100;
  return (
    <span aria-hidden data-motion-track className={cn(styles.lane, styles.end, className)}>
      <span
        className={styles.size}
        data-motion-draw="line"
        style={{ width: `${pct}%`, marginLeft: `${100 - pct}%`, transformOrigin: "right center" }}
      />
    </span>
  );
}

/**
 * Evren içindeki konum — kulvar, ortada ortanca çentiği, değerin
 * yüzdeliğinde dikey im. Yargı yok: yüksek F/K "kötü" demek değil, im
 * yalnız YERİ söylüyor.
 */
export function UniverseLane({
  position,
  title,
  className,
}: {
  /** 0..1 yüzdelik konum. */
  position: number;
  title?: string;
  className?: string;
}) {
  const pct = Math.min(1, Math.max(0, position)) * 100;
  return (
    <span aria-hidden title={title} className={cn(styles.lane, styles.end, styles.universe, className)}>
      <span className={styles.medianNotch} />
      <span className={styles.mark} style={{ left: `${pct}%` }} />
    </span>
  );
}

/* YÖN KULVARI BURADAN ÇIKTI (10 Kasım 2026, gece). `DirectionLane`in tek
   kullanıcısı /sirketler tablosuydu; o tablo Endeks Bileşenleri'yle ortak
   kalın çubuğa geçti (`ZeroBar`, components/markets/BoardTable.tsx). Kararı
   yaşıyor: ölçek SABİT (`span` yüzde = tam kol), sayfalar arasında aynı
   uzunluk aynı hareketi anlatsın — listenin en büyüğüne göre ölçeklemek
   "Daha Fazla"ya basınca bütün çubukları yeniden boyutlandırırdı. Sabitler
   lib/market-scales.ts'te (`DAY_LANE_SPAN`, `WEEK_LANE_SPAN`). /tarama'nın
   kulvarları (`SizeBar`, `UniverseLane`) aynen duruyor. */
