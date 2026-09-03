import { Fragment } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { CompareEmpty, type ComparePreset } from "@/components/markets/CompareEmpty";
import {
  CompareChartPanel,
  ComparePeriodLabel,
  ComparePeriodValue,
  CompareProvider,
  CompareRangeControl,
  CompareStrip,
  type CompareLabels,
} from "@/components/markets/CompareLive";
import {
  DataStamp,
  PageHeader,
  Panel,
} from "@/components/ui/primitives";
import { seriesColorOf } from "@/lib/chart-series";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { CompareAdd } from "@/components/markets/CompareAdd";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { getI18n } from "@/lib/i18n";
import { industryLabel, sectorLabel } from "@/lib/sectors";
import {
  COMPARE_RANGES,
  DEFAULT_COMPARE_RANGE,
  MAX_COMPARE_SYMBOLS,
  isCompareRange,
  parseCompareSymbols,
  type CompareRange,
  type CompareSeries,
} from "@/lib/compare";
import {
  cn,
  directionOf,
  directionText,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  peRatioOf,
} from "@/lib/utils";
import { pageMetadata } from "@/lib/page-meta";

/**
 * Karşılaştırma — iki ile dört hisseyi yan yana okumak.
 *
 * Ürünün geri kalanı tek bir şirketi derinlemesine gösteriyor; buradaki soru
 * farklı: "bu ikisinden hangisi". O soruya cevap veren şey tek tek metrikler
 * değil, AYNI ÖLÇEKTE görülen metriklerdir — bu yüzden sayfanın omurgası bir
 * tablo ve normalize edilmiş tek bir grafik.
 *
 * Seçim URL'de yaşıyor (?semboller=NVDA,AMD), yani paylaşılabilir ve
 * sunucuda çözülüyor.
 *
 * ARALIK ARTIK İSTEMCİDE. Sayfanın geri kalanı sunucu bileşeni olarak kaldı
 * — kotasyonlar, ölçü blokları, şirket künyeleri hep burada çözülüyor.
 * Aralığa BAĞLI olan tek şey barlar ve onlar `CompareProvider` içinde
 * yaşıyor: düğmeye basınca yüzdeler anında değişiyor, sunucuya bir daha
 * gidilmiyor. Gerekçenin tamamı `components/markets/CompareLive.tsx`te.
 *
 * Aralık listesi, sembol sınırı ve adres biçimi `lib/compare.ts`te: aynı üç
 * kural sunucu sayfası, istemci denetimi ve toplu bar ucu tarafından
 * okunuyor ve üçü ayrı liste tutamaz.
 */

/** Karşılaştırmaya hazır başlangıç setleri — boş ekranı doldurur. */
const PRESETS: readonly ComparePreset[] = [
  {
    labelKey: "presetChips",
    noteKey: "presetChipsNote",
    symbols: ["NVDA", "AMD", "AVGO", "MU"],
  },
  {
    labelKey: "presetMega",
    noteKey: "presetMegaNote",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"],
  },
  {
    labelKey: "presetIndices",
    noteKey: "presetIndicesNote",
    symbols: ["SPY", "QQQ", "DIA", "IWM"],
  },
  /* BELLEK DÖRTLÜSÜ. Öteki üç set aynı endeksin ya da aynı büyüklüğün
     içinden seçiliyor; bu set bir TEDARİK ZİNCİRİNDEN geliyor ve ekranın
     asıl sorusuna en yakın duran örnek bu — dördü de aynı talebe (yapay
     zekâ sunucularının belleği) satıyor ama biri Kore'de, biri ABD'de
     listeli ve ikisi farklı para biriminde raporluyor. Tablonun ADR
     uyarısı da (hisse başı kâr ve 52 hafta bandı ana borsanın parasında)
     ilk kez burada gerçekten devreye giriyor. */
  {
    labelKey: "presetMemory",
    noteKey: "presetMemoryNote",
    symbols: ["MU", "SNDK", "SKHY", "MRVL"],
  },
];

