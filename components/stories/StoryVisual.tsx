import Image from "next/image";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/**
 * Mercek yazılarının kapak görselleri.
 *
 * GÖRSEL NEREDEN GELİYOR. Bu yazıların stok fotoğrafı yok ve olmamalı: haber
 * fotoğrafı telifli, üstelik dekoratif bir görsel okuyucuya olayla ilgili
 * hiçbir şey söylemiyor. Elimizde telifi bizde olan iki gerçek görsel var ve
 * ikisi de yazının KENDİSİYLE ilgili:
 *
 *   1. Yazının kahramanı şirketlerin logoları — sağlayıcının şirket
 *      profilinden geliyor, zaten veritabanında (`symbols.logo_url`) ve
 *      next/image için tanımlı (next.config.ts → remotePatterns).
 *   2. O şirketin gerçek fiyat eğrisi — kendi sağlayıcımızdan, sunucuda
 *      çizilen SVG. Bir olayın kapağında "piyasa ne yaptı" sorusunun cevabı
 *      duruyor; süs değil, veri.
 *
 * Ölçü hep aynı dilde: gradient yüzey + hairline, gölge yok. Tek gölge marka
 * karosunun; logolar onu taklit etmez.
 */

export type SymbolMetaLite = {
  name?: string | null;
  logoUrl?: string | null;
};

/**
 * Üst üste binen logo daireleri.
 *
 * Bir yazıda on iki sembol geçebiliyor; kapakta en fazla üçü durur, kalanı
 * sayıyla söylenir. Logosu olmayan sembol boş kutu bırakmaz — sembolün ilk
 * iki harfi accent dolgulu bir daireye oturur.
 */
