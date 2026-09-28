import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { congressFilings, congressTrades, cusipTickers, investorFilings, investorHoldings } from "./schema";
import { INVESTORS, investorBySlug, type Investor } from "./investors";
import {
  crowdMoves,
  detectSplit,
  diffPeriods,
  mergeHoldings,
  planFilingIds,
  planPeriods,
  topBuys,
  topSells,
  UNCHANGED_EPSILON,
  type CrowdEntry,
  type FilingRecord,
  type HoldingRecord,
  type Move,
  type PeriodDiff,
  type PeriodPlan,
} from "./investor-view";

/**
 * Ünlü yatırımcılar — okuma katmanı (28 Eylül).
 *
 * TABLO YOKKEN SESSİZ. Migration'lar deploy'da uygulanmıyor; kod tablodan
 * önce yayına inebilir. Her okuma hatayı yakalayıp `null` dönüyor ve
 * sayfa "henüz veri yok" boş durumunu basıyor (`user_avatars` deseni).
 *
 * İSTEKLER ARASI ÖNBELLEK. Veri günde en fazla bir kez değişiyor (günlük
 * cron) ama dizin on beş yatırımcının iki dönemini, yani birkaç bin satırı
 * okuyor. Hesap `unstable_cache` içinde, sonuç küçük (kart başına altı
 * pozisyon); cron yeni dosya yazınca `INVESTORS_TAG`i tazeliyor. Hata
 * önbelleğin DIŞINDA yakalanıyor: içerideki fonksiyon fırlatıyor, düşen
 * veritabanının boş cevabı bir saat saklanmıyor (`loadHolidays` gerekçesi).
 */

export const INVESTORS_TAG = "investors";
const REVALIDATE_SECONDS = 3_600;
/** Kartta ve kahramanda gösterilen en büyük pozisyon sayısı. */
export const CARD_TOP = 6;
/** Çeyreğin hareketleri şeridinde taraf başına satır. */
const MOVERS_LIMIT = 6;

