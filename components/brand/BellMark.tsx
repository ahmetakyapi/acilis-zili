import { cn } from "@/lib/utils";

/**
 * Marka işareti — mavi degrade karo içinde tören zili.
 *
 * KLASİK TÖREN ZİLİ (24 Eylül). Dört seçenek yan yana çizildi ("Zil İşareti
 * Seçenekleri" artifact'i): bugünkü kubbe, 1 · Klasik Tören Zili, 2 · Çalan
 * Zil, 3 · Gece Mavisi. 23 Eylül'de 3 seçildi — lacivert karo, beyaz zil,
 * marka mavisi ağız çubuğu; gerekçesi açık mavi degradenin yanındaki seçili
 * sekme ve birincil düğmelerle karışmasıydı. Bir gün sonra sahibi 1'e
 * döndü: karo açık maviden gece mavisine iner (#5cc4ff → #1f86e0 →
 * #0b3f86, eski degradeden bir kademe derin), üst yarıda beyaz bir
 * parlaklık taşır, zil ağız çubuğuyla birlikte bütünüyle beyazdır. Sitenin
 * ve paylaşım kartlarının kimliği eski degradenin ailesinde kalıyor.
 *
 * İki tema, TEK işaret: sekme ikonu, ana ekran ikonu ve paylaşım kartı
 * temayı bilemiyor, yani iki işaret bir yerde mutlaka yan yana düşerdi.
 * Koyu temada karonun koyu köşesi zemine yaklaşıyor; onu ayıran beyaz iç
 * kenar (`--mark-edge`) koyu temada bir kademe daha belirgin.
 *
 * Renkler token: `--mark-gradient` (karo), `--mark-edge` (iç kenar),
 * `--mark-ink` (zil) ve `--mark-lip` (ağız çubuğu). `--on-primary` KULLANILMAZ:
 * o accent üzerine basılan metnin rengi ve koyu temada koyu lacivert —
 * işaret bir dönem koyu temada siyah zille çiziliyordu.
 */

/**
 * Zil geometrisi — TÖREN ZİLİ, bildirim zili değil.
 *
 * Dört parça: tepede askı, omuzlu ve eteği açılan kubbe, altında ağız
 * çubuğu ve ondan kopuk yuvarlak tokmak. Önceki çizim düz kenarlı bir
 * kubbeydi; 16 pikselde bir kutuya dönüşüyordu. Omuz ve açılan etek o boyda
 * da zil diye okunuyor.
 *
 * Ağız çubuğunun kendi token'ı var (`--mark-lip`) ama bugün zille aynı
 * beyaz: Gece Mavisi seçeneğinde marka mavisindeydi, mavi karoda o renk
 * zemine karışıyor.
 */
export const BELL_HANGER = { x: 118, y: 40, width: 20, height: 16, rx: 8 };
export const BELL_BODY_PATH =
  "M128 58c-27 0-44 20-46 47l-3 37c-1 11-7 18-18 22h134c-11-4-17-11-18-22l-3-37c-2-27-19-47-46-47z";
export const BELL_LIP = { x: 52, y: 170, width: 152, height: 15, rx: 7.5 };
export const BELL_CLAPPER = { cx: 128, cy: 206, r: 13 };

/**
 * Karonun görüş kutusu — zil KARONUN TAMAMINA göre yerleşir.
 *
 * Zil `0 0 256 256` içinde çizildi ve karoya `scale(.92)` ile, merkezi
 * (128, 124) noktasına oturtularak basılıyor. Aynı yerleşim bir dönüşüm
 * yerine görüş kutusuyla veriliyor: kenar 256 / 0,92 = 278,26 birim,
 * merkez (128, 124). Böylece svg karonun kendi boyunda çiziliyor ve
 * `icon.svg`, apple ikonu, PWA ikonları ve paylaşım kartları aynı sayıyı
 * okuyor. Zil karonun dikeyde %64'ünü, yatayda %55'ini kaplıyor.
 */
export const BELL_VIEWBOX = "-11.13 -15.13 278.26 278.26";

/** Zilin dört parçası — dolgu renkleri çağırandan. */
export function BellShape({ ink, lip }: { ink: string; lip: string }) {
  return (
    <g fill={ink}>
      <rect {...BELL_HANGER} />
      <path d={BELL_BODY_PATH} />
      <rect {...BELL_LIP} fill={lip} />
      <circle {...BELL_CLAPPER} />
    </g>
  );
}

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
      className={cn("flex shrink-0", className)}
      style={{
        width: size,
        height: size,
        // Köşe yarıçapı boyutla ölçekleniyor — 27px'te 9px.
        borderRadius: size / 3,
        background: "var(--mark-gradient)",
        /* İç kenar, oturma gölgesiyle aynı listede: ayrı bir katman
           span'ine gerek yok. */
        boxShadow: "var(--mark-shadow), inset 0 0 0 1px var(--mark-edge)",
      }}
    >
      <svg width={size} height={size} viewBox={BELL_VIEWBOX}>
        <BellShape ink="var(--mark-ink)" lip="var(--mark-lip)" />
      </svg>
    </span>
  );
}

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
 *
 * KELİME ARALIĞI DAR (23 Eylül). Boşluk yazının fontundaki sıradan boşluktu:
 * 19 puntoda 3,4 piksel (0,18 em). Harf aralığı -0,03 em'e sıkıldığı için
 * harfler birbirine yaklaşmış, boşluk yerinde kalmıştı; üstüne ş'nin sağ
 * payı ve Z'nin sol payı eklenince iki kelime ayrı ayrı duruyordu. Aralık
 * 0,07 em daraltıldı. Boşluk karakteri YERİNDE — seçip kopyalayan
 * "AçılışZili" almasın, ekran okuyucu iki kelime okusun.
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
      className={cn(
        "w-fit font-bold tracking-[-0.03em] [word-spacing:-0.07em] text-strong",
        className,
      )}
      style={style}
    >
      {head}
      {tail && <span className="text-primary"> {tail}</span>}
    </span>
  );
}
