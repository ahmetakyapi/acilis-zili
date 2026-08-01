import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, Kicker, PageHeader, Panel } from "@/components/ui/primitives";
import { getStories } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";

/**
 * Piyasa dosyaları — liste.
 *
 * En yeni dosya tam genişlikte bir manşet kartı alır, kalanlar altında
 * tarih sütunlu satırlar hâlinde dizilir. Haberler ekranından farkı bilinçli:
 * orada akış var, burada arşiv — dolayısıyla tarih öne çıkıyor ve her satır
 * bir cümlelik girişini taşıyor.
 */

export default async function StoriesPage() {
  const { locale, t } = await getI18n();
  const rows = await getStories(locale);

  const [lead, ...rest] = rows;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.stories.eyebrow}
        title={t.stories.title}
        subtitle={t.stories.subtitle}
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState title={t.stories.empty} hint={t.stories.emptyHint} />
        </Panel>
      ) : (
        <>
          {/* ---- Manşet ---- */}
          <Link href={`/dosyalar/${lead.slug}`} prefetch>
            <section className="panel-hover rounded-2xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] p-5 transition-colors sm:p-7">
              <div className="flex items-center gap-2.5">
                <Kicker tone="primary">{t.stories.latest}</Kicker>
                <span className="numeral ml-auto text-[11.5px] text-muted">
                  {formatEtDateLong(lead.eventDate, locale)}
                </span>
              </div>
              <h2 className="display-ink mt-3 w-fit text-[24px] font-bold leading-[1.15] tracking-[-0.03em] sm:text-[32px]">
                {lead.title}
              </h2>
              <p className="mt-3 max-w-[65ch] text-[15px] leading-[25px] text-body">
                {lead.dek}
              </p>
              <p className="mt-4 flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-[12.5px] font-semibold text-primary">
                {t.guide.cardCta}
                <ArrowRight weight="bold" size={13} />
                {lead.readMinutes && (
                  <span className="numeral ml-auto font-normal text-muted">
                    {lead.readMinutes} {t.stories.readMinutes}
                  </span>
                )}
              </p>
            </section>
          </Link>

          {/* ---- Arşiv ---- */}
          {rest.length > 0 && (
            <Panel>
              <div className="px-4 py-4 sm:px-5">
                <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
                  {t.stories.archive}
                </h2>
              </div>
              <ul>
                {rest.map((story) => (
                  <li key={story.slug}>
                    <Link
                      href={`/dosyalar/${story.slug}`}
                      prefetch
                      className="flex flex-col gap-1.5 border-t border-line px-4 py-4 transition-colors hover:bg-primary-tint sm:flex-row sm:gap-5 sm:px-5"
                    >
                      <span className="numeral shrink-0 text-[12px] text-muted sm:w-[120px] sm:pt-0.5">
                        {formatEtDateLong(story.eventDate, locale)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-bold leading-snug tracking-[-0.02em] text-strong">
                          {story.title}
                        </span>
                        <span className="mt-1 block text-[13.5px] leading-[21px] text-body">
                          {story.dek}
                        </span>
                        {story.symbols && story.symbols.length > 0 && (
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {story.symbols.slice(0, 6).map((symbol) => (
                              <span
                                key={symbol}
                                className="numeral rounded-md bg-surface-elevated px-1.5 py-0.5 text-[10.5px] font-bold text-body"
                              >
                                {symbol}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
