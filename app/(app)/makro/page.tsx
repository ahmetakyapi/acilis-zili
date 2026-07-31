import { Sparkline } from "@/components/ui/Sparkline";
import { DataStamp, EmptyState, Panel } from "@/components/ui/primitives";
import { getMacroRows } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { cn, formatPrice } from "@/lib/utils";
import type { MacroObservation } from "@/lib/providers/types";

export default async function MacroPage() {
  const { locale, t } = await getI18n();
  const rows = await getMacroRows();

  const withData = rows.filter(
    (row) => row.latestValue !== null && row.observations,
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="notched inline-block text-2xl font-semibold sm:text-3xl">
          {t.macro.title}
        </h1>
        <p className="mt-2 text-sm text-soft">{t.macro.subtitle}</p>
      </header>

      {withData.length === 0 ? (
        <Panel>
          <EmptyState title={t.common.noData} hint={t.common.noDataHint} />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withData.map((row) => {
            const title = locale === "tr" ? row.titleTr : row.titleEn;
            const observations =
              (row.observations as MacroObservation[] | null) ?? [];
            const delta =
              row.latestValue !== null && row.prevValue !== null
                ? row.latestValue - row.prevValue
                : null;

            return (
              <Panel key={row.seriesId} className="p-4 sm:p-5">
                <h2 className="text-xs font-medium text-soft">{title}</h2>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="tote text-3xl">
                    {formatPrice(row.latestValue, locale, {
                      digits: row.unit === "%" ? 1 : 0,
                    })}
                    {row.unit === "%" && (
                      <span className="text-lg text-soft">%</span>
                    )}
                  </span>
                  {delta !== null && Math.abs(delta) > 0.001 && (
                    <span className="numeral text-xs text-muted">
                      {delta > 0 ? "+" : "−"}
                      {formatPrice(Math.abs(delta), locale, {
                        digits: row.unit === "%" ? 1 : 0,
                      })}
                      {row.unit === "%" ? (locale === "tr" ? " puan" : " pt") : ""}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <Sparkline points={observations} title={title} className="h-14 w-full" />
                </div>

                <dl className="mt-3 space-y-1 border-t border-line-soft pt-2.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted">{t.macro.period}</dt>
                    <dd className="numeral text-soft">{row.periodLabel ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">{t.macro.previous}</dt>
                    <dd className="numeral text-soft">
                      {formatPrice(row.prevValue, locale, {
                        digits: row.unit === "%" ? 1 : 0,
                      })}
                      {row.unit === "%" ? "%" : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted">{t.macro.nextRelease}</dt>
                    <dd
                      className={cn(
                        "text-right text-soft",
                        row.nextReleaseAt ? "numeral" : "text-muted",
                      )}
                    >
                      {row.nextReleaseAt ?? t.macro.noNextRelease}
                    </dd>
                  </div>
                </dl>

                <DataStamp
                  source="fred"
                  at={row.updatedAt}
                  locale={locale}
                  className="mt-3"
                />
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
