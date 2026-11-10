import { PageShare } from "@/components/article/PageShare";
import { HeroAccent } from "@/components/motion/HeroAccent";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { Suspense } from "react";
import { SectionMasthead } from "@/components/motion/SectionMasthead";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/markets/MarketExperience.module.css";
import { CommodityBoard, SectorPerformance, parseSectorSort } from "@/components/markets/EtfBoards";
import { SentimentPulse } from "@/components/markets/SentimentPulse";
import boardStyles from "@/components/markets/MarketBoards.module.css";
import { IndexHeat } from "@/components/markets/IndexHeat";
import { BreadthSummary, IndexIdentity, IndexTabs } from "@/components/markets/IndexSelection";
import { MembersTable } from "@/components/markets/MembersTable";
import { MoverPanel } from "@/components/markets/MoverPanel";
import {
  HEAT_MAX,
  INDEX_TABS,
  PAGE_STEP,
  SORT_KEYS,
  type Row,
  type SortDir,
  type SortKey,
  type TabKey,
} from "@/components/markets/index-shared";
import { IndexCard } from "@/components/markets/IndexCard";
import { median, sameSessionMoves, themePhase } from "@/lib/theme-stats";
import { themeRow } from "@/lib/themes-data";
import { GuideHint } from "@/components/article/GuideHint";
import { CompanyCards } from "@/components/ui/CompanyCards";
import type { CompanyCardExtra } from "@/lib/company-card";
import {
  DataStamp,
  EmptyState,
  Panel,
  Skeleton,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBarsMulti, getQuotes, getWeeklyChanges } from "@/lib/providers";
