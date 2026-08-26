import { Suspense } from "react";
import { FearGauge } from "@/components/markets/FearGauge";
import { GuideHint } from "@/components/article/GuideHint";
import Link from "next/link";
import {
  ChangePill,
  DataStamp,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  PanelLink,
  PercentReading,
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
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import type { MarketStatus } from "@/lib/market-hours";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  directionOf,
  directionText,
  SIGN_GAP,
  formatMoneyCompact,
  formatEtDateShort,
  formatPercent,
  formatPercentPlain,
  formatPrice,
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
      "Endeksler, tahvil faizleri ve gün içi hareket — ABD piyasasının nabzı.",
  },
  en: {
    title: "Markets",
    description:
      "Indices, bond yields and intraday moves — the pulse of the US market.",
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
const YIELD_SERIES = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin", labelKey: "yieldY5" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin", labelKey: "yieldY30" },
] as const;

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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={locale === "tr" ? "ABD Piyasası" : "US Market"}
        title={t.markets.title}
        subtitle={t.markets.subtitle}
      />

      {/* KABUK ÖNCE AKAR. `IndexCards` ve `IndexDetail` doğrudan gövdede
          await ediliyordu ve S&P 500 sekmesinde `IndexDetail` 499 sembol için
          kotasyon + ad çekiyor; o tur bitene kadar sayfa başlığı, tahvil
          şeridi ve sekme çubuğu dahil HİÇBİR ŞEY görünmüyordu. Sekmeye
          basan okuyucu yalnızca sekmenin yeniden çizilmesi için tam turu
          bekliyordu. Aynı düzeltme /sirketler'de zaten yapılmış (orada
          gerekçesi yorumla yazılı); burası atlanmıştı.

          `key`: sekme ya da sıralama değişince Suspense yeni bir sınır
          sayıyor ve iskelet tekrar görünüyor — yoksa React eski içeriği
          ekranda tutup sessizce bekletiyor. */}
      <Suspense
        key={`cards:${tab}:${sort}:${dir}`}
        /* Ölçülmüş yükseklikler, tahmin değil: kartlar mobilde alt alta
            (3 × 152 + 2 × 12 boşluk = 480), `sm`den itibaren tek sıra (152).
            Yedek 132px'ti; mobilde 348 piksellik bir sıçrama demekti ve
            sıçrama ekranın TA TEPESİNDE oluyordu. */
        fallback={
          <Skeleton className="h-[480px] w-full rounded-xl sm:h-[152px]" />
        }
      >
        <IndexCards activeTab={tab} sort={sort} dir={dir} locale={locale} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <YieldStrip locale={locale} t={t} />
        {/* SUSPENSE YOK — bilerek.
            Burada `fallback={null}` ile bir sınır vardı ve iki yönden de
            zarardı. Kazancı sıfır: kardeşi `YieldStrip` de FRED'den besleniyor
            ve o askıya alınmamış, yani sayfa FRED turunu ZATEN bekliyor.
            Maliyeti gerçek: boş yedek sıfır yer kaplıyor, kart akışla gelince
            mobilde 262 piksel açılıp altındaki her şeyi aşağı itiyordu —
            ölçüldü, /piyasalar'ın mobil CLS'i 0,206 çıkıyordu (Google'ın
            "kötü" eşiği 0,1). */}
        <FearGauge
            locale={locale}
            labels={{
              title: t.markets.fearTitle,
              hint: t.markets.fearHint,
              average: t.markets.fearAverage,
              guideCta: t.markets.fearGuideCta,
              bands: {
                calm: t.markets.fearCalm,
                normal: t.markets.fearNormal,
                tense: t.markets.fearTense,
                fear: t.markets.fearHigh,
                panic: t.markets.fearPanic,
              },
            }}
          />
      </div>

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
        fallback={
          <DetailSkeleton rows={Math.min(active.members.length, limit)} />
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

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["endeks", "faiz-tahvil"]}
        className="pt-1"
      />
    </div>
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
}: {
  activeTab: TabKey;
  sort: SortKey;
  dir: SortDir;
  locale: Locale;
}) {
  const status = await getStatus();
  const proxies = INDEX_TABS.map((entry) => entry.proxy);
  const [quotesResult, bars] = await Promise.all([
    getQuotes([...proxies], status),
    getChartBarsMulti([...proxies], "1D", status),
  ]);

  if (!quotesResult.ok) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {INDEX_TABS.map((entry) => {
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
            className="group"
          >
            <Panel
              className={cn(
                "panel-hover flex h-full flex-col p-4",
                selected && "border-primary-faint bg-primary-tint",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-strong">{entry.label}</p>
                <p className="numeral text-nano text-muted">{entry.proxy}</p>
              </div>
              {quote ? (
                <>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <p className="tote text-heading">
                      {formatPrice(quote.price, locale)}
                    </p>
                    <p
                      className={cn(
                        "numeral text-base font-bold",
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
                      title={`${entry.label} · 1G`}
                      tone={tone}
                      height={44}
                      showLastDot={false}
                      strokeWidth={1.6}
                      className="mt-3 h-11 w-full opacity-90"
                    />
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-muted">—</p>
              )}
            </Panel>
          </Link>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Tahvil faizleri ve getiri eğrisi
   ========================================================================== */

async function YieldStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const results = await Promise.all(
    YIELD_SERIES.map((series) => getSeries(series, 10)),
  );

  const values = YIELD_SERIES.map((series, index) => {
    const result = results[index];
    return {
      key: series.slug,
      label: t.markets[series.labelKey],
      latest: result.ok ? result.data.latestValue : null,
      prev: result.ok ? result.data.prevValue : null,
      date: result.ok ? (result.data.observations.at(-1)?.date ?? null) : null,
    };
  });

  if (values.every((v) => v.latest === null)) return null;

  const y2 = values[0].latest;
  const y10 = values[2].latest;
  const spread = y2 !== null && y10 !== null ? y10 - y2 : null;
  const inverted = spread !== null && spread < 0;

  return (
    <Panel>
      {/* Plaka başlık — ölçü paneli. Rol ayrımının gerekçesi
          components/ui/primitives.tsx → PanelHeader içinde; ana sayfadaki
          tahvil kartı da aynı tonu taşıyor, aynı sayılar aynı görünsün. */}
      <PanelHeader title={t.markets.yields} tone="plate" />

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-line-soft sm:p-0">
        {values.map((value) => {
          const delta =
            value.latest !== null && value.prev !== null
              ? value.latest - value.prev
              : null;
          return (
            /* Dikey dolgu bir kademe dar (sm:py-3). Bu iki kart yan yana
               duruyor ve ikisi birden sayfanın ilk ekranını yiyordu; altında
               piyasa genişliği ve gün içi hareket var, onlar daha yukarıdan
               başlamalı. Bilgi kaybı yok, yalnızca boşluk. */
            <div key={value.key} className="rounded-lg border border-line bg-surface px-3.5 py-3 text-center sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 sm:py-3">
              {/* SÜTUN ORTALANMIŞ. Etiket, sayı ve değişim sola dayalıydı ve
                  üçü de farklı genişlikte olduğu için sağ kenarları tırtıklı
                  bir merdiven çiziyordu: dört sütun yan yana durunca kart
                  hizasız görünüyordu. Ortalanınca üçü tek bir eksende
                  yığılıyor. */}
              <p className="text-nano font-semibold uppercase tracking-[0.08em] text-muted">
                {value.label}
              </p>
              {/* İşaretin yeri dile bağlı; kural tek yerde (primitives →
                  PercentReading). Burada koşulsuz SONA konuyordu ve Türkçe
                  ekranda "4,19 %" çıkıyordu — aynı sayı ana sayfada "%4,19"
                  diyordu. */}
              <PercentReading
                value={value.latest}
                locale={locale}
                className="tote mt-0.5 block text-xl sm:text-2xl"
                signClassName="mx-1 text-sm text-soft"
              />
              {delta !== null && Math.abs(delta) > 0.001 && (
                <p
                  className={cn(
                    /* Değişim bir kademe büyük (11 → 12): sütunun taşıdığı
                       ikinci bilgi bu ve künye puntosunda kalınca seviyenin
                       altında kayboluyordu. */
                    "numeral mt-0.5 text-small font-semibold",
                    delta > 0 ? "text-up" : "text-down",
                  )}
                >
                  {delta > 0 ? "▲" : "▼"} {formatPrice(Math.abs(delta), locale)}{" "}
                  {t.markets.point}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Getiri eğrisi — sayının ne anlama geldiği burada yazar */}
      {spread !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft px-4 py-2.5 sm:px-5">
          <span className="text-xs font-semibold text-strong">
            {t.markets.curveTitle}
          </span>
          <span
            className={cn(
              "numeral rounded-full px-2.5 py-1 text-xs font-bold",
              inverted ? "bg-down-wash text-down" : "bg-up-wash text-up",
            )}
          >
            {spread >= 0 ? "+" : "−"}
            {formatPrice(Math.abs(spread), locale)} {t.markets.point}
          </span>
          <span className="text-xs text-soft">
            {inverted ? t.markets.curveInverted : t.markets.curveNormal}
          </span>
          <span className="basis-full text-tiny leading-[17px] text-muted">
            {t.markets.curveHint}
          </span>
        </div>
      )}

      {values[0].date && (
        <p className="border-t border-line-soft px-4 py-2 text-nano text-muted sm:px-5">
          FRED · {formatEtDateShort(values[0].date, locale)}
        </p>
      )}
    </Panel>
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

  const byChange = [...withQuote].sort(
    (a, b) => (b.quote!.changePct ?? 0) - (a.quote!.changePct ?? 0),
  );
  const gainers = byChange.slice(0, 5);
  const losers = [...byChange].reverse().slice(0, 5);

  return (
    <>
      <IndexToolbar
        tab={tab}
        proxy={proxy}
        proxyQuote={proxyResult.ok ? (proxyResult.data[proxy] ?? null) : null}
        advancing={advancing}
        declining={declining}
        flat={flat}
        total={withChange.length}
        locale={locale}
        t={t}
      />

      {withQuote.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Künye SEÇKİNİN PAYDASINI söylüyor: "Günün En Çok Artanları"
                beş satır basıyor ama hangi kümenin beşi olduğunu yazmıyordu.
                Endeks 102 şirketse "102 şirketin 5 tanesi" — aynı kalıp
                bileşen tablosunda ve ana sayfadaki bilanço panelinde de var. */}
            <MoverPanel
              title={t.markets.topGainers}
              rows={gainers}
              showContribution={divisor !== null}
              contributionLabel={t.markets.contribution}
              locale={locale}
              t={t}
              meta={t.companies.showing
                .replace("{n}", String(gainers.length))
                .replace("{total}", String(withQuote.length))}
            />
            <MoverPanel
              title={t.markets.topLosers}
              rows={losers}
              showContribution={divisor !== null}
              contributionLabel={t.markets.contribution}
              locale={locale}
              t={t}
              meta={t.companies.showing
                .replace("{n}", String(losers.length))
                .replace("{total}", String(withQuote.length))}
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
   yüksekliği harcıyor, birleşince seçimin karşılığı hemen altında okunuyor. */

function IndexToolbar({
  tab,
  proxy,
  proxyQuote,
  advancing,
  declining,
  flat,
  total,
  locale,
  t,
}: {
  tab: TabKey;
  proxy: string;
  proxyQuote: Quote | null;
  advancing: number;
  declining: number;
  flat: number;
  total: number;
  locale: Locale;
  t: Dictionary;
}) {
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-3 sm:px-5">
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
        <span className="numeral ml-auto text-nano text-muted">
          {t.markets.asOf}: {formatEtDateShort(INDEX_COMPOSITION_DATE, locale)}
        </span>
      </div>

      {/* SEÇİLİ ENDEKSİN KENDİ GÜNÜ. Çubuk "kaç şirket artıda" diyor ama
          endeksin kendisinin ne yaptığını söylemiyordu: bir endeks üyelerinin
          çoğu düşerken de yükselebiliyor (birkaç ağır şirket taşırsa) ve
          okuyucu o farkı ancak sayfanın en üstündeki karta geri dönüp
          görebiliyordu. Sayı seçimin hemen altında, genişliğin hemen üstünde.
          Kaynak: endeksi izleyen fonun kotasyonu — hangi fon olduğu yazılı,
          çünkü gösterilen endeksin kendisi değil onu izleyen fon. */}
      {proxyQuote && proxyQuote.changePct !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft px-4 py-2.5 sm:px-5">
          <span className="text-small font-semibold text-strong">
            {INDEX_TABS.find((entry) => entry.key === tab)?.label}
          </span>
          <ChangePill changePct={proxyQuote.changePct} locale={locale} />
          <span className="numeral text-tiny text-muted">
            {proxy} · {formatPrice(proxyQuote.price, locale, { currency: true })}
          </span>
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-line-soft px-4 py-3.5 sm:px-5">
          <h2 className="flex items-baseline gap-2 text-base font-bold tracking-tight text-strong">
            {t.markets.breadth}
            {/* Oran etiketin yanında: çubuğun kesin karşılığı burada okunur,
                eskiden altta ayrı bir cümleydi. */}
            <span className="numeral text-base font-bold text-up">
              {formatPercentPlain(pct(advancing), locale, 0)}
            </span>
          </h2>

          {/* Çubuk satırın esneyen parçası: dar ekranda kırılıp tam genişliğe
              geçsin diye taban genişliği var. */}
          <div className="flex h-2.5 min-w-[180px] flex-1 gap-px overflow-hidden rounded-full bg-surface-sunken">
            {advancing > 0 && (
              <span className="bg-up" style={{ width: `${pct(advancing)}%` }} />
            )}
            {flat > 0 && (
              <span className="bg-flat/50" style={{ width: `${pct(flat)}%` }} />
            )}
            {declining > 0 && (
              <span className="bg-down" style={{ width: `${pct(declining)}%` }} />
            )}
          </div>

          <p className="numeral text-small text-muted">
            <span className="font-semibold text-up">{advancing}</span>{" "}
            {t.markets.advancing}
            <span aria-hidden className="mx-1.5">
              ·
            </span>
            <span className="font-semibold text-down">{declining}</span>{" "}
            {t.markets.declining}
            {flat > 0 && (
              <>
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                <span className="font-semibold text-soft">{flat}</span>{" "}
                {t.markets.unchanged}
              </>
            )}
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ---- En çok artan / düşen kartları ---- */

function MoverPanel({
  title,
  rows,
  showContribution,
  contributionLabel,
  locale,
  t,
  meta,
}: {
  title: string;
  rows: Row[];
  showContribution: boolean;
  contributionLabel: string;
  locale: Locale;
  t: Dictionary;
  /** Başlığın yanındaki künye — kaç şirketten seçildiği. */
  meta?: string;
}) {
  if (rows.length === 0) return null;

  const peak = Math.max(
    ...rows.map((row) => Math.abs(row.quote?.changePct ?? 0)),
    0.01,
  );

  return (
    <Panel>
      {/* KARŞILAŞTIRMAYA GİDEN YOL. Ekran gezinmede görünmüyor ve siteye
          girenin çoğu varlığını bilmiyordu; oysa "günün en çok artan beşi"
          listesi, karşılaştırmanın en doğal başlangıcı. Liste sabit değil,
          o anki sıralamadan türüyor. */}
      <PanelHeader
        title={title}
        meta={meta}
        action={
          rows.length >= 2 ? (
            <PanelLink
              href={`/karsilastir?semboller=${rows
                .slice(0, 4)
                .map((row) => row.member.symbol)
                .join(",")}`}
            >
              {t.compare.compareFirstFour}
            </PanelLink>
          ) : undefined
        }
      />
      <ul className="divide-y divide-line-soft">
        {rows.map((row) => {
          const changePct = row.quote?.changePct ?? 0;
          const width = Math.max((Math.abs(changePct) / peak) * 100, 4);
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
                className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className="shrink-0 text-base font-bold text-strong">
                      {row.member.symbol}
                    </span>
                    <span className="min-w-0 truncate text-tiny text-muted">
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

                {/* Görsel oran çubuğu — grubun en büyüğüne göre ölçekli */}
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "h-[5px] rounded-full",
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

  return (
    <Panel>
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
      <div
        className="scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
        tabIndex={0}
        role="region"
        aria-label={t.markets.constituents}
      >
        <table className="w-full text-sm sm:min-w-[680px]">
          <thead>
            <tr className="border-b border-line text-left text-nano uppercase tracking-[0.08em] text-muted">
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
                label={t.companies.price}
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
          <tbody className="divide-y divide-line-soft">
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
                        <span className="block max-w-[104px] truncate text-tiny leading-[15px] text-muted sm:max-w-none">
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
                        {quote ? formatPercent(quote.changePct, locale) : "—"}
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
                                  : `${Math.max(
                                      (Math.abs(quote.changePct) / peakChange) * 100,
                                      6,
                                    )}%`,
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
                      {quote ? formatPrice(quote.price, locale) : "—"}
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
                      : "—"}
                  </td>
                  {showContribution && (
                    <td className="numeral hidden px-3 py-2 text-right text-soft sm:table-cell sm:pr-5">
                      {row.contribution !== null
                        ? approxPoints(row.contribution, locale)
                        : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
 * Suspense sınırı ÜÇ kardeşi birden kapsıyor — genişlik şeridi, artan/azalan
 * panelleri ve bileşen tablosu — ama yedeği yalnızca tabloyu taklit ediyordu.
 * Ölçüldü: sekme değiştiren okuyucunun altında sayfa 7301 pikselden 3183'e
 * çöküyor, yarım saniye sonra geri açılıyordu. Yalnızca tablo taklit
 * edilince çöküş 1237 piksele indi; eksik kalan 890 piksel tam olarak o iki
 * bloktu.
 *
 * Yer tutucular yükseklikle değil YAPIYLA eşleşiyor: aynı dolgu, aynı satır
 * düzeni, aynı ızgara. Böylece içerik uzayıp kısaldıkça iskelet de onunla
 * birlikte kayıyor ve elle ayarlanmış piksel sayıları eskimiyor.
 */
function DetailSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {/* Genişlik şeridi */}
      <Panel>
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-2.5 flex-1" />
        </div>
      </Panel>

      {/* Artanlar / azalanlar — beşer satır */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((panel) => (
          <Panel key={panel}>
            <div className="flex items-center justify-between px-4 py-4 sm:px-5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <div className="flex flex-col gap-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </Panel>
        ))}
      </div>

      {/* Bileşen tablosu */}
      <Panel>
        <div className="flex flex-col gap-px">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </Panel>
    </>
  );
}
