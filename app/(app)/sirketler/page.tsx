import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import Link from "next/link";
import {
  ChangePill,
  DataStamp,
  EmptyState,
  Panel,
  Skeleton,
  LogoTile,
} from "@/components/ui/primitives";
import { primaryOnly } from "@/db/seed/indices";
import {
  getCompanies,
  getStatus,
  liveMarketCap,
  type CompanyRow,
} from "@/lib/data";
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
  formatMoneyCompact,
  formatPercent,
  formatPrice,
  formatVolume,
} from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/sirketler",
  tr: {
    title: "Şirketler",
    description:
      "ABD borsalarında işlem gören şirketler — sektör, fiyat ve piyasa değeriyle.",
  },
  en: {
    title: "Companies",
    description:
      "Companies listed on US exchanges — with sector, price and market cap.",
  },
});

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

/**
 * Bir seferde basılan satır sayısı.
 *
 * Dizin 670 şirketin TAMAMINI tek sayfada basıyordu: 3 MB HTML, 13.700 DOM
 * düğümü, 667 logo. Telefonda 4G'de ilk boyama iki saniyeyi geçiyordu ve
 * sıralamaya basmak yarım saniye sürüyordu — çünkü sunucu her tıklamada 670
 * satırı yeniden çiziyor, tarayıcı da 670 satırı yeniden yerleştiriyordu.
 * Kimse 670 satırlık bir listeyi kaydırmıyor; okuyucu ya sektöre filtreliyor
 * ya aramayı kullanıyor.
 *
 * Sıralama SATIRLARIN TAMAMI üzerinde yapılır, sonra dilim alınır: "en çok
 * düşen" listesi ilk 60 satırın değil, 670'in en çok düşenidir. Kotasyonlar
 * bu yüzden hepsi için çekilmeye devam ediyor (zaten paralel ve önbellekli);
 * kazanç sunucunun ürettiği HTML'de ve tarayıcının kurduğu DOM'da.
 */
