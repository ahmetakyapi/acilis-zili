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
 * mavisi değil; konum çubuğu aynı yumuşak mavi, ortanca çentiği metin
 * mürekkebi; yön yalnız yeşil/kırmızı.
 * Kulvar kalınlığı tek ölçü: `var(--lane-h, 5px)`.
 *
 * Hepsi `aria-hidden`: sayının kopyası ya da (yüzdelikte) `title`ı olan bir
 * konum; ekran okuyucu satırı iki kez okumasın.
 */

/** Büyüklük çubuğu — işaretsiz, 0..1, sağa yaslı (sayının sağ kenarıyla aynı hat). */
export function SizeBar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.min(1, Math.max(0, ratio)) * 100;
  return (
    /* 10 Kasım (gece), değer çubuğu standardı: dolgu kulvarla aynı 5
       pikseldi, şimdi 8 (kulvar 5); sınıflar ortak (`value-lane`,
       `value-bar` — globals.css). Çizim `bar-fill` ile (kaynak sağda:
       çubuk sayının sağ kenarından büyür); kapı satırın/kartın `data-draw`ı. */
    <span aria-hidden className={cn("value-lane", styles.lane, styles.end, className)}>
      <span className="value-bar bar-fill" style={{ left: `${100 - pct}%`, width: `${pct}%`, transformOrigin: "right center" }} />
    </span>
  );
}

/**
 * Evren içindeki konum — sıfırdan değerin yüzdeliğine uzanan KALIN dolu
 * çubuk, ortada ince ortanca çentiği. Yargı yok: yüksek F/K "kötü" demek
 * değil, çubuk yalnız "evrenin ne kadarı bu değerin altında" diyor.
 *
 * 10 Kasım 2026 (sahibinin sözü: "böyle nokta nokta ne anlatıyor
 * anlamıyorum; yatayda uzun kalın çizgi seviyorum"): önceki hâlde boş
 * kulvarın üstünde 3×11 piksellik tek bir dikey im vardı; 72 piksellik
 * rayda göz imi arıyor, komşu sütundaki dolu piyasa değeri çubuğuyla aynı
 * dilde okunmuyordu. Şimdi 8 piksellik dolu çubuk (kulvar 5), dış ucu
 * yuvarlak; ortanca çubuğun ÜSTÜNDE ince koyu çentik (tek kıyas imi).
 * Sözleşme (prop'lar) aynı; çağıran değişmedi. Aynı gece: kurallar ortak
 * sınıfa taşındı (`value-lane` / `value-bar` / `value-notch`); ölçüler aynı
 * (kulvar 5, çubuk 8, çentik 2 × 13 — önce/sonra ölçüldü, /tarama).
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
    <span aria-hidden title={title} className={cn("value-lane", styles.lane, styles.end, className)}>
      {/* En az 3: en alttaki hissede de çubuğun ucu görünsün (boş kulvar "veri yok" gibi okunur). */}
      <span className="value-bar bar-fill" style={{ left: 0, width: `${Math.max(pct, 3)}%` }} />
      <span className="value-notch" style={{ left: "50%" }} />
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
