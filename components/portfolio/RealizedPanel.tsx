import { Panel, PanelHeader, LogoTile } from "@/components/ui/primitives";
import { formatIsoDate, formatLira } from "@/lib/fx";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { RealizedData } from "@/lib/portfolio-sales-data";
import type { SymbolMeta } from "@/lib/data";
import { cn, directionOf, directionText, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import { UndoSaleButton } from "./PortfolioClient";

/**
 * GERÇEKLEŞEN KÂR/ZARAR (9 Ekim) — gerekçe `lib/schema.ts` → portfolioSales.
 *
 * Sıra ekran kuralıyla aynı: başlık → ölçü ızgarası (satış YILINA göre
 * toplam; beyan yılı satış günüyle belirleniyor) → satış listesi → künye
 * panelin içinde, hairline ile. Lira kârı alış ve satış günlerinin TCMB
 * kuruyla; bir kur eksikse o satırın lira tarafı "Kur Yok" diyor ve yılın
 * lira toplamı da kısmi bir sayı yerine boş kalıyor (veri dürüstlüğü 1).
 *
 * Sunucu bileşeni; yalnızca "Geri Al" istemcide (iş masasının bildirimiyle).
 */
export function RealizedPanel({
  data,
  names,
  locale,
  t,
}: {
  data: RealizedData;
  names: Record<string, SymbolMeta | undefined>;
  locale: Locale;
  t: Dictionary;
}) {
  const S = t.portfolioSales;
  if (!data.available) return null;
  const usd = (value: number, signed = false) =>
    `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true })}`;
  const qtyFormat = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 8 });

  return (
    <Panel aria-label={S.realizedTitle}>
      <PanelHeader title={S.realizedTitle} />
      {data.views.length === 0 ? (
        <p className="px-4 pb-4 text-small leading-relaxed text-body sm:px-5">{S.realizedEmpty}</p>
      ) : (
        <>
          {/* Yıl toplamları — yan yana duran ölçüler aynı hatta biter. */}
          <div className="grid gap-2.5 px-4 pb-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
            {data.years.map((year) => (
              <div key={year.year} className="grid grid-rows-[auto_1fr_auto] gap-1 rounded-lg border border-line bg-surface-sunken px-3.5 py-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-small font-bold text-strong">{S.yearTitle.replace("{year}", year.year)}</span>
                  <span className="numeral text-tiny text-muted">{S.yearCount.replace("{n}", String(year.count))}</span>
                </p>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className={cn("numeral text-lead font-bold", directionText(directionOf(year.pnlUsd)))}>{usd(year.pnlUsd, true)}</span>
                  <span className={cn("numeral text-read font-semibold", year.pnlTl === null ? "text-muted" : directionText(directionOf(year.pnlTl)))}>
                    {year.pnlTl === null ? S.rateMissing : formatLira(year.pnlTl, locale, 2, true)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <ul className="border-t border-line">
            {data.views.map((view) => (
              <li key={view.saleId} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-3 last:border-b-0 sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:px-5">
                <LogoTile symbol={view.symbol} logoUrl={names[view.symbol]?.logoUrl ?? null} size="sm" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="numeral text-read font-bold text-strong">{view.symbol}</span>
                    <span className="numeral text-tiny text-muted">{formatIsoDate(view.soldAt, locale)}</span>
                  </p>
                  <p className="numeral text-tiny text-body">
                    {qtyFormat.format(view.quantity)} × {formatPrice(view.priceUsd, locale, { currency: true })}
                    {view.lots > 1 && <span className="text-muted"> · {S.lotsNote.replace("{n}", String(view.lots))}</span>}
                  </p>
                </div>
                {/* Telefonda iki getiri satırın altına iniyor (tam genişlik). */}
                <div className="col-span-3 grid grid-cols-2 gap-3 sm:col-span-1 sm:contents">
                  <Result label={S.usd} value={usd(view.pnlUsd, true)} pct={view.pnlUsdPct} tone={view.pnlUsd} locale={locale} />
                  <Result
                    label={S.tl}
                    value={view.pnlTl === null ? S.rateMissing : formatLira(view.pnlTl, locale, 2, true)}
                    pct={view.pnlTlPct}
                    tone={view.pnlTl}
                    locale={locale}
                  />
                </div>
                <div className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto">
                  <UndoSaleButton saleId={view.saleId} symbol={view.symbol} label={S.undo} aria={S.undoAria.replace("{symbol}", view.symbol)} done={S.toastUndone.replace("{symbol}", view.symbol)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">{S.realizedNote}</p>
    </Panel>
  );
}

function Result({
  label,
  value,
  pct,
  tone,
  locale,
}: {
  label: string;
  value: string;
  pct: number | null;
  tone: number | null;
  locale: Locale;
}) {
  return (
    <div className="min-w-0">
      <p className="text-nano text-muted">{label}</p>
      <p className={cn("numeral text-read font-bold", tone === null ? "text-muted" : directionText(directionOf(tone)))}>{value}</p>
      <p className="numeral text-tiny text-muted">{pct === null ? NO_VALUE : formatPercent(pct, locale)}</p>
    </div>
  );
}
