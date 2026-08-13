import Image from "next/image";
import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { CompareChart, type CompareSeries } from "@/components/markets/CompareChart";
import {
  ChangePill,
  DataStamp,
  EmptyState,
  PageHeader,
  Panel,
  SegmentItem,
  Segment,
  SymbolBadge,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { CHART_RANGES, type ChartRange } from "@/lib/providers/types";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { industryLabel } from "@/lib/sectors";
import {
  cn,
  directionOf,
  directionText,
  formatCompact,
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

function parseSymbols(raw: string | string[] | undefined): string[] {
  if (typeof raw !== "string") return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter((entry) => isValidSymbol(entry)),
    ),
  ].slice(0, MAX_SYMBOLS);
}

export default async function ComparePage(props: PageProps<"/karsilastir">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const symbols = parseSymbols(search.semboller);
  const range: ChartRange = CHART_RANGES.includes(search.aralik as ChartRange)
    ? (search.aralik as ChartRange)
    : DEFAULT_RANGE;

  const hrefFor = (list: string[], nextRange: ChartRange = range) => {
    if (list.length === 0) return "/karsilastir";
    const params = new URLSearchParams({ semboller: list.join(",") });
    if (nextRange !== DEFAULT_RANGE) params.set("aralik", nextRange);
    return `/karsilastir?${params}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t.compare.eyebrow}
        title={t.compare.title}
        subtitle={t.compare.subtitle}
      />

      {symbols.length === 0 ? (
        <Panel className="flex flex-col gap-5 p-5 sm:p-6">
          <EmptyState title={t.compare.empty} hint={t.compare.emptyHint} />
          <div className="flex flex-col gap-2.5">
            <p className="plate text-[10px] tracking-[0.09em]">
              {t.compare.presets}
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Link
                  key={preset.labelKey}
                  href={hrefFor(preset.symbols)}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[12.5px] font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
                >
                  {t.compare[preset.labelKey]}
                  <span className="numeral text-[11px] text-muted">
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

  /* Satırlar tek yerde tanımlı: hem geniş ekrandaki tablo hem mobildeki
     kart yığını aynı diziden besleniyor, ikisi birbirinden kayamıyor. */
  const rows: {
    label: string;
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
        const closes = series.find((s) => s.symbol === symbols[i])?.closes;
        if (!closes || closes.length < 2) return "—";
        const pct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
        return (
          <span className={cn("numeral font-semibold", directionText(directionOf(pct)))}>
            {formatPercent(pct, locale)}
          </span>
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
        return cap ? `$${formatCompact(cap, locale)}` : "—";
      },
    },
    {
      label: t.stock.peRatio,
      /* Oran, tablonun kendi fiyat satırından kuruluyor. Sağlayıcının hazır
         F/K'si geriden gelen bir fiyatla hesaplanmış oluyor; karşılaştırma
         tablosunda bu, iki şirketi farklı anların fiyatıyla yan yana koymak
         demekti. Gerekçenin tamamı `peRatioOf`'ta. */
      value: (i) => {
        const metrics = metricResults[i];
        if (!metrics?.ok) return "—";
        return formatPrice(
          peRatioOf(quotes[symbols[i]]?.price, metrics.data.eps),
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
        return metrics?.ok && metrics.data.dividendYield !== null
          ? formatPercentPlain(metrics.data.dividendYield, locale, 2)
          : "—";
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
        return (
          <span className="numeral text-[12.5px] text-body">
            {formatPrice(metrics.data.low52, locale)} —{" "}
            {formatPrice(metrics.data.high52, locale)}
          </span>
        );
      },
    },
    {
      label: t.stock.industry,
      value: (i) =>
        industryLabel(names[symbols[i]]?.industry, locale) ?? "—",
    },
  ];

  return (
    <>
      {/* ---- Seçili semboller ---- */}
      <div className="flex flex-wrap items-center gap-2">
        {symbols.map((symbol) => {
          const meta = names[symbol];
          return (
            <span
              key={symbol}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1.5 text-[13px]"
            >
              {meta?.logoUrl ? (
                <Image
                  src={meta.logoUrl}
                  alt=""
                  width={22}
                  height={22}
                  className="size-[22px] shrink-0 rounded-full bg-white object-contain"
                />
              ) : (
                <SymbolBadge symbol={symbol} size="sm" className="size-[22px] rounded-full text-[9px]" />
              )}
              <Link
                href={`/hisse/${symbol}`}
                className="numeral font-bold text-strong transition-colors hover:text-primary"
              >
                {symbol}
              </Link>
              <Link
                href={hrefFor(symbols.filter((entry) => entry !== symbol))}
                aria-label={`${symbol} ${t.compare.remove}`}
                /* 20×20'lik bir çarpı, parmakla ıskalanan bir hedefti — hem
                   de yanlış basıldığında sembolü listeden düşüren bir
                   hedef. Görsel daire aynı boyutta kalıyor, dokunma alanı
                   dolguyla 32px'e çıkıyor. */
                className="-m-1.5 flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-down-wash hover:text-down"
              >
                <X weight="bold" size={11} />
              </Link>
            </span>
          );
        })}
        {symbols.length < MAX_SYMBOLS && (
          <span className="text-[12px] text-muted">{t.compare.addHint}</span>
        )}
      </div>

      {/* ---- Normalize grafik ---- */}
      {series.length > 0 && (
        <Panel className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
              {t.compare.chartTitle}
            </h2>
            <Segment>
              {(["1M", "3M", "6M", "1Y", "5Y"] as const).map((key) => (
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
          <CompareChart
            series={series}
            title={t.compare.chartTitle}
            locale={locale}
            readingLabel={t.compare.chartReading}
          />
          <p className="text-[11.5px] leading-relaxed text-muted">
            {t.compare.chartHint}
          </p>
        </Panel>
      )}

      {/* ---- Metrik tablosu ---- */}
      <Panel className="overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="w-[104px] px-3 py-2.5 font-medium sm:w-[168px] sm:px-5">
                  {t.compare.metric}
                </th>
                {symbols.map((symbol) => (
                  <th
                    key={symbol}
                    className="numeral px-2.5 py-2.5 text-right text-[11.5px] font-bold tracking-normal text-strong sm:px-4"
                  >
                    {symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left text-[12.5px] font-medium text-muted sm:px-5"
                  >
                    {row.label}
                  </th>
                  {symbols.map((symbol, index) => (
                    <td
                      key={symbol}
                      className="px-2.5 py-2.5 text-right text-[13px] text-body sm:px-4"
                    >
                      {row.value(index)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