export const generateMetadata = pageMetadata({
  path: "/karsilastir",
  tr: {
    title: "Karşılaştır",
    description:
      "İki ya da daha fazla hisseyi aynı grafikte, aynı ölçekte karşılaştır.",
  },
  en: {
    title: "Compare",
    description:
      "Put two or more stocks on the same chart, at the same scale.",
  },
});

export default async function ComparePage(props: PageProps<"/karsilastir">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const { kept: symbols, dropped } = parseCompareSymbols(search.semboller);
  const range: CompareRange = isCompareRange(search.aralik)
    ? search.aralik
    : DEFAULT_COMPARE_RANGE;

  return (
    <div className="flex flex-col gap-5">
      {symbols.length === 0 ? (
        <>
          <PageHeader
            eyebrow={t.compare.eyebrow}
            title={t.compare.title}
            subtitle={t.compare.subtitle}
          />
          {/* Adresten düşen semboller SÖYLENİYOR: paylaşılan bir bağlantıda
              beşinci sembol sessizce yok oluyordu. */}
          {dropped.length > 0 && (
            <p className="text-small text-muted">{t.compare.trimmedNote}</p>
          )}
          <CompareEmpty presets={PRESETS} t={t} />
        </>
      ) : (
        /* BAŞLIK DA TAHTANIN İÇİNDE. Aralık denetimi sayfa başlığının sağında
           duruyor ve artık istemci durumunu okuyor: sağlayıcının ağacın
           kökünde olması gerekiyor, yani başlık da onun altında. */
        <CompareBoard symbols={symbols} range={range} dropped={dropped} />
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["degerleme", "cesitlendirme"]}
        className="pt-1"
      />
    </div>
  );
}

async function CompareBoard({
  symbols,
  range,
  dropped,
}: {
  symbols: string[];
  range: CompareRange;
  dropped: string[];
}) {
  const { locale, t } = await getI18n();
  const status = await getStatus();

  const [quotesResult, names, barsBySymbol, ...metricResults] =
    await Promise.all([
      getQuotes(symbols, status),
      getSymbolNames(symbols),
      getChartBarsMulti(symbols, range, status),
      ...symbols.map((symbol) => getKeyMetrics(symbol)),
    ]);

  const quotes = quotesResult.ok ? quotesResult.data : {};

  /* AÇILIŞ ARALIĞININ SERİLERİ SUNUCUDAN. Bunlar olmadan zincir "HTML → JS
     indir → hidrasyon → fetch → çizim" diye işlerdi ve sayfanın en büyük
     görsel öğesi gereksiz bir gidiş-dönüş kadar geç belirirdi. Aralık
     değişince istemci `/api/karsilastir`e gidiyor; ilk aralık için hiç
     çıkmıyor. */
  const initialSeries: CompareSeries[] = symbols
    .map((symbol) => {
      const bars = barsBySymbol[symbol] ?? [];
      return {
        symbol,
        closes: bars.map((bar) => bar.close),
        // İmleç kartındaki tarih için — hangi ana baktığını söylemeyen bir
        // okuma "o zaman kim öndeydi" sorusuna yarım cevap verir.
        times: bars.map((bar) => bar.time),
      };
    })
    .filter((entry) => entry.closes.length >= 2);

  /* Aralığa bağlı METİNLERİN tamamı tek nesnede: sağlayıcı bileşenden
     istemciye fonksiyon değil VERİ geçiyor. Sözlük sunucuda çözülüyor. */
  const labels: CompareLabels = {
    rangeLabel: t.compare.rangeLabel,
    ranges: Object.fromEntries(
      COMPARE_RANGES.map((key) => [key, t.chart.ranges[key]]),
    ) as CompareLabels["ranges"],
    rangeLongs: Object.fromEntries(
      COMPARE_RANGES.map((key) => [key, t.chart.rangeLabels[key]]),
    ) as CompareLabels["rangeLongs"],
    rangeAnnounce: Object.fromEntries(
      COMPARE_RANGES.map((key) => [
        key,
        t.compare.rangeAnnounce.replace("{range}", t.chart.rangeLabels[key]),
      ]),
    ) as CompareLabels["rangeAnnounce"],
    selected: t.compare.selected,
    dayShort: t.compare.dayShort,
    periodColumn: t.compare.periodColumn,
    remove: t.compare.remove,
    partialPeriod: t.compare.partialPeriod,
    chartTitle: t.compare.chartTitle,
    chartHint: t.compare.chartHint,
    chartReading: t.compare.chartReading,
    chartMissing: t.compare.chartMissing,
    chartMissingHint: t.compare.chartMissingHint,
    rangeFailed: t.compare.rangeFailed,
    rangeFailedHint: t.compare.rangeFailedHint,
    retry: t.common.retry,
    periodChange: t.compare.periodChange,
  };

  /**
   * O sütundaki şirket ana borsasında DOLAR DIŞI bir para birimiyle mi
   * işlem görüyor.
   *
   * Sağlayıcının hisse başı kâr ve 52 hafta bandı alanları ana borsanın
   * parasında geliyor; fiyat ise ADR'nin doları. Tablo ikisini aynı sütunda
   * yan yana bastığı için ayrımı bilmek zorunda. Depoda 21 sembol böyle:
   * TSM (TWD), ASML (EUR), PDD/NTES (CNY), SKHY (KRW)…
   */
  const yabanciPara = (i: number) => {
    const kod = names[symbols[i]]?.currency;
    return Boolean(kod && kod !== "USD");
  };
  const yabanciSembol = symbols.filter((_, i) => yabanciPara(i));

  /* Satırlar tek yerde tanımlı: hem geniş ekrandaki tablo hem mobildeki
     kart yığını aynı diziden besleniyor, ikisi birbirinden kayamıyor. */
  const rows: {
    /* Grup anahtarı satırın KENDİSİNDE. Önce diziyi dilimleyerek
       gruplanıyordu ve dizinin sırası değişince gruplar sessizce kaydı:
       net kâr marjı riske, beta değerlemeye düşmüştü. Anahtar satırla
       birlikte taşınırsa sıra değişse de grup doğru kalır. */
    group: "return" | "valuation" | "risk" | "company";
    /* React anahtarı ETİKETTEN AYRI: dönem getirisi satırının etiketi artık
       bir düğüm (seçili aralığı da yazan istemci bileşeni) ve bir düğüm
       anahtar olamaz. */
    key: string;
    label: React.ReactNode;
    /** Ölçünün altındaki mikro künye — cümle düzeninde. */
    caption?: string;
    value: (index: number) => React.ReactNode;
  }[] = [
    {
      group: "return",
      key: "lastPrice",
      label: t.market.lastPrice,
      value: (i) => {
        const quote = quotes[symbols[i]];
        return quote ? (
          <span className="numeral font-bold text-strong">
            {formatPrice(quote.price, locale)}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      /* ROZET DEĞİL, DÜZ SAYI — hemen altındaki dönem getirisi satırıyla aynı.
         İki gerekçe üst üste geldi. Biri tutarlılık: bu bir metrik ızgarası,
         her hücresi düz bir sayı; rozet listelerin ve şeridin afordansı ve
         yan yana duran iki getiri satırı sebepsiz yere birbirinden farklı
         görünüyordu. Öteki yer: rozetin zemini, iç dolgusu ve ok işareti
         sayının etrafına 23 piksel kabuk ekliyor ve dört sembolde tablonun
         EN GENİŞ sütununu bu satır belirliyordu — 360 pikselde yatay
         kaydırmanın tek başına en büyük sebebi oydu.
         Renk tek taşıyıcı değil: `formatPercent` artı/eksi işaretini
         kendisi yazıyor, yani yön renk körlüğünde de okunuyor. */
      group: "return",
      key: "dayChange",
      label: t.compare.dayChange,
      value: (i) => {
        const quote = quotes[symbols[i]];
        if (!quote) return "—";
        return (
          <span
            className={cn(
              "numeral font-semibold",
              directionText(directionOf(quote.changePct)),
            )}
          >
            {formatPercent(quote.changePct, locale)}
          </span>
        );
      },
    },
    {
      /* SATIRIN TAMAMI İSTEMCİDE — tablonun tek aralığa bağlı satırı bu.
         Etiket seçili aralığın uzun adını da yazıyor ("Son 6 Ay"): "Dönem
         Getirisi" tek başına hangi pencereye baktığını söylemiyordu ve
         cevabı ekranın öteki ucundaki düğmedeydi. Değer, sembol şeridinde
         okunan sayıyla AYNI kaynaktan geliyor (`lib/compare.ts` →
         `periodChangePct`); iki yerde duran bir sayının iki hesaptan
         çıkması bu depoda bir kez hata olarak yaşandı. */
      group: "return",
      key: "periodChange",
      label: <ComparePeriodLabel labels={labels} />,
      value: (i) => <ComparePeriodValue symbol={symbols[i]} />,
    },
    {
      group: "valuation",
      key: "marketCap",
      label: t.market.marketCap,
      value: (i) => {
        /* CANLI hesap — sağlayıcının `marketCap` alanı profil çekildiği anın
           fotoğrafı ve profil ~29 günde bir tazeleniyor. Aynı şirket bu
           tabloda ve /piyasalar'da iki farklı değerle görünüyordu; tablonun
           kendi fiyat satırı zaten canlı, piyasa değeri de ondan kurulmalı.
           Kural tek yerde: lib/data.ts → liveMarketCap */
        const cap = liveMarketCap(
          names[symbols[i]],
          quotes[symbols[i]]?.price,
        );
        return formatMoneyCompact(cap, locale);
      },
    },
    {
      group: "valuation",
      key: "peRatio",
      label: t.stock.peRatio,
      /* Oran, tablonun kendi fiyat satırından kuruluyor. Sağlayıcının hazır
         F/K'si geriden gelen bir fiyatla hesaplanmış oluyor; karşılaştırma
         tablosunda bu, iki şirketi farklı anların fiyatıyla yan yana koymak
         demekti. Gerekçenin tamamı `peRatioOf`'ta. */
      /* ...AMA yalnızca fiyat ve kâr AYNI PARA BİRİMİNDEYSE. ADR'de fiyat
         dolar, hisse başı kâr ana borsanın parası ve bölüm anlamsız bir sayı
         veriyordu: tabloda TSM'nin F/K'si 4,80 çıkıyor, AAPL 35,50 iken TSM
         yedi kat ucuz görünüyordu. USD dışında sağlayıcının kendi oranı
         kullanılıyor — o oran ana borsanın içinde kurulduğu için birimsiz ve
         tutarlı (TSM'de 27,87). */
      value: (i) => {
        const metrics = metricResults[i];
        if (!metrics?.ok) return "—";
        return formatPrice(
          yabanciPara(i)
            ? metrics.data.peRatio
            : peRatioOf(quotes[symbols[i]]?.price, metrics.data.eps),
          locale,
        );
      },
    },
    {
      group: "valuation",
      key: "dividend",
      label: t.stock.dividend,
      value: (i) => {
        const metrics = metricResults[i];
        /* Yüzde işareti elle BAŞA konuyordu: İngilizce tarafta "%0.46"
           çıkıyordu, oysa orada sayıdan sonra gelir. İşaretin yeri dile
           bağlı ve o kural tek yerde: lib/utils.ts → withPercent. */
        /* SIFIR İLE BİLİNMİYOR AYRI ŞEY. "Temettü ödemiyor" bir bilgi,
           "veri gelmedi" bilgisizlik; ikisi de aynı tireye düşüyordu. */
        if (!metrics?.ok || metrics.data.dividendYield === null) return "—";
        return metrics.data.dividendYield === 0
          ? t.compare.dividendNone
          : formatPercentPlain(metrics.data.dividendYield, locale, 2);
      },
    },
    {
      group: "risk",
      key: "beta",
      label: t.stock.beta,
      value: (i) => {
        const metrics = metricResults[i];
        return metrics?.ok && metrics.data.beta !== null
          ? formatPrice(metrics.data.beta, locale)
          : "—";
      },
    },
    {
      group: "risk",
      key: "range52",
      label: t.compare.range52,
      value: (i) => {
        const metrics = metricResults[i];
        if (!metrics?.ok || metrics.data.low52 === null || metrics.data.high52 === null)
          return "—";
        /* Bant da ana borsanın parasında: ASML'de fiyat satırı "1.763,39"
           (dolar) derken bant "611,80 — 1.741,00" (euro) yazıyordu, yani
           hisse kendi 52 haftalık zirvesinin ÜSTÜNDE duruyor gibi
           görünüyordu. Kod yazılınca ikisinin farklı ölçüler olduğu
           okunuyor. */
        const kod = names[symbols[i]]?.currency;
        const opts = { currency: kod ?? true } as const;
        /* PARA BİRİMİ BİR KEZ, TİRE ALT SINIRA YAPIŞIK.
           Bant dar sütunda satır atlıyordu ve kırılma noktası tirenin iki
           yanındaki boşluklardı: 360 pikselde hücre "164,07 $" / "—" /
           "236,54 $" diye ÜÇ satıra bölünüyor, ortadaki satırda tek başına
           bir tire kalıyordu. İki düzeltme birden: simge tek bir aralığın
           iki ucunda iki kez yazılmasına gerek olmadığı için yalnızca üst
           sınırda duruyor (yabancı borsa kodu da orada görünüyor), ve tire
           alt sınıra bağlantısız boşlukla bağlı — artık tek başına satıra
           düşemiyor. */
        return (
          <span className="numeral text-small text-body">
            {formatPrice(metrics.data.low52, locale)} —{" "}
            {formatPrice(metrics.data.high52, locale, opts)}
          </span>
        );
      },
    },
    {
      /* AYNI İSTEKTEN GELİYOR: `getKeyMetrics` bu alanı zaten döndürüyordu
         (`netProfitMarginTTM`) ve sunum katmanı onu atıyordu. Değerleme
         karşılaştırmasında F/K'nin yanında duracak ölçü bu. */
      group: "valuation",
      key: "netMargin",
      label: t.compare.netMargin,
      caption: t.analysis.trailing12m,
      value: (i) => {
        const metrics = metricResults[i];
        return metrics?.ok && metrics.data.netMarginPct !== null
          ? formatPercentPlain(metrics.data.netMarginPct, locale, 1)
          : "—";
      },
    },
    {
      /* SEKTÖR GICS'TEN. Sağlayıcının serbest metni aynı şirkete iki ekranda
         iki farklı ad veriyordu; `/sirketler` GICS'i tercih ediyor, bu ekran
         tek kalmıştı. Alan aynı sorgudan geliyor, ek gidiş-dönüş yok. */
      group: "company",
      key: "sector",
      label: t.compare.sector,
      value: (i) => sectorLabel(names[symbols[i]]?.sector, locale) ?? "—",
    },
    {
      group: "company",
      key: "industry",
      label: t.stock.industry,
      value: (i) =>
        industryLabel(names[symbols[i]]?.industry, locale) ?? "—",
    },
  ];

  /* SATIRLAR ÜÇ ÖBEKTE. On iki satır düz bir liste hâlinde akıyordu ve
     okuyucu "getiri mi bakıyorum, değerleme mi" diye ayırt edemiyordu.
     Öbek başlığı bir kutu değil, bir ton basamağı ve tek hairline —
     kart içinde ikinci kutu yok. */
  const groups = (
    [
      ["return", t.compare.groupReturn],
      ["valuation", t.compare.groupValuation],
      ["risk", t.compare.groupRisk],
      ["company", t.compare.groupCompany],
    ] as const
  )
    .map(([key, label]) => ({
      key,
      label,
      rows: rows.filter((row) => row.group === key),
    }))
    .filter((group) => group.rows.length > 0);

  /* Ölçü bloğu çöken semboller — beş satır birden sessizce tireye
     düşüyordu. */
  const olcusuz = symbols.filter((_, i) => !metricResults[i]?.ok);
  /* Hiçbir kaynaktan veri gelmeyen sembol: `?semboller=ZZZZ` doğrulamayı
     geçiyor ve sütun baştan sona tire doluyordu. */
  const bilinmeyen = symbols.filter(
    (sym) =>
      !names[sym] && !quotes[sym] && (barsBySymbol[sym]?.length ?? 0) === 0,
  );

  return (
    <CompareProvider
      /* SEMBOL LİSTESİ DEĞİŞİNCE SAĞLAYICI YENİDEN KURULUYOR. Sembol
         eklemek/çıkarmak gerçek bir gezinme ve sunucu yeni listenin
         serilerini zaten gönderiyor; `key` olmasaydı React aynı örneği
         korur, tembel `useState` başlatıcıları yeniden koşmaz ve ekran
         elindeki veriyi bırakıp aynı şeyi bir de istemciden isterdi. */
      key={symbols.join(",")}
      symbols={symbols}
      initialRange={range}
      initialSeries={initialSeries}
      locale={locale}
      announce={labels.rangeAnnounce}
    >
      {/* ARALIK DENETİMİ SAYFANIN DENETİMİ. Grafik panelinin başlığındaydı
          ve orada yalnızca grafiği yönetiyormuş gibi duruyordu; oysa şeritteki
          ve tablodaki dönem getirisi de bu aralıktan çıkıyor. Dar ekranda
          altı düğme sığmazsa ray bölünmek yerine kayıyor.
          Etiketler artık sözlükten: düğmelerin içine ham anahtar
          basılıyordu ve Türkçe ekranda "1M · 3M · 6M · YTD" yazıyordu, oysa
          hisse sayfasının aynı denetimi yıllardır "1A · 3A · 6A · YBB"
          diyor — aynı ürün, iki dil. */}
      <PageHeader
        eyebrow={t.compare.eyebrow}
        title={t.compare.title}
        subtitle={t.compare.subtitle}
        action={<CompareRangeControl labels={labels} />}
      />

      {/* Adresten düşen semboller SÖYLENİYOR: paylaşılan bir bağlantıda
          beşinci sembol sessizce yok oluyordu. */}
      {dropped.length > 0 && (
        <p className="text-small text-muted">{t.compare.trimmedNote}</p>
      )}

      {/* ---- Sembol şeridi ----
           Gerekçesi `components/markets/CompareLive.tsx`te: renk anahtarı,
           şirket adı ve ARALIĞIN SÜRDÜĞÜ yüzde burada. */}
      <CompareStrip
        rows={symbols.map((symbol) => ({
          symbol,
          name: names[symbol]?.name ?? null,
          logoUrl: names[symbol]?.logoUrl ?? null,
          changePct: quotes[symbol]?.changePct ?? null,
        }))}
        labels={labels}
      >
        {symbols.length < MAX_COMPARE_SYMBOLS ? (
          /* EKLEME YOLU EKRANIN İÇİNDE. Burada yalnızca "bir hisse
             sayfasından Karşılaştır'a bas" yazan bir cümle vardı: dörtten
             üçe düşen kullanıcı dördüncüyü geri koyamıyordu. */
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
            <CompareAdd
              symbols={symbols}
              rangeParam={range === DEFAULT_COMPARE_RANGE ? null : range}
              labels={{
                add: t.compare.addSymbol,
                placeholder: t.compare.addPlaceholder,
                cancel: t.common.cancel,
                noResults: t.stock.notFound,
                searching: t.common.loading,
                searchFailed: t.common.error,
              }}
            />
            {symbols.length === 1 && (
              /* Tek seri kendi başlangıcına normalize edilmiş tek bir çizgi;
                 ekran bunu söylemeden okuyucuyu bekletiyordu. */
              <span className="min-w-0 flex-1 text-small text-muted">
                {t.compare.secondSymbolHint}
              </span>
            )}
          </div>
        ) : (
          /* Dörtte ekleme çipi tümüyle kayboluyordu ve neden kaybolduğu
             hiçbir yerde yazmıyordu. */
          <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {t.compare.fullHint}
          </p>
        )}
      </CompareStrip>

      {/* ---- Normalize grafik ---- */}
      <CompareChartPanel labels={labels} />

      {/* ---- Metrik tablosu ----
           ETİKET SÜTUNU SABİT. 390 pikselde panel ~352 piksel, etiket 104,
           kalan 248 piksel dört sütuna bölünüyor — kaydırma kaçınılmaz. Ama
           kaydırırken etiket de kayıp gidiyordu ve okuyucu "bu satır neydi"
           diye başa dönmek zorunda kalıyordu. Zemin `--panel-fixed`, çünkü
           `--surface-solid` koyu temada saydam ve altından kayan sayılar
           etiketin içinden okunuyordu.
           Kap klavyeyle odaklanabilir (WCAG 2.1.1) ve `scroll-x-hint`
           "devamı var" işaretini geri getiriyor — deponun dört yerdeki
           yerleşik kalıbı. */}
      <Panel>
        <div
          className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
          tabIndex={0}
          role="region"
          aria-label={t.compare.tableRegion}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-nano uppercase tracking-wider text-muted">
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-[104px] bg-(--panel-fixed) px-2.5 py-2.5 font-medium sm:w-[168px] sm:px-4 md:px-5"
                >
                  {t.compare.metric}
                </th>
                {symbols.map((symbol) => (
                  <th
                    key={symbol}
                    scope="col"
                    className="px-1 py-2.5 text-right sm:px-2.5 md:px-4"
                  >
                    <span className="numeral block text-tiny font-bold tracking-normal text-strong">
                      {symbol}
                    </span>
                    {names[symbol]?.name && (
                      /* `ml-auto`: blok kutusu `max-w` ile daraldığı için
                         `text-right` onu sağa yaslamıyor — hücrede sola
                         kayıp sembolün altından çıkıyordu.
                         ŞİRKET ADI DAR EKRANDA BAŞLIKTA YOK. Tablo dört
                         sembolde 531 piksel istiyordu ve 360 pikselde kaba
                         322 piksel kalıyor: yatay kaydırma kaçınılmazdı.
                         Genişliği isteyen sayılar değil ADLARDI —
                         "Advanced Micro Devices Inc" tek başına 153
                         piksellik bir sütun açıyordu, oysa aynı ad hemen
                         yukarıdaki şeritte her sembolün yanında duruyor.
                         Adlar inince dört sütun kaydırmasız sığıyor. */
                      <span className="ml-auto hidden max-w-[9rem] truncate text-nano font-normal normal-case tracking-normal text-muted sm:block">
                        {names[symbol].name}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {groups.map((group) => (
                <Fragment key={group.label}>
                  {/* ŞİRKET GRUBU DAR EKRANDA TABLODAN İNİYOR (aşağıdaki
                      künyeye). Sektör ve alt sektör sayı değil, birer AD:
                      sütunlar arasında karşılaştırılmıyor, şirket şirket
                      okunuyor. Dört sütuna bölününce her birine ~50 piksel
                      düşüyor ve "Bilgi Teknolojileri" kelime ortasından
                      kırılıyordu ("Teknolojil / eri"). Geniş ekranda yer var,
                      orada tablodaki yerinde duruyor. */}
                  <tr className={cn(group.key === "company" && "hidden sm:table-row")}>
                    <th
                      scope="colgroup"
                      colSpan={symbols.length + 1}
                      className="bg-surface px-2.5 py-1.5 text-left sm:px-4 md:px-5"
                    >
                      <span className="plate sticky left-0 text-nano tracking-[0.09em]">
                        {group.label}
                      </span>
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row.key}
                      className={cn(
                        group.key === "company" && "hidden sm:table-row",
                      )}
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-(--panel-fixed) px-2.5 py-2.5 text-left text-small font-medium text-muted sm:px-4 md:px-5"
                      >
                        {row.label}
                        {row.caption && (
                          <span className="block text-nano leading-tight text-muted">
                            {row.caption}
                          </span>
                        )}
                      </th>
                      {symbols.map((symbol, index) => (
                        <td
                          key={symbol}
                          /* DAR EKRANDA DOLGU 4 PİKSEL. Dört sembolde tablo
                             360 pikselde 437 piksel istiyordu ve kabına 322
                             kalıyor. Dolgu sütun başına 20 piksel yiyordu —
                             beş sütunda 100 piksel, yani taşmanın yaklaşık
                             yarısı. Nefes payı iki basamakta geri geliyor:
                             tam `sm`de (640px) şirket satırları da tabloya
                             döndüğü için eski dolguya bir anda çıkmak beş
                             piksellik bir kaydırma bırakıyordu. */
                          className="px-1 py-2.5 text-right text-base text-body sm:px-2.5 md:px-4"
                        >
                          {row.value(index)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Şirket künyesi — YALNIZCA DAR EKRANDA ----
             Tablodan inen sektör ve alt sektör satırlarının karşılığı.
             Dört sütuna bölünmüş bir metin ızgarası yerine şirket şirket
             okunan tek satırlık künyeler: kelime ortadan kırılmıyor, renk
             anahtarı grafikle aynı ve satır tablonun genişliğiyle
             yarışmıyor. */}
        <div className="border-t border-line sm:hidden">
          <p className="plate px-4 pb-1 pt-3 text-nano tracking-[0.09em]">
            {t.compare.groupCompany}
          </p>
          <ul className="pb-3">
            {symbols.map((symbol) => {
              const sektor = sectorLabel(names[symbol]?.sector, locale);
              const sanayi = industryLabel(names[symbol]?.industry, locale);
              return (
                <li
                  key={symbol}
                  className="flex items-baseline gap-2 px-4 py-1"
                >
                  <span
                    aria-hidden
                    className="h-3 w-[3px] shrink-0 translate-y-[2px] rounded-full"
                    style={{ background: seriesColorOf(symbols, symbol) }}
                  />
                  <span className="numeral shrink-0 text-tiny font-bold text-strong">
                    {symbol}
                  </span>
                  <span className="min-w-0 flex-1 text-tiny leading-snug text-muted">
                    {[sektor, sanayi].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Eksik veri SESSİZ KALMIYOR. Üç ayrı hâl, üç ayrı cümle; hepsi
            aynı hairline künye kalıbında, yeni kutu açmadan. */}
        {bilinmeyen.length > 0 && (
          <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {t.compare.unknownSymbols.replace("{symbols}", bilinmeyen.join(", "))}
          </p>
        )}
        {olcusuz.length > 0 && (
          <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {t.compare.metricsUnavailable.replace(
              "{symbols}",
              olcusuz.join(", "),
            )}
          </p>
        )}
        {!quotesResult.ok && (
          <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {t.compare.quotesUnavailable}
          </p>
        )}
        {/* USD dışı sembol varsa sebebi tablonun altında yazıyor — yoksa
            okuyucu dolar fiyatıyla ana borsa bandını yan yana koyup birini
            yanlış okuyor. */}
        {yabanciSembol.length > 0 && (
          <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {t.compare.homeCurrencyNote
              .replace("{symbols}", yabanciSembol.join(", "))
              .replace(
                "{codes}",
                [
                  ...new Set(
                    yabanciSembol.map((sym) => names[sym]?.currency ?? "?"),
                  ),
                ].join(", "),
              )}
          </p>
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
    </CompareProvider>
  );
}
