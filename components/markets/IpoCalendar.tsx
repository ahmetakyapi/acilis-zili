import { Suspense } from "react";
/* `LocaleLink`, `next/link` DEĞİL: çıplak bağlantı /en/takvim'de sembol
   adreslerini öneksiz basıyordu ("/hisse/AMRO") ve sayfa yalnızca dil
   çerezi sayesinde İngilizce kalıyordu; adres dili taşımıyordu. */
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { getIpoCalendar } from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatRange } from "@/lib/technical";
import {
  cn,
  formatCompact,
  formatEtDateLong,
  formatMoneyCompact,
  withCurrency,
} from "@/lib/utils";

/**
 * Halka arz takvimi — önümüzdeki altı hafta.
 *
 * Ekonomik takvimin yanında duruyor çünkü ikisi de aynı soruya cevap
 * veriyor: "önümüzdeki günlerde ne olacak". Bilanço takvimi ve makro takvim
 * zaten vardı; takvimi tamamlayan üçüncü parça buydu.
 *
 * Sağlayıcı bazı kayıtları fiyat aralığı ve adet belirlenmeden yayımlıyor
 * (status: expected). O alanlar boş bırakılıyor — tahmin edilmiyor. Durum
 * rozeti de bunu açıkça söylüyor: "beklenen" ile "fiyatlandı" farklı
 * şeylerdir ve fark, katılım kararını doğrudan etkiler.
 */

const WEEKS_AHEAD = 6;
const MAX_ROWS = 12;
/* Takvim ekranının yan kolonunda (360 piksel) en çok altı satır: kolon,
   yanındaki takvim panelinden uzun düşüp sayfanın dibinde tek başına
   sarkmasın. 1100 altında aynı liste tam genişliğe iniyor ve orada on iki
   satırın hepsi görünüyor.
   Karar İKİ KOŞULLU: kap dar (`@max-[479px]`) VE ekran ≥1100. Yalnızca kap
   koşulu vardı ve telefonda tam genişlikteki kap da 480'in altında (ölçüldü:
   390'da 354, 320'de 284 piksel) — 7-12. satırlar hiçbir "devamı var"
   işareti olmadan gizleniyordu. 360 piksellik yan kolon yalnızca ≥1100'de
   var (CalendarExperience `.board`); tavan da yalnızca orada. */
const COMPACT_ROWS = 6;

/**
 * Fiyat aralığı sağlayıcıdan METİN geliyor ("7.06", "18.00-20.00") ve
 * olduğu gibi basılıyordu: TR'de "18.00-20.00 $" hemen altındaki
 * "805 Mn $" ile aynı satırda iki ayrı ondalık dili konuşuyordu (390,
 * ölçüldü). Yalnızca metin bir ya da iki SAYIDAN ibaretse yerelleşiyor ve
 * sitenin öteki fiyat aralıklarıyla aynı biçime giriyor (`formatRange`:
 * "18,00 – 20,00 $", simge bir kez). Sayı olmayan her şey olduğu gibi
 * kalır; tahmin edilmez.
 */
function priceRangeLabel(raw: string, locale: Locale): string {
  const parts = raw.split("-").map((part) => part.trim());
  const numbers = parts.map(Number);
  if (parts.length > 2 || parts.some((part) => part === "") || numbers.some((n) => !Number.isFinite(n))) {
    return withCurrency(raw, locale);
  }
  return formatRange(numbers[0], numbers[numbers.length - 1], locale);
}

/**
 * Borsa adını kısaltır.
 *
 * Sağlayıcı "NASDAQ Global Select", "NYSE American" gibi tam pazar adları
 * veriyor; dar sütunda hepsi "NASDAQ Glo..." diye kırpılıyordu. Pazar
 * segmenti bu ekranda bilgi taşımıyor — borsanın kendisi taşıyor.
 */
function shortExchange(value: string | null): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes("NASDAQ")) return "NASDAQ";
  if (upper.includes("NYSE")) return "NYSE";
  return value.split(/[ ,]/)[0];
}

