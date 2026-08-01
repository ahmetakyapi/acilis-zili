import Image from "next/image";
import Link from "next/link";
import { CaretDown, Heart } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import {
  EmptyState,
  PageHeader,
  Panel,
  Segment,
  SegmentItem,
  SymbolBadge,
  TimingChip,
  type TimingTone,
} from "@/components/ui/primitives";
import { getEarningsBetween, getSymbolNames, getUserSymbols } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatCompact, formatEtDateLong, formatPrice } from "@/lib/utils";
import type { EarningsRow } from "@/lib/schema";
import type { SymbolMeta } from "@/lib/data";

/**
 * Bilanço takvimi — mockup 4d. Dikkat hiyerarşisi üç katmanlıdır:
 *   1. Gün içinde piyasa değeri en büyük iki şirket tam genişlik hero satırı
 *   2. Sonraki büyükler 184px sabit genişlikte mini kart ızgarasında
 *   3. Kalan yüzlerce sembol varsayılan KAPALI bir açılır bölümde —
 *      kalabalık ilk bakışta görünmez, isteyen açar (native <details>).
 */

const HERO_MIN_CAP = 100e9;
const HERO_COUNT = 2;
const MID_COUNT = 6;

/** Hafta/Ay segmenti — mockup'taki iki seçenek. */
const RANGES = {
  hafta: 6,
  ay: 29,
} as const;
type RangeKey = keyof typeof RANGES;

export default async function EarningsPage(props: PageProps<"/bilancolar">) {
  const search = await props.searchParams;
  const onlyWatchlist = search.f === "favoriler";
  const range: RangeKey = search.aralik === "ay" ? "ay" : "hafta";

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  let rows = await getEarningsBetween(today, addEtDays(today, RANGES[range]));

  let userSymbols: string[] = [];
  if (session?.user?.id) {
    userSymbols = await getUserSymbols(session.user.id);
  }
  if (onlyWatchlist && userSymbols.length > 0) {
    const set = new Set(userSymbols);
    rows = rows.filter((row) => set.has(row.symbol));
  }

  const meta = await getSymbolNames([...new Set(rows.map((r) => r.symbol))]);
  const watchSet = new Set(userSymbols);

  const byDay = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.reportDate) ?? [];
    list.push(row);
    byDay.set(row.reportDate, list);
  }

  const rangeHref = (key: RangeKey) =>
    `/bilancolar?${new URLSearchParams({
      ...(onlyWatchlist ? { f: "favoriler" } : {}),
      ...(key === "ay" ? { aralik: "ay" } : {}),
    })}`;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={t.earnings.title}
        subtitle={t.earnings.subtitleLong}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {session?.user && (
              <Link
                href={
                  onlyWatchlist
                    ? rangeHref(range)
                    : `/bilancolar?f=favoriler${range === "ay" ? "&aralik=ay" : ""}`
                }
                className={cn(
                  "inline-flex min-h-9 items-center gap-[7px] rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                  onlyWatchlist
                    ? "border-transparent bg-primary text-on-primary"
                    : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
                )}
              >
                <Heart weight="duotone" size={14} />
                {t.earnings.onlyWatchlist}
              </Link>
            )}
            <Segment>
              {(["hafta", "ay"] as const).map((key) => (
                <SegmentItem
                  key={key}
                  href={rangeHref(key)}
                  active={range === key}
                >
                  {key === "hafta" ? t.earnings.rangeWeek : t.earnings.rangeMonth}
                </SegmentItem>
              ))}
            </Segment>
          </div>
        }
      />

      {byDay.size === 0 ? (
        <Panel>
          <EmptyState title={t.earnings.empty} />
        </Panel>
      ) : (
        [...byDay.entries()].map(([date, dayRows]) => (
          <DaySection
            key={date}
            date={date}
            isToday={date === today}
            rows={dayRows}
            meta={meta}
            watchSet={watchSet}
            locale={locale}
            t={t}
          />
        ))
      )}
    </div>
  );
}

function timingOf(hour: string | null, t: Dictionary): {
  label: string;
  short: string;
  tone: TimingTone;
} {
  if (hour === "bmo")
    return {
      label: t.earnings.beforeOpen,
      short: t.earnings.beforeOpen,
      tone: "pre",
    };
  if (hour === "amc")
    return {
      label: t.earnings.afterClose,
      short: t.earnings.afterClose,
      tone: "post",
    };
  if (hour === "dmh")
    return {
      label: t.earnings.duringMarket,
      short: t.earnings.duringMarket,
      tone: "neutral",
    };
  return {
    label: t.earnings.timeUnknown,
    short: t.earnings.timeUnknown,
    tone: "neutral",
  };
}

