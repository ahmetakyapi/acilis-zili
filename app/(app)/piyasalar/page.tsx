import { Suspense } from "react";
import { FearGauge } from "@/components/markets/FearGauge";
import { GuideHint } from "@/components/article/GuideHint";
import Image from "next/image";
import Link from "next/link";
import {
  DataStamp,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
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
import { getChartBars, getQuotes } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import type { MarketStatus } from "@/lib/market-hours";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  directionOf,
  formatChange,
  formatCompact,
  formatEtDateShort,
  formatPercent,
  formatPrice,
} from "@/lib/utils";

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
const INDEX_TABS = [
  { key: "dow", label: "Dow Jones", proxy: "DIA", members: primaryOnly(DOW_MEMBERS) },
  { key: "nasdaq", label: "Nasdaq 100", proxy: "QQQ", members: primaryOnly(NDX_MEMBERS) },
  { key: "sp500", label: "S&P 500", proxy: "SPY", members: primaryOnly(SPX_MEMBERS) },
] as const;

type TabKey = (typeof INDEX_TABS)[number]["key"];

const SORT_KEYS = ["degisim", "fiyat", "ad", "katki", "cap"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

/** ABD Hazine tahvili serileri — FRED sabit vadeli getiriler. */
const YIELD_SERIES = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin", labelKey: "yieldY5" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin", labelKey: "yieldY30" },
] as const;

/** Alpaca snapshot çağrısı sembol listesini paketler halinde alır. */
async function quotesFor(
  symbols: string[],
  status: MarketStatus,
): Promise<{ quotes: Record<string, Quote>; stampAt: Date | null }> {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 100) {
    chunks.push(symbols.slice(i, i + 100));
  }
  const results = await Promise.all(
    chunks.map((chunk) => getQuotes(chunk, status)),
  );
  const quotes: Record<string, Quote> = {};
  let stampAt: Date | null = null;
  for (const result of results) {
    if (!result.ok) continue;
    Object.assign(quotes, result.data);
    if (!stampAt || result.fetchedAt > stampAt) stampAt = result.fetchedAt;
  }
  return { quotes, stampAt };
}

