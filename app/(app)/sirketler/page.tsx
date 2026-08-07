import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import Image from "next/image";
import Link from "next/link";
import {
  ChangePill,
  DataStamp,
  EmptyState,
  Panel,
  Skeleton,
} from "@/components/ui/primitives";
import { primaryOnly } from "@/db/seed/indices";
import { getCompanies, getStatus, type CompanyRow } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getQuotes, getWeeklyChanges } from "@/lib/providers";
import {
  SECTOR_GROUPS,
  industryLabel,
  sectorGroupByKey,
  sectorGroupLabel,
  sectorGroupOf,
} from "@/lib/sectors";
import {
  cn,
  directionOf,
  directionText,
  formatCompact,
  formatPercent,
  formatPrice,
  formatVolume,
} from "@/lib/utils";

/**
 * Şirketler — sektör kategorileri + kolon başlığından sıralama.
 * Sıralama URL'de yaşar (?sirala=cap&yon=desc): sunucuda çözülür, JS gerekmez;
 * aynı kolona ikinci tıklama yönü çevirir.
 *
 * Kategoriler alt sektör değil ÜST GRUP: sağlayıcının döndürdüğü 148 GICS alt
 * sektörü şeride sığmıyordu ve hepsi İngilizceydi. Gruplama ve Türkçe adlar
 * `lib/sectors.ts` içinde; alt sektörün kendisi tablonun sütununda okunur.
 */

