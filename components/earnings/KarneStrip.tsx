import { cn } from "@/lib/utils";
import styles from "./KarneStrip.module.css";

/**
 * BEKLENTİ KARNESİ — TEK ÇİZİM (10 Kasım 2026, tutarlılık denetimi).
 *
 * NEDEN: aynı bilgi (son çeyreklerde EPS beklentisi aşıldı mı) üç ayrı
 * biçimde çiziliyordu: ufkun karosunda dört parçalı şerit, okuma şeridinde
 * onun büyüğü, bilanço sayfasında dört kart + "4/4". Parça biçimi ve renk
 * kuralı artık TEK yerde; ekranlar yalnız boy seçer.
 *
 * Kural (gerekçeleri `EarningsHorizon.module.css` → "KARNE BİR ŞERİT",
 * "AŞILMADI KIRMIZI"): eskiden yeniye, soldan sağa. Aşıldı `--up` DOLU;
 * aşılmadı `--down` İÇİ BOŞ (renk tek taşıyıcı değil, biçim de ayırır);
 * beklentiye denk `--line-strong` dolu; bilinmeyen çeyrek kulvar rengi
 * (`--line-soft`), yani parça "boş". Parça sayısı çağıranın verdiği kadar:
 * hizalı satırlarda çağıran eksikleri `"none"` ile başa doldurur
 * (`karneSlots`, `lib/earnings-horizon.ts`).
 *
 * Çizim süs olarak işaretli (`aria-hidden`): yanında her zaman yazılı bir
 * karşılığı durur ("3/4 Çeyrekte Aşıldı", karo etiketi). Hareket: şerit
 * BÜTÜN olarak soldan bir kez açılır (parça parça değil; ufukta 96 parçanın
 * tek tek belirmesi öğe girişiydi, veri çizimi değil). Sunucu son kareyi
 * basar; hareketi azaltana animasyon yok.
 *
 * SÖZLEŞME (başka ekranlar da kullanabilir): `marks` zorunlu, gerisi isteğe
 * bağlı. `size`: "sm" kabın genişliğinde 6 piksel (karo), "md" 80×7 (satır
 * içi), "lg" kabın genişliğinde 8 piksel (kart başlığı), "key" tek parçalık
 * lejant örneği. `pending`: veri yolda (soluk, çizim beklemede).
 */
export type KarneStripMark = "beat" | "miss" | "inline" | "none";

export function KarneStrip({
  marks,
  size = "sm",
  pending = false,
  className,
}: {
  marks: readonly KarneStripMark[];
  size?: "sm" | "md" | "lg" | "key";
  pending?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn(styles.strip, className)} data-size={size} data-pending={pending || undefined}>
      {marks.map((mark, index) => (
        <i key={index} data-mark={mark} />
      ))}
    </span>
  );
}
