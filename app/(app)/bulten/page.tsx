import { Suspense } from "react";
import Link from "next/link";
import { BriefBody } from "@/components/today/BriefBody";
import {
  EmptyState,
  PageHeader,
  Panel,
  Segment,
  SegmentItem,
  Kicker,
  Skeleton,
} from "@/components/ui/primitives";
import {
  getBriefArchive,
  getBriefByDate,
  getLatestBrief,
  weekAnchor,
} from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* Künye yoktu; arşivin tamamı ana sayfanın başlığı ve açıklamasıyla
   paylaşılıyordu. Adres sorgu parametresi taşısa da (`?tur=`, `?tarih=`)
   canonical sorgusuz kalıyor — `pageAlternates` onu `path`ten kuruyor. */
export const generateMetadata = pageMetadata({
  path: "/bulten",
  tr: {
    title: "Bülten",
    description: "Günlük ve haftalık piyasa bülteninin arşivi.",
  },
  en: {
    title: "Brief",
    description: "Archive of the daily and weekly market brief.",
  },
});
import { cn, formatEtDateLong, formatEtDateShort } from "@/lib/utils";
import type { BriefPeriod } from "@/lib/brief";

/**
 * Bülten arşivi — solda seçili günün/haftanın tam metni, sağda tarih listesi.
 *
 * Tek rota iki dönemi yönetiyor: `?tur=haftalik` haftalık kayıtlara geçer,
 * `?tarih=` seçili kaydı belirler. Ayrı bir dinamik segment açmak yerine
 * sorgu parametresi kullanıldı — arşivde gezinirken liste yerinde kalıyor.
 *
 * HIZ: sekme değişimi eskiden takılıyordu, iki nedenle. Birincisi sorgular
 * ZİNCİRLİYDİ — önce arşiv listesi çekiliyor, ilk satırından tarih okunuyor,
 * sonra o tarihin metni çekiliyordu; iki tam gidiş-dönüş arka arkaya.
 * `getLatestBrief` bu zinciri kırdı, ikisi artık paralel gidiyor. İkincisi
 * sayfanın tamamı sunucuda bekleniyordu: başlık ve sekmeler bile veri
 * gelmeden boyanmıyordu. Artık kabuk anında geliyor, içerik `<Suspense>` ile
 * akıyor ve `key` dönem/tarih değiştiğinde iskeleti hemen gösteriyor.
 */

type Params = { period: BriefPeriod; selected: string | null };

export default async function BriefArchivePage(props: PageProps<"/bulten">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const period: BriefPeriod = search.tur === "haftalik" ? "weekly" : "daily";
  const selected = typeof search.tarih === "string" ? search.tarih : null;

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
      {/* Kabuk veri beklemez: sekmeler hemen boyanır, tıklama anında tepki
          verir ve altındaki içerik akarak gelir. */}
      <PageHeader
        title={period === "weekly" ? t.brief.periodWeekly : t.brief.title}
        subtitle={
          period === "weekly" ? t.brief.weeklySubtitle : t.brief.subtitle
        }
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

      <Suspense key={`${period}:${selected ?? ""}`} fallback={<ArchiveSkeleton />}>
        <ArchiveBoard
          params={{ period, selected }}
          hrefFor={hrefFor}
          locale={locale}
          t={t}
        />
      </Suspense>
    </div>
  );
}

