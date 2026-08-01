import { cn } from "@/lib/utils";

type BellMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Marka işareti — gradient kare içinde tek çizgi zil.
 *
 * Sayfadaki tek gradient budur; başka hiçbir yüzey gradient taşımaz. Zil
 * accent üzerine basıldığı için `--on-primary` ile çizilir: gündüz beyaz,
 * gece lacivert mürekkep.
 */
export function BellMark({ size = 27, className }: BellMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        // Köşe yarıçapı boyutla ölçekleniyor — 27px'te 9px, mockup değeri.
        borderRadius: size / 3,
        background: "var(--mark-gradient)",
      }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 256 256"
        fill="none"
      >
        <path
          d="M128 32a80 80 0 00-80 80c0 45-18 62-18 62h196s-18-17-18-62a80 80 0 00-80-80z"
          fill="none"
          stroke="var(--on-primary)"
          strokeWidth="19"
          strokeLinejoin="round"
        />
        <path
          d="M100 182a28 28 0 0056 0"
          fill="none"
          stroke="var(--on-primary)"
          strokeWidth="19"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

type WordmarkProps = {
  locale?: string;
  size?: number;
  className?: string;
};

/** İşaret + kelime — masthead ve giriş kartında birlikte durur. */
export function BrandLockup({
  locale = "tr",
  size = 27,
  className,
}: WordmarkProps) {
  const name = locale === "en" ? "Opening Bell" : "Açılış Zili";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BellMark size={size} />
      <span
        className="font-bold tracking-[-0.03em] text-strong"
        style={{ fontSize: size * 0.63 }}
      >
        {name}
      </span>
    </span>
  );
}