/**
 * Kartın sayıları — her biri kendi etiketiyle.
 *
 * Eskiden sağdaki büyük sayı çıplak duruyordu ve altındaki tek satırlık
 * künye ("Gelir Beklentisi · EPS Beklentisi 0,35") neyin ne olduğunu ilk
 * bakışta söylemiyordu. Artık başlık sayının ÜSTÜNDE, kalan ölçüler de
 * etiket–değer çiftleri hâlinde okunuyor.
 *
 * Manşet sayı gelir beklentisidir; o yoksa EPS beklentisi öne çıkar —
 * kartın en büyük yerinde bir "—" görmek bilgi taşımıyordu.
 */
type Figure = { label: string; value: string };

function cardFigures(
  row: EarningsRow,
  meta: SymbolMeta | undefined,
  locale: Locale,
  t: Dictionary,
  short: boolean,
): { headline: Figure | null; rest: Figure[] } {
  const revenue =
    row.revenueEstimate !== null && row.revenueEstimate !== undefined
      ? {
          label: short ? t.earnings.revenueShort : t.earnings.revenueEstimate,
          value: `${formatCompact(row.revenueEstimate, locale)} $`,
        }
      : null;
  const eps =
    row.epsEstimate !== null && row.epsEstimate !== undefined
      ? {
          label: short ? "EPS" : t.earnings.epsEstimate,
          value: formatPrice(row.epsEstimate, locale, { currency: true }),
        }
      : null;
  // Gün içindeki sıralama zaten piyasa değerine göre; sayı da görünsün.
  const cap = meta?.marketCap
    ? {
        label: short ? t.earnings.marketCapShort : t.market.marketCap,
        value: `${formatCompact(meta.marketCap, locale)} $`,
      }
    : null;

  const headline = revenue ?? eps;
  const rest = [revenue, eps, cap].filter(
    (figure): figure is Figure => figure !== null && figure !== headline,
  );
  return { headline, rest };
}

