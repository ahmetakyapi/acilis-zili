import { ArrowUpRight, SquaresFour, TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { HeroAccent } from "@/components/motion/HeroAccent";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { Suspense, type ReactNode } from "react";
import { SectionMasthead } from "@/components/motion/SectionMasthead";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/markets/MarketExperience.module.css";
import { CommodityBoard, SectorPerformance, parseSectorSort } from "@/components/markets/EtfBoards";
import { SentimentPulse } from "@/components/markets/SentimentPulse";
import boardStyles from "@/components/markets/MarketBoards.module.css";
import { ScaleBar } from "@/components/markets/CompareScale";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { CompanyCards } from "@/components/ui/CompanyCards";
import type { CompanyCardExtra } from "@/lib/company-card";
import {
  ChangePill,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  Skeleton,
  LogoTile,
  SkeletonRow,
} from "@/components/ui/primitives";
import { Sparkline } from "@/components/ui/Sparkline";
import {
  DOW_MEMBERS,
  INDEX_COMPOSITION_DATE,
  NDX_MEMBERS,
  SPX_MEMBERS,
  primaryOnly,
  type IndexMember,
} from "@/db/seed/indices";
import { getStatus, getSymbolNames, liveMarketCap, type SymbolMeta } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import type { MarketStatus } from "@/lib/market-hours";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  directionOf,
  directionText,
  SIGN_GAP,
  formatCompact,
  formatEtDateMedium,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  staleMark,
  NO_VALUE,
} from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";
import { ScrollEdges } from "@/components/ui/ScrollEdges";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/piyasalar",
  tr: {
    title: "Piyasalar",
    description:
      "Endeksler, piyasa genişliği ve gün içi hareket — ABD piyasasının nabzı.",
  },
  en: {
    title: "Markets",
    description:
      "Indices, market breadth and intraday moves — the pulse of the US market.",
  },
});

/**
 * Piyasalar — nabız ekranı.
 *
 * Üstte üç büyük endeksin kartı (proxy ETF fiyatı + gün içi eğrisi), altında
 * ABD tahvil faizleri ve getiri eğrisinin durumu. Seçilen endeks için gün
 * içi genişlik (kaç hisse artıda), en çok hareket edenler ve tam bileşen
 * listesi gösterilir. Üyelik statik, kotasyonlar canlı; hesaplanan her sayı
 * elimizdeki fiyatlardan türer — tahmin yok.
 */

/* Üyelik listeleri şirket başına tek satır gösterir: endekste iki sınıfı da
   bulunan şirketler (GOOGL/GOOG, FOXA/FOX, NWSA/NWS) yaygın sınıfıyla yer
   alır. Dow'da çok sınıflı üye yoktur, bölen hesabı bundan etkilenmez. */
/* Sıra Nasdaq 100 ile başlıyor: okuyucunun bu siteye gelme sebebi ağırlıkla
   teknoloji hissesi ve gün içi hareketin konuşulduğu endeks o. Dizi hem üstteki
   endeks kartlarını hem seçici çiplerini besliyor, ikisi de aynı sırayı
   izliyor — ve açılıştaki seçili sekme de baştaki endeks. */
const INDEX_TABS = [
  { key: "nasdaq", label: "Nasdaq 100", proxy: "QQQ", members: primaryOnly(NDX_MEMBERS) },
  { key: "dow", label: "Dow Jones", proxy: "DIA", members: primaryOnly(DOW_MEMBERS) },
  { key: "sp500", label: "S&P 500", proxy: "SPY", members: primaryOnly(SPX_MEMBERS) },
] as const;

type TabKey = (typeof INDEX_TABS)[number]["key"];

