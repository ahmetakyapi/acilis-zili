import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn } from "@/lib/utils";

/**
 * Süzgeç çipi — etiket + isteğe bağlı sayı, adresle çalışır (JS'siz).
 *
 * /sirketler'deki SectorChip'in paylaşılan hâli (15 Ekim, /tarama için
 * çıkarıldı): aynı görünüm iki dizin sayfasında da kullanılıyor ve iki
 * kopya er geç birbirinden ayrı düşerdi. `scroll={false}` çipin doğası:
 * süzgeç bir gezinme değil, aynı listenin yeniden dizilmesi.
 *
 * Sayı tam renkte: saydamlık (/70) mavi zemin üstünde kontrastı 3,2'ye
 * düşürüyordu; WCAG AA küçük punto için 4,5 istiyor (ölçüm /sirketler'de).
 */
export function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-small font-semibold transition-colors sm:min-h-[34px]",
        active
          ? "border-transparent bg-primary text-on-primary"
          : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn("numeral text-tiny font-bold", active ? "text-on-primary" : "text-muted")}>
          {count}
        </span>
      )}
    </Link>
  );
}
