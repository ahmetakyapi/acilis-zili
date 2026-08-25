import { Fragment } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { CompareChart, type CompareSeries } from "@/components/markets/CompareChart";
import { seriesColorOf } from "@/lib/chart-series";
import {
  ChangePill,
  DataError,
  DataStamp,
  EmptyState,
  PageHeader,
  Panel,
  SegmentItem,
  Segment,
  LogoTile,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { CompareAdd } from "@/components/markets/CompareAdd";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import type { ChartRange } from "@/lib/providers/types";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { industryLabel, sectorLabel } from "@/lib/sectors";
import {
  cn,
  directionOf,
  directionText,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  isValidSymbol,
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
 * sunucuda çözülüyor; bu ekranda istemci tarafı durum yok.
 *
 * Dört sembol sınırı keyfi değil: beşinci sütun mobilde tabloyu okunmaz
 * yapıyor ve normalize grafikte renkler ayırt edilemez hâle geliyor.
 */

const MAX_SYMBOLS = 4;
const DEFAULT_RANGE: ChartRange = "6M";

/** Karşılaştırmaya hazır başlangıç setleri — boş ekranı doldurur. */
const PRESETS: { labelKey: keyof Dictionary["compare"]; symbols: string[] }[] = [
  { labelKey: "presetChips", symbols: ["NVDA", "AMD", "AVGO", "MU"] },
  { labelKey: "presetMega", symbols: ["AAPL", "MSFT", "GOOGL", "AMZN"] },
  { labelKey: "presetIndices", symbols: ["SPY", "QQQ", "DIA", "IWM"] },
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

/**
 * Grafik aralıkları — `CHART_RANGES`in tamamı DEĞİL.
 *
 * `1D` ve `1W` dakikalık bar döndürüyor; dört sembol o çözünürlükte üst üste
 * çizilince normalize eğri okunmaz bir gürültüye dönüyor. Aralık listesi tek
 * yerde duruyor ki doğrulama ile denetim ayrışmasın — eskiden doğrulama
 * `CHART_RANGES`e (sekiz aralık), denetim beş düğmeye bakıyordu: adrese
 * `?aralik=1D` yazan biri hiçbir düğmenin seçili görünmediği bir ekran
 * alıyordu.
 */
const COMPARE_RANGES = ["1M", "3M", "6M", "YTD", "1Y", "5Y"] as const;
type CompareRange = (typeof COMPARE_RANGES)[number];

/**
 * Adresteki sembol listesi — alınanlar ve DÜŞENLER.
 *
 * Düşenler ayrı dönüyor çünkü ekran onları söylemek zorunda: paylaşılan bir
 * bağlantıda beş sembol varsa beşincisi sessizce yok oluyordu ve okuyucu
 * "bağlantı bozuk" sanıyordu.
 *
 * Dizi biçimi de kurtarılıyor: `?semboller=A&semboller=B` Next tarafından
 * dizi olarak geliyor ve eski `typeof raw !== "string"` koşulu onu boş
 * ekrana düşürüyordu.
 */
function parseSymbols(raw: string | string[] | undefined): {
  kept: string[];
  dropped: string[];
} {
  const metin = Array.isArray(raw) ? raw.join(",") : raw;
  if (typeof metin !== "string") return { kept: [], dropped: [] };
  const parcalar = metin
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  const gecerli = [...new Set(parcalar.filter((entry) => isValidSymbol(entry)))];
  const gecersiz = [...new Set(parcalar.filter((entry) => !isValidSymbol(entry)))];
  return {
    kept: gecerli.slice(0, MAX_SYMBOLS),
    dropped: [...gecersiz, ...gecerli.slice(MAX_SYMBOLS)],
  };
}

export default async function ComparePage(props: PageProps<"/karsilastir">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const { kept: symbols, dropped } = parseSymbols(search.semboller);
  const range: ChartRange = COMPARE_RANGES.includes(
    search.aralik as CompareRange,
  )
    ? (search.aralik as ChartRange)
    : DEFAULT_RANGE;

  /* Virgül HAM yazılıyor. `URLSearchParams` onu `%2C`ye çeviriyor ama hisse
     sayfasındaki karşılaştır bağlantısı ham virgül üretiyor: aynı içerik iki
     ayrı adreste yaşıyor, önbellek iki kez doluyor ve paylaşılan bağlantılar
     birbirine benzemiyordu. */
  const hrefFor = (list: string[], nextRange: ChartRange = range) => {
    if (list.length === 0) return "/karsilastir";
    const ek = nextRange !== DEFAULT_RANGE ? `&aralik=${nextRange}` : "";
    return `/karsilastir?semboller=${list.join(",")}${ek}`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ARALIK DENETİMİ SAYFANIN DENETİMİ. Grafik panelinin başlığındaydı
          ve orada yalnızca grafiği yönetiyormuş gibi duruyordu; oysa tablodaki
          dönem getirisi de bu aralıktan çıkıyor. Kalıp bilanço takviminin
          başlığındakiyle aynı. Dar ekranda altı düğme sığmıyor, ray
          bölünmek yerine kayıyor. */}
      <PageHeader
        eyebrow={t.compare.eyebrow}
        title={t.compare.title}
        subtitle={t.compare.subtitle}
        action={
          symbols.length > 0 ? (
            <div className="scroll-x-hint -mx-1 max-w-full px-1">
              <Segment label={t.compare.rangeLabel}>
                {COMPARE_RANGES.map((key) => (
                  <SegmentItem
                    key={key}
                    href={hrefFor(symbols, key)}
                    active={range === key}
                  >
                    {key}
                  </SegmentItem>
                ))}
              </Segment>
            </div>
          ) : undefined
        }
      />

      {/* Adresten düşen semboller SÖYLENİYOR: paylaşılan bir bağlantıda
          beşinci sembol sessizce yok oluyordu. */}
      {dropped.length > 0 && (
        <p className="text-small text-muted">{t.compare.trimmedNote}</p>
      )}

      {symbols.length === 0 ? (
        <Panel className="flex flex-col gap-5 p-5 sm:p-6">
          {/* Dolgusu kısılmış: `EmptyState` tek başına duran bir panel için
              yazıldı ve altta 40px taşıyor; burada hemen altında hazır setler
              var ve iki blok arasında altmış piksellik ölü bir bant
              kalıyordu.
              ARAMA KUTUSU BURADA AÇIK: boş ekran "bir hisse sayfasına git"
              diyordu, oysa ekleme yolu bu ekranın içinde. */}
          <EmptyState
            title={t.compare.empty}
            hint={t.compare.emptyHint}
            className="pb-2 pt-6"
            action={
              <CompareAdd
                symbols={[]}
                rangeParam={null}
                defaultOpen
                labels={{
                  add: t.compare.addSymbol,
                  placeholder: t.compare.addPlaceholder,
                  cancel: t.common.cancel,
                  noResults: t.stock.notFound,
                }}
              />
            }
          />
          <div className="flex flex-col gap-2.5">
            <p className="plate text-nano tracking-[0.09em]">
              {t.compare.presets}
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Link
                  key={preset.labelKey}
                  href={hrefFor(preset.symbols)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:min-h-9"
                >
                  {t.compare[preset.labelKey]}
                  <span className="numeral text-tiny text-muted">
                    {preset.symbols.join(" · ")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      ) : (
        <CompareBoard
          symbols={symbols}
          range={range}
          hrefFor={hrefFor}
          locale={locale}
          t={t}
        />
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
  hrefFor,
  locale,
  t,
}: {
  symbols: string[];
  range: ChartRange;
  hrefFor: (list: string[], nextRange?: ChartRange) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();

  const [quotesResult, names, barsBySymbol, ...metricResults] =
    await Promise.all([
      getQuotes(symbols, status),
      getSymbolNames(symbols),
      getChartBarsMulti(symbols, range, status),
      ...symbols.map((symbol) => getKeyMetrics(symbol)),
    ]);

  const quotes = quotesResult.ok ? quotesResult.data : {};

  const series: CompareSeries[] = symbols
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

  /**
   * Seri, seçilen aralığın tamamını kapsamıyorsa kapsadığı gerçek aralık.
   * Kapsıyorsa null — o zaman söylenecek fazladan bir şey yok.
   */
  const enErken = Math.min(
    ...series.map((entry) => entry.times?.[0] ?? Infinity),
  );
  const eksikDonem = (entry: (typeof series)[number] | undefined) => {
    const ts = entry?.times;
    if (!ts || ts.length < 2 || !Number.isFinite(enErken)) return null;
    const kapsam = (ts[ts.length - 1] - ts[0]) || 1;
    // Tam kapsayan serilerde künye basılmıyor; eşik seri başlangıcının
    // ortak başlangıca oranı.
    if (ts[0] - enErken < kapsam * 0.02) return null;
    const bicim = (unix: number) =>
      new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(unix * 1000));
    return `${bicim(ts[0])} — ${bicim(ts[ts.length - 1])}`;
  };

  /* Satırlar tek yerde tanımlı: hem geniş ekrandaki tablo hem mobildeki
     kart yığını aynı diziden besleniyor, ikisi birbirinden kayamıyor. */
  const rows: {
    label: string;
    /** Ölçünün altındaki mikro künye — cümle düzeninde. */
    caption?: string;
    value: (index: number) => React.ReactNode;
  }[] = [
    {
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
      label: t.compare.dayChange,
      value: (i) => {
        const quote = quotes[symbols[i]];
        return quote ? (
          <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
        ) : (
          "—"
        );
      },
    },
    {
      label: t.compare.periodChange,
      value: (i) => {
        const entry = series.find((s) => s.symbol === symbols[i]);
        const closes = entry?.closes;
        if (!closes || closes.length < 2) return "—";
        const pct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
        /* KISA SERİ KENDİ DÖNEMİNİ SÖYLER.
           Getiri serinin İLK barından hesaplanıyor; sonradan listelenen bir
           hissede bu, seçilen aralığın tamamı değil. 5Y seçiliyken SPCX
           satırında "− %14,90" yazıyordu ve okuyucu bunu beş yıllık kayıp
           sanıyordu — oysa şirketin elimizdeki ilk barı 8 Haziran 2026, yani
           gösterilen şey on haftalık getiri.
           Ek kullanılmıyor ("2026'dan beri" gibi): Türkçede ek yılın
           okunuşuna göre değişiyor (2026'DAN ama 2025'TEN) ve tek bir kalıp
           ikisini birden doğru yazamıyor. Tarih aralığı hem eksiz hem daha
           çok şey söylüyor. */
        const kisa = eksikDonem(entry);
        return (
          <div className="flex flex-col items-end gap-0.5">
            <span
              className={cn(
                "numeral font-semibold",
                directionText(directionOf(pct)),
              )}
            >
              {formatPercent(pct, locale)}
            </span>
            {kisa && (
              <span className="numeral text-nano text-muted">{kisa}</span>
            )}
          </div>
        );
      },
    },
    {
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
      label: t.stock.beta,
      value: (i) => {
        const metrics = metricResults[i];
        return metrics?.ok && metrics.data.beta !== null
          ? formatPrice(metrics.data.beta, locale)
          : "—";
      },
    },
    {
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
        return (
          <span className="numeral text-small text-body">
            {formatPrice(metrics.data.low52, locale, opts)} —{" "}
            {formatPrice(metrics.data.high52, locale, opts)}
          </span>
        );
      },
    },
    {
      /* AYNI İSTEKTEN GELİYOR: `getKeyMetrics` bu alanı zaten döndürüyordu
         (`netProfitMarginTTM`) ve sunum katmanı onu atıyordu. Değerleme
         karşılaştırmasında F/K'nin yanında duracak ölçü bu. */
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
      label: t.compare.sector,
      value: (i) => sectorLabel(names[symbols[i]]?.sector, locale) ?? "—",
    },
    {
      label: t.stock.industry,
      value: (i) =>
        industryLabel(names[symbols[i]]?.industry, locale) ?? "—",
    },
  ];

  /* SATIRLAR ÜÇ ÖBEKTE. On iki satır düz bir liste hâlinde akıyordu ve
     okuyucu "getiri mi bakıyorum, değerleme mi" diye ayırt edemiyordu.
     Öbek başlığı bir kutu değil, bir ton basamağı ve tek hairline —
     kart içinde ikinci kutu yok. */
  const groups: { label: string; rows: typeof rows }[] = [
    { label: t.compare.groupReturn, rows: rows.slice(0, 3) },
    { label: t.compare.groupValuation, rows: rows.slice(3, 7) },
    { label: t.compare.groupRisk, rows: rows.slice(7, 9) },
    { label: t.compare.groupCompany, rows: rows.slice(9) },
  ];

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
    <>
      {/* ---- Sembol şeridi ----
           Çip yığınıydı: logo, sembol ve çarpı. Üç şey eksikti — şirketin
           ADI (alan `SymbolMeta.name` içinde geliyor ve hiç basılmıyordu),
           günlük değişim ve en önemlisi GRAFİKTEKİ RENGİN ANAHTARI.
           Okuyucu grafikteki mor çizginin hangi sembol olduğunu ancak
           grafiğin altındaki küçük künyeye bakıp kurabiliyordu.
           Renk sembolden eşleniyor, dizinin sırasından değil: `series`
           barı gelmeyen sembolü eliyor ve indise bakan bir eşleme bütün
           renkleri kaydırıyordu.
           DÖNEM GETİRİSİ ŞERİDE GİRMİYOR — tabloda duruyor. Aynı sayıyı iki
           yerde tutmak projenin veri kuralına aykırı. */}
      <Panel>
        <ul className="divide-y divide-line-soft">
          {symbols.map((symbol) => {
            const meta = names[symbol];
            const quote = quotes[symbol];
            return (
              <li
                key={symbol}
                className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
              >
                <span
                  aria-hidden
                  className="h-5 w-[3px] shrink-0 rounded-full"
                  style={{ background: seriesColorOf(symbols, symbol) }}
                />
                <LogoTile symbol={symbol} logoUrl={meta?.logoUrl} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/hisse/${symbol}`}
                    className="numeral w-fit text-base font-bold leading-tight text-strong transition-colors hover:text-primary"
                  >
                    {symbol}
                  </Link>
                  {meta?.name && (
                    <span className="truncate text-tiny leading-tight text-muted">
                      {meta.name}
                    </span>
                  )}
                </span>
                {quote && (
                  <ChangePill
                    changePct={quote.changePct}
                    locale={locale}
                    size="sm"
                  />
                )}
                <Link
                  href={hrefFor(symbols.filter((entry) => entry !== symbol))}
                  aria-label={`${symbol} ${t.compare.remove}`}
                  /* Dokunma hedefi 44px; görsel daire aynı, negatif margin
                     satır yüksekliğini değiştirmiyor. */
                  className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-down-wash hover:text-down focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus) sm:-m-1.5 sm:size-8"
                >
                  <X weight="bold" size={12} />
                </Link>
              </li>
            );
          })}
        </ul>
        {symbols.length < MAX_SYMBOLS ? (
          /* EKLEME YOLU EKRANIN İÇİNDE. Burada yalnızca "bir hisse
             sayfasından Karşılaştır'a bas" yazan bir cümle vardı: dörtten
             üçe düşen kullanıcı dördüncüyü geri koyamıyordu. */
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
            <CompareAdd
              symbols={symbols}
              rangeParam={range === DEFAULT_RANGE ? null : range}
              labels={{
                add: t.compare.addSymbol,
                placeholder: t.compare.addPlaceholder,
                cancel: t.common.cancel,
                noResults: t.stock.notFound,
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
      </Panel>

      {/* ---- Normalize grafik ----
           PANEL HER HÂLDE BASILIYOR. `series.length > 0` koşulu paneli
           tümüyle yutuyordu: sağlayıcı bar döndürmediğinde ekranda grafiğin
           yerinde hiçbir şey yoktu ve okuyucu "bu ekranda grafik yok mu"
           diye soruyordu. Aralık denetimi sayfa başlığına taşındı — o
           denetim yalnızca grafiği değil tablodaki dönem getirisini de
           yönetiyor.
           İpucu grafiğin ÜSTÜNDE: "hepsi neden sıfırdan başlıyor" sorusu
           doğmadan cevaplanıyor. */}
      <Panel className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
          {t.compare.chartTitle}
        </h2>
        <p className="text-tiny leading-relaxed text-muted">
          {t.compare.chartHint}
        </p>
        {series.length > 0 ? (
          <CompareChart
            series={series}
            title={t.compare.chartTitle}
            locale={locale}
            readingLabel={t.compare.chartReading}
          />
        ) : (
          <DataError
            message={t.compare.chartMissing}
            hint={t.compare.chartMissingHint}
          />
        )}
      </Panel>

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
                  className="sticky left-0 z-10 w-[104px] bg-(--panel-fixed) px-3 py-2.5 font-medium sm:w-[168px] sm:px-5"
                >
                  {t.compare.metric}
                </th>
                {symbols.map((symbol) => (
                  <th
                    key={symbol}
                    scope="col"
                    className="px-2.5 py-2.5 text-right sm:px-4"
                  >
                    <span className="numeral block text-tiny font-bold tracking-normal text-strong">
                      {symbol}
                    </span>
                    {names[symbol]?.name && (
                      /* `ml-auto`: blok kutusu `max-w` ile daraldığı için
                         `text-right` onu sağa yaslamıyor — hücrede sola
                         kayıp sembolün altından çıkıyordu. */
                      <span className="ml-auto block max-w-[9rem] truncate text-nano font-normal normal-case tracking-normal text-muted">
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
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={symbols.length + 1}
                      className="bg-surface px-3 py-1.5 text-left sm:px-5"
                    >
                      <span className="plate sticky left-0 text-nano tracking-[0.09em]">
                        {group.label}
                      </span>
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-(--panel-fixed) px-3 py-2.5 text-left text-small font-medium text-muted sm:px-5"
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
                          className="px-2.5 py-2.5 text-right text-base text-body sm:px-4"
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
    </>
  );
}
