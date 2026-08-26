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
        className="numeral flex shrink-0 items-center justify-center bg-primary-wash font-bold text-primary-ink"
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
  locale,
  max = 4,
}: {
  cast: CastMember[];
  /** Yazıda geçen toplam sembol sayısı — şeride sığmayanlar sayıyla söylenir. */
  total: number;
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
            <span className="numeral flex size-[34px] shrink-0 items-center justify-center rounded-md bg-surface-elevated text-tiny font-bold text-muted">
              +{rest}
            </span>
          )}
        </span>
        <span className="numeral truncate text-tiny font-semibold tracking-[0.02em] text-body">
          {shown.map((member) => member.symbol).join(" · ")}
        </span>
      </span>

      {lead.sinceEvent !== null && (
        <span className="shrink-0 pl-2 text-right">
          <span
            className={cn(
              "numeral block text-read font-bold leading-none",
              directionText(tone),
            )}
          >
            {formatPercent(lead.sinceEvent, locale)}
          </span>
          {/* İKİ KÜNYE SATIRI KALKTI. İkisi de 8 punto — mobil okunabilirlik
              tabanının altında — ve ikisi de tekrar: sembol hemen soldaki
              şeritte ve logo karosunda zaten yazılı (üstelik hisse sayfasında
              bu kapak her zaman sayfanın kendi sembolünü gösteriyor), tarih
              ise 54 piksel aşağıda gövdenin ilk satırında okunaklı puntoyla
              duruyor. Kapak 88 pikselden 62'ye indi. */}
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
  eventDate,
  moreLabel,
  locale,
}: {
  cast: CastMember[];
  total: number;
  title: string;
  sinceLabel: string;
  /** Ölçünün başladığı gün — künyenin altında yazılır. */
  eventDate: string;
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
        <span className="plate min-w-0 text-micro tracking-[0.09em]">
          {title}
        </span>
        {/* Künyenin altında ölçünün BAŞLADIĞI GÜN: "olaydan bugüne" tek
            başına hangi günden beri olduğunu söylemiyordu. */}
        <span className="shrink-0 whitespace-nowrap text-right">
          <span className="block text-micro uppercase tracking-[0.07em] text-muted">
            {sinceLabel}
          </span>
          <span className="numeral block text-nano leading-tight text-body">
            {eventDate}
          </span>
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
                <span className="numeral block text-small font-bold leading-tight text-strong">
                  {member.symbol}
                </span>
                {member.name && (
                  <span className="block truncate text-nano leading-tight text-muted">
                    {member.name}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "numeral shrink-0 text-base font-bold",
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
        <p className="border-t border-line-soft px-4 py-2 text-nano text-muted">
          {moreLabel.replace("{count}", String(rest))}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Olaydan bugüne getiri

   Arşiv kartlarındaki ve manşetteki tek rakam: yazının anlattığı olayın
   gününden bugüne, o sembolün ne yaptığı. Kart "bu ay fiyat nasıl seyretti"
   diye sormuyor — "bu olaydan sonra ne oldu" diye soruyor.
   -------------------------------------------------------------------------- */

/**
 * Olayın barlarla eşleşmesi için tanınan boşluk.
 *
 * Olay gününden sonraki İLK işlem günü taban sayılıyor; hafta sonu ve tatil
 * payı buradan geliyor.
 */
const MAX_EVENT_GAP_SECONDS = 10 * 86400;

/**
 * Olaydan son kapanışa yüzde değişim.
 *
 * TABAN OLAYDAN ÖNCEKİ KAPANIŞ — olay gününün kapanışı DEĞİL.
 *
 * Taban olay gününün kendi kapanışıydı ve bu iki şeyi birden bozuyordu:
 *
 *   1. Olayın kendi etkisi ölçünün DIŞINDA kalıyordu. Sitedeki "Moderna
 *      %177 Yükseldi" yazısı bunun en açık örneği: hisse olay günü %177
 *      yükselmiş, ama olay gününün kapanışından ölçülünce kartta − %16,77
 *      yazıyordu. Okuyucu başlıkta "yükseldi" okuyup rakamda düşüş
 *      görüyordu. Aynı sayı doğru tabandan + %130,51.
 *   2. Olay SON işlem gününe denk geldiğinde taban ile son bar aynı bar
 *      oluyor ve fonksiyon hiçbir şey döndüremiyordu. Yani rakam tam da en
 *      yeni — ve sayfada en üstte duran — yazılarda kayboluyordu: manşetin
 *      kadro tablosundaki üç şirket de tire gösteriyordu.
 *
 * Olaydan önceki kapanış yoksa (olay serinin başında ya da öncesinde) taban
 * olay barının kendisi kalır; o da son barsa hiçbir şey dönmez.
 *
 * TABAN UYDURULMAZ. Bir yıllık bar çekiliyor; olay üç yıl önceyse serinin en
 * eski barı olayın günü değil. Bu fonksiyon bir dönem o tabandan yüzde
 * hesaplayıp sonucu yine "olaydan bugüne" diye yazıyordu, yani künye sayının
 * ne olduğu konusunda yanılıyordu. `MAX_EVENT_GAP_SECONDS` bunu engelliyor.
 */
export function sinceEventReturn(
  bars: readonly { time: number; close: number }[] | undefined,
  eventDate: string,
): number | null {
  if (!bars || bars.length < 2) return null;

  const eventTs = Date.parse(`${eventDate}T00:00:00Z`) / 1000;
  if (!Number.isFinite(eventTs)) return null;

  const at = bars.findIndex((bar) => bar.time >= eventTs);
  if (at < 0) return null;
  if (bars[at].time - eventTs > MAX_EVENT_GAP_SECONDS) return null;

  const base = at > 0 ? bars[at - 1] : bars[at];
  const last = bars[bars.length - 1];
  if (base.close <= 0 || base.time === last.time) return null;

  return ((last.close - base.close) / base.close) * 100;
}