export function IpoCalendar({
  locale,
  t,
  compact = false,
}: {
  locale: Locale;
  t: Dictionary;
  /**
   * Dar kolon düzeni. `sm:` kırılımları VİEWPORT'u okuyor, kabı değil:
   * 1440 pikselde 360 piksellik yan kolona konan liste 92 piksellik tarih
   * sütununu ve geniş aralığı alıyor, şirket adına ~150 piksel kalıyordu.
   * `compact` bu kararları KABA bağlıyor: yan kolonda dar tarih sütunu ve
   * altı satır, 1100 altında tam genişliğe inince geniş sütun ve tam liste
   * (ölçüldü: 1024'te 976 piksellik panelde tarih iki satıra kırılıyor,
   * sağında ~600 piksel boş kalıyordu). Yatay dolgu DEĞİŞMİYOR:
   * başlık (`PanelHeader`) 20 pikselde kalıyor ve satırlar ondan ayrı
   * düşerse sol kenar iki hatta biterdi.
   */
  compact?: boolean;
}) {
  return (
    <Panel>
      <PanelHeader title={t.ipo.title} meta={t.ipo.window} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        }
      >
        <IpoList locale={locale} t={t} compact={compact} />
      </Suspense>
    </Panel>
  );
}

async function IpoList({
  locale,
  t,
  compact,
}: {
  locale: Locale;
  t: Dictionary;
  compact: boolean;
}) {
  const today = todayEt();
  const result = await getIpoCalendar(today, addEtDays(today, WEEKS_AHEAD * 7));

  /* SAĞLAYICI HATASI İLE BOŞ SONUÇ AYRI ŞEYLER — ikisi aynı daldaydı.
     `t.ipo.empty` bir OLGU İDDİASI: "Bu aralıkta planlanmış halka arz yok",
     alt satırı da "Sağlayıcı takvimi henüz yeni kayıt yayımlamadı" diyerek
     sağlayıcının YANIT VERDİĞİNİ söylüyor. Finnhub düştüğünde kullanıcı bu
     iki cümleyi okuyup gerçekten halka arz olmadığına inanıyordu.
     CLAUDE.md § Veri dürüstlüğü: bilinmeyen, "yok" diye yazılmaz. */
  if (!result.ok) {
    return <EmptyState title={t.common.noData} hint={t.common.noDataHint} />;
  }

  if (result.data.length === 0) {
    return <EmptyState title={t.ipo.empty} hint={t.ipo.emptyHint} />;
  }

  const rows = result.data.slice(0, MAX_ROWS);

  const statusLabel: Record<string, string> = {
    expected: t.ipo.statusExpected,
    priced: t.ipo.statusPriced,
    filed: t.ipo.statusFiled,
  };

  return (
    <>
      <ul>
        {rows.map((row, index) => (
          <li
            key={`${row.symbol}-${row.date}`}
            className={cn(
              "flex items-start gap-3 border-t border-line px-4 py-3 sm:px-5",
              compact ? "@min-[480px]:gap-4" : "sm:gap-4",
              compact && index >= COMPACT_ROWS && "min-[1100px]:@max-[479px]:hidden",
            )}
          >
            <span className={cn("w-[74px] shrink-0", compact ? "@min-[480px]:w-[92px]" : "sm:w-[92px]")}>
              <span className="block text-tiny font-semibold leading-tight text-strong">
                {formatEtDateLong(row.date, locale)}
              </span>
              {shortExchange(row.exchange) && (
                <span className="mt-0.5 block truncate text-nano leading-tight text-muted">
                  {shortExchange(row.exchange)}
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Link
                  href={`/hisse/${row.symbol}`}
                  className="tap-44 numeral -my-1.5 inline-flex min-h-8 items-center py-1.5 text-base font-bold text-strong transition-colors hover:text-primary"
                >
                  {row.symbol}
                </Link>
                {row.status && (
                  <span className="rounded-full bg-surface-elevated px-[7px] py-px text-nano font-semibold text-body">
                    {statusLabel[row.status.toLowerCase()] ?? row.status}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-small leading-tight text-body">
                {row.name}
              </span>
            </span>

            {/* BİLİNMEYEN ALAN BOŞ KALIR, TİRE BASILMAZ. Fiyat aralığı
                belirlenmemiş kayıtta sağ sütunun üstünde tek başına bir tire
                duruyordu; alan yoksa satır yalnızca bildiğini yazıyor. */}
            <span className="shrink-0 text-right">
              {row.priceRange && (
                <span className="numeral block text-small font-semibold text-strong">
                  {/* Aralık bir metin ama para: simgenin yeri yine dile bağlı. */}
                  {priceRangeLabel(row.priceRange, locale)}
                </span>
              )}
              {row.totalValue || row.shares ? (
                <span className="numeral mt-0.5 block text-nano leading-tight text-muted">
                  {row.totalValue
                    ? formatMoneyCompact(row.totalValue, locale)
                    : `${formatCompact(row.shares ?? 0, locale)} ${t.ipo.shares}`}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
        {t.ipo.hint}
      </p>
    </>
  );
}
