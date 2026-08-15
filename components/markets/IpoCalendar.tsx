import { Suspense } from "react";
import Link from "next/link";
import { EmptyState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { getIpoCalendar } from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatCompact, formatEtDateLong } from "@/lib/utils";

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

export function IpoCalendar({ locale, t }: { locale: Locale; t: Dictionary }) {
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
        <IpoList locale={locale} t={t} />
      </Suspense>
    </Panel>
  );
}

async function IpoList({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const result = await getIpoCalendar(today, addEtDays(today, WEEKS_AHEAD * 7));

  if (!result.ok || result.data.length === 0) {
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
        {rows.map((row) => (
          <li
            key={`${row.symbol}-${row.date}`}
            className="flex items-start gap-3 border-t border-line px-4 py-3 sm:gap-4 sm:px-5"
          >
            <span className="w-[74px] shrink-0 sm:w-[92px]">
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
                  className="numeral -my-1.5 inline-flex min-h-8 items-center py-1.5 text-base font-bold text-strong transition-colors hover:text-primary"
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

            <span className="shrink-0 text-right">
              <span className="numeral block text-small font-semibold text-strong">
                {row.priceRange ? `$${row.priceRange}` : "—"}
              </span>
              <span className="numeral mt-0.5 block text-nano leading-tight text-muted">
                {row.totalValue
                  ? `$${formatCompact(row.totalValue, locale)}`
                  : row.shares
                    ? `${formatCompact(row.shares, locale)} ${t.ipo.shares}`
                    : "—"}
              </span>
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
