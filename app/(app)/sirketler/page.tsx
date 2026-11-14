import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PageShare } from "@/components/article/PageShare";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { Suspense } from "react";
import { CompanyLeaders } from "@/components/companies/CompanyLeaders";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { CompanySearch } from "@/components/companies/CompanySearch";
import companyStyles from "@/components/companies/CompanyDirectory.module.css";
import table from "@/components/companies/CompanyTable.module.css";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { BoardSortHead, BoardSortMenu, BoardTableSkeleton, CompanyCell, MoreBand, MoveFigure, board, phoneSlots, rowStep } from "@/components/markets/BoardTable";
import { RowFlip, RowTap } from "@/components/markets/RowFlip";
import { SectorDistribution } from "@/components/companies/SectorDistribution";
import { CoverTabs } from "@/components/companies/CoverTabs";
import { RollingFigure } from "@/components/ui/RollingFigure";
import styles from "@/components/motion/DirectoryExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
} from "@/components/ui/primitives";
import { primaryOnly } from "@/db/seed/indices";
import {
  getCompanies,
  getStatus,
  liveMarketCap,
  type CompanyRow,
} from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { DAY_LANE_SPAN, WEEK_LANE_SPAN, laneModeOf, laneOver, laneSpan } from "@/lib/market-scales";
import { getQuotesWithin, getWeeklyChanges } from "@/lib/providers";
import {
  SECTOR_GROUPS,
  industryLabel,
  sectorGroupByKey,
  sectorGroupLabel,
  sectorGroupOf,
} from "@/lib/sectors";
import {
  cn,
  formatMoneyCompact,
  formatPercentPlain,
  formatPrice,
  formatCompact,
  staleMark,
  NO_VALUE,
} from "@/lib/utils";

import { ChipStrip } from "@/components/ui/ChipStrip";
import { pageMetadata } from "@/lib/page-meta";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { aliasSymbols } from "@/db/seed/aliases";

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

/**
 * Kaç kotasyonsuz satırdan sonra sebebi yazılır.
 *
 * Bir-iki boş hücre gürültüdür, açıklamaya değmez. Ama piyasa değerine göre
 * ARTAN sıraladığında listenin başına seyrek işlem gören mikro ölçekli
 * şirketler geliyor ve ekranın yarısı tireye dönüşüyor: ölçüldü, 60 satırın
 * 27'sinde değişim, 20'sinde fiyat, 20'sinde hacim boştu. Tire dürüst — o
 * şirket gerçekten işlem görmemiş — ama gerekçesiz bir tire okuyucuya
 * "site bozuk" diye okunuyor.
 */
const KOTASYONSUZ_ACIKLAMA_ESIGI = 3;
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

/** Piyasa değeri sırasında canlı verisi çekilen fazladan satır — gerekçe tabloda. */
const CAP_CANDIDATE_MARGIN = 40;
/** Canlı kotasyona tanınan süre; dolarsa son bilinen değer künyesiyle (getQuotesWithin). */
const QUOTE_BUDGET_MS = 2500;

/* KULVAR ÖLÇEĞİ TEK KAYNAKTAN (10 Kasım, gece). Burada iki yerel sabit
   vardı: günlük ±%5 ("bütün sayfalarda aynı ölçek") ve haftalık ±%12
   ("hafta günden geniş oynar"). Aynı gün kurulan Endeks Bileşenleri tablosu
   ±%3 / ±%8 kullanıyordu: aynı hareket iki tabloda iki ayrı uzunluktu.
   İkisi de artık `DAY_LANE_SPAN` / `WEEK_LANE_SPAN` okur
   (lib/market-scales.ts; ısı haritası ve sektör tablosuyla aynı eşikler).
   Eşiği aşan hareket kolu doldurur; büyüklüğünü yanındaki sayı söyler.
   10 Kasım (gece, ikinci tur): o sabitler artık TABAN; ölçek listeye göre
   açılır (`laneSpan`, gerekçe lib/market-scales.ts). Hesap tabloda,
   "KULVAR ÖLÇEĞİ LİSTEDEN". */

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

/* SIRALAMA BAŞLIĞI ortak parçada (10 Kasım, gece): `BoardSortHead`,
   components/markets/BoardTable.tsx — Endeks Bileşenleri'yle aynı bileşen.
   Buradaki `SortHead`in karar yorumları (üç hâlli sıralama imi, `aria-sort`,
   `scroll={false}`, telefonda 44 piksellik hedef) onunla birlikte taşındı. */

/** Boşluk ve noktalamasız eşleşmenin en kısa sorgusu. */
const COMPACT_MIN = 3;

/** "Coca-Cola Co" → "cocacolaco"; Latin küçültme (NVIDIA'nın I'sı ı olmasın). */
function compactName(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
}