async function ArchiveBoard({
  params,
  hrefFor,
  locale,
  t,
}: {
  params: Params;
  hrefFor: (opts: { period?: BriefPeriod; date?: string }) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const { period, selected } = params;

  /* Paralel: liste ile metin birbirini beklemiyor. Tarih verilmişse o kayıt,
     verilmemişse dönemin en yenisi doğrudan çekiliyor. */
  const [archive, requestedBrief] = await Promise.all([
    getBriefArchive(locale, period),
    selected
      ? getBriefByDate(selected, locale, period)
      : getLatestBrief(locale, period),
  ]);

  if (archive.length === 0) {
    return (
      <Panel>
        <EmptyState title={t.brief.noArchive} hint={t.brief.emptyHint} />
      </Panel>
    );
  }

  /* İstenen tarih arşivde yoksa en yeniye düşülür — boş ekran gösterilmez.
     Bu durumda ikinci bir sorgu gerekiyor ama yalnızca geçersiz bir bağlantı
     açıldığında; normal gezinmede olmuyor. */
  const brief =
    requestedBrief ?? (await getLatestBrief(locale, period));
  const selectedDate = brief?.briefDate ?? archive[0]?.briefDate ?? null;

  const today = todayEt();
  const currentAnchor = period === "weekly" ? weekAnchor(today) : today;

  return (
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
                  ? t.brief.weeklyRange
                      .replace(
                        "{start}",
                        formatEtDateShort(brief.briefDate, locale),
                      )
                      .replace(
                        "{end}",
                        formatEtDateShort(
                          addEtDays(brief.briefDate, 4),
                          locale,
                        ),
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

            {/* Haftalık kaydın kurgusu başlıktan önce söylenir: kayıt biten
                haftanın adına açılıyor ama önümüzdeki haftanın takvimini de
                taşıyor. Bu satır olmadan okuyucu iki bölümün neden yan yana
                durduğunu anlamıyordu. */}
            {period === "weekly" && (
              <p className="mt-3 text-[11.5px] font-semibold tracking-[0.04em] text-primary">
                {t.brief.weeklyFrame}
              </p>
            )}

            {/* Çeviri henüz yoksa orijinal gösterilir — ama bunu söyleyerek. */}
            {brief.locale !== locale && (
              <p className="mt-3 w-fit rounded-full border border-line bg-surface-elevated px-3.5 py-1.5 text-[12px] text-muted">
                {t.brief.fallbackNote}
              </p>
            )}

            <h2 className="mt-4 text-[22px] font-bold leading-tight tracking-[-0.03em] text-strong sm:text-[26px]">
              {brief.headline}
            </h2>

            <BriefBody
              markdown={brief.bodyMd}
              collapsible={false}
              size="page"
            />

            {/* Takvim tahmin değildir — "bu hafta" bölümünün sınırı. */}
            {period === "weekly" && (
              <p className="mt-6 border-t border-primary-faint pt-3 text-[11.5px] leading-relaxed text-muted">
                {t.brief.weeklyNotForecast}
              </p>
            )}
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
                  prefetch
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "block border-t border-line px-4 py-3 transition-colors sm:px-5",
                    active ? "bg-primary-wash" : "hover:bg-primary-tint",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-2 text-[11.5px]",
                      active ? "text-primary" : "text-muted",
                    )}
                  >
                    <span className="numeral font-semibold">
                      {period === "weekly"
                        ? t.brief.weeklyRange
                            .replace(
                              "{start}",
                              formatEtDateShort(row.briefDate, locale),
                            )
                            .replace(
                              "{end}",
                              formatEtDateShort(
                                addEtDays(row.briefDate, 4),
                                locale,
                              ),
                            )
                        : formatEtDateLong(row.briefDate, locale)}
                    </span>
                    {row.briefDate === currentAnchor && (
                      <span className="font-bold">
                        ·{" "}
                        {period === "weekly" ? t.brief.thisWeek : t.brief.today}
                      </span>
                    )}
                    {/* Kayıt okunan dilde değilse dili rozetle söylenir. */}
                    {row.locale !== locale && (
                      <span className="plate ml-auto text-[9px] tracking-[0.09em]">
                        {row.locale.toUpperCase()}
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
  );
}

/** Sekme değişiminde anında görünen iskelet — boş ekran yerine yapı. */
function ArchiveSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Skeleton className="h-[420px] w-full rounded-2xl" />
      <Skeleton className="h-[420px] w-full rounded-(--radius-xl)" />
    </div>
  );
}