export function LogoCluster({
  symbols,
  meta,
  size = 40,
  max = 3,
  className,
}: {
  symbols: string[];
  meta: Record<string, SymbolMetaLite>;
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = symbols.slice(0, max);
  const rest = symbols.length - shown.length;
  if (shown.length === 0) return null;

  return (
    <span className={cn("flex shrink-0 items-center", className)} aria-hidden>
      {shown.map((symbol, index) => {
        const logo = meta[symbol]?.logoUrl;
        return (
          <span
            key={symbol}
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-solid",
              index > 0 && "-ml-3",
            )}
            style={{ width: size, height: size, zIndex: shown.length - index }}
          >
            {logo ? (
              <Image
                src={logo}
                alt=""
                width={size}
                height={size}
                className="size-full bg-white object-contain p-[3px]"
              />
            ) : (
              /* Logosu olmayan sembol (çoğu ETF) baş harflerine kırpılmaz:
                 "SP · QQ · DI" bozuk görünüyordu. Sembolün tamamı yazılır,
                 punto uzunluğa göre küçülür — SPY 4'te, GOOGL 6'da sığar. */
              <span
                className="numeral px-0.5 font-bold leading-none text-primary"
                style={{ fontSize: size * (symbol.length > 4 ? 0.21 : 0.26) }}
              >
                {symbol}
              </span>
            )}
          </span>
        );
      })}
      {rest > 0 && (
        <span
          className="numeral -ml-3 flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-elevated font-bold text-body"
          style={{ width: size, height: size, fontSize: size * 0.28 }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export type CoverQuote = {
  symbol: string;
  changePct: number | null;
} | null;

/**
 * Kart kapağı — gradient yüzey, logolar, sembolün okuması ve eğrisi.
 *
 * KOMPOZİSYON. Kapak üç katman: en altta zeminin degradesi, onun üstünde
 * sembolün son bir aylık eğrisi (soluk, tam genişlikte, kapağın alt üçte
 * ikisini kaplar), en üstte logolar ve okuma. Eğri kasten arka planda —
 * kapağın işi "bu yazı hangi şirketlerin, piyasa ne yapmış" demek, grafik
 * okutmak değil; okunacak grafik yazının içinde (`::: grafik`) zaten var.
 *
 * YÜKSEKLİK `minHeight` OLARAK VERİLİYOR, sabit değil: manşette kapak sağ
 * kolonda duruyor ve sabit yükseklikle metnin yanında yarım kalıyordu —
 * altında kartın degradesi boş bir şerit olarak görünüyordu. Esnek ölçüyle
 * kapak kolonun tamamını dolduruyor, kart tek parça okunuyor.
 */
export function StoryCover({
  symbols,
  meta,
  quote,
  points,
  locale,
  rangeLabel,
  minHeight = 92,
  logoSize = 40,
  className,
}: {
  symbols: string[];
  meta: Record<string, SymbolMetaLite>;
  quote: CoverQuote;
  /** Birincil sembolün son bir aylık kapanışları; yoksa eğri çizilmez. */
  points?: { value: number }[];
  locale: Locale;
  /** Eğrinin ne kadarlık dönem olduğunu söyleyen mikro etiket — "son 1 ay". */
  rangeLabel?: string;
  minHeight?: number;
  logoSize?: number;
  className?: string;
}) {
  const tone = directionOf(quote?.changePct);
  const name = quote ? meta[quote.symbol]?.name : null;
  const hasCurve = Boolean(points && points.length > 1);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden border-b border-line bg-[linear-gradient(135deg,var(--primary-wash),var(--primary-tint))] px-5 py-4",
        /* Eğri yoksa kapak kısalır ve içerik ortalanır. Sağlayıcı barları
           döndürmediğinde (kota, yeni sembol, geçici hata) sabit yükseklik
           logoların altında boş bir bant bırakıyordu — kapak bozulmuş gibi
           duruyordu. Yükseklik veriye uyuyor, tersi değil. */
        hasCurve ? "justify-between" : "justify-center",
        className,
      )}
      style={{ minHeight: hasCurve ? minHeight : Math.min(minHeight, 76) }}
    >
      {hasCurve && (
        <Sparkline
          points={points as { value: number }[]}
          title=""
          tone={tone}
          width={320}
          height={80}
          strokeWidth={1.5}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 w-full opacity-45"
        />
      )}

      <div className="relative flex items-start gap-3">
        <LogoCluster symbols={symbols} meta={meta} size={logoSize} />

        {quote && (
          <span className="ml-auto min-w-0 text-right">
            <span className="numeral block truncate text-[12.5px] font-bold text-strong">
              {quote.symbol}
            </span>
            {name && (
              <span className="block max-w-[10rem] truncate text-[10.5px] leading-tight text-muted">
                {name}
              </span>
            )}
            <span
              className={cn(
                "numeral mt-0.5 block text-[12px] font-bold",
                directionText(tone),
              )}
            >
              {formatPercent(quote.changePct, locale)}
            </span>
          </span>
        )}
      </div>

      {/* Eğrinin künyesi: soluk bir çizginin ne olduğunu söylemezsen süs
          gibi okunuyor. Yalnızca eğri varken yazılır. */}
      {hasCurve && rangeLabel && (
        <span className="plate relative self-start text-[9px] tracking-[0.09em]">
          {rangeLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Kart başlığı — logolar ve sembolün okuması, ARKASINDA EĞRİ YOK.
 *
 * Manşetteki katmanlı kapak küçük kartta çalışmıyordu: 104px'lik bir bantta
 * eğri logoların arkasından geçiyor, "SON 1 AY" künyesi çizginin üstüne
 * biniyor ve üç öğe birbirini bulandırıyordu. Kartta eğri başlıktan çıkıp
 * kartın ALT kenarına iniyor (StoryCurveStrip); başlıkta yalnızca kimlik ve
 * okuma kalıyor, ikisi de net.
 */
export function StoryCardHeader({
  symbols,
  meta,
  quote,
  locale,
}: {
  symbols: string[];
  meta: Record<string, SymbolMetaLite>;
  quote: CoverQuote;
  locale: Locale;
}) {
  const tone = directionOf(quote?.changePct);
  const name = quote ? meta[quote.symbol]?.name : null;

  return (
    <div className="flex items-center gap-3 border-b border-line bg-[linear-gradient(135deg,var(--primary-wash),var(--primary-tint))] px-5 py-3.5">
      <LogoCluster symbols={symbols} meta={meta} size={36} />
      {quote && (
        <span className="ml-auto min-w-0 text-right">
          <span className="numeral block truncate text-[12px] font-bold text-strong">
            {quote.symbol}
          </span>
          {name && (
            <span className="block max-w-[10rem] truncate text-[10.5px] leading-tight text-muted">
              {name}
            </span>
          )}
        </span>
      )}
      {quote && (
        <span
          className={cn(
            "numeral shrink-0 text-[12.5px] font-bold",
            directionText(tone),
          )}
        >
          {formatPercent(quote.changePct, locale)}
        </span>
      )}
    </div>
  );
}

/**
 * Kartın alt kenarındaki eğri şeridi — kartın imzası.
 *
 * Kırpılmadan tam genişliği kaplar ve altında etiket taşımaz: burada eğri
 * bir ölçü değil, kartın hangi hisseye ait olduğunu hatırlatan sessiz bir
 * biçim. Okunacak sayı başlıkta zaten yazılı.
 */
export function StoryCurveStrip({
  points,
  changePct,
}: {
  points?: { value: number }[];
  changePct: number | null | undefined;
}) {
  if (!points || points.length < 2) return null;
  return (
    <Sparkline
      points={points}
      title=""
      tone={directionOf(changePct)}
      width={320}
      height={28}
      strokeWidth={1.5}
      className="mt-auto h-7 w-full opacity-70"
    />
  );
}
