import { cn } from "@/lib/utils";

/**
 * Marka işareti — gradient karo içinde tören zili.
 *
 * İnce çizgili zil 24px'te kırılıyordu; dolu siluet küçük boyutta çok daha
 * net okunuyor. Karoya iki ayrıntı eklendi: üstten inen ince bir iç ışık
 * çizgisi ve alttan gelen hafif bir gölge — karo düz bir kare yerine
 * basılmış bir rozet gibi duruyor. Sayfadaki tek gradient budur.
 */

/**
 * Zil geometrisi — TÖREN ZİLİ, bildirim zili değil.
 *
 * Önceki çizim her uygulamanın notification ikonuydu: geniş, basık bir
 * silüet ve gövdeye yapışık yarım daire bir tokmak. Ürünün adı "Açılış
 * Zili" ve işaret ettiği nesne borsanın tören zili — ayrı bir şey.
 *
 * Yeni çizim dört parça: tepede AYRIK topuz, daha dar ve uzun kubbe,
 * altında keskin bir AĞIZ ÇUBUĞU ve ondan kopuk yuvarlak tokmak. Ağız
 * çubuğu aynı zamanda sitenin imzası olan gün şeridinin yankısı.
 * Parçaların arasındaki boşluklar 16px'te kapanmıyor; eski çizimde tokmak
 * gövdeye karışıp tek bir lekeye dönüşüyordu.
 */
export const BELL_BODY_PATH =
  "M128 68c-30 0-53 24-53 54v33h106v-33c0-30-23-54-53-54z";
/** Ağız çubuğu — zilin ağzı ve gün şeridinin yankısı. */
export const BELL_MOUTH = { x: 56, y: 159, width: 144, height: 16, rx: 8 };
export const BELL_CLAPPER = { cx: 128, cy: 196, r: 12 };
export const BELL_KNOB = { cx: 128, cy: 50, r: 11 };

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
        width={size * 0.66}
        height={size * 0.66}
        viewBox="0 0 256 256"
        fill="var(--on-primary)"
      >
        <circle {...BELL_KNOB} />
        <path d={BELL_BODY_PATH} />
        <rect {...BELL_MOUTH} />
        <circle {...BELL_CLAPPER} />
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
