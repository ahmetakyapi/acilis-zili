import Image from "next/image";
import { investorInitials, investorPortrait, type Investor } from "@/lib/investors";
import { cn } from "@/lib/utils";
import styles from "./Investors.module.css";

/**
 * Yatırımcının portresi — ya özgür lisanslı fotoğraf ya da baş harf karosu.
 *
 * Fotoğrafların kaynağı ve lisansı `lib/investors.ts` → PORTRAITS (belgeli
 * istisna orada). Farklı kaynaklardan gelen kareler tek aile gibi dursun
 * diye hepsi aynı işlemden geçiyor: aynı kare kırpım, aynı köşe yarıçapı,
 * hafifçe düşürülmüş doygunluk (bağlantının üzerine gelince tam renk).
 * Çerçeve yok: görsel kutunun kendisi (CLAUDE.md, "görselin etrafında
 * çerçeve yok").
 *
 * FOTOĞRAFI OLMAYAN KİŞİ İÇİN UYDURMA YOK. Baş harf karosu aynı kutu,
 * aynı yarıçap; zemin ton farkıyla, harfler display ağırlığında. Izgarada
 * fotoğraflı kartın yanında "eksik görsel" gibi değil, bilinçli bir karo
 * gibi durması için harflerin altında kuruluşun adı ince bir künye olarak
 * duruyor (yalnızca büyük boyda).
 *
 * `alt` boş: ad her zaman portrenin yanında yazılı, ekran okuyucu adı iki
 * kez duymasın.
 */
export type PortraitSize = "chip" | "sm" | "card" | "hero" | "tile";

const PIXELS: Record<PortraitSize, number> = { chip: 24, sm: 36, card: 88, hero: 168, tile: 160 };

export function Portrait({
  investor,
  size,
  className,
  priority = false,
}: {
  investor: Investor;
  size: PortraitSize;
  className?: string;
  priority?: boolean;
}) {
  const photo = investorPortrait(investor.slug);
  const px = PIXELS[size];
  if (photo) {
    return (
      <span className={cn(styles.portrait, className)} data-size={size}>
        <Image
          src={photo.src}
          alt=""
          width={px}
          height={px}
          sizes={`${px}px`}
          priority={priority}
          className={styles.portraitImg}
        />
      </span>
    );
  }
  return (
    <span className={cn(styles.portrait, styles.initials, className)} data-size={size} aria-hidden>
      <span className={styles.initialsText}>{investorInitials(investor.name)}</span>
      {(size === "hero" || size === "tile" || size === "card") && (
        <span className={styles.initialsFirm}>{investor.firm}</span>
      )}
    </span>
  );
}