const SORT_KEYS = ["degisim", "fiyat", "ad", "katki", "cap"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

/**
 * Bir seferde basılan bileşen satırı.
 *
 * S&P 500 sekmesi 499 satırın tamamını basıyordu: 2,3 MB HTML tek sayfada,
 * telefonda saniyelerce süren bir yerleşim. Endeks bileşenleri listesi
 * baştan sona okunan bir şey değil — okuyucu ilk sıralara, yani sıralamanın
 * tepesine bakıyor. Sıralama SATIRLARIN TAMAMI üzerinde yapılıp dilim sonra
 * alınıyor, yani "en çok düşen" ilk 60'ın değil 499'un en çok düşeni.
 * (Aynı ölçü ve aynı gerekçe /sirketler dizininde de var.)
 */
const PAGE_STEP = 60;

/** ABD Hazine tahvili serileri — FRED sabit vadeli getiriler. */
/**
 * Endeks üyelerinin kotasyonu.
 *
 * PAKETLEME BURADA DEĞİL SAĞLAYICI KATMANINDA. Burada elle 100'erlik
 * paketlere bölünüyordu; oysa `alpaca.getSnapshots` zaten 200'lük paketlerle
 * çalışıyor. S&P 500 için sonuç 5 Alpaca isteği ve 5 ayrı veritabanı
 * yazmasıydı — tek çağrıda 3 istek ve tek toplu yazma oluyor
 * (QUOTE_WRITE_BATCH = 500). Bölmek üstelik zararlıydı: paket sınırı
 * sağlayıcının kendi sınırıyla hizalı değil, yani her iki katman da
 * bölünce paketler ufalıyordu.
 */
/**
 * KAYNAK VE TAZELİK DE TAŞINIYOR.
 *
 * Bu sarmalayıcı bir dönem sağlayıcı sonucundan yalnızca `data` ve
 * `fetchedAt` alıyor, `source` ile `stale` alanlarını düşürüyordu; damga da
 * kaynağı elden "alpaca" diye yazıyordu. Sonuç: Alpaca'ya ulaşılamadığında
 * `getQuotes` son çare olarak `quotes_cache`ten okuyor ve o satırlar saatler
 * — hafta sonuna denk gelirse günler — öncesine ait olabiliyorken ekranda
 * "Alpaca · SIP · 12:40 güncellendi · 15 dk gecikmeli" yazıyordu. Üç bilgi
 * birden yanlıştı: kaynak, gecikme iddiası ve güncellik uyarısının hiç
 * görünmemesi.
 *
 * Bu ekranda önbelleğe düşmek kenar bir durum da değil: Finnhub yedeği
 * yalnızca sekiz sembole kadar deneniyor (lib/providers/index.ts) ve endeks
 * bileşenleri her zaman 30-500 sembol soruyor, yani Alpaca düştüğünde tek
 * yedek önbellek. İkiz ekran (/sirketler) bunu zaten doğru yapıyordu.
 */
async function quotesFor(
  symbols: string[],
  status: MarketStatus,
): Promise<{
  quotes: Record<string, Quote>;
  stampAt: Date | null;
  source: string | null;
  stale: boolean;
}> {
  const result = await getQuotes(symbols, status);
  if (!result.ok) {
    return { quotes: {}, stampAt: null, source: null, stale: false };
  }
  return {
    quotes: result.data,
    stampAt: result.fetchedAt ?? null,
    source: result.source,
    stale: Boolean(result.stale),
  };
}

export default async function MarketsPage(props: PageProps<"/piyasalar">) {
  const search = await props.searchParams;
  /* Varsayılan sekme dizinin BAŞI: sabit "dow" yazmak, sırayı değiştirdiğimiz
     an ilk çipin seçili olmadığı bir açılış üretiyordu — çubuk hatalı görünür. */
  const tab: TabKey = INDEX_TABS.some((t) => t.key === search.endeks)
    ? (search.endeks as TabKey)
    : INDEX_TABS[0].key;
  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "degisim";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";
  const requested = Number(
    typeof search.adet === "string" ? search.adet : PAGE_STEP,
  );
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.ceil(requested / PAGE_STEP) * PAGE_STEP
      : PAGE_STEP;

  const { locale, t } = await getI18n();
  const active = INDEX_TABS.find((entry) => entry.key === tab)!;
  const sectorSort = parseSectorSort(search.sektor, search.sektorYon);
  /* Sektör sıralaması endeks bölümünün parametrelerini KORUYOR: okuyucu
     S&P 500 sekmesinde 120 satıra inmişken sektör başlığına basınca endeks
     tablosu başa dönmemeli. Adres yalnızca bilinen anahtarlardan kuruluyor;
     tanınmayan parametre taşınmıyor. */
  const sectorHref = (params: { sektor: string; sektorYon: string }) => {
    const query = new URLSearchParams();
    if (search.endeks === tab) query.set("endeks", tab);
    if (typeof search.sirala === "string") query.set("sirala", sort);
    if (typeof search.yon === "string") query.set("yon", dir);
    if (typeof search.adet === "string") query.set("adet", String(limit));
    query.set("sektor", params.sektor);
    query.set("sektorYon", params.sektorYon);
    return `/piyasalar?${query.toString()}`;
  };

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <div className={`${styles.marketHeader} page-frame`}>
        <HeroAccent />
      <div className={styles.masthead}>
      <SectionMasthead
        embedded
        eyebrow={locale === "tr" ? "ABD Piyasası" : "US Market"}
        title={t.markets.title}
        description={t.markets.subtitle}
      />
      </div>

      {/* KABUK ÖNCE AKAR. `IndexCards` ve `IndexDetail` doğrudan gövdede
          await ediliyordu ve S&P 500 sekmesinde `IndexDetail` 499 sembol için
          kotasyon + ad çekiyor; o tur bitene kadar sayfa başlığı, tahvil
          şeridi ve sekme çubuğu dahil HİÇBİR ŞEY görünmüyordu. Sekmeye
          basan okuyucu yalnızca sekmenin yeniden çizilmesi için tam turu
          bekliyordu. Aynı düzeltme /sirketler'de zaten yapılmış (orada
          gerekçesi yorumla yazılı); burası atlanmıştı.

          İlk düzende hem kartlar hem detay seçimle sıfırlanıyordu.
          Artık kartların konumu ve sınırı sabit: yalnız seçimin sonuç alanı
          yenilenir; QueryTransition beklerken mevcut yüksekliği korur. */}
      <div className={styles.cardsArea}>
        <Suspense
          key={`cards:${locale}`}
          /* Ölçülmüş yükseklikler, tahmin değil: kartlar mobilde alt alta
              (3 × 152 + 2 × 12 boşluk = 480), `sm`den itibaren tek sıra (152).
              Yedek 132px'ti; mobilde 348 piksellik bir sıçrama demekti ve
              sıçrama ekranın TA TEPESİNDE oluyordu. */
          fallback={
            <Skeleton className={styles.indexSkeleton} />
          }
        >
          <IndexCards activeTab={tab} sort={sort} dir={dir} locale={locale} t={t} />
        </Suspense>
      </div>


      </div>


      <QueryTransition label={t.common.loading}>
      <Suspense
        key={`detail:${tab}:${sort}:${dir}:${limit}`}
        /* SATIR SAYISI KADAR İSKELET, DÜZ BİR PLAKA DEĞİL.
           Yedek 420 piksellik tek bir gri dikdörtgendi; gerçek tablo 60 satırla
           3300–3600 piksel. Sekme değiştiren okuyucunun altında sayfa 7301
           pikselden 3183'e çöküyor, yarım saniye sonra geri açılıyordu —
           ölçüldü. Kaydırma yeri tarayıcı sayesinde geri geliyor ama araya
           giren o sıçrama tek başına "sayfa bozuldu" hissi veriyor, üstelik
           ağır bağlantıda pencere uzuyor.
           Satır sayısı ZATEN BİLİNİYOR (`limit` ve üye sayısı sunucuda,
           askıya alınmadan önce), dolayısıyla yer tahminle değil sayıyla
           ayrılıyor. */
        /* SEKME SATIRI AKIŞIN İÇİNDE (26 Eylül). Yükselenlerin payı artık
           düğmelerin yanında duruyor ve o pay kotasyonlarla birlikte geliyor;
           satır bu yüzden `IndexDetail`in içine girdi. Yedekte de AYNI
           düğmeler basılıyor: sekme değişirken satır kaybolmuyor, yalnızca
           yanındaki pay bekliyor. */
        fallback={
          <>
            <IndexTabs tab={tab} locale={locale} t={t}
              identity={<IndexIdentity tab={tab} proxy={active.proxy} proxyQuote={null} locale={locale} t={t} loading />}
              aside={<div className={styles.shareBox} aria-hidden="true">
                <div className={styles.shareHead}><Skeleton className="h-3 w-28" /><Skeleton className="h-6 w-12" /></div>
                <Skeleton className="h-2 w-full" />
                <div className={styles.shareCounts}>{[0, 1, 2].map((key) => <Skeleton key={key} className="h-5 w-16" />)}</div>
              </div>}
            />
            <LoadingFallback label={t.common.loading}><DetailSkeleton rows={Math.min(active.members.length, limit)} contribution={tab === "dow"} /></LoadingFallback>
          </>
        }
      >
        <IndexDetail
          tab={tab}
          members={active.members}
          proxy={active.proxy}
          sort={sort}
          dir={dir}
          limit={limit}
          locale={locale}
          t={t}
        />
      </Suspense>
      </QueryTransition>

      {/* PİYASA GENELİ: NABIZ, SEKTÖRLER, EMTİA (28 Eylül). Endeks akışının
          (kartlar → sekmeler → genişlik → hareket edenler → bileşenler)
          ARKASINDA: kartlar `?endeks=` ile aşağıdaki detayı değiştiriyor
          ve araya bir blok girseydi seçimin sonucu ekranın dışında
          kalırdı. Üçü de seçili endeksten bağımsız; kendi Suspense
          sınırlarında akıyorlar, endeks sekmesi değişince yeniden
          beklenmiyorlar (anahtarları sekmeye bağlı değil). */}
      <section className={boardStyles.section} aria-label={t.marketExtras.boardsLabel}>
        <Suspense fallback={<Skeleton className="h-72 rounded-[18px]" />}>
          <SentimentPulse locale={locale} t={t} />
        </Suspense>
        <div className={boardStyles.boards}>
          <Suspense fallback={<Skeleton className="h-[520px] rounded-[18px]" />}>
            <SectorPerformance
              locale={locale}
              t={t}
              sort={sectorSort.sort}
              dir={sectorSort.dir}
              hrefFor={sectorHref}
            />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[520px] rounded-[18px]" />}>
            <CommodityBoard locale={locale} t={t} />
          </Suspense>
        </div>
      </section>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        /* Faiz ve oynaklık ızgarası açıklama kutusu taşımıyor (MarketPulse);
           eğri ve VIX'in okunuşu bu iki yazıda. Sayı ÇİFT kalmalı —
           GuideHint iki sütunlu. Sektör ve fon yazıları 28 Eylül'de
           eklendi (sektör paneli ve emtia fonları). */
        slugs={["endeks", "volatilite", "sektor-rotasyonu", "etf"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}

/* ==========================================================================
   Endeks kartları — üç büyük endeks, gün içi eğrisiyle
   ========================================================================== */

async function IndexCards({
  activeTab,
  sort,
  dir,
  locale,
  t,
}: {
  activeTab: TabKey;
  sort: SortKey;
  dir: SortDir;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const proxies = INDEX_TABS.map((entry) => entry.proxy);
  const [quotesResult, bars] = await Promise.all([
    getQuotes([...proxies], status),
    getChartBarsMulti([...proxies], "1D", status),
  ]);

  if (!quotesResult.ok) return <Panel className={styles.indexUnavailable}><EmptyState title={t.common.noData} hint={t.common.noDataHint} scene="chart" /></Panel>;

  // The selected index occupies the first visual position. Keep DOM and
  // keyboard order aligned with that position; the toolbar keeps its order.
  // Keep all three positions stable when the active index changes.
  const orderedTabs = INDEX_TABS;

  return (
    <div className={styles.indexOverview}>
    <div className={styles.indexGrid} data-motion-stagger>
      {orderedTabs.map((entry) => {
        const quote = quotesResult.data[entry.proxy];
        const points = (bars[entry.proxy] ?? []).map((bar) => ({
          value: bar.close,
        }));
        const tone = directionOf(quote?.changePct);
        const selected = entry.key === activeTab;

        return (
          <Link
            key={entry.key}
            href={`/piyasalar?endeks=${entry.key}&sirala=${sort}&yon=${dir}`}
            scroll={false}
            /* SEÇİLİ OLAN YALNIZCA RENKLE SÖYLENİYORDU. Kart seçildiğinde
               accent kenarlık ve tint alıyor ama ekran okuyucuya hiçbir şey
               ulaşmıyordu. Sektör çipleri (/sirketler) bunu zaten yapıyor. */
            aria-current={selected ? "true" : undefined}
            className={styles.indexLink}
          >
            <Panel
              className={cn(
                "panel-hover flex h-full flex-col", styles.indexCard,
                selected && "border-primary-faint bg-primary-tint",
              )}
            >
              <div className={styles.identity}>
                <p className="text-sm font-semibold text-strong">{entry.label}</p>
                <p className={styles.indexProxy}><span className="numeral">{entry.proxy}</span><ArrowUpRight size={14} aria-hidden /></p>
              </div>
              {quote ? (
                <>
                  <div className={styles.reading}>
                    <p className={styles.price}>
                      {formatPrice(quote.price, locale)}
                    </p>
                    <p
                      data-tone={tone}
                      className={cn(
                        styles.indexChange, "numeral text-base font-bold",
                        tone === "up"
                          ? "text-up"
                          : tone === "down"
                            ? "text-down"
                            : "text-muted",
                      )}
                    >
                      {formatPercent(quote.changePct, locale)}
                    </p>
                  </div>
                  {points.length > 1 && (
                    <Sparkline
                      points={points}
                      title={`${entry.label} · ${locale === "tr" ? "1G" : "1D"}`}
                      tone={tone}
                      height={38}
                      showLastDot
                      strokeWidth={1.8}
                      className={styles.spark}
                    />
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-muted">{NO_VALUE}</p>
              )}
            </Panel>
          </Link>
        );
      })}
    </div>
    <div className={styles.indexStamp}>
      <div className={styles.indexContext}>
        <span className={styles.sessionBadge} data-open={status.isRegularOpen}>
          <i aria-hidden />
          {status.session === "regular" ? t.market.open : status.session === "pre-market" ? t.market.preMarket : status.session === "after-hours" ? t.market.afterHours : t.market.closed}
        </span>
        <span>{t.today.experienceIndexNote} · <strong>USD</strong></span>
      </div>
      <DataStamp labels={t.data} source={quotesResult.source} at={quotesResult.fetchedAt} stale={Boolean(quotesResult.stale)} locale={locale} />
    </div>
    </div>
  );
}

/* ==========================================================================
   Seçili endeks — genişlik, hareket edenler, tam liste
   ========================================================================== */

/**
 * Dow puan katkısı — YAKLAŞIK olduğu görünsün.
 *
 * Katkı, endeks böleninden hesaplanıyor ve bölen DIA fiyatı × 100
 * varsayımından türüyor. DIA gerçek Dow'un tam yüzde biri DEĞİL: temettü
 * dağıtımları ve NAV primi/iskontosu yüzünden bu yaklaşık bir oran. Sonuç iki ondalık haneyle
 * ("+38,42 puan") basılıyordu — yaklaşık bir bölenden çıkan sayıya iki
 * hanelik kesinlik giydirmek, projenin "uydurma kesinlik yok" kuralının
 * tam karşılığı. Tam sayıya yuvarlanıp başına `~` konuyor.
 */
function approxPoints(value: number, locale: Locale): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { maximumFractionDigits: 0 },
  ).format(Math.abs(rounded));
  return `~${sign}${SIGN_GAP}${formatted}`;
}

type Row = {
  member: IndexMember;
  quote: Quote | undefined;
  /** Yalnızca Dow (fiyat ağırlıklı) için: endeks puanına katkı. */
  contribution: number | null;
  /** Finnhub logosu — tabloda satırı bir bakışta tanınır kılar. */
  logoUrl: string | null;
  /** Piyasa değeri — yalnızca USD cinsinden bilinenler. */
  marketCap: number | null;
};

async function IndexDetail({
  tab,
  members,
  proxy,
  sort,
  dir,
  limit,
  locale,
  t,
}: {
  tab: TabKey;
  members: readonly IndexMember[];
  proxy: string;
  sort: SortKey;
  dir: SortDir;
  limit: number;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [{ quotes, stampAt, source, stale }, proxyResult, meta] = await Promise.all([
    quotesFor(
      members.map((m) => m.symbol),
      status,
    ),
    /* TÜM proxy'ler isteniyor, yalnızca seçili olan değil: aynı liste
       yukarıdaki `IndexCards` içinde de çekiliyor ve iki çağrının argümanı
       birebir aynı olunca istek boyunca tek çalışmaya iniyor
       (`getQuotes` sıralı anahtarla tekilleştiriyor). Tek sembol sorulunca
       anahtar farklı oluyor ve fazladan bir Alpaca isteği + bir veritabanı
       yazması çıkıyordu. */
    getQuotes([...INDEX_TABS.map((entry) => entry.proxy)], status),
    getSymbolNames(members.map((m) => m.symbol)),
  ]);

  /* Dow fiyat ağırlıklıdır: Endeks = Σfiyat / bölen. Bölen, elimizdeki
     fiyat toplamı ile endeks seviyesinden türetilir (DIA ≈ Dow/100), böylece
     her hissenin puan katkısı = fiyat değişimi / bölen olarak hesaplanır.
     Diğer endeksler piyasa değeri ağırlıklı olduğundan katkı hesaplanmaz. */
  /* BAYAT KOTASYONDAN BÖLEN TÜRETİLMEZ. Önbellekten gelen bir proxy fiyatı
     (sağlayıcı düştüğünde) saatler öncesinin seviyesini taşıyor ve ondan
     çıkan bölen bugünün katkısını yanlış ölçekliyor. Bölen yoksa katkı
     sütunu hiç basılmıyor — yanlış sayı basmaktansa boş bırakmak doğru. */
  let divisor: number | null = null;
  if (tab === "dow" && proxyResult.ok && !proxyResult.stale) {
    const proxyQuote = proxyResult.data[proxy];
    let sumPrices = 0;
    let counted = 0;
    for (const member of members) {
      const price = quotes[member.symbol]?.price;
      if (typeof price === "number") {
        sumPrices += price;
        counted += 1;
      }
    }
    const level = proxyQuote ? proxyQuote.price * 100 : null;
    if (level && counted === members.length && sumPrices > 0) {
      divisor = sumPrices / level;
    }
  }

  const rows: Row[] = members.map((member) => {
    const quote = quotes[member.symbol];
    return {
      member,
      quote,
      contribution:
        divisor && quote && typeof quote.change === "number"
          ? quote.change / divisor
          : null,
      // Canlı fiyat × hisse sayısı — gün içinde güncel kalır.
      logoUrl: meta[member.symbol]?.logoUrl ?? null,
      marketCap: liveMarketCap(meta[member.symbol], quote?.price),
    };
  });

  const withQuote = rows.filter((row) => row.quote);
  /* GENİŞLİK YALNIZCA DEĞİŞİMİ BİLİNEN SATIRLARDAN SAYILIYOR.
     Sayaç `(changePct ?? 0)` ile yazılmıştı: değişimi bilinmeyen bir sembol
     — borsadan çıkmış, işlemi durmuş ya da o gün hiç işlem görmemiş bir
     satır — sıfır sayılıp "yatay" kutusuna düşüyordu. Sıfır ile bilinmiyor
     ayrı şeyler; biri "fiyat değişmedi" diye bir İDDİA, öteki iddiasızlık.
     Aynı ayrımı sıralama zaten yapıyor (bkz. `valueOf` yorumu). */
  const withChange = withQuote.filter(
    (row) => row.quote!.changePct !== null && row.quote!.changePct !== undefined,
  );
  const advancing = withChange.filter((row) => row.quote!.changePct! > 0).length;
  const declining = withChange.filter((row) => row.quote!.changePct! < 0).length;
  const flat = withChange.length - advancing - declining;

  /* SIRALAMA DA YALNIZCA DEĞİŞİMİ BİLİNEN SATIRLARDAN.
     Sayaç yukarıda `withChange` ile düzeltilmişti ama bu liste hâlâ
     `withQuote`u `?? 0` ile sıralıyordu: değişimi bilinmeyen bir sembol
     sıfır sayılıp diziye giriyor ve az hareketli bir günde — beşten az
     sembol artıya ya da eksiye geçtiğinde — "Günün En Çok Artanları"
     listesine "—" yüzdesiyle çıkabiliyordu. Bir hareket sıralamasında
     hareketi bilinmeyen satırın yeri yok.

     Künyenin PAYDASI da düzeldi: üstteki sayaç "102 şirketin" derken bu
     künye `withQuote.length` ile başka bir toplam yazıyordu — aynı ekranda
     iki farklı payda. İkisi de artık `withChange`. */
  const byChange = [...withChange].sort(
    (a, b) => b.quote!.changePct! - a.quote!.changePct!,
  );
  const gainers = byChange.slice(0, 5);
  const losers = [...byChange].reverse().slice(0, 5);
  const movementScale = Math.max(...byChange.map((row) => Math.abs(row.quote!.changePct!)), 0.01);

  /* "GÜNÜN EN ÇOK ARTANLARI" — HANGİ GÜNÜN?
     İki panelin başlığı bir gün iddiası taşıyor ve o iddia yalnızca paket bu
     seansa aitse doğru. Sağlayıcı düştüğünde (bu ekranda kenar durum değil:
     Finnhub yedeği sekiz sembole kadar deneniyor, endeks bileşenleri
     30-500 sembol soruyor) sıralama Neon önbelleğinden, yani ÖNCEKİ seansın
     yüzdelerinden kuruluyor. Sayfanın damgası bunu yazıyor ama damga başka
     bir blokta; iddianın yanında bir şey yazmıyordu.

     Panel gizlenmiyor: son kapanışın sıralaması bir bilgi ve bu ekranın
     tablosu da aynı önbellekten besleniyor. Yazılan şey künyeye ekleniyor —
     aynı kalıp ana sayfanın hareket panelinde damgayla, alt şeritte grup
     künyesiyle kuruluyor. */
  const staleNote =
    stale && stampAt ? ` · ${staleMark(t.data.mayBeStale, stampAt, locale)}` : "";

  const share = withChange.length > 0 ? (advancing / withChange.length) * 100 : 0;

  /* ŞİRKET KARTI (components/ui/CompanyCard). Isı haritasının hücreleri
     kendi kartlarını sunucuda taşıyordu (30 hücre × tam kart işaretlemesi,
     `HeatmapGrid` konum ve Escape sarmalı); artık hücre, hareket satırı ve
     tablo satırı yalnızca `data-cc` taşıyor ve sitenin ortak kartını
     açıyor. Eski kartın hacim ve gün aralığı satırları kartın ek satırı.
     Kayıt YALNIZCA GÖRÜNEN satırlar için: harita + hareketler burada,
     tablonun görünen dilimi `MembersTable`da (S&P 500'ün beş yüz üyesine
     kayıt basmak sayfayı büyütürdü). Kotasyon sayfanın paketi. */
  const cardFacts = (row: Row): CompanyCardExtra => {
    const quote = row.quote;
    const facts: [string, string][] = [];
    if (quote?.volume !== null && quote?.volume !== undefined) facts.push([t.market.volume, formatCompact(quote.volume, locale)]);
    if (quote && quote.low !== null && quote.high !== null) {
      facts.push([t.markets.heatDayRange, `${formatPrice(quote.low, locale)} – ${formatPrice(quote.high, locale, { currency: true })}`]);
    }
    return facts.length > 0 ? { facts } : {};
  };
  const cardRows = [
    ...[...withChange].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, HEAT_MAX),
    ...gainers,
    ...losers,
  ];
  const carded = new Set(cardRows.map((row) => row.member.symbol));
  const cardContext = { quotes, names: meta, status, facts: cardFacts };

  return (
    <>
      <CompanyCards
        symbols={[...carded]}
        quotes={quotes}
        names={meta}
        status={status}
        extras={Object.fromEntries(cardRows.map((row) => [row.member.symbol, cardFacts(row)]))}
      />
      <IndexTabs
        tab={tab}
        locale={locale}
        t={t}
        identity={<IndexIdentity tab={tab} proxy={proxy} proxyQuote={proxyResult.ok ? (proxyResult.data[proxy] ?? null) : null} locale={locale} t={t} />}
        aside={
          withChange.length > 0 ? (
            <BreadthSummary
              share={share}
              advancing={advancing}
              flat={flat}
              declining={declining}
              locale={locale}
              t={t}
            />
          ) : undefined
        }
      />
      <IndexToolbar
        total={withChange.length}
        memberCount={members.length}
        heat={withChange}
        locale={locale}
        t={t}
      >
        {source && <DataStamp labels={t.data} source={source} at={stampAt} stale={stale} locale={locale}
          note={status.session === "pre-market" || status.session === "after-hours" ? t.data.extendedNote : undefined} />}
        {/* ÖLÇEK NOTU KÜNYE BANDINDA. İki hareket panelinin üstünde tek
            başına bir satırdı (sayfada kendi 30 piksellik şeridi); bant
            hemen altındaki iki panelin künyesi zaten. */}
        {withQuote.length > 0 && <span className={styles.movementScale}>{t.markets.movementScale}</span>}
      </IndexToolbar>

      {withQuote.length > 0 && (
        <>
          <div id="market-movers" className={styles.movers} data-motion-stagger>
            {/* Künye SEÇKİNİN PAYDASINI söylüyor: "Günün En Çok Artanları"
                beş satır basıyor ama hangi kümenin beşi olduğunu yazmıyordu.
                Endeks 102 şirketse "102 şirketin 5 tanesi" — aynı kalıp
                bileşen tablosunda ve ana sayfadaki bilanço panelinde de var. */}
            <MoverPanel
              title={t.markets.topGainers}
              kind="up"
              rows={gainers}
              scaleMax={movementScale}
              showContribution={divisor !== null}
              contributionLabel={t.markets.contribution}
              locale={locale}
              t={t}
              meta={
                t.companies.showing
                  .replace("{n}", String(gainers.length))
                  .replace("{total}", String(withChange.length)) + staleNote
              }
            />
            <MoverPanel
              title={t.markets.topLosers}
              kind="down"
              rows={losers}
              scaleMax={movementScale}
              showContribution={divisor !== null}
              contributionLabel={t.markets.contribution}
              locale={locale}
              t={t}
              meta={
                t.companies.showing
                  .replace("{n}", String(losers.length))
                  .replace("{total}", String(withChange.length)) + staleNote
              }
            />
          </div>
        </>
      )}


      <MembersTable
        tab={tab}
        rows={rows}
        limit={limit}
        sort={sort}
        dir={dir}
        showContribution={divisor !== null}
        locale={locale}
        t={t}
        cards={{ ...cardContext, skip: carded }}
      />

      {source && (
        <DataStamp
          labels={t.data}
          source={source}
          at={stampAt}
          stale={stale}
          locale={locale}
          /* Seans dışında değişim sütunu satır satır farklı bir güne
             dayanabiliyor; not /sirketler'de vardı, burada yoktu. Seans
             içinde not yok — orada bütün semboller aynı günü gösteriyor. */
          note={
            status.session === "pre-market" || status.session === "after-hours"
              ? t.data.extendedNote
              : undefined
          }
        />
      )}
    </>
  );
}

/* ---- Endeks seçici + piyasa genişliği ----

   İkisi tek panelde: seçici başıboş bir düğme satırıydı, genişlik ise tek
   bir çubuk için ayrı bir paneldi. Bilgi olarak da aynı şeye bakıyorlar —
   "hangi endeks" ve "o endeksin bugünü". Ayrı dururken sayfada iki blok
   yüksekliği harcıyor, birleşince seçimin karşılığı hemen altında okunuyor.
   Sonraki yükleme düzeninde seçimler sonuç sınırının dışına çıktı: veri
   beklenirken çipler kaybolmaz veya devre dışı kalmaz; genişlik yine altındadır. */

function IndexTabs({ tab, aside, identity, t }: { tab: TabKey; locale: Locale; t: Dictionary; aside?: ReactNode; identity?: ReactNode }) {
  return <Panel className={styles.indexTabs}>
      <div className={styles.toolbarLayout}>
        <div className={styles.indexControls}>
        <div className={styles.indexChoices}>
        <p className={styles.breadthEyebrow}>{t.markets.breadth}</p>
        {/* ÜÇ ÇİP MOBİLDE TEK SATIRDA. `flex-wrap` ile diziliyorlardı ve
            üçüncü çip (S&P 500) 390 pikselde alt satıra düşüyordu: üç eşit
            seçenek iki-bir diye kırılınca denetim tek bir seçici olmaktan
            çıkıp iki ayrı satır gibi okunuyordu. Dar ekranda üçlü ızgara,
            geniş ekranda eskisi gibi doğal genişlikte akıyorlar.
            Üye sayısı dar ekranda düşüyor: 106 piksellik hücreye sığmıyor ve
            zaten bir alttaki "102 şirketin 5 tanesi" künyesinde yazılı. */}
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap">
          {INDEX_TABS.map((entry) => {
            const activeTab = entry.key === tab;
            return (
              <Link
                key={entry.key}
                href={`/piyasalar?endeks=${entry.key}`}
                aria-current={activeTab ? "page" : undefined}
                scroll={false}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors sm:min-h-[38px] sm:px-4 sm:text-sm",
                  activeTab
                    ? "bg-primary text-on-primary"
                    : "border border-line bg-surface text-soft hover:border-line-strong hover:text-strong",
                )}
              >
                {entry.label}
                <span
                  className={cn(
                    "numeral hidden text-xs font-normal sm:inline",
                    /* Saydamlık yerine punto — gerekçe şirketler dizininde. */
                    activeTab ? "text-on-primary" : "text-muted",
                  )}
                >
                  {entry.members.length}
                </span>
              </Link>
            );
          })}
        </div>
        </div>
        {identity}
        </div>
        {/* SAĞDA YÜKSELENLERİN PAYI (26 Eylül). Pay genişlik kartının sağ
            yarısını tutuyordu; satırın sağı ise yalnızca liste tarihini
            taşıyordu. Pay buraya çıkınca kartın sağı ısı haritasına kaldı.
            Liste tarihi kartın kimlik bloğuna indi. */}
        {aside && <div className={styles.tabsAside}>{aside}</div>}
      </div>

  </Panel>;
}

/* Seçili endeksin kendi değişimi, yükselen şirketlerin payından farklıdır:
   birkaç ağır şirket, üyelerin çoğu düşerken endeksi yukarı taşıyabilir.
   Gösterilen fiyat endeks seviyesi değil onu izleyen fonun kotasyonudur;
   fon sembolü bu yüzden fiyatın yanında kalır. Eksik değişimler sayaca
   katılmaz; gerçek kapsam toplam üye sayısıyla ayrıca gösterilir. */
function IndexIdentity({ tab, proxy, proxyQuote, locale, t, loading = false }: {
  tab: TabKey; proxy: string; proxyQuote: Quote | null; locale: Locale; t: Dictionary; loading?: boolean;
}) {
  return <div className={styles.toolbarIdentity} aria-label={INDEX_TABS.find((entry) => entry.key === tab)?.label}>
    <div className={styles.selectedIndexLabel}>
      <span className={styles.proxySymbol}>{proxy}</span>
      <span>{INDEX_TABS.find((entry) => entry.key === tab)?.label}</span>
    </div>
    {loading ? <Skeleton className="h-7 w-48 max-w-full" /> : proxyQuote ? (
      <div className={styles.selectedIndexReading}>
        <strong className="numeral">{formatPrice(proxyQuote.price, locale, { currency: true })}</strong>
        {proxyQuote.changePct !== null && <ChangePill changePct={proxyQuote.changePct} locale={locale} />}
      </div>
    ) : <span className={styles.selectedIndexEmpty}>{t.common.noData}</span>}
  </div>;
}

function IndexToolbar({ total, memberCount, heat, locale, t, children }: {
  total: number; memberCount: number; heat: Row[];
  locale: Locale; t: Dictionary; children?: ReactNode;
}) {
  return (
    <Panel id="market-reading" className={styles.breadth}>
      <div className={styles.breadthOverview}>
        {/* ISI HARİTASI, LOGOLU VE 30 ŞİRKET (26 Eylül). Renkli kareler
            "anlamsız" bulundu: hangi karenin hangi şirket olduğu okunmuyordu.
            Artık piyasa değerine göre ilk 30 şirket (`HEAT_MAX`), her karede
            logo ve günlük yüzde; renk karonun zemini, koyuluk hareketin
            büyüklüğü. Üzerine gelince sitenin ortak şirket kartı açılıyor
            (28 Eylül). Kareler klavyeyle de gezilebiliyor: 30 durak kabul
            edilebilir. */}
        {heat.length > 0 && (
          <div className={styles.heat}>
            <div className={styles.heatHead}>
              <h2 data-ink="solid"><SquaresFour size={21} weight="duotone" aria-hidden />{t.markets.heatmap}</h2>
              <p className={styles.heatHint}>{t.markets.heatmapHint}</p>
              <div className={styles.heatLegend} role="img" aria-label={t.markets.heatScaleHint}>
                <div className={styles.heatSwatches} aria-hidden>
                  {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((level) => (
                    <i key={level} data-heat-tone={level < 0 ? "down" : level > 0 ? "up" : "flat"} data-heat-level={Math.abs(level)} />
                  ))}
                </div>
                <div className={styles.heatLegendLabels}><span>{locale === "tr" ? "≤ −%3" : "≤ −3%"}</span><span>0</span><span>{locale === "tr" ? "≥ +%3" : "≥ +3%"}</span></div>
                <span className={styles.heatLegendHint}>{t.markets.heatScaleSteps}</span>
              </div>
            </div>
            <div className={styles.heatGrid} data-motion-stagger>
              {[...heat]
                .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
                .slice(0, HEAT_MAX)
                .map((row) => {
                  const change = row.quote!.changePct!;
                  const magnitude = Math.abs(change);
                  const level = magnitude === 0 ? 0 : magnitude < 0.5 ? 1 : magnitude < 1.5 ? 2 : magnitude < 3 ? 3 : 4;
                  const tone = change > 0 ? "up" : change < 0 ? "down" : "flat";
                  return (
                    <Link
                      key={row.member.symbol}
                      href={`/hisse/${row.member.symbol}`}
                      prefetch={false}
                      className={styles.heatCell}
                      data-cc={row.member.symbol}
                      aria-label={`${row.member.symbol} · ${row.member.name} · ${formatPercent(change, locale)}`}
                      data-heat-tone={tone}
                      data-heat-level={level}
                    >
                      <LogoTile symbol={row.member.symbol} logoUrl={row.logoUrl} size="md" className={styles.heatLogo} />
                      <span className={styles.heatSymbol}>{row.member.symbol}</span>
                      <span className={cn("numeral", styles.heatPct)}>{formatPercent(change, locale)}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      {total === 0 && <p className={styles.heatEmpty}>{t.common.noData}</p>}
      <div className={styles.breadthStamp}>
        {children}
        <span className={styles.heatCoverage}>{t.markets.breadthCoverage.replace("{known}", String(total)).replace("{total}", String(memberCount))} · {t.markets.asOf}: {formatEtDateMedium(INDEX_COMPOSITION_DATE, locale)}</span>
      </div>
    </Panel>
  );
}

/** Isı haritasında en çok kaç şirket — piyasa değerine göre ilk 30 (26 Eylül,
    sahibinin isteği): Dow zaten 30 üye, böylece üç endekste de harita aynı
    ızgarada ve her kare logosu, yüzdesi ve künye kartıyla okunacak kadar iri. */
const HEAT_MAX = 30;

/**
 * Yükselenlerin payı — sekme satırının sağında, sıkı hâliyle (26 Eylül).
 * Büyük yüzde, üç renkli ray ve artı/yatay/eksi sayıları tek blokta.
 */
function BreadthSummary({
  share, advancing, flat, declining, locale, t,
}: {
  share: number; advancing: number; flat: number; declining: number; locale: Locale; t: Dictionary;
}) {
  const parts = [
    { key: "up", value: advancing, fill: "bg-up", tone: "text-up", label: t.markets.advancing },
    { key: "flat", value: flat, fill: "bg-flat/50", tone: "text-muted", label: t.markets.unchanged },
    { key: "down", value: declining, fill: "bg-down", tone: "text-down", label: t.markets.declining },
  ];
  return (
    <div className={styles.shareBox}>
      <div className={styles.shareHead}>
        <span>{t.markets.advancingShare}</span>
        <strong className="numeral">{formatPercentPlain(share, locale, 0)}</strong>
      </div>
      <div className={styles.breadthRail} aria-hidden>
        {parts.map((part) => part.value > 0 && <span key={part.key} data-motion-draw="line" className={cn("bar-fill", part.fill)} style={{ flex: part.value }} />)}
      </div>
      <dl className={styles.shareCounts}>
        {parts.map((part) => (
          <div key={part.key}>
            <dt>{part.label}</dt>
            <dd className={cn("numeral", part.tone)}>{part.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* Haritanın renk eşikleri sabittir: %0,5 / %1,5 / %3. Endeks
   değiştirmek aynı hareketi başka bir renge dönüştürmez. */

/* ---- En çok artan / düşen kartları ---- */

function MoverPanel({
  title,
  kind,
  rows,
  showContribution,
  contributionLabel,
  locale,
  t,
  meta,
  scaleMax,
}: {
  title: string;
  kind: "up" | "down";
  rows: Row[];
  showContribution: boolean;
  contributionLabel: string;
  locale: Locale;
  t: Dictionary;
  /** Başlığın yanındaki künye — kaç şirketten seçildiği. */
  meta?: string;
  scaleMax: number;
}) {
  if (rows.length === 0) return null;

  return (
    <Panel className={styles.mover}>
      {/* KARŞILAŞTIRMAYA GİDEN YOL. Ekran gezinmede görünmüyor ve siteye
          girenin çoğu varlığını bilmiyordu; oysa "günün en çok artan beşi"
          listesi, karşılaştırmanın en doğal başlangıcı. Liste sabit değil,
          o anki sıralamadan türüyor. */}
      <div className={styles.moverHeading}>
        <h2 data-ink="solid"><span className={styles.moverHeadingIcon} data-direction={kind}>
          {kind === "up" ? <TrendUp size={18} weight="bold" aria-hidden /> : <TrendDown size={18} weight="bold" aria-hidden />}
        </span>{title}</h2>
        <div className={styles.moverHeadingMeta}>
          {meta && <span>{meta}</span>}
          {rows.length >= 2 && <PanelLink href={`/karsilastir?semboller=${rows.slice(0, 4).map((row) => row.member.symbol).join(",")}`}>
            {t.compare.compareFirstFour}
          </PanelLink>}
        </div>
      </div>
      <ul className="divide-y divide-line-soft" data-motion-stagger>
        {rows.map((row, index) => {
          const changePct = row.quote?.changePct ?? 0;
          const width = (Math.abs(changePct) / scaleMax) * 100;
          /* RENK SATIRIN KENDİ DEĞERİNDEN, PANELİN ADINDAN DEĞİL.
             `tone` propu panelin tamamını boyuyordu: düşüşle geçen bir günde
             "Günün En Çok Artanları" listesindeki beş satırın hepsi eksi
             olabiliyor ve eksi yüzdeler YEŞİL basılıyordu. Panelin adı bir
             sıralama yönü, satırın rengi ise bir olgu. */
          const satirTon = directionOf(row.quote?.changePct);
          return (
            <li key={row.member.symbol}>
              {/* prefetch={false}: bu bağlantı bir LİSTE SATIRINDA ve satır
                  sayısı altmışa çıkıyor. Next varsayılanı, görünür alana
                  giren her bağlantıyı önden ısıtıyor — altmış satır altmış
                  sunucu isteği demek. Sitedeki öteki liste satırları
                  (şirketler, bilanço takvimi, analiz tablosu) bunu zaten
                  yapıyordu; endeks bileşenleri gözden kaçmış. */}
              <Link
                href={`/hisse/${row.member.symbol}`}
                prefetch={false}
                className={styles.moverLink}
                data-cc={row.member.symbol}
              >
                <div className={styles.moverIdentity}>
                  <span className={styles.moverRank} aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                  <LogoTile symbol={row.member.symbol} logoUrl={row.logoUrl} size="sm" className={styles.moverLogo} />
                  <span className={styles.moverCompany}>
                    <span className="shrink-0 text-base font-bold text-strong">
                      {row.member.symbol}
                    </span>
                    <span className="min-w-0 truncate text-tiny text-muted" title={row.member.name}>
                      {row.member.name}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "numeral shrink-0 text-sm font-bold",
                      directionText(satirTon),
                    )}
                  >
                    {formatPercent(row.quote?.changePct, locale)}
                  </span>
                </div>

                {/* Both panels use the same maximum absolute percentage. */}
                <div className={styles.moverTrack}>
                  <span
                    aria-hidden
                    data-motion-draw="line"
                    className={cn(
                      "bar-fill h-[3px] rounded-full",
                      satirTon === "up"
                        ? "bg-up/70"
                        : satirTon === "down"
                          ? "bg-down/70"
                          : "bg-flat/50",
                    )}
                    style={{ width: `${width}%` }}
                  />
                  {showContribution && row.contribution !== null && (
                    <span className="numeral shrink-0 text-nano text-muted">
                      {contributionLabel} {approxPoints(row.contribution, locale)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ---- Tam bileşen tablosu ---- */

function sortHref(
  tab: TabKey,
  key: SortKey,
  sort: SortKey,
  dir: SortDir,
  limit: number,
) {
  const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
  // Derinlik korunur: 180 satıra inmiş biri sütun başlığına basınca ilk 60'a
  // geri fırlatılmamalı.
  const depth = limit > PAGE_STEP ? `&adet=${limit}` : "";
  return `/piyasalar?endeks=${tab}&sirala=${key}&yon=${nextDir}${depth}`;
}

function SortHead({
  label,
  href,
  active,
  dir,
  className,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  className?: string;
}) {
  return (
    <th
      scope="col"
      /* Sıralı sütun rengi ve `aria-hidden` bir üçgenle anlatılıyordu; ikisi
         de yardımcı teknolojiye ulaşmıyor. Gerekçe ikizinde yazılı:
         app/(app)/sirketler/page.tsx */
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn("px-3 py-2.5 text-right font-semibold", className)}
    >
      {/* Dokunma alanı yazının kendisi kadardı (14px); negatif margin +
          dikey dolgu tabloyu büyütmeden hedefi 32px'e çıkarır. */}
      {/* scroll={false}: sıralama bir gezinme değil, aynı tablonun yeniden
          dizilmesi. Varsayılan davranışta okuyucu tablonun ortasında bir
          başlığa basınca sayfanın en üstüne fırlıyor ve aşağı geri kaydırmak
          zorunda kalıyordu. */}
      <Link
        href={href}
        scroll={false}
        className={cn(
          /* MOBİLDE 44px. Sıralama başlığı tablonun ANA denetimi ama dokunma
             hedefi 32 pikseldi. Negatif margin dolguyu emiyor, yani hedef
             büyürken satır yüksekliği değişmiyor; masaüstünde imleç hassas,
             orada 32px yeterli. */
          "-my-3.5 inline-flex min-h-11 items-center gap-1 py-3.5 transition-colors hover:text-primary sm:-my-2 sm:min-h-8 sm:py-2",
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

function MembersTable({
  tab,
  rows,
  limit,
  sort,
  dir,
  showContribution,
  locale,
  t,
  cards,
}: {
  tab: TabKey;
  rows: Row[];
  /** Kaç satır basılacak — sıralama TAMAMI üzerinde, dilim sonra alınır. */
  limit: number;
  sort: SortKey;
  dir: SortDir;
  showContribution: boolean;
  locale: Locale;
  t: Dictionary;
  /** Şirket kartı: sayfanın paketi ve üstte zaten kaydı basılmış semboller. */
  cards: {
    quotes: Record<string, Quote>;
    names: Record<string, SymbolMeta>;
    status: MarketStatus;
    facts: (row: Row) => CompanyCardExtra;
    skip: ReadonlySet<string>;
  };
}) {
  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState title={t.common.noData} />
      </Panel>
    );
  }

  /* Değeri olmayan satır `null` — eksik veri bir uç değer değil bilinmezlik.
     `-Infinity` azalan sıralamada doğru çalışıp artanda bozuluyordu: artana
     geçen okuyucu listenin başında en çok düşenleri değil kotasyonu hiç
     gelmemiş şirketleri buluyordu (aynı düzeltme Şirketler tablosunda da). */
  const valueOf = (row: Row): number | string | null => {
    switch (sort) {
      case "fiyat":
        return row.quote?.price ?? null;
      case "ad":
        return row.member.name;
      case "katki":
        return row.contribution ?? null;
      case "cap":
        return row.marketCap ?? null;
      default:
        return row.quote?.changePct ?? null;
    }
  };

  /* Cubuk olcegi: grubun EN BUYUK mutlak degisimi. Yuzde degerleri
     kendi araliginda kucuk (±%3) oldugu icin sabit bir olcek cubuklari
     gorunmez yapiyordu. */
  const peakChange = Math.max(
    ...rows.map((row) => Math.abs(row.quote?.changePct ?? 0)),
    0.01,
  );
  /* PİYASA DEĞERİ BİR DE ÇİZGİ (26 Eylül). "Karşılaştırılan her büyüklük bir
     de çizgi olarak okunur" (CLAUDE.md); sütun yalnızca sayıydı ve "hangisi
     ne kadar büyük" basamak basamak okunuyordu. Ölçek DOĞRUSAL ve listenin
     en büyüğüne göre: logaritmik ölçek sırayı korurdu ama büyüklüğü
     çarpıtırdı, oysa sütunun asıl söylediği tam da o — birkaç dev şirketin
     piyasanın ne kadarını tuttuğu. Çubuk bir yargı değil, nötr tonda. */
  const peakCap = Math.max(...rows.map((row) => row.marketCap ?? 0), 1);

  const ordered = [...rows].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    // Boşlar her iki yönde de sonda; kendi aralarında tablo sırasını korur.
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      const cmp = String(va).localeCompare(String(vb), "en");
      return dir === "asc" ? cmp : -cmp;
    }
    return dir === "asc" ? va - vb : vb - va;
  });

  // Dilim SIRALAMADAN SONRA — bkz. PAGE_STEP.
  const sorted = ordered.slice(0, limit);
  const hasMore = ordered.length > sorted.length;
  const moreHref = `/piyasalar?endeks=${tab}&sirala=${sort}&yon=${dir}&adet=${limit + PAGE_STEP}`;

  const fresh = sorted.filter((row) => !cards.skip.has(row.member.symbol));

  return (
    <Panel id="market-members" className={styles.members}>
      <CompanyCards
        symbols={fresh.map((row) => row.member.symbol)}
        quotes={cards.quotes}
        names={cards.names}
        status={cards.status}
        extras={Object.fromEntries(fresh.map((row) => [row.member.symbol, cards.facts(row)]))}
      />
      {/* Sayaç başlıkta: tablo kırpılıyor ve okuyucu tıklamadan önce
          listenin ne kadarını gördüğünü bilmeli. Aynı kalıp ana sayfadaki
          bilanço panelinde ve /mercek arşivinde de var. */}
      <PanelHeader
        title={t.markets.constituents}
        meta={
          hasMore
            ? t.companies.showing
                .replace("{n}", String(sorted.length))
                .replace("{total}", String(ordered.length))
            : undefined
        }
      />
      {/* Tablo telefonda `min-w-[680px]` ile açılıyordu: ilk bakışta yalnızca
          sıra, şirket ve değişimin bir kısmı görünüyor, FİYAT ekranın dışında
          kalıyordu. Bir bileşen listesinde "ne kadar oynamış" ile "kaç dolar"
          birlikte okunur — birini görmek için yana kaydırmak gerekmesi tabloyu
          ilk açılışta kırık gösteriyordu.

          Çözüm daraltmak değil, ELEMEK: sıra numarası, piyasa değeri ve Dow
          katkısı telefonda gizleniyor (sm+ hepsi geri geliyor), kalan üç sütun
          390px'e rahat sığıyor ve yatay kaydırma kalkıyor. Piyasa değeri
          kaybolmuyor — fiyatın altına ikinci satır olarak iniyor. */}
      {/* KAP KLAVYEYLE ODAKLANABİLİR — gerekçe ikizinde (sirketler). */}
      <ScrollEdges
        className="scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
        tabIndex={0}
        role="region"
        aria-label={t.markets.constituents}
      >
        <table className="w-full text-sm sm:min-w-[680px]">
          <caption className="sr-only">{INDEX_TABS.find((entry) => entry.key === tab)?.label} · {t.markets.constituents}</caption>
          <thead>
            <tr className="border-b border-line text-left text-nano text-muted">
              <th className="hidden w-10 px-4 py-2.5 font-semibold sm:table-cell sm:px-5">
                #
              </th>
              <SortHead
                label={t.companies.company}
                href={sortHref(tab, "ad", sort, dir, limit)}
                active={sort === "ad"}
                dir={dir}
                className="text-left"
              />
              {/* Değişim fiyattan önce — bkz. /sirketler tablosu. */}
              <SortHead
                label={t.companies.change}
                href={sortHref(tab, "degisim", sort, dir, limit)}
                active={sort === "degisim"}
                dir={dir}
                className="px-1.5 sm:px-3"
              />
              <SortHead
                label={`${t.companies.price} ($)`}
                href={sortHref(tab, "fiyat", sort, dir, limit)}
                active={sort === "fiyat"}
                dir={dir}
                className="pr-4 sm:pr-3"
              />
              <SortHead
                label={t.market.marketCap}
                href={sortHref(tab, "cap", sort, dir, limit)}
                active={sort === "cap"}
                dir={dir}
                className={cn(
                  "hidden sm:table-cell",
                  !showContribution && "sm:pr-5",
                )}
              />
              {showContribution && (
                <SortHead
                  label={t.markets.contribution}
                  href={sortHref(tab, "katki", sort, dir, limit)}
                  active={sort === "katki"}
                  dir={dir}
                  className="hidden sm:table-cell sm:pr-5"
                />
              )}
            </tr>
          </thead>
          <tbody data-motion-stagger className="divide-y divide-line-soft">
            {sorted.map((row, index) => {
              const quote = row.quote;
              const tone = directionOf(quote?.changePct);
              return (
                <tr
                  key={row.member.symbol}
                  className="transition-colors hover:bg-primary-tint"
                >
                  <td className="numeral hidden px-4 py-2.5 text-xs text-muted sm:table-cell sm:px-5">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2.5 pl-4 sm:pl-3">
                    <Link
                      href={`/hisse/${row.member.symbol}`}
                      prefetch={false}
                      /* -my-2 py-2: bağlantı hücreyi doldurmadığı için
                         dokunma hedefi metnin kendi 20px'iyle sınırlıydı.
                         Dolgu onu satır yüksekliğine yayar, negatif margin
                         de tabloyu olduğu yerde tutar. */
                      className="-my-2 flex min-w-0 items-center gap-2.5 py-2"
                      data-cc={row.member.symbol}
                    >
                      <LogoTile
                        symbol={row.member.symbol}
                        logoUrl={row.logoUrl}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-bold leading-[17px] text-strong">
                          {row.member.symbol}
                        </span>
                        <span title={row.member.name} className="block max-w-[104px] truncate text-tiny leading-[15px] text-muted sm:max-w-none">
                          {row.member.name}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {/* Sayı + oran çubuğu birlikte: tablo yalnızca sayıdan
                      ibaretken "kim ne kadar oynamış" sorusu ancak yüzdeler
                      tek tek okunup kafada sıralanarak cevaplanıyordu.
                      Çubuk sıralamayı göze taşıyor ve üstteki En Çok
                      Artanlar kartıyla aynı ölçeği kullanıyor. */}
                  <td className="px-1.5 py-2.5 sm:px-3">
                    <span className="flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          "numeral text-right font-bold",
                          tone === "up"
                            ? "text-up"
                            : tone === "down"
                              ? "text-down"
                              : "text-muted",
                        )}
                      >
                        {quote ? formatPercent(quote.changePct, locale) : NO_VALUE}
                      </span>
                      {quote && (
                        <span
                          aria-hidden
                          className="flex h-1 w-12 justify-end overflow-hidden rounded-full bg-surface-elevated sm:w-16"
                        >
                          <span
                            className={cn(
                              "h-full rounded-full",
                              tone === "up"
                                ? "bg-up/70"
                                : tone === "down"
                                  ? "bg-down/70"
                                  : "bg-flat/50",
                            )}
                            style={{
                              /* Değişim bilinmiyorsa çubuk çizilmiyor: sıfır
                                 genişlik "hareket yok" demek olurdu ve o da
                                 bir iddia. */
                              width:
                                quote.changePct === null
                                  ? 0
                                  : `${(Math.abs(quote.changePct) / peakChange) * 100}%`,
                            }}
                          />
                        </span>
                      )}
                    </span>
                  </td>
                  {/* Piyasa değeri telefonda kendi sütununu kaybediyor ama
                      veriyi kaybetmiyor: fiyatın altına küçük punto ikinci
                      satır olarak iniyor. Aynı şirketin iki ölçüsü zaten
                      birlikte okunuyor ("kaç dolar / ne kadar büyük"), alt
                      alta gelmeleri sütun olarak durmalarından daha sıkı.
                      sm+ ekranda satır gizlenir, sütun geri gelir. */}
                  <td className="px-3 py-2.5 pr-4 text-right sm:pr-3">
                    <span className="numeral block font-bold text-strong">
                      {quote ? formatPrice(quote.price, locale) : NO_VALUE}
                    </span>
                    {row.marketCap && (
                      <span className="numeral mt-0.5 block text-tiny leading-[14px] text-muted sm:hidden">
                        {formatMoneyCompact(row.marketCap, locale)}
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "numeral hidden px-3 py-2.5 text-right text-body sm:table-cell",
                      showContribution ? undefined : "sm:pr-5",
                    )}
                  >
                    {row.marketCap
                      ? formatMoneyCompact(row.marketCap, locale)
                      : NO_VALUE}
                    {row.marketCap ? <ScaleBar ratio={row.marketCap / peakCap} signed={false} className="max-w-[96px]" /> : null}
                  </td>
                  {showContribution && (
                    <td className="numeral hidden px-3 py-2 text-right text-soft sm:table-cell sm:pr-5">
                      {row.contribution !== null
                        ? approxPoints(row.contribution, locale)
                        : NO_VALUE}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollEdges>
      {/* Sayaç + devamı — /sirketler dizinindeki ölçünün aynısı.
          scroll={false}: okuyucu tablonun dibinde, yeni satırlar geldiğinde
          sayfanın başına fırlatılmamalı. */}
      {hasMore && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <p className="numeral text-small text-muted">
            {t.companies.showing
              .replace("{n}", String(sorted.length))
              .replace("{total}", String(ordered.length))}
          </p>
          <Link
            href={moreHref}
            scroll={false}
            /* 44px: sayfanın en altındaki tek eylem ve mobilde dokunma
               eşiğinin altındaydı (40px). */
            className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-10"
          >
            {t.companies.showMore}
          </Link>
        </div>
      )}

      {showContribution && (
        <p className="border-t border-line-soft px-4 py-2.5 text-tiny leading-relaxed text-muted sm:px-5">
          {t.markets.contributionHint}
        </p>
      )}
    </Panel>
  );
}

/**
 * Endeks bileşenleri bölümünün yer tutucusu.
 *
 * Suspense sınırı genişlik, hareketler ve bileşen tablosunu kapsar.
 * Önceki yedek yalnızca tabloyu taklit ediyordu.
 * Ölçüldü: sekme değiştiren okuyucunun altında sayfa 7301 pikselden 3183'e
 * çöküyor, yarım saniye sonra geri açılıyordu. Yalnızca tablo taklit
 * edilince çöküş 1237 piksele indi; eksik kalan 890 piksel tam olarak o iki
 * bloktu.
 *
 * Yer tutucular yükseklikle değil YAPIYLA eşleşiyor: aynı dolgu, aynı satır
 * düzeni, aynı ızgara. Böylece içerik uzayıp kısaldıkça iskelet de onunla
 * birlikte kayıyor ve elle ayarlanmış piksel sayıları eskimiyor.
 */
function DetailSkeleton({ rows, contribution }: { rows: number; contribution: boolean }) {
  return (
    <div className={styles.detailSkeleton} aria-hidden="true">
      {/* 27 Eylül: eski kimlik/çubuk maketi yerine gerçek 30 karolu geometri.
          Seçici ve genişlik özeti yukarıda, yüklenirken de aynı konumda. */}
      <Panel className={styles.breadth}>
        <div className={styles.breadthOverview}>
          <div className={styles.heat}>
            <div className={styles.heatHead}>
              <Skeleton className="h-5 w-20" />
              <Skeleton className={cn(styles.heatHint, "h-3 w-full max-w-72")} />
              <Skeleton className={cn(styles.heatLegend, "h-10")} />
            </div>
            <div className={styles.heatGrid}>
              {Array.from({ length: HEAT_MAX }, (_, i) => (
                <div key={i} className={styles.heatCell} data-heat-level="0">
                  <Skeleton className="size-[26px] rounded-lg" />
                  <Skeleton className="h-3 w-7" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={cn(styles.breadthStamp, styles.stampSkeleton)}>
          <Skeleton className="h-3 w-72 max-w-full" />
          <Skeleton className="h-3 w-52 max-w-full" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
      </Panel>

      <div className={styles.movers}>
        {[0, 1].map((panel) => (
          <Panel key={panel} className={styles.mover}>
            <div className={styles.moverSkeletonHead}>
              <Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-24" />
            </div>
            <ul>
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className={styles.moverSkeletonRow}>
                  <Skeleton className="size-6 rounded-md" />
                  <div className={styles.moverSkeletonCompany}><Skeleton className="h-[18px] w-12" /><Skeleton className="h-[14px] w-full" /></div>
                  <Skeleton className={cn(styles.moverSkeletonValue, "h-5 w-16")} />
                  <Skeleton className={cn(styles.moverSkeletonBar, "h-[3px] w-full")} />
                  {contribution && <Skeleton className={cn(styles.moverSkeletonBar, "h-4 w-20")} />}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel className={styles.members}>
        <div className="flex items-center justify-between gap-4 px-5 py-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-20" /></div>
        <div className="flex flex-col gap-px">
          {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      </Panel>
    </div>
  );
}