import { quoteBasis, type MarketStatus } from "@/lib/market-hours";
import { sessionDomain } from "@/components/today/index-feed";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  formatCompact,
  formatPercentPlain,
  staleMark,
} from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";

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
        share={<PageShare compactOnMobile align="right" path="/piyasalar" title={t.markets.title} locale={locale} t={t} />}
        embedded
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
              identity={<IndexIdentity tab={tab} proxy={active.proxy} median={null} phase={null} locale={locale} t={t} loading />}
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
      {/* YEDEKLER YAPISAL (14 Ekim). Üç pano düz plakaydı (h-72 / h-[520px])
          ve gerçek boylarıyla eşleşmiyordu: aşağı inmiş okuyucunun altında
          sayfa kayıyordu. Endeks detayının kendi standardı (DetailSkeleton:
          "yer tutucular yükseklikle değil YAPIYLA eşleşir") buraya da
          uygulandı; satır sayıları sabit ve sunucuda biliniyor (nabız 5
          gösterge, sektör 11, emtia 6+2 ve iki grup başlığı). */}
      <section className={boardStyles.section} aria-label={t.marketExtras.boardsLabel}>
        <Suspense fallback={<PulseSkeleton />}>
          <SentimentPulse locale={locale} t={t} />
        </Suspense>
        <div className={boardStyles.boards}>
          <Suspense fallback={<BoardSkeleton rows={11} />}>
            <SectorPerformance
              locale={locale}
              t={t}
              sort={sectorSort.sort}
              dir={sectorSort.dir}
              hrefFor={sectorHref}
            />
          </Suspense>
          <Suspense fallback={<BoardSkeleton rows={8} groups={2} />}>
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

  /* Kıvılcım çizgilerinin ekseni — ana sayfanın endeks kartlarıyla aynı
     (`sessionDomain`): dört kart aynı günü aynı ölçekte anlatır. */
  const rail = sessionDomain(status);

  // The selected index occupies the first visual position. Keep DOM and
  // keyboard order aligned with that position; the toolbar keeps its order.
  // Keep all three positions stable when the active index changes.
  const orderedTabs = INDEX_TABS;

  return (
    <div className={styles.indexOverview}>
    <div className={styles.indexGrid}>
      {orderedTabs.map((entry, order) => {
        const quote = quotesResult.data[entry.proxy] ?? null;
        /* ÇİZGİ SEANS EKSENİNDE, TABAN ÖNCEKİ KAPANIŞ (14 Ekim). Barlar
           yalnızca değerle eşlenip eksensiz çiziliyordu: %0,05'lik kıpırtı
           kartı dolduruyor, x ekseni bar SIRASI olunca ön seans günü yarım
           gösteriyordu — Sparkline'ın kendi karar kaydının ana sayfada
           ölçüp düzelttiği hata buradaydı. Ana sayfanın kuralının aynısı:
           zaman + `sessionDomain` + `prevClose` tabanı + açılışta yarım
           ton; sayı o seansa ait değilse (`quoteBasis === "lastClose"`)
           şekil HİÇ çizilmiyor (veri dürüstlüğü 3-4). Kartın kendisi
           18 Ekim'den beri components/markets/IndexCard.tsx. */
        const points = (bars[entry.proxy] ?? []).map((bar) => ({
          time: bar.time,
          value: bar.close,
        }));
        return (
          <IndexCard
            key={entry.key}
            href={`/piyasalar?endeks=${entry.key}&sirala=${sort}&yon=${dir}`}
            label={entry.label}
            proxy={entry.proxy}
            quote={quote}
            points={points}
            sparkOk={quote ? quoteBasis(quote, status) !== "lastClose" : false}
            rail={rail}
            selected={entry.key === activeTab}
            order={order}
            locale={locale}
            t={t}
          />
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
  members: readonly Row["member"][];
  proxy: string;
  sort: SortKey;
  dir: SortDir;
  limit: number;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [{ quotes, stampAt, source, stale }, proxyResult, meta, weekly] = await Promise.all([
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
    /* HAFTALIK DEĞİŞİM (10 Kasım, sahibinin isteği: "haftalık değişim de
       koyabiliriz buraya"). Kaynak Şirketler tablosununkiyle AYNI
       (`getWeeklyChanges`: toplu günlük bar isteği, son 5 işlem günü) —
       aynı hissenin haftalığı iki ekranda iki ayrı sayı olmasın (Veri
       dürüstlüğü 3). Yeni uç ya da şema yok. MALİYET: 200 sembollük paket
       başına bir Alpaca isteği (Nasdaq 100 ve Dow 1, S&P 500 3), kotasyonla
       PARALEL; yanıt Next veri önbelleğinde en az 15 dakika (seans sınırını
       aşmadan, `boundedTtl`). Liste üyelik sırasıyla soruluyor: sıralama ya
       da derinlik değişince adres, dolayısıyla önbellek kaydı değişmez.
       Sağlayıcı düşerse boş sözlük döner; sütun HİÇ basılmaz
       (`MembersTable` → `showWeek`). */
    getWeeklyChanges(members.map((m) => m.symbol), status),
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
      week: weekly[member.symbol] ?? null,
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
    /* Gün aralığı artık kartın kendi çizgisi (`companyCardRecord` → range). */
    return facts.length > 0 ? { facts } : {};
  };
  const heatSource = [...withChange].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, HEAT_MAX);
  /* Harita tema haritasının satır tipini okuyor (`themeRow`: seans
     temeli ve işlem günüyle); renk yalnız aynı seansı anlatan kümede
     (`sameSessionMoves`, gerekçe components/markets/HeatScale.tsx). */
  const heatRows = heatSource.map((row) => themeRow(row.member.symbol, quotes, meta, status));
  const heatMoves = sameSessionMoves(heatRows);
  /* MEDYAN HİSSE (18 Ekim). Seçim şeridi seçili fonun fiyatını ve
     yüzdesini İKİNCİ kez yazıyordu — hemen üstündeki kart aynı iki sayıyı
     büyük puntoyla taşıyor. Yerine kartta OLMAYAN bir okuma geldi:
     üyelerin günlük değişiminin ortancası. Piyasa değeri ağırlıklı
     endeks birkaç dev şirketle "tipik hisse"den ayrışabiliyor; fonun
     yüzdesiyle yan yana bu fark bir bakışta okunuyor. Medyan tema
     ekranlarının kuralıyla kuruluyor: yalnız aynı seansı anlatan
     yüzdelerden; karışık hâlde hiç basılmıyor (`sameSessionMoves`). */
  const memberMoves = sameSessionMoves(members.map((member) => themeRow(member.symbol, quotes, meta, status)));
  const medianMove = memberMoves ? median(memberMoves.values) : null;
  const medianPhase = themePhase(memberMoves?.basis ?? null, status.session);
  const cardRows = [...heatSource, ...gainers, ...losers];
  const carded = new Set(cardRows.map((row) => row.member.symbol));
  const cardContext = { quotes, stale: Boolean(stale), names: meta, status, facts: cardFacts };

  return (
    <>
      <CompanyCards
        symbols={[...carded]}
        quotes={quotes}
        stale={Boolean(stale)}
        names={meta}
        status={status}
        extras={Object.fromEntries(cardRows.map((row) => [row.member.symbol, cardFacts(row)]))}
      />
      <IndexTabs
        tab={tab}
        locale={locale}
        t={t}
        identity={<IndexIdentity tab={tab} proxy={proxy} median={medianMove} phase={medianPhase} moves={memberMoves?.values ?? null} locale={locale} t={t} />}
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
      <IndexHeat
        total={withChange.length}
        memberCount={members.length}
        heat={heatRows}
        moves={heatMoves}
        locale={locale}
        t={t}
      >
        {source && <DataStamp labels={t.data} source={source} at={stampAt} stale={stale} locale={locale}
          note={status.session === "pre-market" || status.session === "after-hours" ? t.data.extendedNote : undefined} />}
      </IndexHeat>

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
            {/* ÖLÇEK NOTU İKİ PANELİN DİBİNDE (6 Kasım). İki hareket
                panelinin üstünde tek başına bir satırdı; sonra ısı haritasının
                künye bandına taşınmıştı ("bant hemen altındaki iki panelin
                künyesi"). Orada üç parçalı bandın ortasında kendi panelinden
                kopuk, haritayı anlatıyormuş gibi duruyordu. Not iki panelin
                ORTAK ölçeğini söylüyor; yeri ikisinin altında, iki kolonu
                kaplayan tek satır. */}
            {/* 10 Kasım: not ölçeğin KENDİSİNİ de yazıyor ("Tam Şerit %6,93").
                "Aynı ölçek" deniyordu ama ölçeğin ne olduğu yazmıyordu; tam
                boydaki şeridin hangi yüzde olduğu artık notta, başında
                şeridin küçük bir örneğiyle. */}
            <p className={styles.movementScale}>
              <i aria-hidden />
              <span>{t.markets.movementScale}</span>
              <span className="numeral">{t.markets.movementScaleFull.replace("{pct}", formatPercentPlain(movementScale, locale))}</span>
            </p>
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
                  <Skeleton className={cn(styles.moverSkeletonBar, "h-[5px] w-full")} />
                  {contribution && <Skeleton className={cn(styles.moverSkeletonBar, "h-4 w-20")} />}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel className={styles.members}>
        <div className="flex items-center justify-between gap-4 px-5 py-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-20" /></div>
        {/* Satır boyu gerçek tabloyla aynı (10 Kasım: 46 piksel, telefonda
            48 ve ilk on beş — MembersTable.module.css); eski yer tutucu 54
            piksellik genel satırdı ve telefonda altmış satırın hepsini
            basıyordu (gerçeği on beş). */}
        <div className={styles.memberSkeleton}>
          <div />
          {Array.from({ length: rows }, (_, i) => (
            <div key={i}>
              <Skeleton className="size-7 shrink-0 rounded-md" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="ml-auto h-[5px] w-[30%] rounded-full" />
              <Skeleton className="h-3 w-14 shrink-0" />
              <Skeleton className="hidden h-3 w-14 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---- Pano yedekleri — gerekçe panoların Suspense sınırında ---- */

/** Piyasa Nabzı iskeleti: başlık + açıklama + kadran dairesi + 5 gösterge. */
function PulseSkeleton() {
  return (
    <div className={boardStyles.pulsePanel}>
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className="px-4 pb-1 sm:px-5"><Skeleton className="h-2.5 w-72 max-w-full" /></div>
      <div className={boardStyles.pulseBody}>
        <div className="flex items-center justify-center py-2"><Skeleton className="size-44 rounded-full" /></div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-2.5 w-36" />
                <Skeleton className="h-1 w-full max-w-64" />
              </div>
              <Skeleton className="h-4 w-7" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3 sm:px-5">
        <Skeleton className="h-2 w-full max-w-xl" />
        <Skeleton className="h-2 w-3/4" />
      </div>
    </div>
  );
}

/** Sektör/Emtia pano iskeleti: başlık + sütun satırı + N satır + künye. */
function BoardSkeleton({ rows, groups = 0 }: { rows: number; groups?: number }) {
  return (
    <div className={boardStyles.board}>
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="flex h-9 items-center gap-6 bg-surface-sunken px-4 sm:px-5">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="ml-auto h-2 w-10" />
        <Skeleton className="h-2 w-10" />
        <Skeleton className="h-2 w-10" />
      </div>
      <div className="flex flex-col">
        {Array.from({ length: groups }).map((_, i) => (
          <div key={`g-${i}`} className="px-4 pb-1.5 pt-3 sm:px-5"><Skeleton className="h-2 w-16" /></div>
        ))}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-t border-line-soft px-4 py-3 first:border-t-0 sm:px-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-12" />
            </div>
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3 sm:px-5">
        <Skeleton className="h-2 w-full max-w-md" />
        <Skeleton className="h-2 w-2/3" />
      </div>
    </div>
  );
}
