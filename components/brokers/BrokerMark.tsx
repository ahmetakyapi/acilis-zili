import { LogoImage } from "@/components/ui/LogoImage";
import { brokerMonogram } from "@/lib/broker-cards";
import { brokerBrand } from "@/lib/broker-brand";
import { cn } from "@/lib/utils";
import styles from "./BrokerMark.module.css";

/**
 * Kurumun LOGO KAROSU (25 Ekim, kurum logoları turu). Logo kurumun kendi
 * sitesinden, kaydı `lib/broker-brand.ts`te; kayıtta yoksa ya da dosya
 * düşerse baş harf karosu (`brokerMonogram`). Görsel düşüşünü
 * `LogoImage` yakalıyor (sitenin şirket logolarıyla aynı yol).
 *
 * Görsel kutunun kendisi: çerçeve ve iç dolgu yok (CLAUDE.md "Görselin
 * etrafında çerçeve yok"); boşluk WebP'nin kendi beyaz zemininde. Ad her
 * zaman yanında yazılı olduğu için karo süs: `alt=""`, `aria-hidden`.
 * Ne istemci ne sunucu bileşeni: ikisinden de çağrılıyor.
 */
const SIZES = { xs: 20, sm: 24, md: 32, lg: 40, xl: 44 } as const;
export type BrokerMarkSize = keyof typeof SIZES;

export function BrokerMark({
  id,
  name,
  size = "lg",
  className,
}: {
  id: string;
  name: string;
  size?: BrokerMarkSize;
  className?: string;
}) {
  const px = SIZES[size];
  const box = cn(styles.mark, className);
  const fallback = (
    <span aria-hidden className={cn(box, styles.mono)} data-size={size}>
      {brokerMonogram(name)}
    </span>
  );
  const brand = brokerBrand(id);
  if (!brand) return fallback;
  return (
    <span aria-hidden className={styles.wrap} data-size={size}>
      <LogoImage src={brand.logo} px={px} boxClass={box} fallback={fallback} />
    </span>
  );
}
