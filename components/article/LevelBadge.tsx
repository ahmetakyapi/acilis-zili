import { guideLevelLabel, type GuideLevel } from "@/content/guide";
import { cn } from "@/lib/utils";

/**
 * Zorluk rozeti — Temel · Orta · İleri.
 *
 * RENK DEĞİL BASAMAK taşır. Yeşil/sarı/kırmızı üçlüsü denenmedi bile: bu
 * sitede renk yalnızca üç şey söylüyor — yukarı, aşağı, etkileşim. Zorluk
 * bunların hiçbiri değil ve "ileri" seviyeyi kırmızıya boyamak onu bir
 * uyarıya çevirirdi; oysa ileri bir yazı tehlikeli değil, sırası sonra
 * gelen bir yazı.
 *
 * Ayrım yoğunlukta: üç nokta işaretinden kaçı dolu. Basamak gözle sayılıyor,
 * etiket de yanında yazılı — ne rozet tek başına bilmece kalıyor ne de metin
 * tek başına sıralamayı taşıyor.
 */
export function LevelBadge({
  level,
  locale,
  className,
}: {
  level: GuideLevel;
  locale: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-[3px] text-[10.5px] font-bold tracking-[0.02em] text-body",
        className,
      )}
    >
      <LevelDots level={level} />
      {guideLevelLabel(level, locale)}
    </span>
  );
}

/**
 * Basamağın rozetsiz hâli. Rehber şeridinde bir KONUNUN ulaştığı en üst
 * seviyeyi gösteriyor; orada etiket zaten yanında yazılı olduğu için
 * rozetin kenarlığı fazladan bir kutu oluyordu.
 */
export function LevelDots({
  level,
  className,
}: {
  level: GuideLevel;
  className?: string;
}) {
  const filled = level === "temel" ? 1 : level === "orta" ? 2 : 3;

  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center gap-[2px]", className)}
    >
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          className={cn(
            "size-[5px] rounded-full",
            step < filled ? "bg-primary" : "bg-line-strong",
          )}
        />
      ))}
    </span>
  );
}
