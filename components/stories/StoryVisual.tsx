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
 * Kart kapağı — gradient bant, logolar ve arkasında sembolün eğrisi.
 *
 * Eğri kasten ARKA PLANDA ve soluk: kapağın işi bir bakışta "bu yazı hangi
 * şirketlerin, piyasa ne yapmış" demek, grafik okutmak değil. Okunacak grafik
 * yazının içinde (`::: grafik` bloğu) zaten var.
 */
export function StoryCover({
  symbols,
  meta,
  quote,
  points,
  locale,
  height = 92,
  logoSize = 40,
  className,
}: {
  symbols: string[];
  meta: Record<string, SymbolMetaLite>;
  quote: CoverQuote;
  /** Birincil sembolün son bir aylık kapanışları; yoksa eğri çizilmez. */
  points?: { value: number }[];
  locale: Locale;
  height?: number;
  logoSize?: number;
  className?: string;
}) {
  const tone = directionOf(quote?.changePct);
  const name = quote ? meta[quote.symbol]?.name : null;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden border-b border-line bg-[linear-gradient(135deg,var(--primary-wash),var(--primary-tint))] px-5",
        className,
      )}
      style={{ height }}
    >
      {points && points.length > 1 && (
        <Sparkline
          points={points}
          title=""
          tone={tone}
          width={320}
          height={48}
          strokeWidth={1.5}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 w-full opacity-50"
        />
      )}

      <LogoCluster
        symbols={symbols}
        meta={meta}
        size={logoSize}
        className="relative"
      />

      {quote && (
        <span className="relative ml-auto min-w-0 text-right">
          <span className="numeral block truncate text-[12px] font-bold text-strong">
            {quote.symbol}
          </span>
          {name && (
            <span className="block max-w-28 truncate text-[10.5px] leading-tight text-muted">
              {name}
            </span>
          )}
          <span
            className={cn(
              "numeral block text-[11.5px] font-semibold",
              directionText(tone),
            )}
          >
            {formatPercent(quote.changePct, locale)}
          </span>
        </span>
      )}
    </div>
  );
}