export default async function CompaniesPage(props: PageProps<"/sirketler">) {
  const search = await props.searchParams;
  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "cap";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";
  const { locale, t } = await getI18n();
  const query = typeof search.q === "string" ? search.q.trim().slice(0, 100) : "";
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

  const sectorRows = activeGroup

    ? companies.filter(
        (c) => sectorGroupOf(c.industry).key === activeGroup.key,
      )
    : companies;
  // Match names and ticker symbols before pagination; searching only the first
  // 60 rows would incorrectly hide companies from a 1,010-company directory.
  // Fold Latin casing consistently: Turkish lowercase turns NVIDIA's I into ı.
  const terms = query.toLocaleLowerCase("en-US").split(/\s+/).filter(Boolean);
  /* ÜÇ YOL (28 Eylül). Yalnızca ad ve sembolde kelime araması yapılıyordu
     ve "google" hiçbir şey bulmuyordu: tablodaki ad "Alphabet Inc". Başlıktaki
     arama (app/api/search) bu boşluğu takma ad köprüsüyle kapatıyordu, bu
     sayfa kapatmıyordu. Şimdi:
       1. kelimeler ad + sembolde (eskisi gibi),
       2. takma ad köprüsü (db/seed/aliases.ts: google → GOOGL, instagram →
          META, tsmc → TSM),
       3. boşluk ve noktalamasız eşleşme: "coca cola" → "Coca-Cola",
          "jp morgan" → "JPMorgan". Üç harften kısa sorguda denenmiyor,
          yoksa iki harf adın ortasında her şeyle eşleşirdi. */
  const aliased = new Set(query ? aliasSymbols(query) : []);
  const compactQuery = compactName(query);
  const rows = sectorRows.filter(company => {
    const name = `${company.symbol} ${company.name}`.toLocaleLowerCase("en-US");
    return (
      terms.every(term => name.includes(term)) ||
      aliased.has(company.symbol) ||
      (compactQuery.length >= COMPACT_MIN && compactName(company.name).includes(compactQuery))
    );
  });
  const leaders = [...companies].filter(company => company.marketCap != null && company.marketCap > 0).sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 10);

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
    if (query) params.set("q", query);
    // Sıralama değişince derinlik korunur: 180 satıra inmiş biri, sütun
    // başlığına basınca ilk 60'a geri fırlatılmamalı.
    if (limit > PAGE_STEP) params.set("adet", String(limit));
    return `/sirketler?${params.toString()}`;
  };

  const sectorHref = (value: string | null) => {
    const params = new URLSearchParams({ sirala: sort, yon: dir });
    if (value) params.set("sektor", value);
    if (query) params.set("q", query);
    return `/sirketler?${params.toString()}`;
  };

  const moreHref = () => {
    const params = new URLSearchParams({
      sirala: sort,
      yon: dir,
      adet: String(limit + PAGE_STEP),
    });
    if (activeGroup) params.set("sektor", activeGroup.key);
    if (query) params.set("q", query);
    return `/sirketler?${params.toString()}`;
  };

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <DirectoryHeader shareInTitle share={<PageShare compactOnMobile align="right" path="/sirketler" title={t.companies.title} locale={locale} t={t} />} className={companyStyles.hero} title={t.companies.title} description={t.companies.subtitle}
        visual={
          <CoverTabs
            labels={{
              group: t.toolVisuals.companies.coverTabs,
              leaders: t.directory.marketLeaders,
              leadersMeta: t.directory.leadersByCap,
              sectors: t.toolVisuals.companies.distTitle,
              sectorsMeta: t.toolVisuals.companies.distMeta,
            }}
            sectors={query ? null : (
              <SectorDistribution
                companies={companies}
                activeKey={activeGroup?.key ?? null}
                hrefFor={sectorHref}
                locale={locale}
                t={t}
              />
            )}
            leaders={<>
            {/* KAPAĞIN SAĞI İKİ SEKME (25 Ekim, sahibinin isteği): Piyasanın
                Devleri | Sektör Dağılımı. Dağılım bir süre tablonun altında
                kendi panelindeydi; artık tek yeri burası (gerekçe
                `CoverTabs`, `SectorDistribution`). Arama varken sekme yok:
                bir aramanın sonucu dağılım değil, tek tek şirketler. */}
            <CompanyLeaders leaders={leaders} locale={locale} scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }} />
            {/* Liderlerin şirket kartı ayrı bir anahtarla (`set`): tablo
                satırı aynı sembolü kendi paketiyle kaydediyor. Kotasyonu
                kart kendisi soruyor, akışla iniyor. */}
            <Suspense fallback={null}>
              <CompanyCards symbols={leaders.map((item) => item.symbol)} set="leaders" />
            </Suspense>
          </>}
          />
        }>

        {/* KAPSAM VE ARAMA AYNI SATIRDA. İkisi alt alta iki bant halindeydi
            ve arama kendi etiket satırıyla birlikte 90 pikselden fazla yer
            kaplıyordu. Aynı satırda okunması da doğru: solda dizinin NE
            KADAR olduğu, sağda o dizinin içinde tek bir şirketi bulma yolu. */}
        <div className={companyStyles.coverRow}>
          {/* Kapsam sayıları yüklemede sayaç gibi dönüyor (JS'siz, son hâl
              HTML'de); sektör sayısı şirket sayısının ardından. */}
          <dl className={companyStyles.coverage}><div><dt>{t.directory.companyCount}</dt><dd><RollingFigure value={companies.length.toLocaleString(locale)} /></dd></div><div><dt>{t.directory.sectorCount}</dt><dd><RollingFigure value={String(shownGroups.length)} delayMs={180} /></dd></div></dl>
          <CompanySearch action={withLocale("/sirketler", locale)} query={query} sector={activeGroup?.key}
            sort={sort} direction={dir} labels={t.companies} />
        </div>
        {/* SEKTÖR ŞERİDİ DE KAPAĞIN İÇİNE. Kendi bandında duruyordu ve o
            bant, kapağın sol sütununun altındaki boşlukla birlikte iki ayrı
            ölü alan yapıyordu. Şerit kapağın içine girince hem o boşluk
            doluyor hem bir bant tümüyle kalkıyor; okuma sırası da doğru
            kalıyor: ne kadar var, tek şirketi nasıl bulurum, kümeyi nasıl
            daraltırım. */}
        {/* Kategori şeridi — geniş ekranda iki satıra sarar, mobilde kayar
            (kaydırılabilir olduğu sağ kenar solmasından belli olur). */}
        {shownGroups.length > 0 && (
          <div className={cn("relative", styles.filters)}>
            <ChipStrip
              activeKey={activeGroup?.key ?? null}
              scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }}
              /* ŞERİT HER GENİŞLİKTE TEK SATIR — `sm:flex-wrap` kalktı.
                 Sarma, yüksekliği METNİN GENİŞLİĞİNE bağlıyordu ve o genişlik
                 yazı tipi yüklenirken değişiyor: ölçüldü, 1440'ta kap yedek
                 yazı tipiyle 114 piksel (çipler iki satır), gerçek yazı
                 tipiyle 72 (tek satır). Font takası satırı bir anda 42 piksel
                 kısaltıyor ve altındaki 1320×369'luk tablo yukarı zıplıyordu —
                 yavaş bağlantıda masaüstünde CLS 0,379 ölçüldü, sitenin en
                 kötü değeri. Tek satırda yükseklik metne bağlı değil, yani
                 takas hiçbir şeyi oynatmıyor.
                 Görsel olarak bugünkü hâl de zaten tek satır: on bir sektör
                 1440'ta sığıyor. Sığmadığında sarmak yerine kayıyor ve
                 kaydığı kenar solmasından belli oluyor (`ScrollEdges`) —
                 mobildeki davranışın aynısı.

                 ÇUBUK GİZLİ (`scroll-x`), görünür değil. `scroll-x-hint`
                 tablolar için yazılmıştı: orada içeriğin %70'i ekran dışında
                 ve gizli çubuk "devamı var" işaretini de siliyor. Burada o
                 işaret ZATEN VAR — şeridin kendi kenar solması. İkisi bir
                 arada durunca kapağın içinde, çiplerin hemen altında asılı
                 duran gri bir çubuk kalıyordu; kutunun kendi çizgisi gibi
                 okunuyor ve hiçbir şey eklemiyordu. */
              className="scroll-x flex items-center gap-1.5 pr-12 sm:gap-2 sm:pr-0"
            >
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
            </ChipStrip>
          </div>
        )}

      </DirectoryHeader>

      {/* Tablo AYRI AKIYOR. Eskiden kotasyonlar ve haftalık değişim sayfanın
          gövdesinde arka arkaya bekleniyordu: 514 sembol için altı ardışık
          Alpaca turu demek ve o süre boyunca sektör çipleri bile boyanmıyordu,
          yani filtreye basınca ekran donuyordu. Artık kabuk tek veritabanı
          sorgusuyla anında geliyor, tablo arkadan akıyor.

          `key` filtreye ve sıralamaya bağlı: değiştiğinde Suspense sınırı
          sıfırlanıyor ve iskelet ANINDA görünüyor — tıklamanın karşılığı
          hemen ekranda. */}
      {/* DUYURU BÖLGESİ SUSPENSE'İN DIŞINDA VE HER ZAMAN VAR. Sonuç künyesi
          tablonun içindeydi ve tablo anahtarlı bir Suspense sınırının altında:
          arama değişince bölge yeniden KURULUYOR, içeriğiyle birlikte doğuyor.
          Ekran okuyucu var olmayan bir bölgenin doğuşunu duyurmaz; duyurduğu
          şey var olan bir bölgenin DEĞİŞMESİDİR. Bölge artık sayfada sabit,
          sorgu yokken boş; görünen künye tablonun başında sunum olarak kalıyor. */}
      <p className="sr-only" role="status">
        {query
          ? t.companies.searchResults
              .replace("{n}", String(rows.length))
              .replace("{query}", () => query)
          : ""}
      </p>

      <QueryTransition label={t.common.loading}>
      {/* `limit` ANAHTARDA DEĞİL (14 Ekim). "Daha Fazla Göster" anahtarı
          değiştirip sınırı sıfırlıyordu: 60 okunmuş satır DOM'dan atılıp
          yeniden kuruluyor ve giriş pozundan bir daha oynuyordu. Satırlar
          `key={symbol}` taşıdığı için anahtar sabit kalınca React ilk
          satırları yerinde korur; yalnız eklenenler kendi kademesiyle
          gelir. Filtre/sıralama/sorgu anahtarda kalıyor — oralarda iskelet
          anında gelmeye devam ediyor. */}
      <Suspense
        key={`${activeGroup?.key ?? "hepsi"}:${query}:${sort}:${dir}`}
        fallback={<LoadingFallback label={t.common.loading}><TableSkeleton rows={Math.min(rows.length || 12, limit)} /></LoadingFallback>}
      >
        <CompaniesTable
          rows={rows}
          query={query}
          clearHref={(() => {
            const params = new URLSearchParams({ sirala: sort, yon: dir });
            if (activeGroup) params.set("sektor", activeGroup.key);
            return `/sirketler?${params}`;
          })()}
          limit={limit}
          moreHref={moreHref()}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
          groupLabel={
            activeGroup
              ? sectorGroupLabel(activeGroup, locale)
              : t.companies.allSectors
          }
          locale={locale}
          t={t}
        />
      </Suspense>
      </QueryTransition>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["degerleme", "piyasa-degeri"]}
        className="pt-1"
      />
    </MotionExperience>
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
  query,
  clearHref,
  limit,
  moreHref,
  sort,
  dir,
  sortHref,
  groupLabel,
  locale,
  t,
}: {
  rows: CompanyRow[];
  query: string;
  clearHref: string;
  /** Kaç satır basılacak — sıralama TAMAMI üzerinde, dilim sonra alınır. */
  limit: number;
  moreHref: string;
  sort: SortKey;
  dir: SortDir;
  sortHref: (key: SortKey) => string;
  /** Panel başlığı — seçili sektörün adı ya da "Tüm Sektörler". */
  groupLabel: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  /* PİYASA DEĞERİ SIRASINDA CANLI VERİ YALNIZCA ADAYLARA (24 Eylül, ölçüldü).
     Tablo 60 satır basıyor ama kotasyon ve haftalık değişim dizinin TAMAMI
     (~1.010 sembol) için çekiliyordu — "en çok düşen" gibi sıralamalar
     hepsini görmek zorunda, doğru. Varsayılan sıra piyasa değeri ise ve
     orada sıra önbellekteki değerden neredeyse hiç oynamıyor: önbellek
     fiyatı canlıdan en fazla birkaç dakika geride. Kotasyon önbelleği
     boşken bin sembollük tur yerelde 1,4-3 saniye sürüyordu; canlıda seans
     içinde önbellek sık tazelendiği için ziyaretçilerin önemli bir kısmı
     sayfayı bu kadar bekliyordu.
     Artık piyasa değeri sırasında önce önbellekteki değerle sıralanıp
     görünen dilim + 40 satırlık bir pay seçiliyor; canlı veri yalnızca onlar
     için çekiliyor ve nihai sıra yine CANLI değerle kuruluyor. Pay, dilimin
     sınırındaki bir şirketin canlı fiyatla bir-iki sıra yer değiştirmesini
     karşılıyor. Değeri bilinmeyen satırlar her iki yönde de sonda kalıyordu;
     burada da sonda. Öteki sıralamalar (değişim, hafta, hacim, fiyat)
     bütün diziyi görmeye devam ediyor. */
  const candidates =
    sort === "cap"
      ? [...unsorted]
          .sort((a, b) => {
            if (a.marketCap == null) return b.marketCap == null ? 0 : 1;
            if (b.marketCap == null) return -1;
            return dir === "asc" ? a.marketCap - b.marketCap : b.marketCap - a.marketCap;
          })
          .slice(0, limit + CAP_CANDIDATE_MARGIN)
      : unsorted;
  const symbols = candidates.map((r) => r.symbol);

  const [quotesResult, weekly] = await Promise.all([
    /* Süre sınırlı (31 Ekim, gerekçe `getQuotesWithin`): sınır dolarsa
       tablo son bilinen değerle ve künyesiyle hemen gelir. */
    getQuotesWithin(symbols, status, QUOTE_BUDGET_MS),
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
  /* PİYASA DEĞERİ BİR DE ÇİZGİ (26 Eylül). "Karşılaştırılan her büyüklük bir
     de çizgi olarak okunur" (CLAUDE.md); sütun yalnızca sayıydı ve "hangisi
     ne kadar büyük" basamak basamak okunuyordu. Ölçek DOĞRUSAL ve listenin
     en büyüğüne göre: logaritmik ölçek sırayı korurdu ama büyüklüğü
     çarpıtırdı, oysa sütunun asıl söylediği tam da o — birkaç dev şirketin
     piyasanın ne kadarını tuttuğu. Çubuk bir yargı değil, nötr tonda. */
  /* 10 Kasım (gece), sahibinin sözü — "piyasa değerini direkt yazsak daha
     doğru": ÇUBUK KALKTI. Doğrusal çubuk doğruydu ama okunmuyordu: dizinin
     devi 4,4 T $, altmışıncı sıradaki ~200 Mr $; 56–96 piksellik rayda ilk
     on satırın ötesinde dolgu birkaç pikseldi (canlıda ölçüldü, sütun
     "veri gelmemiş" gibi duruyordu) ve yanındaki sayı soluk 12–13
     pikseldi. Logaritmik çubuk yasak (uzunluğun sıfırı yok). Şimdi sayının
     KENDİSİ güçlü mürekkeple (15/600) — Endeks Bileşenleri'yle aynı karar
     (`arayuz.md` → Görsel Dil: "piyasa değeri gibi büyüklükler doğrudan
     yazılır"). Dev şirketlerin payı üstteki sektör dağılımında çiziliyor. */

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
        /* ÖNBELLEK YEDEĞİ YOK. Hücre gibi sıralama da yalnızca canlı
           kotasyonun hacmini kullanıyor — gerekçe aşağıda, hücrede. */
        return quote?.volume ?? null;
      default:
        return capOf(row) ?? null;
    }
  };

  /* Boşlar her zaman SONDA, yön ne olursa olsun. Kendi aralarındaki sıra
     bozulmuyor: `Array.prototype.sort` kararlı, yani veri gelmeyen şirketler
     tablonun kendi (piyasa değeri) sırasında kalıyor. */
  const sorted = [...candidates].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  });

  // Dilim SIRALAMADAN SONRA: "en çok düşen" ilk 60'ın değil, hepsinin en çok
  // düşeni. Kotasyonlar bu yüzden tüm semboller için çekiliyor — piyasa
  // değeri sırası hariç, orada adaylar yetiyor (yukarıda).
  const rows = sorted.slice(0, limit);
  /* Toplam ve "daha fazla" DİZİNİN kendisinden: adaylar yalnızca bu
     turun canlı verisini sınırlıyor, listenin boyunu değil. */
  const total = unsorted.length;
  const hasMore = total > rows.length;
  const kotasyonsuz = rows.filter((r) => !quotes[r.symbol]).length;
  /* HACİM SÜTUNU VERİ VARSA (10 Kasım). Açılış öncesinde ve sağlayıcının
     hacim döndürmediği pakette sütun 60 satırın 60'ında "–" basıyordu
     (canlıda ölçüldü): eksik veri yer tutmaz. Okur sütuna göre sıralamışsa
     (`?sirala=hacim`) sütun yine görünür — neye göre dizildiğini saklamaz. */
  const showVolume = sort === "hacim" || rows.some((r) => quotes[r.symbol]?.volume != null);
  /** "İlk üç" vurgusu yalnız hareket sıralamalarında (gerekçe MembersTable.tsx). */
  const leadSort = sort === "degisim" || sort === "hafta";
  /* KULVAR ÖLÇEĞİ LİSTEDEN (10 Kasım gece; Endeks Bileşenleri'yle aynı
     fonksiyon ve aynı tabanlar). Sabit ±%3'te dizinin "en çok artan"
     sıralamasında ilk altmış satırın TAMAMI dolu koldu (küçük şirketlerde
     %10–%40'lık günler olağan). Ölçek bu sıralamanın kotasyonu çekilen
     BÜTÜN satırlarından (`candidates`; yalnız basılan dilimden değil):
     "Daha Fazla Göster" çubukları yeniden çizdirmez. Tek istisna piyasa
     değeri sırası: orada kotasyon yalnız adaylar için çekiliyor (dilim + 40,
     yukarıda), liste uzadıkça aday kümesi de büyür ve basamak nadiren
     oynayabilir — bin sembollük turu ölçek için geri getirmek o kararın
     kazancını silerdi. */
  const daySpan = laneSpan(candidates.map((row) => quotes[row.symbol]?.changePct), DAY_LANE_SPAN, laneModeOf(sort === "degisim", dir));
  const weekSpan = laneSpan(candidates.map((row) => weekly[row.symbol]), WEEK_LANE_SPAN, laneModeOf(sort === "hafta", dir));
  const anyOver = rows.some((row) => {
    const change = quotes[row.symbol]?.changePct;
    const week = weekly[row.symbol];
    return (change != null && laneOver(change, daySpan)) || (week != null && laneOver(week, weekSpan));
  });
  /* TELEFONDA KOMPAKT LİSTE (10 Kasım gece, son tur; sahibinin sözü:
     "listeleri KAYDIRMADAN kullanalım, KOMPAKT olsun"). Satırın sağında iki
     sayı: üstte okurun sıraladığı ölçü (varsayılan piyasa değeri), altında
     günlük yüzde; değişime göre diziliyse yüzde + fiyat (`phoneSlots`,
     components/markets/BoardTable.tsx). Aynı gece öğlen kurulan "piyasa
     değeri telefonda fiyatın ÖNÜNDE, sütun iki kez basılır" çözümü
     (`capPhone`) bu yüzden kalktı: listede hücrenin yeri ızgaradan. */
  const lead: SortKey = sort === "hacim" && !showVolume ? "degisim" : sort;
  const second: SortKey = lead === "degisim" ? "fiyat" : "degisim";
  const slot = phoneSlots(lead, second);
  const slotLabel: Record<SortKey, string> = {
    degisim: t.companies.change,
    fiyat: t.companies.price,
    hafta: t.companies.weekChange,
    cap: t.market.marketCap,
    hacim: t.market.volume,
  };
  const sortItems = (["cap", "degisim", "fiyat", "hafta", ...(showVolume ? ["hacim"] : [])] as SortKey[]).map((key) => ({
    key,
    label: slotLabel[key],
    href: sortHref(key),
    active: sort === key,
  }));
  const compareHref =
    rows.length >= 2
      ? `/karsilastir?semboller=${rows.slice(0, 4).map((row) => row.symbol).join(",")}`
      : null;

  return (
    <>
      {/* `data-fit="lg"`: bu tablo 1024'ten itibaren kaba sığıyor (ölçüm
          CompanyTable.module.css); ortak parça başlığı oradan itibaren
          belgeye yapıştırır. */}
      <Panel id="company-table" className={cn(board.panel, table.panel)} data-fit="lg" data-volume={showVolume || undefined}>
        {/* SIRALAMA DEĞİŞİNCE SATIRLAR YERİNE KAYAR (10 Kasım, gece; gerekçe
            components/markets/RowFlip.tsx). Sektör süzgeci ya da arama
            değişince (`token`) kayıt geçersiz: o bir sıralama değil. */}
        <RowFlip scope="company-table" token={`${groupLabel}:${query}`} order={`${sort}:${dir}:${limit}`} />
        {/* SATIRIN TAMAMI GEZİNİR — 14 Ekim kararı (`LinkedRows`), 10 Kasım
            gecesinden beri Endeks Bileşenleri'yle aynı yaprakla (`RowTap`):
            düz sol tık satırdaki GERÇEK bağlantıya aynı değiştirici tuşlarla
            iletilir; metin seçimi ve iç içe etkileşimli öğe hariç.
            `LinkedRows` /tarama'da da `RowTap`a geçti; kullanılmayan dosya
            14 Kasım'da silindi. */}
        <RowTap scope="company-table" />
        {/* Şirket kartı — görünen satırlar, sayfanın paketiyle. */}
        <CompanyCards
          symbols={rows.map((row) => row.symbol)}
          quotes={quotesResult.ok ? quotes : null}
          stale={quotesResult.ok && Boolean(quotesResult.stale)}
          status={status}
        />
        {query && <div className={companyStyles.results}>
          {/* SIRA ÖNEMLİ: sayı önce basılır. Aranan metnin kendisi bir yer
              tutucu olabilir — "{n}" yazıp arayan biri, önce {query} yazılsaydı
              ikinci geçişte kendi aramasının sayıya dönüştüğünü görürdü.
              İkinci değişim işlev alıyor: "$&" gibi bir arama `replace`in
              kendi kalıp dili sayılmasın. */}
          <p>{t.companies.searchResults.replace("{n}", String(total)).replace("{query}", () => query)}</p>
          <Link href={clearHref} scroll={false}>{t.companies.clearSearch}</Link>
        </div>}
        {/* TABLONUN BAŞLIĞI VARDI AMA GÖRÜNMÜYORDU. Panel doğrudan sütun
            satırıyla açılıyordu: hangi kümeye baktığın (bütün şirketler mi,
            seçili sektör mü) ve listenin ne kadarını gördüğün yalnızca
            tablonun DİBİNDEKİ sayaçtan okunuyordu. Sayfanın geri kalanı rol
            ayrımını taşıyor (ölçü panelleri plaka, listeler başlık +
            sayaç); bu tablo o dilin dışında kalmıştı. */}
        {(rows.length > 0 || query) && (
          <PanelHeader
            title={groupLabel}
            /* Sıralı listenin ilk dördü karşılaştırmaya gidiyor: liste
               sabit değil, o anki sıralamadan ve sektör süzgecinden
               türüyor. Karşılaştırma ekranı gezinmede görünmüyor ve
               siteye girenin çoğu varlığını bilmiyordu. */
            /* TELEFONDA BAŞLIKTA DEĞİL, TABLONUN DİBİNDE (10 Kasım): 390'da
               künye ("1625 şirketin 60 tanesi · Piyasa Değeri ▼") ile aynı
               satıra sığmıyor, "İlk Dördünü Karşıla" diye panelin kenarında
               kırpılıyordu (canlıda ölçüldü). */
            action={
              compareHref ? (
                <PanelLink href={compareHref} className="max-sm:hidden">
                  {t.compare.compareFirstFour}
                </PanelLink>
              ) : undefined
            }
            /* KÜNYE BAYATLIĞI DA TAŞIYOR. Sayfanın damgası tablonun
               ALTINDA duruyor ve 500 satırlık bir listede okuyucuya hiç
               ulaşmıyor; oysa "Değişim" sütunu sıralamanın varsayılanı ve
               bir gün iddiası taşıyor ("listeye bakan önce bugün ne olmuş
               diye bakıyor" — aşağıdaki sütun yorumu). Sağlayıcı düşüp
               paket önbellekten geldiğinde o sütun ÖNCEKİ seansın
               yüzdelerini gösteriyor. İşaret başlığın yanına, iddianın
               kurulduğu yere yazılıyor; damga aşağıda kalıyor. */
            meta={(() => {
              const parts = [
                hasMore
                  ? t.companies.showing
                      .replace("{n}", String(rows.length))
                      .replace("{total}", String(total))
                  : null,
                quotesResult.ok && quotesResult.stale
                  ? staleMark(t.data.mayBeStale, quotesResult.fetchedAt, locale)
                  : null,
              ].filter(Boolean).join(" · ");
              /* TELEFONDA ETKİN SIRALAMA KÜNYEDE (14 Ekim). Haftalık ve
                 Hacim sütunları <640'ta gizli: paylaşılan bir
                 `?sirala=hacim` adresi telefonda açıldığında tablo
                 GÖRÜNMEYEN bir ölçüye göre diziliydi ve ekranda bunu
                 söyleyen hiçbir şey yoktu. Künye yalnız dar ekranda,
                 sütun başlığı zaten görünürken ikinci kez söylemiyor.
                 TARİHÇE (10 Kasım gece, son tur): künyedeki "Piyasa
                 Değeri ▼" kalktı — telefonda sıralama şeridi
                 (`BoardSortMenu`) aynı şeyi butonun üstünde söylüyor ve
                 sıralanan ölçü satırın sağ üstünde; iki kez yazılmıyor. */
              return parts || null;
            })()}
          />
        )}
        {/* KAP KLAVYEYLE ODAKLANABİLİR. Tablo dar ekranda kendi kabında
            kayıyor ve `tabindex` olmadan sağdaki sütunlara fare olmadan
            ulaşmak mümkün değildi (WCAG 2.1.1). Aynı düzeltme hisse
            sayfasındaki bilanço tablosunda zaten vardı, iki dizin tablosuna
            taşınmamıştı. */}
        {rows.length === 0 ? (
          <EmptyState scene="searching" title={query ? t.companies.searchEmpty : t.companies.empty}
            hint={query ? t.companies.searchEmptyHint : t.companies.emptyHint} />
        ) : (
          <>
          {/* Telefonda başlık satırının yerinde sıralama şeridi (640+ yok);
              kabın DIŞINDA — açılır menü kabın taşma kırpmasına girmesin. */}
          <BoardSortMenu
            items={sortItems}
            dir={dir}
            label={t.markets.phoneSort}
            caption={`${slotLabel[lead]} · ${slotLabel[second]}`}
            ascLabel={t.markets.phoneSortAsc}
            descLabel={t.markets.phoneSortDesc}
          />
          <ScrollEdges
            className={cn(board.scroller, "scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)")}
            tabIndex={0}
            role="region"
            aria-label={t.companies.title}
            /* Kimlik sütunu yapışkan (ortak parça; tablo kaba sığmadığı
               her genişlikte): sol kenar solmasın, yalnız sağ uç "devamı
               var" desin. */
            fixedStart
          >
            {/* MOBİLDE SABİT DÜZEN. Otomatik düzende şirket sütunu
                içeriğinin doğal genişliğini alıyordu: en uzun ad ("Space
                Exploration Technologies Corp") sütunu 245 piksele çıkarıyor,
                tablo 352 piksellik kanalda 453 piksele uzuyor ve okuyucu
                piyasa değeri sütununu ancak yana kaydırarak görebiliyordu.
                Ölçüldü: 101 piksel taşma.
                Sabit düzende sayı sütunları kendi genişliğini alıyor, şirket
                sütunu artan yeri; ad zaten kısalıyor. Geniş ekranda
                otomatik düzen geri geliyor — orada yer bol ve sütunlar
                içeriğe göre nefes almalı. (Kural artık modülde:
                CompanyTable.module.css → "Telefon".) */}
            {/* YOĞUNLUK (10 Kasım, görsel tur — B grubu). Önce: 60 satır × 67
                piksel = 4.020 piksellik seyrek bir duvar (1440, canlı).
                Satır iki katlıydı (sembol üstte, ad altta; hapın ve sayının
                ALTINDA 84 piksellik kulvar), Hacim sütunu açılış öncesinde
                60 satırın 60'ında "–" basıyordu ve tablo, aynı gün yenilenen
                Piyasalar'daki Endeks Bileşenleri tablosundan (46 piksel, tek
                kat, şerit sayının yanında) başka bir aileden görünüyordu.
                Şimdi aynı dil: 1280+ sembol ve ad aynı hatta, satır 46
                piksel; günlük değişimin kulvarı sütunun esnek genişliğini
                alıyor (ölçek yine SABİT ±%5 — gerekçe `DirectionLane`),
                haftalık kulvar ve piyasa değeri çubuğu sayının yanında.
                Değişim HAP DEĞİL yön renginde sayı: 60 dolgulu hap alt alta
                bir "rozet duvarı" kuruyordu ve yönü zaten yanındaki ayrışan
                kulvar söylüyor (Endeks Bileşenleri'yle aynı karar).
                Ölçüm: CompanyTable.module.css başında.

                10 Kasım (gece), sahibinin sözü — "çok daha görsel, çok
                daha okunabilir; şirketlerin adı ve logolar az daha
                büyüyebilir": PANO SATIRI, Endeks Bileşenleri'yle ORTAK
                parçalardan (components/markets/BoardTable.tsx; gerekçe
                MembersTable.tsx → "PANO SATIRI"). Satır 46 → 62 (telefonda
                52 → 56), logo 28 → 40, sembol 14 → 16/700, ad gövde
                mürekkebinde 14; günlük yüzde 13/700 → 19/700, fiyat 14/400
                (700 yazılmıştı, özgüllükten 400 basılıyordu) → 16/700,
                piyasa değeri soluk 13 + ince çubuk → güçlü 15/600. Kulvarlar
                5 piksellik ince şeritten 8 / 6 piksellik dolu çubuğa, ölçek
                iki tabloda aynı sabit. Sütun sırası da aynı aileye geçti:
                Değişim · Fiyat · Haftalık · Piyasa Değeri · Hacim (Fiyat,
                Haftalık'ın önüne). TELEFON: dört sütunluk sabit düzen
                (aşağıdaki "MOBİLDE SABİT DÜZEN") yerine Endeks'in düzeni —
                Şirket sabit, ilk ekranda Değişim + Fiyat, Haftalık / Piyasa
                Değeri / Hacim kaydırınca; sağ kenar "devamı var" diye
                soluyor (`arayuz.md` → "Kaydırma saklanmaz"). Piyasa değeri
                artık ilk ekranda değil: dört sütun 352 piksele ancak 13
                piksellik sayılar ve 122 piksellik kimlikle sığıyordu; iri
                kimlik ve iri yüzde ile aynı ekrana sığmıyor (ölçüm modülde,
                "ÖLÇÜM 2").

                10 Kasım (gece, son tur), sahibinin sözü — "tablolar sağa
                sola kaymasın, kompakt olsun": KAYDIRMA KALKTI. Telefonda
                satır kompakt liste satırı (kimlik + sıralanan ölçü + günlük
                yüzde; BoardTable.module.css → "TELEFON: KOMPAKT LİSTE"),
                640–1023'te yalnız sığan sütunlar, 1024+ tam tablo; kap hiçbir
                genişlikte kaymıyor (ölçüm CompanyTable.module.css → "ÖLÇÜM
                4"). */}
            <table className={cn(board.table, table.table)}>
              <thead>
                <tr>
                  <th scope="col" className={board.rankHead}>#</th>
                  <th scope="col" className={board.companyHead}>
                    {t.companies.company}
                  </th>
                  <th scope="col" className={cn(board.tagHead, table.sectorHead)}>
                    {t.companies.sector}
                  </th>
                  {/* Değişim fiyattan önce: listeye bakan önce "bugün ne
                      olmuş" diye bakıyor, seviyeye sonra. */}
                  <BoardSortHead
                    label={t.companies.change}
                    href={sortHref("degisim")}
                    active={sort === "degisim"}
                    dir={dir}
                    className={table.changeHead}
                  />
                  {/* TELEFONDA PİYASA DEĞERİ FİYATIN ÖNÜNDE (10 Kasım gece, ana
                      oturumun kararı). Tablonun varsayılan sırası piyasa
                      değeri; gece turunda sütun telefonda kaydırmanın
                      arkasına düşmüştü ve okur ilk ekranda listenin neye
                      göre dizildiğini göremiyordu. Tablo hücresi CSS ile
                      yer değiştirmez: sütun İKİ KEZ basılır, <640'ta bu
                      (öndeki) kopya, 640+ asıl yerindeki görünür; gizli
                      kopya `display:none` (yardımcı teknolojiye de yok).
                      Yalnız Şirketler'de; Endeks Bileşenleri'nde sıra aynı.
                      Başlık telefonda iki satır ("Piyasa / Değeri"): tek
                      satırda sütun 111 piksel tutuyor, Fiyat solma kuşağına
                      giriyordu (ölçüm CompanyTable.module.css → "ÖLÇÜM 3").
                      TARİHÇE (10 Kasım gece, son tur): ikinci kopya KALKTI.
                      Telefonda tablo artık kompakt liste; piyasa değeri
                      sıralanan ölçüyse satırın sağ üstünde, ızgarayla
                      (`phoneSlots`) — sütunu iki kez basmaya gerek yok. */}
                  <BoardSortHead
                    label={t.companies.price}
                    href={sortHref("fiyat")}
                    active={sort === "fiyat"}
                    dir={dir}
                    className={table.priceHead}
                  />
                  {/* Sütun adı iki kez değişti, ikisinin de gerekçesi duruyor.
                      Önce "Hafta" idi: bir ad, bir ölçü değil — takvim haftası
                      mı, 7 gün mü, 5 seans mı söylemiyordu ve tanım yalnızca
                      balonda duruyordu. Balon dokunmatik tablette hiç
                      açılmıyor (`hover: none`), yani tanımı göremeyen bir
                      okuyucu kitlesi vardı. Sonra "5 Seans" oldu: kesindi ama
                      okuyucunun dili değildi, bir sütun başlığından çok bir
                      tanımdı. Şimdi "Haftalık" — sıfat olduğu için "haftalık
                      değişim" diye okunuyor, "Hafta"nın belirsizliği yok ve
                      5 seans zaten bir haftanın kendisi. Kalan tek nüans
                      (seans mı takvim günü mü) ipucunda (`hint`) ve 10 Kasım
                      gecesinden beri tablonun dibindeki künyede de yazılı. */}
                  <BoardSortHead
                    label={t.companies.weekChange}
                    href={sortHref("hafta")}
                    active={sort === "hafta"}
                    dir={dir}
                    hint={t.companies.weekChangeHint}
                    className={table.weekHead}
                  />
                  <BoardSortHead
                    label={t.market.marketCap}
                    href={sortHref("cap")}
                    active={sort === "cap"}
                    dir={dir}
                    className={table.capHead}
                  />
                  {showVolume && (
                    <BoardSortHead
                      label={t.market.volume}
                      href={sortHref("hacim")}
                      active={sort === "hacim"}
                      dir={dir}
                      className={table.volumeHead}
                    />
                  )}
                </tr>
              </thead>
              {/* Satırın tamamı gezinir — `RowTap`, panelin başında. */}
              <tbody data-motion-stagger>
                {rows.map((company, index) => {
                  const quote = quotes[company.symbol];
                  const week = weekly[company.symbol];
                  const cap = capOf(company);
                  return (
                    <tr
                      key={company.symbol}
                      data-row={company.symbol}
                      /* İlk üç yalnız hareket sıralamasında; çizim kapısı ve
                         kademe satırda — gerekçeleri MembersTable.tsx'te. */
                      data-lead={leadSort && index < 3 ? "" : undefined}
                      data-draw
                      style={rowStep(index)}
                    >
                      {/* Sıra numarası logoyla aynı hatta, sağa yaslı:
                          "9" ile "10" aynı sağ kenarda. */}
                      <td className={cn("numeral", board.rank)}>{index + 1}</td>
                      {/* Bağlantı hücreyi dolduruyor: satıra dokunmak bu
                          sayfanın ana eylemi ama bağlantı yalnızca logo
                          yüksekliği kadardı (34px) ve hücre dolgusunun
                          bir kısmı tıklanabilir değildi. Şimdi satır boyu
                          (telefonda 55px). SABİT SINIR YOK DEĞİL: ad kutusu
                          `--name-max` ile tavanlı, sığmayan ad üç noktayla
                          kesiliyor; tam ad `title`da (`CompanyCell`). */}
                      <CompanyCell symbol={company.symbol} name={company.name} logoUrl={company.logoUrl} />
                      <td className={cn(board.tag, table.sector)}>
                        {industryLabel(company.industry, locale) ?? <span className={board.none}>{NO_VALUE}</span>}
                      </td>
                      {/* Yön bir de çizgi: sıfır ortada, ölçek sabit
                          (`ZeroBar`; gerekçe lib/market-scales.ts). */}
                      <td className={table.changeCell} data-sorted={sort === "degisim" || undefined} data-slot={slot("degisim")}>
                        <MoveFigure value={quote ? quote.changePct : null} span={daySpan} locale={locale} />
                      </td>
                      {/* Fiyat satırın ÇAPASI: değişim, hafta, piyasa değeri
                          ve hacim hep ona göre okunuyor. Diğerleriyle aynı
                          ağırlıkta yazılınca sayı dizisinin içinde kayboluyordu;
                          kalın ve en koyu mürekkepte. (10 Kasım gecesi
                          ölçüldü: `.price` 700 yazıyordu, `.table tbody td`
                          özgüllükle 400 basıyordu; ortak parçada genel hücre
                          kuralı `:where()` içinde, tuzak kapandı.) */}
                      <td className={cn("numeral", board.price, table.priceCell, !quote && board.none)} data-sorted={sort === "fiyat" || undefined} data-slot={slot("fiyat")}>
                        {quote ? formatPrice(quote.price, locale) : NO_VALUE}
                      </td>
                      {/* Hafta da bir çizgi (31 Ekim): günlük sütun şeritli,
                          haftalık birimsiz sayıydı; iki yön yan yana aynı
                          dilde okunsun. Ölçek ayrı (hafta geniş oynar),
                          sabiti lib/market-scales.ts'te. */}
                      <td className={table.weekCell} data-sorted={sort === "hafta" || undefined} data-slot={slot("hafta")}>
                        <MoveFigure value={week ?? null} weight="week" span={weekSpan} locale={locale} />
                      </td>
                      {/* Piyasa değeri telefonda da kendi sütununda. Bir
                          süre fiyatın altına ikinci satır olarak konmuştu:
                          yer kazandırıyordu ama iki ayrı ölçüyü tek hücrede
                          üst üste bindirdiği için satır "fiyat 178,19 / 105
                          milyar" diye tek bir bilgi gibi okunuyordu. Ayrı
                          sütunda ikisi de kendi başlığının altında duruyor
                          (10 Kasım gecesi telefonda kaydırmanın arkasına
                          düştü; aynı gece Fiyat'ın ÖNÜNE alındı — başlıkta). */}
                      <td className={cn("numeral", board.strong, table.capCell, !cap && board.none)} data-sorted={sort === "cap" || undefined} data-slot={slot("cap")}>
                        {cap ? formatMoneyCompact(cap, locale) : NO_VALUE}
                      </td>
                      {showVolume && (
                        <td className={cn("numeral", table.volume)} data-sorted={sort === "hacim" || undefined} data-slot={slot("hacim")}>
                          {/* HACİM YALNIZCA CANLI KOTASYONDAN. Buraya bir
                              önbellek yedeği (`?? company.volume`) konmuştu ve
                              o değer `quotes_cache`ten geliyor: kotasyonu
                              gelmeyen bir sembolde başka bir GÜNÜN hacmi,
                              komşularının bugünkü hacmiyle aynı başlığın
                              altında duruyordu. Aynı sütunda iki farklı günün
                              sayısı — projenin "aynı sayı aynı kaynaktan"
                              kuralının ihlali. Satırın fiyat ve değişim
                              hücreleri zaten "–" gösteriyor; hacim de öyle. */}
                          {/* KISALTILMIŞ (31 Ekim): "169.643.020" sekiz basamaklık bir
                              dizi olarak okunuyordu; "169,6 Mn" bir bakışta. */}
                          {quote?.volume != null ? formatCompact(quote.volume, locale) : NO_VALUE}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollEdges>
          </>
        )}

        {/* Sayaç + devamı. Sayaç düğmeden ÖNCE geliyor çünkü asıl soru
            "listenin neresindeyim": yalnız bir "Daha Fazla Göster" düğmesi
            kaç satır daha olduğunu söylemiyor ve tıklamanın karşılığını
            tahmin ettiriyordu.
            scroll={false}: okuyucu listenin dibinde, sayfanın başına
            fırlatılmamalı — geldiği yerin altına yeni satırlar eklenmeli. */}
        {kotasyonsuz >= KOTASYONSUZ_ACIKLAMA_ESIGI && (
          <p className={board.note}>
            {t.companies.noQuoteNote.replace("{n}", String(kotasyonsuz))}
          </p>
        )}
        {/* Sayacın ÇİZGİSİ var (14 Ekim): "60 / 670" bir büyüklük
            karşılaştırması ve kural "karşılaştırılan büyüklük bir de
            çizgi olarak okunur" (CLAUDE.md). Listenin neresinde olduğunu
            sayıdan önce söylüyor.
            10 Kasım: sayaç, şerit ve buton tek grupta, SOLDA. Bandın
            iki ucuna gerilmişlerdi (`justify-between` yasağı): 1320
            piksellik bantta sayaç ile buton arasında ~1.000 piksel boş
            duruyordu. Gece: bant ortak parça (`MoreBand`), şerit kalın ve
            `data-draw` + `bar-fill` ile doluyor (eskisi `data-motion-draw`). */}
        {hasMore && (
          <MoreBand
            count={t.companies.showing
              .replace("{n}", String(rows.length))
              .replace("{total}", String(total))}
            share={(rows.length / Math.max(1, total)) * 100}
            href={moreHref}
            label={t.companies.showMore}
          />
        )}
        {/* KÜNYE: şeritlerin ölçeği (gece turundan beri listenin gerçek
            ölçeği) ve haftalığın tanımı — Endeks Bileşenleri'ndeki
            cümlelerin aynısı (aynı fonksiyon, aynı söz). */}
        {rows.length > 0 && (
          <p className={board.note}>
            {t.markets.laneScaleNote
              .replace("{day}", `±${formatPercentPlain(daySpan, locale, 0)}`)
              .replace("{week}", `±${formatPercentPlain(weekSpan, locale, 0)}`)}
            {anyOver && ` ${t.markets.laneOverNote}`}
            {` ${t.markets.weekNote}`}
          </p>
        )}
        {/* Telefonda karşılaştırma bağlantısı tablonun dibinde — gerekçe
            panel başlığındaki `action` yorumunda. */}
        {compareHref && (
          <div className={table.compareBar}>
            <Link href={compareHref} className={table.compare}>
              {t.compare.compareFirstFour}
              <ArrowRight aria-hidden size={13} weight="bold" />
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
          /* Seans dışında değişim sütunu satır satır farklı bir güne
             dayanabiliyor; gerekçesi sözlükte. Seans içinde not yok —
             orada bütün semboller aynı günü gösteriyor. */
          note={
            status.session === "pre-market" ||
            status.session === "after-hours"
              ? t.data.extendedNote
              : undefined
          }
        />
      )}

    </>
  );
}

/** Filtre değişiminde anında görünen iskelet — boş ekran yerine yapı. */
function TableSkeleton({ rows }: { rows: number }) {
  /* İskelet GERÇEK tablonun açılışını da taşıyor (14 Ekim): yalnız satır
     listesi basılıyordu ve içerik gelince başlık (~48px) + sütun satırı
     (~36px) satırları aşağı itiyordu — iskeletin bütün amacı olan "takas
     yerinde oturur" bozuluyordu.
     10 Kasım (gece): satır düzeni paylaşılan `SkeletonRow`daydı (54
     piksel, 34 piksellik logo); tablo pano satırına geçince (62 / 56) ortak
     parçanın iskeleti (`BoardTableSkeleton`) — /piyasalar'ın bileşen
     tablosu da aynısını basıyor. */
  return <BoardTableSkeleton rows={rows} />;
}