const PAGE_STEP = 60;

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
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 sm:min-h-[34px] text-small font-semibold transition-colors",
        active
          ? "border-transparent bg-primary text-on-primary"
          : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
      )}
    >
      {label}
      <span
        className={cn(
          "numeral text-tiny font-bold",
          /* SAYI TAM BEYAZ. Saydamlık (/70) mavi zemin üstünde kontrastı
             3,2'ye düşürüyordu; WCAG AA küçük punto için 4,5 istiyor ve
             kalın olması bunu değiştirmiyor (eşik 18,66px'ten büyük
             puntolarda düşüyor, bu 11px). Hiyerarşi saydamlıkla değil
             puntoyla kuruluyor: sayı zaten etiketten bir kademe küçük. */
          active ? "text-on-primary" : "text-muted",
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
      scope="col"
      /* Hangi sütuna göre sıralı olduğu iki şeyle anlatılıyordu: `text-primary`
         rengi ve `aria-hidden` işaretli bir üçgen. İkisi de yardımcı
         teknolojiye ulaşmıyor — ekran okuyucu kullanıcısı tablonun neye göre
         dizildiğini hiç öğrenemiyordu. `aria-sort` bunu doğrudan söylüyor. */
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn("px-1.5 py-2.5 text-right font-semibold sm:px-3", className)}
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
        <span aria-hidden className="numeral text-micro">
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

  /* Kaç satır basılacak. Sıralama ya da filtre değişince sayaç başa döner:
     "daha fazla" bir okuma derinliğidir, yeni bir listeye taşınmaz. */
  const requested = Number(
    typeof search.adet === "string" ? search.adet : PAGE_STEP,
  );
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.ceil(requested / PAGE_STEP) * PAGE_STEP, rows.length)
      : PAGE_STEP;

  const sortHref = (key: SortKey) => {
    // Aynı kolona tekrar tıklanınca yön değişir; yeni kolonda desc başlar.
    const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams({ sirala: key, yon: nextDir });
    if (activeGroup) params.set("sektor", activeGroup.key);
    // Sıralama değişince derinlik korunur: 180 satıra inmiş biri, sütun
    // başlığına basınca ilk 60'a geri fırlatılmamalı.
    if (limit > PAGE_STEP) params.set("adet", String(limit));
    return `/sirketler?${params.toString()}`;
  };

  const sectorHref = (value: string | null) => {
    const params = new URLSearchParams({ sirala: sort, yon: dir });
    if (value) params.set("sektor", value);
    return `/sirketler?${params.toString()}`;
  };

  const moreHref = () => {
    const params = new URLSearchParams({
      sirala: sort,
      yon: dir,
      adet: String(limit + PAGE_STEP),
    });
    if (activeGroup) params.set("sektor", activeGroup.key);
    return `/sirketler?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
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
        key={`${activeGroup?.key ?? "hepsi"}:${sort}:${dir}:${limit}`}
        fallback={<TableSkeleton rows={Math.min(rows.length || 12, 12)} />}
      >
        <CompaniesTable
          rows={rows}
          limit={limit}
          moreHref={moreHref()}
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
  limit,
  moreHref,
  sort,
  dir,
  sortHref,
  locale,
  t,
}: {
  rows: CompanyRow[];
  /** Kaç satır basılacak — sıralama TAMAMI üzerinde, dilim sonra alınır. */
  limit: number;
  moreHref: string;
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

  /* PİYASA DEĞERİ SATIRDAKİ FİYATLA AYNI KAYNAKTAN. `getCompanies()` değeri
     `quotes_cache`teki fiyatla hesaplıyor; o fiyat bu sayfanın az önce
     çektiği canlı kotasyondan bir tur eski. Aynı satırda "Fiyat" canlı
     sayıyı, "Piyasa Değeri" bir önceki fiyattan çıkan sayıyı gösteriyordu —
     normal bir günde fark görünmüyor ama MRNA'nın tek seansta üçe katlandığı
     gün ekranda iki farklı fiyattan türemiş iki sayı yan yana duruyordu.
     Kotasyon gelmeyen sembolde önbellekten hesaplanmış değer taban kalır. */
  const capOf = (row: CompanyRow): number | null => {
    const price = quotes[row.symbol]?.price;
    return price != null
      ? liveMarketCap(
          {
            marketCap: row.storedMarketCap,
            shareOutstanding: row.shareOutstanding,
          },
          price,
        )
      : row.marketCap;
  };

  /* Değeri OLMAYAN satır `null` döner, sayı değil.
     Eskiden eksik değerler `-Infinity` ile temsil ediliyordu ve bu, azalan
     sıralamada işe yarayıp artanda bozuluyordu: "Değişim"e tıklayıp artana
     geçen okuyucu, listenin başında günün en çok düşenlerini değil kotasyonu
     hiç gelmemiş şirketleri buluyordu. Eksik veri bir uç değer DEĞİL, bir
     bilinmezlik — hiçbir yönde listeye başkanlık etmemeli. */
  const valueOf = (row: CompanyRow): number | null => {
    const quote = quotes[row.symbol];
    switch (sort) {
      case "fiyat":
        return quote?.price ?? null;
      case "degisim":
        return quote?.changePct ?? null;
      case "hafta":
        return weekly[row.symbol] ?? null;
      case "hacim":
        return quote?.volume ?? row.volume ?? null;
      default:
        return capOf(row) ?? null;
    }
  };

  /* Boşlar her zaman SONDA, yön ne olursa olsun. Kendi aralarındaki sıra
     bozulmuyor: `Array.prototype.sort` kararlı, yani veri gelmeyen şirketler
     tablonun kendi (piyasa değeri) sırasında kalıyor. */
  const sorted = [...unsorted].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  });

  // Dilim SIRALAMADAN SONRA: "en çok düşen" ilk 60'ın değil, hepsinin en çok
  // düşeni. Kotasyonlar bu yüzden tüm semboller için çekiliyor.
  const rows = sorted.slice(0, limit);
  const hasMore = sorted.length > rows.length;

  return (
    <>
      <Panel>
        {rows.length === 0 ? (
          <EmptyState title={t.companies.empty} hint={t.companies.emptyHint} />
        ) : (
          <div className="scroll-x">
            <table className="w-full text-sm sm:min-w-[700px]">
              <thead>
                <tr className="border-b border-line text-left text-nano uppercase tracking-[0.08em] text-muted">
                  <th className="hidden w-10 px-4 py-2.5 font-semibold sm:table-cell sm:px-5">
                    #
                  </th>
                  <th className="px-3 py-2.5 font-semibold sm:px-3">
                    {t.companies.company}
                  </th>
                  <th className="hidden px-3 py-2.5 font-semibold md:table-cell">
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
                    className="px-1.5 sm:px-3"
                  />
                  <SortHead
                    col="cap"
                    label={t.market.marketCap}
                    href={sortHref("cap")}
                    active={sort === "cap"}
                    dir={dir}
                    className="pr-4 sm:pr-3"
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
                      <td className="numeral hidden px-4 py-3 text-xs text-muted sm:table-cell sm:px-5">
                        {index + 1}
                      </td>
                      <td className="py-3 pl-3 pr-1.5 sm:px-3">
                        <Link
                          href={`/hisse/${company.symbol}`} prefetch={false}
                          /* Telefonda 44px: satıra dokunmak bu sayfanın ana
                             eylemi ama bağlantı yalnızca logo yüksekliği
                             kadardı (34px) ve hücre dolgusunun bir kısmı
                             tıklanabilir değildi. */
                          className="flex min-h-11 items-center gap-2 sm:min-h-0 sm:gap-2.5"
                        >
                          <LogoTile
                            symbol={company.symbol}
                            logoUrl={company.logoUrl}
                            /* Telefonda 30px: dördüncü sütun (piyasa değeri)
                               eklenince satır 372px'e çıkıp 352'lik kanalı
                               20 piksel aşıyordu. */
                            className="size-[30px] sm:size-[34px]"
                          />
                          <span className="min-w-0">
                            <span className="block text-base font-bold leading-[18px] text-strong">
                              {company.symbol}
                            </span>
                            <span className="block max-w-[66px] truncate text-tiny leading-[15px] text-muted sm:max-w-44">
                              {company.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden max-w-40 truncate px-3 py-3 text-small text-soft md:table-cell">
                        {industryLabel(company.industry, locale) ?? "—"}
                      </td>
                      <td className="px-1 py-3 text-right sm:px-3">
                        {quote ? (
                          <ChangePill
                            changePct={quote.changePct}
                            locale={locale}
                            size="sm"
                            /* sm:text-…: dar ekranda pilin 11px'i kalıyor
                               (390px'te dört sütun zor sığıyor), geniş
                               ekranda sayı bir bakışta okunacak boya çıkıyor. */
                            className="px-1 sm:px-2 sm:text-small"
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read sm:table-cell">
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
                          ağırlıkta yazılınca sayı dizisinin içinde kayboluyordu.
                          Boylar bir kademe büyütüldü: 13/13.5 punto sayılar
                          "bir bakışta" okunmuyordu, tablo sayı tablosu. */}
                      <td className="numeral px-1 py-3 text-right text-base font-bold text-strong sm:px-3 sm:text-read">
                        {quote ? formatPrice(quote.price, locale) : "—"}
                      </td>
                      {/* Piyasa değeri telefonda da FİYATIN SAĞINDA, kendi
                          sütununda. Bir süre fiyatın altına ikinci satır
                          olarak konmuştu: yer kazandırıyordu ama iki ayrı
                          ölçüyü tek hücrede üst üste bindirdiği için satır
                          "fiyat 178,19 / 105 milyar" diye tek bir bilgi gibi
                          okunuyordu. Ayrı sütunda ikisi de kendi başlığının
                          altında duruyor; 390px'e dört sütun, kalan yerler
                          daraltılarak sığdı. */}
                      <td className="numeral py-3 pl-1 pr-3 text-right text-small font-semibold text-body sm:px-3 sm:text-base">
                        {(() => {
                          const cap = capOf(company);
                          return cap ? formatMoneyCompact(cap, locale) : "—";
                        })()}
                      </td>
                      <td className="numeral hidden px-4 py-3 text-right text-read text-soft sm:table-cell sm:px-5">
                        {formatVolume(quote?.volume ?? company.volume, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayaç + devamı. Sayaç düğmeden ÖNCE geliyor çünkü asıl soru
            "listenin neresindeyim": çıplak bir "Daha Fazla Göster" düğmesi
            kaç satır daha olduğunu söylemiyor ve tıklamanın karşılığını
            tahmin ettiriyordu.
            scroll={false}: okuyucu listenin dibinde, sayfanın başına
            fırlatılmamalı — geldiği yerin altına yeni satırlar eklenmeli. */}
        {hasMore && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
            <p className="numeral text-small text-muted">
              {t.companies.showing
                .replace("{n}", String(rows.length))
                .replace("{total}", String(sorted.length))}
            </p>
            <Link
              href={moreHref}
              scroll={false}
              className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
            >
              {t.companies.showMore}
            </Link>
          </div>
        )}
      </Panel>

      {quotesResult.ok && (
        <DataStamp
      labels={t.data}
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
