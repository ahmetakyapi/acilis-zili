import { Sparkline } from "@/components/ui/Sparkline";
import { DataStamp, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getMacroRows } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { cn, formatEtDateLong, formatPrice } from "@/lib/utils";
import type { MacroObservation } from "@/lib/providers/types";

/**
 * Makro göstergeler — her seri bir gösterge kartı.
 * Değer büyük ve mono; değişim yönlü ok taşır ama renk yorumu yapmaz
 * (enflasyonun düşmesi iyi, istihdamın düşmesi kötüdür — renk yanıltır).
 * Dönem ve tarih alanları ham "2026-06" yerine Türkçe okunur.
 */

/** "2026-06" → "Haziran 2026" / "June 2026" */
function formatPeriod(period: string | null, locale: string): string {
  if (!period) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${match[1]}-${match[2]}-15T12:00:00Z`));
}

export default async function MacroPage() {
  const { locale, t } = await getI18n();
  const rows = await getMacroRows();

  const withData = rows.filter(
    (row) => row.latestValue !== null && row.observations,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={locale === "tr" ? "ABD Ekonomisi" : "US Economy"}
        title={t.macro.title}
        subtitle={t.macro.subtitle}
      />

      {withData.length === 0 ? (
        <EmptyState title={t.common.noData} hint={t.common.noDataHint} />
      ) : (
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {withData.map((row) => {
            const title = locale === "tr" ? row.titleTr : row.titleEn;
            const observations =
              (row.observations as MacroObservation[] | null) ?? [];
            const delta =
              row.latestValue !== null && row.prevValue !== null
                ? row.latestValue - row.prevValue
                : null;
            const digits = row.unit === "%" ? 1 : 0;

            return (
              <section key={row.seriesId} className="flex flex-col border-t border-rule pt-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[15px] font-semibold leading-snug text-ink">
                    {title}
                  </h2>
                  <span className="numeral shrink-0 text-[11px] uppercase tracking-[0.07em] text-faint">
                    {formatPeriod(row.periodLabel, locale)}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="tote text-[2.25rem] leading-none">
                    {row.unit === "%" ? "%" : ""}
                    {formatPrice(row.latestValue, locale, { digits })}
                  </span>
                  {delta !== null && Math.abs(delta) > 0.001 && (
                    <span
                      className={cn(
                        "numeral inline-flex items-center gap-1 text-[13px]",
                        delta > 0 ? "text-up" : "text-down",
                      )}
                    >
                      <span aria-hidden className="text-[0.8em]">
                        {delta > 0 ? "▲" : "▼"}
                      </span>
                      {formatPrice(Math.abs(delta), locale, { digits })}
                      {row.unit === "%" ? (locale === "tr" ? " puan" : " pt") : ""}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <Sparkline
                    points={observations}
                    title={title}
                    className="h-16 w-full"
                  />
                </div>

                <dl className="mt-4 flex-1 divide-y divide-hairline border-t border-hairline text-[13px]">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted">{t.macro.previous}</dt>
                    <dd className="numeral font-medium text-body">
                      {formatPrice(row.prevValue, locale, { digits })}
                      {row.unit === "%" ? "%" : ""}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="shrink-0 text-muted">{t.macro.nextRelease}</dt>
                    <dd className="text-right">
                      {row.nextReleaseAt ? (
                        <span className="numeral font-semibold text-up">
                          {formatEtDateLong(row.nextReleaseAt, locale)}
                        </span>
                      ) : (
                        <span className="text-muted">
                          {t.macro.noNextRelease}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                <DataStamp
                  source="fred"
                  at={row.updatedAt}
                  locale={locale}
                  className="mt-3"
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