const SORT_KEYS = ["cap", "hacim", "fiyat", "degisim", "hafta"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

/** Kategori çipi — etiket + o gruptaki şirket sayısı. */
function SectorChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-transparent bg-primary text-on-primary"
          : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
      )}
    >
      {label}
      <span
        className={cn(
          "numeral text-[11px] font-bold",
          active ? "text-on-primary/70" : "text-muted",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function SortHead({
  col,
  label,
  href,
  active,
  dir,
  className,
}: {
  col: SortKey;
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  className?: string;
}) {
  return (
    <th
      key={col}
      className={cn("px-1.5 py-2.5 text-right font-medium sm:px-3", className)}
    >
      {/* Dokunma alanı yazının kendisi kadardı (14px yüksekliğinde) ve
          telefonda sıralama değiştirmek nişancılık istiyordu. Negatif
          margin + dikey dolgu, tabloyu büyütmeden hedefi 32px'e çıkarıyor. */}
      {/* scroll={false}: sıralama bir gezinme değil, aynı tablonun yeniden
          dizilmesi. Varsayılan davranışta okuyucu tablonun ortasında bir
          başlığa basınca sayfanın en üstüne fırlıyor ve aşağı geri kaydırmak
          zorunda kalıyordu. */}
      <Link
        href={href}
        scroll={false}
        className={cn(
          "-my-2 inline-flex min-h-8 items-center gap-1 py-2 transition-colors hover:text-primary",
          active && "text-primary",
        )}
      >
        {label}
        <span aria-hidden className="numeral text-[8px]">
          {active ? (dir === "desc" ? "▼" : "▲") : "▽"}
        </span>
      </Link>
    </th>
  );
}

export default async function CompaniesPage(props: PageProps<"/sirketler">) {
  const search = await props.searchParams;
  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "cap";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";
  const { locale, t } = await getI18n();
  const activeGroup = sectorGroupByKey(
    typeof search.sektor === "string" ? search.sektor : null,
  );

  // Aynı şirketin ikinci sınıf kotasyonu (GOOG ↔ GOOGL) listede tekrar etmez.
  // Tek veritabanı sorgusu — kabuk bunu bekler, sağlayıcıları beklemez.
  const companies = primaryOnly(await getCompanies());

  // Grup → şirket sayısı; boş kalan gruplar şeritte hiç görünmez.
  const groupCounts = new Map<string, number>();
  for (const company of companies) {
    const key = sectorGroupOf(company.industry).key;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }
  const shownGroups = SECTOR_GROUPS.filter(
    (group) => (groupCounts.get(group.key) ?? 0) > 0,
  );

  const rows = activeGroup
    ? companies.filter(
        (c) => sectorGroupOf(c.industry).key === activeGroup.key,
      )
    : companies;

  const sortHref = (key: SortKey) => {
    // Aynı kolona tekrar tıklanınca yön değişir; yeni kolonda desc başlar.
    const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams({ sirala: key, yon: nextDir });
    if (activeGroup) params.set("sektor", activeGroup.key);
    return `/sirketler?${params.toString()}`;
  };

  const sectorHref = (value: string | null) => {
    const params = new URLSearchParams({ sirala: sort, yon: dir });
    if (value) params.set("sektor", value);
    return `/sirketler?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="display-ink w-fit text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">
          {t.companies.title}
        </h1>
        <p className="mt-2 text-sm text-soft">{t.companies.subtitle}</p>
      </header>

      {/* Kategori şeridi — geniş ekranda iki satıra sarar, mobilde kayar
          (kaydırılabilir olduğu sağ kenar solmasından belli olur). */}
      {shownGroups.length > 0 && (
        <div className="relative">
          <div className="scroll-x-hint flex items-center gap-1.5 pb-1 pr-12 sm:flex-wrap sm:gap-2 sm:pb-0 sm:pr-0">
            <SectorChip
              href={sectorHref(null)}
              active={!activeGroup}
              label={t.companies.allSectors}
              count={companies.length}
            />
            {shownGroups.map((group) => {
              const active = group.key === activeGroup?.key;
              return (
                <SectorChip
                  key={group.key}
                  href={sectorHref(active ? null : group.key)}
                  active={active}
                  label={sectorGroupLabel(group, locale)}
                  count={groupCounts.get(group.key) ?? 0}
                />
              );
            })}
          </div>
          {/* Sağ kenar solması — yalnızca kaydırmalı dizilimde anlamlı */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-(--page-bg) to-transparent sm:hidden"
          />
        </div>
      )}

      {/* Tablo AYRI AKIYOR. Eskiden kotasyonlar ve haftalık değişim sayfanın
          gövdesinde arka arkaya bekleniyordu: 514 sembol için altı ardışık
          Alpaca turu demek ve o süre boyunca sektör çipleri bile boyanmıyordu,
          yani filtreye basınca ekran donuyordu. Artık kabuk tek veritabanı
          sorgusuyla anında geliyor, tablo arkadan akıyor.

          `key` filtreye ve sıralamaya bağlı: değiştiğinde Suspense sınırı
          sıfırlanıyor ve iskelet ANINDA görünüyor — tıklamanın karşılığı
          hemen ekranda. */}
      <Suspense
        key={`${activeGroup?.key ?? "hepsi"}:${sort}:${dir}`}
        fallback={<TableSkeleton rows={Math.min(rows.length || 12, 12)} />}
      >
        <CompaniesTable
          rows={rows}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
          locale={locale}
          t={t}
        />
      </Suspense>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["degerleme", "piyasa-degeri"]}
        className="pt-1"
      />
    </div>
  );
}
/* ==========================================================================
   Tablo — sayfadan ayrı akar

   Kotasyon ve haftalık değişim PARALEL çekilir. Eskiden `await getQuotes()`
   sonra `await getWeeklyChanges()` yazıyordu; ikisi de Alpaca'ya üç paket
   istek atıyor, yani altı tur arka arkaya bekleniyordu. Birbirlerine
   bağlı olmadıkları için sıralı beklemenin bir gerekçesi yoktu.
   ========================================================================== */

async function CompaniesTable({
  rows: unsorted,
  sort,
  dir,
  sortHref,
  locale,
  t,
}: {
  rows: CompanyRow[];
  sort: SortKey;
  dir: SortDir;
  sortHref: (key: SortKey) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const symbols = unsorted.map((r) => r.symbol);

  const [quotesResult, weekly] = await Promise.all([
    getQuotes(symbols, status),
    /* Haftalık değişim toplu bir bar isteğiyle geliyor, günlük barlardan
       hesaplanıyor ve uzun TTL ile önbellekli. Günün hareketi tek başına
       gürültü; hafta yönü gösteriyor. */
    getWeeklyChanges(symbols, status),
  ]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const valueOf = (row: CompanyRow): number => {
    const quote = quotes[row.symbol];
    switch (sort) {
      case "fiyat":
        return quote?.price ?? -Infinity;
      case "degisim":
        return quote?.changePct ?? -Infinity;
      case "hafta":
        return weekly[row.symbol] ?? -Infinity;
      case "hacim":
        return quote?.volume ?? row.volume ?? -Infinity;
      default:
        return row.marketCap ?? -Infinity;
    }
  };

  const rows = [...unsorted].sort((a, b) =>
    dir === "asc" ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a),
  );

  return (
    <>
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title={t.companies.empty} hint={t.companies.emptyHint} />
        ) : (
          <div className="scroll-x">
            <table className="w-full text-sm sm:min-w-[700px]">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="hidden w-10 px-4 py-2.5 font-medium sm:table-cell sm:px-5">
                    #
                  </th>
                  <th className="px-3 py-2.5 font-medium sm:px-3">
                    {t.companies.company}
                  </th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                    {t.companies.sector}
                  </th>
                  {/* Değişim fiyattan önce: listeye bakan önce "bugün ne
                      olmuş" diye bakıyor, seviyeye sonra. */}
                  <SortHead
                    col="degisim"
                    label={t.companies.change}
                    href={sortHref("degisim")}
                    active={sort === "degisim"}
                    dir={dir}
                  />
                  <SortHead
                    col="hafta"
                    label={t.companies.weekChange}
                    href={sortHref("hafta")}
                    active={sort === "hafta"}
                    dir={dir}
                    className="hidden sm:table-cell"
                  />
                  <SortHead
                    col="fiyat"
                    label={t.companies.price}
                    href={sortHref("fiyat")}
                    active={sort === "fiyat"}
                    dir={dir}
                  />
                  <SortHead
                    col="cap"
                    label={t.market.marketCap}
                    href={sortHref("cap")}
                    active={sort === "cap"}
                    dir={dir}
                    className="hidden sm:table-cell"
                  />
                  <SortHead
                    col="hacim"
                    label={t.market.volume}
                    href={sortHref("hacim")}
                    active={sort === "hacim"}
                    dir={dir}
                    className="hidden sm:table-cell sm:px-5"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((company, index) => {
                  const quote = quotes[company.symbol];
                  return (
                    <tr
                      key={company.symbol}
                      className="transition-colors hover:bg-primary-tint"
                    >
                      <td className="numeral hidden px-4 py-2.5 text-xs text-muted sm:table-cell sm:px-5">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/hisse/${company.symbol}`} prefetch={false}
                          className="flex items-center gap-2.5"
                        >
                          {company.logoUrl ? (
                            <Image
                              src={company.logoUrl}
                              alt=""
                              width={34}
                              height={34}
                              className="rounded-md bg-white object-contain"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="numeral flex size-[34px] items-center justify-center rounded-md bg-primary-wash text-[9px] font-bold text-primary"
                            >
                              {company.symbol.slice(0, 2)}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="numeral block font-semibold text-strong">
                              {company.symbol}
                            </span>
                            <span className="block max-w-[104px] truncate text-xs text-soft sm:max-w-44">
                              {company.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden max-w-40 truncate px-3 py-2.5 text-xs text-soft md:table-cell">
                        {industryLabel(company.industry, locale) ?? "—"}
                      </td>
                      <td className="px-1.5 py-2.5 text-right sm:px-3">
                        {quote ? (
                          <ChangePill
                            changePct={quote.changePct}
                            locale={locale}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="numeral hidden px-3 py-2.5 text-right sm:table-cell">
                        {weekly[company.symbol] !== undefined ? (
                          <span
                            className={cn(
                              "font-semibold",
                              directionText(directionOf(weekly[company.symbol])),
                            )}
                          >
                            {formatPercent(weekly[company.symbol], locale)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      {/* Fiyat satırın ÇAPASI: değişim, hafta, piyasa değeri
                          ve hacim hep ona göre okunuyor. Diğerleriyle aynı
                          ağırlıkta yazılınca sayı dizisinin içinde kayboluyordu. */}
                      <td className="numeral px-3 py-2.5 pr-4 text-right font-bold text-strong sm:pr-3">
                        {quote ? formatPrice(quote.price, locale) : "—"}
                      </td>
                      <td className="numeral hidden px-3 py-2.5 text-right text-body sm:table-cell">
                        {company.marketCap
                          ? `$${formatCompact(company.marketCap, locale)}`
                          : "—"}
                      </td>
                      <td className="numeral hidden px-4 py-2.5 text-right text-soft sm:table-cell sm:px-5">
                        {formatVolume(quote?.volume ?? company.volume, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {quotesResult.ok && (
        <DataStamp
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      )}

    </>
  );
}

/** Filtre değişiminde anında görünen iskelet — boş ekran yerine yapı. */
function TableSkeleton({ rows }: { rows: number }) {
  return (
    <Panel>
      <div className="flex flex-col gap-px">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <Skeleton className="size-[34px] shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
            <Skeleton className="hidden h-3 w-12 shrink-0 sm:block" />
            <Skeleton className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
