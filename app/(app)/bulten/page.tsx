import Link from "next/link";
import { BriefBody } from "@/components/today/BriefBody";
import {
  EmptyState,
  PageHeader,
  Panel,
  Segment,
  SegmentItem,
  Kicker,
} from "@/components/ui/primitives";
import { getBriefArchive, getBriefByDate, weekAnchor } from "@/lib/data";
import { todayEt } from "@/lib/market-hours";
import { getI18n } from "@/lib/i18n";
import { cn, formatEtDateLong } from "@/lib/utils";
import type { BriefPeriod } from "@/lib/brief";

/**
 * Bülten arşivi — solda seçili günün/haftanın tam metni, sağda tarih listesi.
 *
 * Tek rota iki dönemi yönetiyor: `?tur=haftalik` haftalık kayıtlara geçer,
 * `?tarih=` seçili kaydı belirler. Ayrı bir dinamik segment açmak yerine
 * sorgu parametresi kullanıldı — arşivde gezinirken liste yerinde kalıyor.
 */
export default async function BriefArchivePage(props: PageProps<"/bulten">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const period: BriefPeriod = search.tur === "haftalik" ? "weekly" : "daily";
  const archive = await getBriefArchive(locale, period);

  const requested = typeof search.tarih === "string" ? search.tarih : null;
  // Seçim listede yoksa en yeni kayda düşülür; boş ekran gösterilmez.
  const selectedDate =
    (requested && archive.some((row) => row.briefDate === requested)
      ? requested
      : archive[0]?.briefDate) ?? null;

  const brief = selectedDate
    ? await getBriefByDate(selectedDate, locale, period)
    : null;

  const today = todayEt();
  const currentAnchor = period === "weekly" ? weekAnchor(today) : today;

  const hrefFor = (opts: { period?: BriefPeriod; date?: string }) => {
    const params = new URLSearchParams();
    const p = opts.period ?? period;
    if (p === "weekly") params.set("tur", "haftalik");
    if (opts.date) params.set("tarih", opts.date);
    const query = params.toString();
    return query ? `/bulten?${query}` : "/bulten";
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={t.brief.title}
        subtitle={t.brief.subtitle}
        action={
          <Segment>
            <SegmentItem
              href={hrefFor({ period: "daily", date: undefined })}
              active={period === "daily"}
            >
              {t.brief.periodDaily}
            </SegmentItem>
            <SegmentItem
              href={hrefFor({ period: "weekly", date: undefined })}
              active={period === "weekly"}
            >
              {t.brief.periodWeekly}
            </SegmentItem>
          </Segment>
        }
      />

      {archive.length === 0 ? (
        <Panel>
          <EmptyState title={t.brief.noArchive} hint={t.brief.emptyHint} />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ---- Seçili kayıt ---- */}
          <article className="rounded-2xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))] p-5 sm:p-7">
            {brief ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Kicker tone="primary">
                    {period === "weekly"
                      ? t.brief.periodWeekly
                      : t.brief.periodDaily}
                  </Kicker>
                  <span className="text-[12.5px] text-body">
                    {period === "weekly"
                      ? t.brief.weekOf.replace(
                          "{date}",
                          formatEtDateLong(brief.briefDate, locale),
                        )
                      : formatEtDateLong(brief.briefDate, locale)}
                  </span>
                  {brief.briefDate === currentAnchor && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-bold tracking-[0.05em] text-on-primary">
                      {(period === "weekly"
                        ? t.brief.thisWeek
                        : t.brief.today
                      ).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
                    </span>
                  )}
                  <span className="ml-auto text-[11.5px] text-muted">
                    {t.brief.writtenBy}:{" "}
                    {brief.generatedBy === "claude"
                      ? t.brief.byClaude
                      : t.brief.byRules}
                  </span>
                </div>

                <h2 className="mt-4 text-[22px] font-bold leading-tight tracking-[-0.03em] text-strong sm:text-[26px]">
                  {brief.headline}
                </h2>

                <BriefBody
                  markdown={brief.bodyMd}
                  collapsible={false}
                  size="page"
                />
              </>
            ) : (
              <EmptyState title={t.brief.empty} hint={t.brief.emptyHint} />
            )}
          </article>

          {/* ---- Arşiv listesi ---- */}
          <Panel>
            <div className="px-4 py-4 sm:px-5">
              <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
                {t.brief.archiveTitle}
              </h2>
            </div>
            <ul className="max-h-[70dvh] overflow-y-auto">
              {archive.map((row) => {
                const active = row.briefDate === selectedDate;
                return (
                  <li key={row.briefDate}>
                    <Link
                      href={hrefFor({ date: row.briefDate })}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "block border-t border-line px-4 py-3 transition-colors sm:px-5",
                        active
                          ? "bg-primary-wash"
                          : "hover:bg-primary-tint",
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center gap-2 text-[11.5px]",
                          active ? "text-primary" : "text-muted",
                        )}
                      >
                        <span className="numeral font-semibold">
                          {formatEtDateLong(row.briefDate, locale)}
                        </span>
                        {row.briefDate === currentAnchor && (
                          <span className="font-bold">
                            ·{" "}
                            {period === "weekly"
                              ? t.brief.thisWeek
                              : t.brief.today}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "mt-1 line-clamp-2 block text-[13px] leading-snug",
                          active
                            ? "font-semibold text-strong"
                            : "font-medium text-body",
                        )}
                      >
                        {row.headline}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
