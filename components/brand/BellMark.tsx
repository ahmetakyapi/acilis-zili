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

/**
 * DAR görüş kutusu — işaretin her yerde küçük görünmesinin sebebi buydu.
 *
 * Geometri `0 0 256 256` içinde çizildi ama zilin kendisi o alanın tamamını
 * doldurmuyor: dikeyde 39→208 (169 birim, %66), yatayda 56→200 (144 birim,
 * %56). Karonun içine `size × 0.66` ölçüsünde basılınca zilin karodaki
 * gerçek yüksekliği %43'e, genişliği %37'ye düşüyordu — geri kalanı çizimin
 * kendi içindeki boşluktu. Karo büyütülse bile zil küçük kalıyordu, çünkü
 * sorun karonun boyu değil çizimin içindeki payıydı.
 *
 * Görüş kutusu zilin sınırlarına çekildi: kare kalması için (aksi hâlde
 * ölçekleme zili ezerdi) dikeyde dar kenar belirleyici, yatayda fazlalık
 * simetrik bırakıldı. Zil artık kutunun %91'i. Koordinatlar DEĞİŞMEDİ —
 * `icon.svg`, apple ikonu ve paylaşım kartları aynı sayıları kullanmaya
 * devam ediyor, yalnızca çerçeve daraldı.
 */
export const BELL_VIEWBOX = "35 31 186 186";
/** Zil karonun ne kadarını kaplasın — kutu daraldığı için oran da düştü. */
export const BELL_INSET = 0.64;

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
        width={size * BELL_INSET}
        height={size * BELL_INSET}
        viewBox={BELL_VIEWBOX}
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
/**
 * Marka adı — DEGRADE MASKE YOK.
 *
 * Ad bir dönem `display-ink` ile çiziliyordu: `-webkit-background-clip: text`
 * harfleri bir maskeye çeviriyor ve maskeli metin alt piksel yumuşatması
 * ALAMIYOR, gri tonlamalı çiziliyor. Telefonda üst çubuğun "hafif bulanık"
 * okunmasının asıl sebebi buydu — `backdrop-filter` kaldırıldıktan sonra da
 * kalan buydu. Marka kimliğini zil işareti (SVG, maskeye ihtiyacı yok) ve
 * ikinci kelimenin accent mürekkebi taşıyor.
 *
 * Bölme SON BOŞLUKTAN: "Açılış Zili" ve "Opening Bell" ikisi de doğru
 * ayrılıyor, ad sözlükten geldiği için sabit yazılamaz.
 */
export function BrandWord({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cut = name.lastIndexOf(" ");
  const head = cut > 0 ? name.slice(0, cut) : name;
  const tail = cut > 0 ? name.slice(cut + 1) : "";
  return (
    <span
      className={cn("w-fit font-bold tracking-[-0.03em] text-strong", className)}
      style={style}
    >
      {head}
      {tail && <span className="text-primary"> {tail}</span>}
    </span>
  );
}

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
        <BrandWord name={name} style={{ fontSize: size * 0.5 }} />
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
