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

/** Bir şirketin plakadaki satırı. */
export type CastMember = {
  symbol: string;
  name?: string | null;
  logoUrl?: string | null;
  /** Olayın gününden bugüne getiri; hesaplanamıyorsa null. */
  sinceEvent: number | null;
};

/**
 * Logo karosu — çerçevesiz, kutuyu tümüyle dolduran görsel.
 * Logo yoksa sembolün kendisi accent dolgulu bir karoya oturur.
 */
function LogoTile({
  symbol,
  logoUrl,
  size,
  radius,
}: {
  symbol: string;
  logoUrl?: string | null;
  size: number;
  radius: number;
}) {
  if (!logoUrl) {
    return (
      <span
        aria-hidden
        className="numeral flex shrink-0 items-center justify-center bg-primary-wash font-bold text-primary"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          fontSize: size * (symbol.length > 4 ? 0.2 : 0.26),
        }}
      >
        {symbol}
      </span>
    );
  }
  return (
    <span
      className="block shrink-0 overflow-hidden bg-white"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className="size-full object-contain"
      />
    </span>
  );
}

/**
 * Kartın marka şeridi — yazının KADROSU, tek şirket değil.
 *
 * Önce tek bir büyük logo ve onun getirisi duruyordu; yazı tek bir firmayla
 * ilgiliymiş gibi okunuyordu, oysa bu metinler çoğu zaman bir zinciri
 * anlatıyor (Micron, SanDisk, Western Digital…). Şerit artık logoları yan
 * yana diziyor ve altında sembolleri sayıyor; sağdaki rakam ilk şirketin
 * olay gününden bugüne getirisi.
 */
export function StoryBrands({
  cast,
  total,
  sinceLabel,
  locale,
  max = 4,
}: {
  cast: CastMember[];
  /** Yazıda geçen toplam sembol sayısı — şeride sığmayanlar sayıyla söylenir. */
  total: number;
  sinceLabel: string;
  locale: Locale;
  max?: number;
}) {
  const shown = cast.slice(0, max);
  if (shown.length === 0) return null;
  const rest = total - shown.length;
  const lead = shown[0];
  const tone = directionOf(lead.sinceEvent);

  return (
    <div className="flex items-center gap-3 border-b border-line bg-[linear-gradient(135deg,var(--primary-wash),var(--primary-tint))] px-5 py-3.5">
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-center gap-1.5">
          {shown.map((member) => (
            <LogoTile
              key={member.symbol}
              symbol={member.symbol}
              logoUrl={member.logoUrl}
              size={34}
              radius={10}
            />
          ))}
          {rest > 0 && (
            <span className="numeral flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-surface-elevated text-[11px] font-bold text-muted">
              +{rest}
            </span>
          )}
        </span>
        <span className="numeral truncate text-[11px] font-semibold tracking-[0.02em] text-body">
          {shown.map((member) => member.symbol).join(" · ")}
        </span>
      </span>

      {lead.sinceEvent !== null && (
        <span className="shrink-0 pl-2 text-right">
          <span
            className={cn(
              "numeral block text-[15px] font-bold leading-none",
              directionText(tone),
            )}
          >
            {formatPercent(lead.sinceEvent, locale)}
          </span>
          <span className="mt-1 block text-[9px] uppercase tracking-[0.07em] text-muted">
            {lead.symbol} · {sinceLabel}
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Manşetin kadro paneli — yazıda geçen şirketler, her biri kendi getirisiyle.
 *
 * Manşette yer var ve orada tek bir logo göstermek israftı: bu yazıların
 * anlattığı olay çoğu zaman birkaç şirketi birlikte vuruyor ve "sonra ne
 * oldu" sorusunun cevabı şirket şirket değişiyor. Panel bunu tabloya
 * çeviriyor — logo, sembol, ad ve olaydan bugüne getiri. Kartlardaki şerit
 * bunun sıkıştırılmış hâli.
 */
export function StoryCast({
  cast,
  total,
  title,
  sinceLabel,
  moreLabel,
  locale,
}: {
  cast: CastMember[];
  total: number;
  title: string;
  sinceLabel: string;
  /** "+{count} şirket daha" — şablon. */
  moreLabel: string;
  locale: Locale;
}) {
  const shown = cast.slice(0, 3);
  if (shown.length === 0) return null;
  const rest = total - shown.length;

  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-primary-faint bg-surface-solid/70">
      {/* Sağdaki künye, ALTINDAKİ SAYI SÜTUNUYLA aynı hizada durur: iki
          satıra kırılıp sola yaslandığında rakamlarla ilgisiz bir metin gibi
          okunuyordu. Sol başlık kırılır, sağdaki tek satır kalır. */}
      <div className="flex items-baseline justify-between gap-3 border-b border-primary-faint px-4 py-2.5">
        <span className="plate min-w-0 text-[9.5px] tracking-[0.09em]">
          {title}
        </span>
        <span className="shrink-0 whitespace-nowrap text-right text-[9.5px] uppercase tracking-[0.07em] text-muted">
          {sinceLabel}
        </span>
      </div>
      <ul>
        {shown.map((member) => {
          const tone = directionOf(member.sinceEvent);
          return (
            <li
              key={member.symbol}
              className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0"
            >
              <LogoTile
                symbol={member.symbol}
                logoUrl={member.logoUrl}
                size={30}
                radius={9}
              />
              <span className="min-w-0 flex-1">
                <span className="numeral block text-[12.5px] font-bold leading-tight text-strong">
                  {member.symbol}
                </span>
                {member.name && (
                  <span className="block truncate text-[10.5px] leading-tight text-muted">
                    {member.name}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "numeral shrink-0 text-[13px] font-bold",
                  member.sinceEvent === null ? "text-muted" : directionText(tone),
                )}
              >
                {member.sinceEvent === null
                  ? "—"
                  : formatPercent(member.sinceEvent, locale)}
              </span>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <p className="border-t border-line-soft px-4 py-2 text-[10.5px] text-muted">
          {moreLabel.replace("{count}", String(rest))}
        </p>
      )}
    </div>
  );
}