function swallowed(source: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[yatirimcilar] ${source} okunamadı: ${message}`);
}

/* --------------------------------------------------------------------------
   Ortak parçalar
   -------------------------------------------------------------------------- */

/* Yalnızca hisse satırları. Tahviller (PRN) artık senkronda saklanmıyor
   (lib/providers/sec-13f.ts → aggregateHoldings); bu koşul ondan ÖNCE
   yazılmış satırları süzüyor. Dosya indeksindeki toplamlar da aynı koşulla. */
const STOCK_ONLY = eq(investorHoldings.amountType, "SH");

type IndexedFiling = FilingRecord & { investor: string; longValue: number; longCount: number };

/** Bütün dosyalar, dosya başına hisse (uzun) toplamıyla. ~150 satır. */
async function readFilingIndex(): Promise<IndexedFiling[]> {
  const rows = await db
    .select({
      id: investorFilings.id,
      investor: investorFilings.investor,
      cik: investorFilings.cik,
      accession: investorFilings.accession,
      form: investorFilings.form,
      amendment: investorFilings.amendment,
      period: investorFilings.period,
      filedAt: investorFilings.filedAt,
      valueScaled: investorFilings.valueScaled,
      longValue: sql<number>`coalesce((select sum(h.value) from investor_holdings h where h.filing_id = ${investorFilings.id} and h.position = 'long' and h.amount_type = 'SH'), 0)`,
      longCount: sql<number>`(select count(*) from investor_holdings h where h.filing_id = ${investorFilings.id} and h.position = 'long' and h.amount_type = 'SH')`,
    })
    .from(investorFilings);
  return rows.map((row) => ({ ...row, longValue: Number(row.longValue), longCount: Number(row.longCount) }));
}

async function readHoldings(filingIds: string[]): Promise<Map<string, HoldingRecord[]>> {
  const map = new Map<string, HoldingRecord[]>();
  if (filingIds.length === 0) return map;
  const rows = await db
    .select({
      filingId: investorHoldings.filingId,
      cusip: investorHoldings.cusip,
      position: investorHoldings.position,
      issuer: investorHoldings.issuer,
      titleOfClass: investorHoldings.titleOfClass,
      amount: investorHoldings.amount,
      amountType: investorHoldings.amountType,
      value: investorHoldings.value,
    })
    .from(investorHoldings)
    .where(and(inArray(investorHoldings.filingId, filingIds), STOCK_ONLY));
  for (const { filingId, ...holding } of rows) {
    const list = map.get(filingId) ?? [];
    list.push(holding);
    map.set(filingId, list);
  }
  return map;
}

async function readTickers(): Promise<Record<string, string | null>> {
  const rows = await db.select({ cusip: cusipTickers.cusip, ticker: cusipTickers.ticker }).from(cusipTickers);
  return Object.fromEntries(rows.map((row) => [row.cusip, row.ticker]));
}

function plansOf(index: readonly IndexedFiling[], investor: Investor): PeriodPlan[] {
  return planPeriods(
    index.filter((filing) => filing.investor === investor.slug),
    investor.ciks,
  );
}

/** Dönemin hisse toplamı ve pozisyon sayısı, dosya indeksinden (satır okumadan). */
function planTotals(plan: PeriodPlan, index: readonly IndexedFiling[]): { longValue: number; positionCount: number } {
  const ids = new Set(planFilingIds(plan));
  const files = index.filter((filing) => ids.has(filing.id));
  return {
    longValue: files.reduce((sum, filing) => sum + filing.longValue, 0),
    /* Ekler yeni pozisyon getiriyor; aynı CUSIP'i ikinci kez yazmıyorlar
       (gizli tutulan pozisyon tabanda yok). Toplam sayı güvenli. */
    positionCount: files.reduce((sum, filing) => sum + filing.longCount, 0),
  };
}

function periodHoldings(plan: PeriodPlan, holdings: Map<string, HoldingRecord[]>): HoldingRecord[] {
  return mergeHoldings(planFilingIds(plan).map((id) => holdings.get(id) ?? []));
}

/* --------------------------------------------------------------------------
   Dizin
   -------------------------------------------------------------------------- */

export type TopHolding = {
  cusip: string;
  issuer: string;
  ticker: string | null;
  weight: number;
  value: number;
  move: Move | null;
};

export type FundCard = {
  kind: "13f";
  slug: string;
  period: string;
  filedAt: string;
  longValue: number;
  optionValue: number;
  positionCount: number;
  counts: PeriodDiff["counts"];
  compared: boolean;
  top: TopHolding[];
  /** Eskiden yeniye; kartın küçük eğrisi. */
  history: { period: string; longValue: number }[];
};

export type TradeRow = {
  docId: string;
  rowNo: number;
  ticker: string | null;
  asset: string;
  assetType: string | null;
  txType: string;
  txDate: string;
  notifiedDate: string | null;
  amountLow: number | null;
  amountHigh: number | null;
  owner: string | null;
  description: string | null;
};

export type CongressCard = {
  kind: "congress";
  slug: string;
  lastFiled: string | null;
  trades: TradeRow[];
  buys: number;
  sells: number;
  total: number;
};

export type Overview = {
  cards: (FundCard | CongressCard)[];
  movers: { period: string | null; buys: CrowdEntry[]; sells: CrowdEntry[]; investors: number };
  /** En son dosyalanan 13F'in tarihi — damga (kaynak SEC). */
  latestFiled: string | null;
  /** Kahramanın toplamı: son dönemdeki hisse portföylerinin toplamı (kapanan fon hariç). */
  trackedValue: number;
};

const TRADE_COLUMNS = {
  docId: congressTrades.docId,
  rowNo: congressTrades.rowNo,
  ticker: congressTrades.ticker,
  asset: congressTrades.asset,
  assetType: congressTrades.assetType,
  txType: congressTrades.txType,
  txDate: congressTrades.txDate,
  notifiedDate: congressTrades.notifiedDate,
  amountLow: congressTrades.amountLow,
  amountHigh: congressTrades.amountHigh,
  owner: congressTrades.owner,
  description: congressTrades.description,
};

export function isBuy(txType: string): boolean {
  return txType === "P";
}
export function isSell(txType: string): boolean {
  return txType === "S" || txType.startsWith("S ");
}

const loadOverview = unstable_cache(
  async function loadOverview(): Promise<Overview> {
    const [index, tickers] = await Promise.all([readFilingIndex(), readTickers()]);
    const plansBySlug = new Map<string, PeriodPlan[]>();
    const wantedIds: string[] = [];
    for (const investor of INVESTORS) {
      if (investor.kind !== "13f") continue;
      const plans = plansOf(index, investor);
      plansBySlug.set(investor.slug, plans);
      for (const plan of plans.slice(0, 2)) wantedIds.push(...planFilingIds(plan));
    }
    const holdings = await readHoldings(wantedIds);

    /* Çeyreğin hareketleri yalnızca EN GÜNCEL dönemi bildirmiş ve hâlâ
       açık fonlardan: Burry'nin 2025 3. çeyreği "bu çeyrek" değil. */
    const latestPeriod =
      [...plansBySlug.entries()]
        .filter(([slug]) => investorBySlug(slug)?.status !== "closed")
        .map(([, plans]) => plans[0]?.period ?? "")
        .sort()
        .at(-1) || null;

    const cards: Overview["cards"] = [];
    const diffs: { slug: string; diff: PeriodDiff }[] = [];
    let latestFiled: string | null = null;
    let trackedValue = 0;

    for (const investor of INVESTORS) {
      if (investor.kind === "congress") {
        const trades = await db
          .select(TRADE_COLUMNS)
          .from(congressTrades)
          .where(eq(congressTrades.member, investor.slug))
          .orderBy(desc(congressTrades.txDate), congressTrades.docId, congressTrades.rowNo);
        const [last] = await db
          .select({ filedAt: congressFilings.filedAt })
          .from(congressFilings)
          .where(eq(congressFilings.member, investor.slug))
          .orderBy(desc(congressFilings.filedAt))
          .limit(1);
        cards.push({
          kind: "congress",
          slug: investor.slug,
          lastFiled: last?.filedAt ?? null,
          trades: trades.slice(0, 5),
          buys: trades.filter((trade) => isBuy(trade.txType)).length,
          sells: trades.filter((trade) => isSell(trade.txType)).length,
          total: trades.length,
        });
        /* Damga "SEC EDGAR" diyor: Kongre bildiriminin tarihi oraya
           karışmıyor (Pelosi'nin kartı kendi tarihini taşıyor). */
        continue;
      }
      const plans = plansBySlug.get(investor.slug) ?? [];
      const [current, previous] = plans;
      if (!current) continue;
      const diff = diffPeriods(
        periodHoldings(current, holdings),
        previous ? periodHoldings(previous, holdings) : null,
      );
      if (current.period === latestPeriod && investor.status !== "closed") {
        diffs.push({ slug: investor.slug, diff });
        trackedValue += diff.longValue;
      }
      if (!latestFiled || current.filedAt > latestFiled) latestFiled = current.filedAt;
      cards.push({
        kind: "13f",
        slug: investor.slug,
        period: current.period,
        filedAt: current.filedAt,
        longValue: diff.longValue,
        optionValue: diff.optionValue,
        positionCount: diff.positions.length,
        counts: diff.counts,
        compared: diff.compared,
        top: diff.positions.slice(0, CARD_TOP).map((position) => ({
          cusip: position.cusip,
          issuer: position.issuer,
          ticker: tickers[position.cusip] ?? null,
          weight: position.weight,
          value: position.value,
          move: position.move,
        })),
        history: plans
          .slice(0, 8)
          .map((plan) => ({ period: plan.period, longValue: planTotals(plan, index).longValue }))
          .reverse(),
      });
    }

    const crowd = crowdMoves(diffs, (cusip) => tickers[cusip] ?? null);
    return {
      cards,
      movers: {
        period: latestPeriod,
        buys: topBuys(crowd, MOVERS_LIMIT),
        sells: topSells(crowd, MOVERS_LIMIT),
        investors: diffs.filter(({ diff }) => diff.compared).length,
      },
      latestFiled,
      trackedValue,
    };
  },
  ["investors-overview-v2"],
  { revalidate: REVALIDATE_SECONDS, tags: [INVESTORS_TAG] },
);

export const getInvestorOverview = cache(async function getInvestorOverview(): Promise<Overview | null> {
  try {
    const overview = await loadOverview();
    return overview.cards.length > 0 ? overview : null;
  } catch (error) {
    swallowed("loadOverview", error);
    return null;
  }
});

/* --------------------------------------------------------------------------
   Detay
   -------------------------------------------------------------------------- */

export type FundDetail = {
  kind: "13f";
  slug: string;
  period: string;
  filedAt: string;
  cik: number;
  accession: string;
  valueScaled: boolean;
  amendments: number;
  diff: PeriodDiff;
  previousPeriod: string | null;
  tickers: Record<string, string | null>;
  history: { period: string; filedAt: string; longValue: number; positionCount: number }[];
};

export type CongressDetail = {
  kind: "congress";
  slug: string;
  trades: TradeRow[];
  filings: { docId: string; filedAt: string; tradeCount: number }[];
};

const loadFundDetail = unstable_cache(
  async function loadFundDetail(slug: string): Promise<FundDetail | null> {
    const investor = investorBySlug(slug);
    if (!investor || investor.kind !== "13f") return null;
    const index = await readFilingIndex();
    const plans = plansOf(index, investor);
    const [current, previous] = plans;
    if (!current) return null;
    const holdings = await readHoldings([
      ...planFilingIds(current),
      ...(previous ? planFilingIds(previous) : []),
    ]);
    const diff = diffPeriods(
      periodHoldings(current, holdings),
      previous ? periodHoldings(previous, holdings) : null,
    );
    const cusips = [
      ...new Set([...diff.positions, ...diff.options].map((h) => h.cusip).concat(diff.sold.map((s) => s.cusip))),
    ];
    const tickerRows =
      cusips.length > 0
        ? await db
            .select({ cusip: cusipTickers.cusip, ticker: cusipTickers.ticker })
            .from(cusipTickers)
            .where(inArray(cusipTickers.cusip, cusips))
        : [];
    return {
      kind: "13f",
      slug,
      period: current.period,
      filedAt: current.filedAt,
      cik: current.cik,
      accession: current.base.accession,
      valueScaled: current.valueScaled,
      amendments: current.additions.length + (current.base.amendment ? 1 : 0),
      diff,
      previousPeriod: previous?.period ?? null,
      tickers: Object.fromEntries(tickerRows.map((row) => [row.cusip, row.ticker])),
      history: plans
        .slice(0, 8)
        .map((plan) => ({ period: plan.period, filedAt: plan.filedAt, ...planTotals(plan, index) }))
        .reverse(),
    };
  },
  ["investors-detail-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [INVESTORS_TAG] },
);

const loadCongressDetail = unstable_cache(
  async function loadCongressDetail(slug: string): Promise<CongressDetail> {
    const [trades, filings] = await Promise.all([
      db
        .select(TRADE_COLUMNS)
        .from(congressTrades)
        .where(eq(congressTrades.member, slug))
        .orderBy(desc(congressTrades.txDate), congressTrades.docId, congressTrades.rowNo),
      db
        .select({ docId: congressFilings.docId, filedAt: congressFilings.filedAt, tradeCount: congressFilings.tradeCount })
        .from(congressFilings)
        .where(eq(congressFilings.member, slug))
        .orderBy(desc(congressFilings.filedAt)),
    ]);
    return { kind: "congress", slug, trades, filings };
  },
  ["investors-congress-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [INVESTORS_TAG] },
);

export const getInvestorDetail = cache(async function getInvestorDetail(
  slug: string,
): Promise<FundDetail | CongressDetail | null> {
  const investor = investorBySlug(slug);
  if (!investor) return null;
  try {
    if (investor.kind === "congress") {
      const detail = await loadCongressDetail(slug);
      return detail.trades.length > 0 ? detail : null;
    }
    return await loadFundDetail(slug);
  } catch (error) {
    swallowed(`detail ${slug}`, error);
    return null;
  }
});

/* --------------------------------------------------------------------------
   Hisse sayfası: bu hisseyi kim tutuyor
   -------------------------------------------------------------------------- */

export type StockHolder = {
  slug: string;
  period: string;
  amount: number;
  value: number;
  weight: number;
  move: Move | null;
  changePct: number | null;
  /** Tamamen sattıysa true — `amount`/`value` önceki dönemin. */
  exited: boolean;
};

export type StockInvestors = { holders: StockHolder[]; trades: (TradeRow & { member: string })[] };

const loadStockInvestors = unstable_cache(
  async function loadStockInvestors(ticker: string): Promise<StockInvestors> {
    const cusipRows = await db
      .select({ cusip: cusipTickers.cusip })
      .from(cusipTickers)
      .where(eq(cusipTickers.ticker, ticker));
    const cusips = new Set(cusipRows.map((row) => row.cusip));

    const holders: StockHolder[] = [];
    if (cusips.size > 0) {
      const index = await readFilingIndex();
      const wanted: { investor: Investor; current: PeriodPlan; previous: PeriodPlan | null }[] = [];
      for (const investor of INVESTORS) {
        if (investor.kind !== "13f") continue;
        const [current, previous] = plansOf(index, investor);
        if (current) wanted.push({ investor, current, previous: previous ?? null });
      }
      const ids = wanted.flatMap(({ current, previous }) => [
        ...planFilingIds(current),
        ...(previous ? planFilingIds(previous) : []),
      ]);
      const rows =
        ids.length > 0
          ? await db
              .select({
                filingId: investorHoldings.filingId,
                cusip: investorHoldings.cusip,
                position: investorHoldings.position,
                issuer: investorHoldings.issuer,
                titleOfClass: investorHoldings.titleOfClass,
                amount: investorHoldings.amount,
                amountType: investorHoldings.amountType,
                value: investorHoldings.value,
              })
              .from(investorHoldings)
              .where(
                and(
                  inArray(investorHoldings.filingId, ids),
                  inArray(investorHoldings.cusip, [...cusips]),
                  eq(investorHoldings.position, "long"),
                  STOCK_ONLY,
                ),
              )
          : [];
      const byFiling = new Map<string, HoldingRecord[]>();
      for (const { filingId, ...holding } of rows) {
        const list = byFiling.get(filingId) ?? [];
        list.push(holding);
        byFiling.set(filingId, list);
      }
      for (const { investor, current, previous } of wanted) {
        const cur = periodHoldings(current, byFiling);
        const prev = previous ? periodHoldings(previous, byFiling) : null;
        if (cur.length === 0 && (!prev || prev.length === 0)) continue;
        const { longValue } = planTotals(current, index);
        /* Aynı sembolün birden çok CUSIP'i (sınıf) olabilir; tek satırda topla. */
        const sum = (list: HoldingRecord[]) =>
          list.reduce((acc, h) => ({ amount: acc.amount + h.amount, value: acc.value + h.value }), { amount: 0, value: 0 });
        const now = sum(cur);
        const before = prev && prev.length > 0 ? sum(prev) : null;
        if (cur.length === 0) {
          if (before) {
            holders.push({ slug: investor.slug, period: current.period, amount: before.amount, value: before.value, weight: 0, move: "soldOut", changePct: -100, exited: true });
          }
          continue;
        }
        let move: Move | null = null;
        let changePct: number | null = null;
        if (prev && !before) {
          move = "new";
        } else if (before) {
          const shape = cur[0];
          const split = detectSplit({ ...shape, ...before }, { ...shape, ...now });
          /* SIFIR TABAN (28 Eylül denetimi): `parseInfoTable` 0 adetli satırı
             kabul ediyor; önceki adet 0 iken oran sonsuzdu ve panel
             "Infinity%" basıyordu. `diffPeriods` ile aynı koruma. */
          const base = before.amount * (split ?? 1);
          if (base > 0) {
            const change = now.amount / base - 1;
            move = Math.abs(change) < UNCHANGED_EPSILON ? "unchanged" : change > 0 ? "increased" : "decreased";
            changePct = change * 100;
          } else {
            move = "new";
          }
        }
        holders.push({
          slug: investor.slug,
          period: current.period,
          amount: now.amount,
          value: now.value,
          weight: longValue > 0 ? now.value / longValue : 0,
          move,
          changePct,
          exited: false,
        });
      }
    }

    const trades = await db
      .select({ ...TRADE_COLUMNS, member: congressTrades.member })
      .from(congressTrades)
      .where(eq(congressTrades.ticker, ticker))
      .orderBy(desc(congressTrades.txDate))
      .limit(6);

    holders.sort((a, b) => Number(a.exited) - Number(b.exited) || b.value - a.value);
    return { holders, trades };
  },
  ["investors-stock-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [INVESTORS_TAG] },
);

export const getStockInvestors = cache(async function getStockInvestors(ticker: string): Promise<StockInvestors | null> {
  try {
    const result = await loadStockInvestors(ticker);
    return result.holders.length > 0 || result.trades.length > 0 ? result : null;
  } catch (error) {
    swallowed(`stock ${ticker}`, error);
    return null;
  }
});
