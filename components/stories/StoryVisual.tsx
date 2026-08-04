import Image from "next/image";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/**
 * Mercek yazılarının görsel kimliği.
 *
 * GÖRSEL NEREDEN GELİYOR. Bu yazıların stok fotoğrafı yok ve olmamalı: haber
 * fotoğrafı telifli, üstelik dekoratif bir görsel okuyucuya olayla ilgili
 * hiçbir şey söylemiyor. Elimizde telifi bizde olan iki gerçek görsel var ve
 * ikisi de yazının KENDİSİYLE ilgili:
 *
 *   1. Yazının kahramanı şirketlerin logoları — sağlayıcının şirket
 *      profilinden geliyor, zaten veritabanında (`symbols.logo_url`) ve
 *      next/image için tanımlı (next.config.ts → remotePatterns).
 *   2. O şirketin OLAY GÜNÜNDEN BUGÜNE getirisi — tek bir sayı. Bir süre
 *      burada bir aylık fiyat eğrisi çiziliyordu; kartta veri değil gürültü
 *      oluyordu ve arşivde sorulan soruyu da cevaplamıyordu. Kıvrım yerine
 *      rakam: "olay oldu, o günden beri ne oldu".
 *
 * Ölçü hep aynı dilde: gradient yüzey + hairline, gölge yok. Tek gölge marka
 * karosunun; logolar onu taklit etmez.
 */

export type SymbolMetaLite = {
  name?: string | null;
  logoUrl?: string | null;
};

export type CoverQuote = {
  symbol: string;
  changePct: number | null;
} | null;

/**
 * Marka plakası — kartın ve manşetin görsel çapası.
 *
 * ÖNCE EĞRİ VARDI, KALDIRILDI. Kapakta sembolün bir aylık eğrisi çiziliyordu
 * ve küçük kartta bu bir veri değil gürültüydü: soluk bir kıvrım, yanında
 * logolar, üstünde künye — üçü birbirini bulandırıyordu. Bir arşiv kartında
 * okuyucunun sorduğu soru "bu ay fiyat nasıl seyretti" değil, "bu olaydan
 * sonra ne oldu".
 *
 * Yerine iki şey kondu:
 *   1. ŞİRKETİN LOGOSU, büyük ve kırpılmadan — yazının kimliğini bir bakışta
 *      veren gerçek görsel. Kenarlık ve iç dolgu yok; kare kendi köşe
 *      yarıçapıyla kırpılıyor.
 *   2. TEK SAYI: olayın gününden bugüne getiri. Kıvrımın yerini alan bu
 *      rakam gerçekten bir şey söylüyor — "Leopold'un fonu kapandı, Micron o
 *      günden beri %38 yükseldi".
 */
export function BrandPlate({
  symbols,
  meta,
  sinceEvent,
  sinceLabel,
  locale,
  size = 52,
  className,
}: {
  symbols: string[];
  meta: Record<string, SymbolMetaLite>;
  /** Olayın gününden bugüne getiri; hesaplanamıyorsa null. */
  sinceEvent?: number | null;
  sinceLabel: string;
  locale: Locale;
  size?: number;
  className?: string;
}) {
  const primary = symbols[0];
  if (!primary) return null;

  const logo = meta[primary]?.logoUrl;
  const name = meta[primary]?.name;
  const rest = symbols.length - 1;
  const tone = directionOf(sinceEvent);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {logo ? (
        <span
          className="block shrink-0 overflow-hidden rounded-[14px] bg-white"
          style={{ width: size, height: size }}
        >
          <Image
            src={logo}
            alt=""
            width={size}
            height={size}
            className="size-full object-contain"
          />
        </span>
      ) : (
        <span
          aria-hidden
          className="numeral flex shrink-0 items-center justify-center rounded-[14px] bg-primary-wash font-bold text-primary"
          style={{ width: size, height: size, fontSize: size * 0.26 }}
        >
          {primary}
        </span>
      )}

      <span className="min-w-0">
        <span className="numeral flex items-center gap-1.5 text-[13px] font-bold text-strong">
          {primary}
          {rest > 0 && (
            <span className="numeral rounded-md bg-surface-elevated px-1.5 py-px text-[10px] font-bold text-muted">
              +{rest}
            </span>
          )}
        </span>
        {name && (
          <span className="mt-0.5 block truncate text-[11.5px] leading-tight text-muted">
            {name}
          </span>
        )}
      </span>

      {sinceEvent !== null && sinceEvent !== undefined && (
        <span className="ml-auto shrink-0 pl-4 text-right">
          <span
            className={cn(
              "numeral block text-[15px] font-bold leading-none",
              directionText(tone),
            )}
          >
            {formatPercent(sinceEvent, locale)}
          </span>
          <span className="mt-1 block text-[9.5px] uppercase tracking-[0.07em] text-muted">
            {sinceLabel}
          </span>
        </span>
      )}
    </div>
  );
}
