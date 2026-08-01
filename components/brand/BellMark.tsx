import { cn } from "@/lib/utils";

type BellMarkProps = {
  size?: number;
  /** Koyu kutu içinde açık çan — küçük boyut ve favicon için. */
  tile?: boolean;
  /** Ses yayları 20px altında gürültü yapar; küçük boyutta kapatılır. */
  notches?: boolean;
  className?: string;
};

/**
 * Açılış zili işareti — borsa zilinin heykelsi hâli.
 * Tepe topuzu + etekleri hafif açılan çan gövdesi mürekkep mavisi; tokmak ve
 * çalma anını anlatan iki ses yayı pirinç. Tek motif, iki renk, süs yok.
 */
export function BellMark({
  size = 24,
  tile = false,
  notches = true,
  className,
}: BellMarkProps) {
  const showArcs = notches && size >= 20;
  const ink = tile ? "fill-white" : "fill-primary";
  const brassFill = tile ? "fill-brass-bright" : "fill-brass";
  const brassStroke = tile ? "stroke-brass-bright" : "stroke-brass";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {tile && <rect width="24" height="24" rx="5.5" className="fill-primary" />}

      {/* Tepe topuzu */}
      <circle cx="12" cy="3" r="1.35" className={ink} />
      {/* Boyun */}
      <rect x="11.35" y="3.9" width="1.3" height="1.4" rx="0.6" className={ink} />

      {/* Çan gövdesi — omuzdan inen, etekte hafif dışa açılan profil */}
      <path
        d="M12 5.1
           c 2.75 0 4.33 1.85 4.55 5.1
           c 0.14 2.1 0.62 3.45 1.5 4.4
           c 0.34 0.36 0.42 0.78 0.28 1.12
           c -0.14 0.35 -0.5 0.58 -0.95 0.58
           H 6.62
           c -0.45 0 -0.81 -0.23 -0.95 -0.58
           c -0.14 -0.34 -0.06 -0.76 0.28 -1.12
           c 0.88 -0.95 1.36 -2.3 1.5 -4.4
           C 7.67 6.95 9.25 5.1 12 5.1 Z"
        className={ink}
      />

      {/* Tokmak — pirinç */}
      <circle cx="12" cy="18.55" r="1.6" className={brassFill} />

      {showArcs && (
        <>
          {/* Çalma anı — iki yana açılan ses yayları */}
          <path
            d="M4.4 4.9 C 3.15 6.25 2.45 7.9 2.3 9.75"
            strokeWidth="1.35"
            strokeLinecap="round"
            className={brassStroke}
          />
          <path
            d="M19.6 4.9 C 20.85 6.25 21.55 7.9 21.7 9.75"
            strokeWidth="1.35"
            strokeLinecap="round"
            className={brassStroke}
          />
        </>
      )}
    </svg>
  );
}

type WordmarkProps = {
  locale?: string;
  size?: number;
  className?: string;
  markClassName?: string;
};

export function BrandLockup({
  locale = "tr",
  size = 22,
  className,
  markClassName,
}: WordmarkProps) {
  const name = locale === "en" ? "OPENING BELL" : "AÇILIŞ ZİLİ";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BellMark size={size} className={markClassName} />
      <span
        className="font-mono font-semibold uppercase text-strong"
        style={{ fontSize: size * 0.52, letterSpacing: "0.13em" }}
      >
        {name}
      </span>
    </span>
  );
}
