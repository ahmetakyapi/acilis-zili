import { cn } from "@/lib/utils";

/**
 * Marka işareti — gradient karo içinde dolgun zil silueti.
 *
 * İnce çizgili zil 24px'te kırılıyordu; dolu siluet küçük boyutta çok daha
 * net okunuyor. Karoya iki ayrıntı eklendi: üstten inen ince bir iç ışık
 * çizgisi ve alttan gelen hafif bir gölge — karo düz bir kare yerine
 * basılmış bir rozet gibi duruyor. Sayfadaki tek gradient budur.
 */

/** Zil gövdesi + tokmak — favicon ve OG görseli de aynı geometriyi kullanır. */
export const BELL_BODY_PATH =
  "M128 30a82 82 0 00-82 82c0 40-6 58-17 69-6 6-2 17 7 17h184c9 0 13-11 7-17-11-11-17-29-17-69a82 82 0 00-82-82z";
export const BELL_CLAPPER_PATH = "M98 214a30 30 0 0060 0z";
export const BELL_KNOB = { cx: 128, cy: 26, r: 14 };

export function BellMark({
  size = 27,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        className,
      )}
      style={{
        width: size,
        height: size,
        // Köşe yarıçapı boyutla ölçekleniyor — 27px'te 9px.
        borderRadius: size / 3,
        background: "var(--mark-gradient)",
        boxShadow: "var(--mark-shadow)",
      }}
    >
      {/* İç kenar ışığı — karoya kalınlık veren tek çizgi. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.32), inset 0 0 0 1px rgb(255 255 255 / 0.1)",
        }}
      />
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 256 256"
        fill="var(--on-primary)"
      >
        <circle {...BELL_KNOB} />
        <path d={BELL_BODY_PATH} />
        <path d={BELL_CLAPPER_PATH} />
      </svg>
    </span>
  );
}

/**
 * İşaret + kelime + alt satır.
 *
 * İki metin satırı birbirine göre ORTALANIR: alt satır seyrek aralıklı
 * olduğu için marka adından geniş çıkıyor, sola dayalıyken kilit sağa doğru
 * kayık görünüyordu. Ortalanınca ikisi tek blok gibi oturuyor ve zil karosu
 * bu bloğun tam ortasına denk geliyor.
 */
export function BrandLockup({
  name,
  tagline,
  size = 34,
  className,
  taglineClassName,
}: {
  name: string;
  tagline?: string;
  size?: number;
  className?: string;
  /** Alt satırı gizlemek için — masthead dar ekranda yalnızca adı taşır. */
  taglineClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BellMark size={size} />
      <span className="flex flex-col items-center justify-center leading-none">
        <span
          className="display-ink display-ink-tight w-fit font-bold tracking-[-0.03em]"
          style={{ fontSize: size * 0.5 }}
        >
          {name}
        </span>
        {tagline && (
          <span
            className={cn(
              "mt-[3px] text-center font-semibold uppercase tracking-[0.13em] text-muted",
              taglineClassName,
            )}
            style={{ fontSize: Math.max(9, size * 0.25) }}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
