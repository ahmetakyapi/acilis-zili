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
 * Açılış zili madalyonu.
 * Gösterge halkası (saat kadranı) içinde heykelsi çan; halkanın alt yayı ve
 * tokmak pirinçtir — Gün Şeridi'nin ölçülen seans yayı motifini taşır.
 * İki renk, tek motif; rozet gibi her boyutta okunur.
 */
export function BellMark({
  size = 24,
  tile = false,
  notches = true,
  className,
}: BellMarkProps) {
  const showSessionArc = notches && size >= 18;
  const ink = tile ? "fill-white" : "fill-primary";
  const inkStroke = tile ? "stroke-white" : "stroke-primary";
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

      {/* Kadran halkası */}
      <circle
        cx="12"
        cy="12"
        r="10.4"
        strokeWidth="1.4"
        className={inkStroke}
      />

      {/* Seans yayı — kadranın alt bölümünde pirinç ölçek */}
      {showSessionArc && (
        <path
          d="M 5.32 19.97 A 10.4 10.4 0 0 0 18.68 19.97"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={brassStroke}
        />
      )}

      {/* Tepe topuzu ve boyun */}
      <circle cx="12" cy="6" r="1.05" className={ink} />
      <rect x="11.5" y="6.7" width="1" height="1" rx="0.5" className={ink} />

      {/* Çan gövdesi — omuzdan inen, etekte hafif açılan profil */}
      <path
        d="M12 7.55
           c 2.1 0 3.3 1.45 3.47 3.9
           c 0.1 1.6 0.47 2.62 1.14 3.35
           c 0.26 0.28 0.32 0.6 0.21 0.86
           c -0.11 0.27 -0.38 0.44 -0.73 0.44
           H 7.91
           c -0.35 0 -0.62 -0.17 -0.73 -0.44
           c -0.11 -0.26 -0.05 -0.58 0.21 -0.86
           c 0.67 -0.73 1.04 -1.75 1.14 -3.35
           C 8.7 9 9.9 7.55 12 7.55 Z"
        className={ink}
      />

      {/* Tokmak — pirinç */}
      <circle cx="12" cy="17.5" r="1.3" className={brassFill} />
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
