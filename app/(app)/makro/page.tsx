import { GuideHint } from "@/components/article/GuideHint";
import { Sparkline } from "@/components/ui/Sparkline";
import { DataStamp, EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { getMacroRows } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { formatEtDateLong, formatPrice } from "@/lib/utils";
import type { MacroObservation } from "@/lib/providers/types";

import type { Metadata } from "next";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const metadata: Metadata = {
  title: "Makro",
  description:
    "Enflasyon, istihdam ve faiz — ABD ekonomisinin ana göstergeleri.",
};

/**
 * Makro göstergeler — her seri bir gösterge kartı.
 * Değer büyük ve mono; ok yalnızca yönü söyler (düşüş kırmızı, yükseliş
 * accent mavi) — yeşil bilinçli olarak yok, çünkü enflasyonun düşmesi iyi,
 * istihdamın düşmesi kötüdür ve yeşil "iyi haber" demek olurdu.
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
            const digits = row.unit === "%" ? 1 : 0;

            return (
              <Panel key={row.seriesId} className="flex flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold leading-snug text-strong">
                    {title}
                  </h2>
                  <span className="numeral shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-[10px] text-soft">
                    {formatPeriod(row.periodLabel, locale)}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="tote text-[2rem] leading-none">
                    {formatPrice(row.latestValue, locale, { digits })}
                    {row.unit === "%" && (
                      <span className="ml-1.5 text-lg text-soft">%</span>
                    )}
                  </span>
                  {delta !== null && Math.abs(delta) > 0.001 && (
                    <span className="numeral inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-body">
                      {/* Ok yalnızca yönü söyler: düşüş kırmızı, yükseliş
                          accent mavi. Yeşil yok — bkz. ana sayfa makro kartı. */}
                      <span
                        aria-hidden
                        className={
                          delta > 0
                            ? "text-[0.8em] font-semibold text-primary"
                            : "text-[0.8em] font-semibold text-down"
                        }
                      >
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

                <dl className="mt-4 flex-1 divide-y divide-line-soft border-t border-line-soft text-xs">
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
                        <span className="numeral font-semibold text-primary">
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
              </Panel>
            );
          })}
        </div>
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["enflasyon", "sahin-guvercin"]}
        className="pt-1"
      />
    </div>
  );
}