function DaySection({
  date,
  isToday,
  rows,
  meta,
  watchSet,
  locale,
  t,
}: {
  date: string;
  isToday: boolean;
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  locale: Locale;
  t: Dictionary;
}) {
  const known = rows
    .filter((row) => meta[row.symbol]?.marketCap)
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    );

  const heroes = known
    .filter((row) => (meta[row.symbol]?.marketCap ?? 0) >= HERO_MIN_CAP)
    .slice(0, HERO_COUNT);
  const heroSet = new Set(heroes.map((row) => row.symbol));

  const mid = known
    .filter((row) => !heroSet.has(row.symbol))
    .slice(0, MID_COUNT);
  const midSet = new Set(mid.map((row) => row.symbol));

  const rest = rows.filter(
    (row) => !heroSet.has(row.symbol) && !midSet.has(row.symbol),
  );
  const bmo = rest.filter((row) => row.hour === "bmo");
  const amc = rest.filter((row) => row.hour === "amc");
  const other = rest.filter((row) => row.hour !== "bmo" && row.hour !== "amc");

  return (
    <section aria-label={date}>
      {/* ---- Gün başlığı ---- */}
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <h2 className="text-[19px] font-bold tracking-[-0.025em] text-strong">
          {formatEtDateLong(date, locale)}
        </h2>
        <span className="figure text-[12.5px] text-muted">
          {rows.length} {t.earnings.companiesCount}
        </span>
        {isToday && (
          <span className="rounded-full bg-down-wash px-[9px] py-[3px] text-[10.5px] font-bold tracking-[0.05em] text-down">
            {t.earnings.today.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
          </span>
        )}
      </div>

      {/* ---- Katman 1: hero satırları ---- */}
      <div className="flex flex-col gap-2.5">
        {heroes.map((row) => {
          const m = meta[row.symbol];
          const timing = timingOf(row.hour, t);
          const { headline, rest } = cardFigures(row, m, locale, t, false);
          return (
            <Link key={row.id} href={`/hisse/${row.symbol}`} className="block">
              {/* Mobilde iki satır (mockup 4k), masaüstünde tek hero satırı. */}
              <div className="panel-hover flex flex-col gap-3 rounded-[14px] border border-line bg-surface-solid px-4 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  {m?.logoUrl ? (
                    <Image
                      src={m.logoUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 shrink-0 rounded-[11px] border border-line bg-white object-contain p-1"
                    />
                  ) : (
                    <SymbolBadge symbol={row.symbol} />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-bold tracking-[-0.02em] text-strong">
                        {row.symbol}
                      </span>
                      {watchSet.has(row.symbol) && (
                        <span aria-hidden className="text-xs text-primary">
                          ★
                        </span>
                      )}
                      <TimingChip tone={timing.tone}>{timing.label}</TimingChip>
                    </div>
                    <p className="mt-[3px] truncate text-sm text-body">
                      {m?.name ?? ""}
                    </p>
                  </div>
                </div>
                <div className="border-t border-line pt-3 sm:ml-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                  {headline ? (
                    <>
                      <p className="plate text-[10px] tracking-[0.09em]">
                        {headline.label}
                      </p>
                      <p className="figure mt-[3px] text-[19px] font-bold tracking-[-0.03em] text-strong sm:text-[21px]">
                        {headline.value}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">{t.common.noData}</p>
                  )}
                  {rest.length > 0 && (
                    <dl className="mt-2 flex flex-col gap-[3px] text-[11.5px] sm:items-end">
                      {rest.map((figure) => (
                        <div
                          key={figure.label}
                          className="flex items-baseline gap-2"
                        >
                          <dt className="text-muted">{figure.label}</dt>
                          <dd className="figure font-semibold text-body">
                            {figure.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ---- Katman 2: 184px mini kartlar ---- */}
      {mid.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          {mid.map((row) => {
            const m = meta[row.symbol];
            const timing = timingOf(row.hour, t);
            const { headline, rest } = cardFigures(row, m, locale, t, true);
            return (
              <Link
                key={row.id}
                href={`/hisse/${row.symbol}`}
                className="w-full sm:w-46 sm:shrink-0"
              >
                <div className="panel-hover flex h-full flex-col gap-[11px] rounded-[13px] border border-line bg-surface-solid p-3.5 transition-colors">
                  <div className="flex items-start gap-2">
                    {m?.logoUrl ? (
                      <Image
                        src={m.logoUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-[9px] border border-line bg-white object-contain p-0.5"
                      />
                    ) : (
                      <SymbolBadge symbol={row.symbol} size="sm" />
                    )}
                    <TimingChip tone={timing.tone} size="sm" className="ml-auto">
                      {timing.short}
                    </TimingChip>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold tracking-[-0.01em] text-strong">
                      {row.symbol}
                      {watchSet.has(row.symbol) && (
                        <span aria-hidden className="ml-1 text-primary">
                          ★
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {m?.name ?? ""}
                    </p>
                  </div>
                  {/* Her sayı kendi etiketiyle: dar kartta "1,84 Mr" tek
                      başına gelir mi kâr mı belli olmuyordu. */}
                  <dl className="mt-auto flex flex-col gap-[3px] border-t border-line pt-[9px] text-[11.5px]">
                    {(headline ? [headline, ...rest] : rest).map((figure) => (
                      <div
                        key={figure.label}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <dt className="text-muted">{figure.label}</dt>
                        <dd className="figure font-semibold text-body">
                          {figure.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ---- Katman 3: kalanlar, varsayılan kapalı ---- */}
      {rest.length > 0 && (
        <details className="group/details mt-2.5">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 py-1.5 text-[13px] text-muted transition-colors hover:text-body [&::-webkit-details-marker]:hidden">
            <CaretDown
              weight="duotone"
              size={15}
              className="transition-transform group-open/details:rotate-180"
            />
            {t.earnings.alsoReporting}
            <span className="numeral">({rest.length})</span>
          </summary>
          <Panel className="mt-1 px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-3.5">
              {[
                { label: t.earnings.beforeOpen, list: bmo, tone: "pre" as const },
                { label: t.earnings.afterClose, list: amc, tone: "post" as const },
                {
                  label: t.earnings.timeUnknown,
                  list: other,
                  tone: "neutral" as const,
                },
              ]
                .filter((group) => group.list.length > 0)
                .map((group) => (
                  <div key={group.label} className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 rounded-full",
                          group.tone === "pre"
                            ? "bg-up"
                            : group.tone === "post"
                              ? "bg-primary"
                              : "bg-flat",
                        )}
                      />
                      {group.label}
                      <span className="numeral">({group.list.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.list.map((row) => (
                        <Link
                          key={row.id}
                          href={`/hisse/${row.symbol}`}
                          className={cn(
                            "rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold transition-colors hover:border-line-strong hover:bg-primary-tint hover:text-primary",
                            watchSet.has(row.symbol)
                              ? "border-primary-faint bg-primary-wash text-primary"
                              : "text-body",
                          )}
                        >
                          {row.symbol}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </Panel>
        </details>
      )}
    </section>
  );
}
