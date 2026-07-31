import { cn } from "@/lib/utils";

type BellMarkProps = {
  size?: number;
  /** Koyu kutu içinde açık çan — küçük boyut ve favicon için. */
  tile?: boolean;
  /** Çentikler 20px altında gürültü yapar; küçük boyutta kapatılır. */
  notches?: boolean;
  className?: string;
};

/**
 * Açılış zili işareti.
 * Çan gövdesi markanın rengini taşır; altındaki üç pirinç çentik hem zilin
 * sesini hem ürünün ölçüm ekseni motifini temsil eder.
 */
export function BellMark({
  size = 24,
  tile = false,
  notches = true,
  className,
}: BellMarkProps) {
  const showNotches = notches && size >= 20;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {tile && (
        <rect
          width="24"
          height="24"
          rx="5.5"
          className="fill-primary"
        />
      )}

      {/* Askı halkası */}
      <path
        d="M12 2.15c.62 0 1.12.5 1.12 1.12v.62h-2.24v-.62c0-.62.5-1.12 1.12-1.12Z"
        className={tile ? "fill-white" : "fill-primary"}
      />

      {/* Çan gövdesi */}
      <path
        d="M12 3.6c3.42 0 5.06 3.42 5.24 7.68.1 2.32.62 3.42 1.32 4.22.36.42.1 1.05-.46 1.05H5.9c-.56 0-.82-.63-.46-1.05.7-.8 1.22-1.9 1.32-4.22C6.94 7.02 8.58 3.6 12 3.6Z"
        className={tile ? "fill-white" : "fill-primary"}
      />

      {showNotches ? (
        <>
          {/* Ses dalgası / ölçek çentikleri — imza vurgusu */}
          <rect
            x="7.4"
            y="18.6"
            width="1.5"
            height="2.2"
            rx="0.75"
            className={tile ? "fill-white/55" : "fill-brass"}
          />
          <rect
            x="11.25"
            y="18.6"
            width="1.5"
            height="3.4"
            rx="0.75"
            className={tile ? "fill-white/85" : "fill-brass"}
          />
          <rect
            x="15.1"
            y="18.6"
            width="1.5"
            height="2.2"
            rx="0.75"
            className={tile ? "fill-white/55" : "fill-brass"}
          />
        </>
      ) : (
        /* Küçük boyutta tek tokmak — çentikler okunmaz */
        <circle
          cx="12"
          cy="19.6"
          r="1.75"
          className={tile ? "fill-white/85" : "fill-brass"}
        />
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