export default async function MarketsPage(props: PageProps<"/piyasalar">) {
  const search = await props.searchParams;
  const tab: TabKey = INDEX_TABS.some((t) => t.key === search.endeks)
    ? (search.endeks as TabKey)
    : "dow";
  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "degisim";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";

  const { locale, t } = await getI18n();
  const active = INDEX_TABS.find((entry) => entry.key === tab)!;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={locale === "tr" ? "ABD Piyasası" : "US Market"}
        title={t.markets.title}
        subtitle={t.markets.subtitle}
      />

      <IndexCards activeTab={tab} sort={sort} dir={dir} locale={locale} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <YieldStrip locale={locale} t={t} />
        <Suspense fallback={null}>
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
        </Suspense>
      </div>

      {/* Endeks seçici */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {INDEX_TABS.map((entry) => {
          const activeTab = entry.key === tab;
          return (
            <Link
              key={entry.key}
              href={`/piyasalar?endeks=${entry.key}`}
              scroll={false}
              className={cn(
                "flex min-h-[38px] items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                activeTab
                  ? "bg-primary text-on-primary"
                  : "border border-line bg-surface text-soft hover:border-line-strong hover:text-strong",
              )}
            >
              {entry.label}
              <span
                className={cn(
                  "numeral text-xs font-normal",
                  activeTab ? "text-on-primary/70" : "text-muted",
                )}
              >
                {entry.members.length}
              </span>
            </Link>
          );
        })}
        <span className="numeral ml-auto text-[10px] text-muted">
          {t.markets.asOf}: {formatEtDateShort(INDEX_COMPOSITION_DATE, locale)}
        </span>
      </div>

      <IndexDetail
        tab={tab}
        members={active.members}
        proxy={active.proxy}
        sort={sort}
        dir={dir}
        locale={locale}
        t={t}
      />

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
  const [quotesResult, ...barResults] = await Promise.all([
    getQuotes([...proxies], status),
    ...proxies.map((symbol) => getChartBars(symbol, "1D", status)),
  ]);

  if (!quotesResult.ok) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {INDEX_TABS.map((entry, index) => {
        const quote = quotesResult.data[entry.proxy];
        const bars = barResults[index];
        const points = bars.ok ? bars.data.map((bar) => ({ value: bar.close })) : [];
        const tone = directionOf(quote?.changePct);
        const selected = entry.key === activeTab;

        return (
          <Link
            key={entry.key}
            href={`/piyasalar?endeks=${entry.key}&sirala=${sort}&yon=${dir}`}
            scroll={false}
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
                <p className="numeral text-[10px] text-muted">{entry.proxy}</p>
              </div>
              {quote ? (
                <>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <p className="tote text-[26px]">
                      {formatPrice(quote.price, locale)}
                    </p>
                    <p
                      className={cn(
                        "numeral text-[14px] font-bold",
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
      <PanelHeader title={t.markets.yields} />

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-line-soft sm:p-0">
        {values.map((value) => {
          const delta =
            value.latest !== null && value.prev !== null
              ? value.latest - value.prev
              : null;
          return (
            <div key={value.key} className="rounded-[12px] border border-line bg-surface px-3.5 py-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 sm:py-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                {value.label}
              </p>
              <p className="tote mt-1 text-xl sm:text-2xl">
                {value.latest !== null ? (
                  <>
                    {formatPrice(value.latest, locale)}
                    <span className="ml-1 text-sm text-soft">%</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              {delta !== null && Math.abs(delta) > 0.001 && (
                <p
                  className={cn(
                    "numeral mt-1 text-[11px] font-semibold",
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft px-4 py-3 sm:px-5">
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
          <span className="basis-full text-[11px] leading-relaxed text-muted">
            {t.markets.curveHint}
          </span>
        </div>
      )}

      {values[0].date && (
        <p className="border-t border-line-soft px-4 py-2 text-[10px] text-muted sm:px-5">
          FRED · {formatEtDateShort(values[0].date, locale)}
        </p>
      )}
    </Panel>
  );
}

/* ==========================================================================
   Seçili endeks — genişlik, hareket edenler, tam liste
   ========================================================================== */

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
  locale,
  t,
}: {
  tab: TabKey;
  members: readonly IndexMember[];
  proxy: string;
  sort: SortKey;
  dir: SortDir;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [{ quotes, stampAt }, proxyResult, meta] = await Promise.all([
    quotesFor(
      members.map((m) => m.symbol),
      status,
    ),
    getQuotes([proxy], status),
    getSymbolNames(members.map((m) => m.symbol)),
  ]);

  /* Dow fiyat ağırlıklıdır: Endeks = Σfiyat / bölen. Bölen, elimizdeki
     fiyat toplamı ile endeks seviyesinden türetilir (DIA ≈ Dow/100), böylece
     her hissenin puan katkısı = fiyat değişimi / bölen olarak hesaplanır.
     Diğer endeksler piyasa değeri ağırlıklı olduğundan katkı hesaplanmaz. */
  let divisor: number | null = null;
  if (tab === "dow" && proxyResult.ok) {
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
  const advancing = withQuote.filter((row) => (row.quote!.changePct ?? 0) > 0).length;
  const declining = withQuote.filter((row) => (row.quote!.changePct ?? 0) < 0).length;
  const flat = withQuote.length - advancing - declining;

  const byChange = [...withQuote].sort(
    (a, b) => (b.quote!.changePct ?? 0) - (a.quote!.changePct ?? 0),
  );
  const gainers = byChange.slice(0, 5);
  const losers = [...byChange].reverse().slice(0, 5);

  return (
    <>
      {withQuote.length > 0 && (
        <>
          <BreadthPanel
            advancing={advancing}
            declining={declining}
            flat={flat}
            total={withQuote.length}
            locale={locale}
            t={t}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <MoverPanel
              title={t.markets.topGainers}
              rows={gainers}
              tone="up"
              showContribution={divisor !== null}
              contributionLabel={t.markets.contribution}
              locale={locale}
            />
            <MoverPanel
              title={t.markets.topLosers}
              rows={losers}
              tone="down"
              showContribution={divisor !== null}
              contributionLabel={t.markets.contribution}
              locale={locale}
            />
          </div>
        </>
      )}

      <MembersTable
        tab={tab}
        rows={rows}
        sort={sort}
        dir={dir}
        showContribution={divisor !== null}
        locale={locale}
        t={t}
      />

      {stampAt && <DataStamp source="alpaca" at={stampAt} locale={locale} />}
    </>
  );
}

/* ---- Piyasa genişliği ---- */

function BreadthPanel({
  advancing,
  declining,
  flat,
  total,
  locale,
  t,
}: {
  advancing: number;
  declining: number;
  flat: number;
  total: number;
  locale: Locale;
  t: Dictionary;
}) {
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const advPct = pct(advancing);

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[14px] font-bold tracking-tight text-strong">
          {t.markets.breadth}
        </h2>
        <p className="numeral text-[12.5px] text-muted">
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

      <div className="mt-3.5 flex h-3 w-full gap-px overflow-hidden rounded-full bg-surface-sunken">
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

      <p className="mt-2 text-xs text-soft">
        {locale === "tr"
          ? `Endeksteki şirketlerin %${formatPrice(advPct, locale, { digits: 0 })}'i günü artıda geçiriyor.`
          : `${formatPrice(advPct, locale, { digits: 0 })}% of the index is trading higher.`}
      </p>
    </Panel>
  );
}

/* ---- En çok artan / düşen kartları ---- */

function MoverPanel({
  title,
  rows,
  tone,
  showContribution,
  contributionLabel,
  locale,
}: {
  title: string;
  rows: Row[];
  tone: "up" | "down";
  showContribution: boolean;
  contributionLabel: string;
  locale: Locale;
}) {
  if (rows.length === 0) return null;

  const peak = Math.max(
    ...rows.map((row) => Math.abs(row.quote?.changePct ?? 0)),
    0.01,
  );

  return (
    <Panel>
      <PanelHeader title={title} />
      <ul className="divide-y divide-line-soft">
        {rows.map((row) => {
          const changePct = row.quote?.changePct ?? 0;
          const width = Math.max((Math.abs(changePct) / peak) * 100, 4);
          return (
            <li key={row.member.symbol}>
              <Link
                href={`/hisse/${row.member.symbol}`}
                className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <span className="shrink-0 text-[13.5px] font-bold text-strong">
                      {row.member.symbol}
                    </span>
                    <span className="min-w-0 truncate text-[11.5px] text-muted">
                      {row.member.name}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "numeral shrink-0 text-sm font-bold",
                      tone === "up" ? "text-up" : "text-down",
                    )}
                  >
                    {formatPercent(changePct, locale)}
                  </span>
                </div>

                {/* Görsel oran çubuğu — grubun en büyüğüne göre ölçekli */}
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "h-[5px] rounded-full",
                      tone === "up" ? "bg-up/70" : "bg-down/70",
                    )}
                    style={{ width: `${width}%` }}
                  />
                  {showContribution && row.contribution !== null && (
                    <span className="numeral shrink-0 text-[10px] text-muted">
                      {contributionLabel} {formatChange(row.contribution, locale)}
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

function sortHref(tab: TabKey, key: SortKey, sort: SortKey, dir: SortDir) {
  const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
  return `/piyasalar?endeks=${tab}&sirala=${key}&yon=${nextDir}`;
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
    <th className={cn("px-3 py-2.5 text-right font-semibold", className)}>
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

function MembersTable({
  tab,
  rows,
  sort,
  dir,
  showContribution,
  locale,
  t,
}: {
  tab: TabKey;
  rows: Row[];
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

  const valueOf = (row: Row): number | string => {
    switch (sort) {
      case "fiyat":
        return row.quote?.price ?? -Infinity;
      case "ad":
        return row.member.name;
      case "katki":
        return row.contribution ?? -Infinity;
      case "cap":
        return row.marketCap ?? -Infinity;
      default:
        return row.quote?.changePct ?? -Infinity;
    }
  };

  /* Cubuk olcegi: grubun EN BUYUK mutlak degisimi. Yuzde degerleri
     kendi araliginda kucuk (±%3) oldugu icin sabit bir olcek cubuklari
     gorunmez yapiyordu. */
  const peakChange = Math.max(
    ...rows.map((row) => Math.abs(row.quote?.changePct ?? 0)),
    0.01,
  );

  const sorted = [...rows].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (typeof va === "string" || typeof vb === "string") {
      const cmp = String(va).localeCompare(String(vb), "en");
      return dir === "asc" ? cmp : -cmp;
    }
    return dir === "asc" ? va - vb : vb - va;
  });

  return (
    <Panel>
      <PanelHeader title={t.markets.constituents} />
      <div className="scroll-x">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.08em] text-muted">
              <th className="w-10 px-4 py-2.5 font-semibold sm:px-5">#</th>
              <SortHead
                label={t.companies.company}
                href={sortHref(tab, "ad", sort, dir)}
                active={sort === "ad"}
                dir={dir}
                className="text-left"
              />
              {/* Değişim fiyattan önce — bkz. /sirketler tablosu. */}
              <SortHead
                label={t.companies.change}
                href={sortHref(tab, "degisim", sort, dir)}
                active={sort === "degisim"}
                dir={dir}
              />
              <SortHead
                label={t.companies.price}
                href={sortHref(tab, "fiyat", sort, dir)}
                active={sort === "fiyat"}
                dir={dir}
              />
              <SortHead
                label={t.market.marketCap}
                href={sortHref(tab, "cap", sort, dir)}
                active={sort === "cap"}
                dir={dir}
                className={showContribution ? undefined : "sm:pr-5"}
              />
              {showContribution && (
                <SortHead
                  label={t.markets.contribution}
                  href={sortHref(tab, "katki", sort, dir)}
                  active={sort === "katki"}
                  dir={dir}
                  className="sm:pr-5"
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
                  <td className="numeral px-4 py-2.5 text-xs text-muted sm:px-5">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/hisse/${row.member.symbol}`}
                      /* -my-2 py-2: bağlantı hücreyi doldurmadığı için
                         dokunma hedefi metnin kendi 20px'iyle sınırlıydı.
                         Dolgu onu satır yüksekliğine yayar, negatif margin
                         de tabloyu olduğu yerde tutar. */
                      className="-my-2 flex min-w-0 items-center gap-2.5 py-2"
                    >
                      {row.logoUrl ? (
                        <Image
                          src={row.logoUrl}
                          alt=""
                          width={26}
                          height={26}
                          className="size-[26px] shrink-0 rounded-[7px] border border-line-soft bg-white object-contain"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary-wash text-[9px] font-bold text-primary"
                        >
                          {row.member.symbol.slice(0, 2)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-bold leading-[17px] text-strong">
                          {row.member.symbol}
                        </span>
                        <span className="block truncate text-[11.5px] leading-[15px] text-muted">
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
                  <td className="px-3 py-2.5">
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
                          className="flex h-1 w-16 justify-end overflow-hidden rounded-full bg-surface-elevated"
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
                              width: `${Math.max(
                                (Math.abs(quote.changePct) / peakChange) * 100,
                                6,
                              )}%`,
                            }}
                          />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="numeral px-3 py-2.5 text-right font-bold text-strong">
                    {quote ? formatPrice(quote.price, locale) : "—"}
                  </td>
                  <td
                    className={cn(
                      "numeral px-3 py-2.5 text-right text-body",
                      showContribution ? undefined : "sm:pr-5",
                    )}
                  >
                    {row.marketCap
                      ? `$${formatCompact(row.marketCap, locale)}`
                      : "—"}
                  </td>
                  {showContribution && (
                    <td className="numeral px-3 py-2 text-right text-soft sm:pr-5">
                      {row.contribution !== null
                        ? formatChange(row.contribution, locale)
                        : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showContribution && (
        <p className="border-t border-line-soft px-4 py-2.5 text-[11px] leading-relaxed text-muted sm:px-5">
          {t.markets.contributionHint}
        </p>
      )}
    </Panel>
  );
}
