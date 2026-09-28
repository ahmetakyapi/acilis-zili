import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  congressFilings,
  congressTrades,
  cusipTickers,
  investorFilings,
  investorHoldings,
} from "./schema";
import { INVESTORS, INVESTOR_PERIODS, type Investor } from "./investors";
import { getSecFiling, getSecFilings, type SecFilingRef } from "./providers/sec-13f";
import { mapCusips, openFigiLimits } from "./providers/openfigi";
import { getMemberPtrs, getPtrTrades } from "./providers/house-ptr";

/**
 * Ünlü yatırımcılar senkronu — idempotent (28 Eylül).
 *
 * Yeni dosya yoksa hiçbir şey çekmiyor: her yatırımcının SEC dosya listesi
 * (CIK başına bir istek) ve Kongre'nin yıllık indeksi (~60 KB) sorulur,
 * veritabanında olmayan erişim numarası ya da belge yoksa iş biter. 13F
 * sezonu dışında bu ~17 istek ve birkaç saniye.
 *
 * Next içe aktarmıyor: aynı kod günlük cron'dan (bütçeli) ve ilk doldurma
 * betiğinden (`scripts/sync-investors.ts`, bütçesiz) koşuyor. Önbellek
 * etiketini cron kendisi tazeliyor.
 *
 * SIRA ÖNEMLİ. Bütçe biterse eksik kalan eskiler olsun: dosyalar yeniden
 * eskiye, önce asıl bildirimler, sonra düzeltmeler. CUSIP eşlemesinde de
 * büyük pozisyon önce — okuyucunun ilk gördüğü satırların logosu olsun.
 */

export type SyncOptions = {
  /** `Date.now()` bu ana ulaşınca yeni iş başlatılmaz. */
  deadline?: number;
  /** Tek koşumda en fazla kaç 13F dosyası işlenir. */
  maxFilings?: number;
  /** Tek koşumda en fazla kaç OpenFIGI isteği. */
  maxFigiRequests?: number;
  /** Kongre indeksinin yılları; verilmezse içinde bulunulan yıl. */
  houseYears?: number[];
  log?: (message: string) => void;
};

type Report = { filings: number; failed: string[]; skipped: number; cusips: number; ptrs: number; trades: number };

const HOLDING_BATCH = 500;
/** Eşleşmeyen CUSIP bu kadar gün sonra yeniden sorulur (yeni halka arz, yeni sembol). */
const FIGI_RETRY_DAYS = 30;
const DAY_MS = 86_400_000;

function outOf(options: SyncOptions): boolean {
  return options.deadline !== undefined && Date.now() >= options.deadline;
}

/* --------------------------------------------------------------------------
   13F
   -------------------------------------------------------------------------- */

/**
 * Bir yatırımcının çekilecek dosyaları: son `INVESTOR_PERIODS` dönem, her
 * dönemde TERCİH EDİLEN CIK'in dosyaları (lib/investors.ts → sıra), henüz
 * veritabanında olmayanlar. Saf; sınanıyor.
 */
export function pendingFilings(
  investor: Pick<Investor, "ciks">,
  refs: readonly SecFilingRef[],
  known: ReadonlySet<string>,
  periods = INVESTOR_PERIODS,
): SecFilingRef[] {
  const relevant = refs.filter((ref) => ref.form === "13F-HR" || ref.form === "13F-HR/A");
  const wanted = [...new Set(relevant.map((ref) => ref.period))].sort().reverse().slice(0, periods);
  const out: SecFilingRef[] = [];
  for (const period of wanted) {
    const inPeriod = relevant.filter((ref) => ref.period === period);
    const cik = investor.ciks.find((candidate) => inPeriod.some((ref) => ref.cik === candidate));
    if (cik === undefined) continue;
    out.push(...inPeriod.filter((ref) => ref.cik === cik && !known.has(ref.accession)));
  }
  return out.sort(
    (a, b) =>
      b.period.localeCompare(a.period) ||
      (a.form === "13F-HR" ? 0 : 1) - (b.form === "13F-HR" ? 0 : 1) ||
      a.filedAt.localeCompare(b.filedAt),
  );
}

async function storeFiling(investor: Investor, ref: SecFilingRef, report: Report, log: (m: string) => void) {
  const parsed = await getSecFiling(ref);
  if (!parsed.ok) {
    report.failed.push(`${investor.slug} ${ref.accession}: ${parsed.message}`);
    return;
  }
  const { cover, holdings, valueTotal, valueScaled } = parsed.data;
  const amendment = ref.form === "13F-HR/A" ? (cover.amendment ?? "unknown") : null;
  const [row] = await db
    .insert(investorFilings)
    .values({
      investor: investor.slug,
      cik: ref.cik,
      accession: ref.accession,
      form: ref.form,
      amendment,
      period: ref.period,
      filedAt: ref.filedAt,
      valueTotal,
      entryCount: holdings.length,
      valueScaled,
    })
    .onConflictDoNothing()
    .returning({ id: investorFilings.id });
  if (!row) return;
  try {
    for (let i = 0; i < holdings.length; i += HOLDING_BATCH) {
      await db.insert(investorHoldings).values(
        holdings.slice(i, i + HOLDING_BATCH).map((holding) => ({ filingId: row.id, ...holding })),
      );
    }
  } catch (error) {
    /* Yarım yazılmış dosya kalmasın: satırlar düşerse kaydı da sil, ertesi
       koşum baştan dener (satırlar ON DELETE CASCADE ile gider). */
    await db.delete(investorFilings).where(eq(investorFilings.id, row.id));
    throw error;
  }
  report.filings += 1;
  log(
    `${investor.slug} ${ref.period} ${ref.form}${amendment ? ` (${amendment})` : ""} · ${holdings.length} pozisyon` +
      ` · ${(valueTotal / 1e9).toFixed(2)} Mr $${valueScaled ? " · bin dolar → dolar" : ""}`,
  );
}

async function sync13F(options: SyncOptions, report: Report, log: (m: string) => void) {
  const limit = options.maxFilings ?? Number.POSITIVE_INFINITY;
  for (const investor of INVESTORS) {
    if (investor.kind !== "13f") continue;
    if (outOf(options) || report.filings >= limit) {
      report.skipped += 1;
      continue;
    }
    const refs: SecFilingRef[] = [];
    for (const cik of investor.ciks) {
      const res = await getSecFilings(cik);
      if (res.ok) refs.push(...res.data);
      else report.failed.push(`${investor.slug} CIK ${cik}: ${res.message}`);
    }
    if (refs.length === 0) continue;
    const knownRows = await db
      .select({ accession: investorFilings.accession })
      .from(investorFilings)
      .where(eq(investorFilings.investor, investor.slug));
    const pending = pendingFilings(investor, refs, new Set(knownRows.map((row) => row.accession)));
    for (const ref of pending) {
      if (outOf(options) || report.filings >= limit) {
        report.skipped += 1;
        break;
      }
      await storeFiling(investor, ref, report, log);
    }
  }
}

/* --------------------------------------------------------------------------
   CUSIP → sembol
   -------------------------------------------------------------------------- */

async function resolveCusips(options: SyncOptions, report: Report, log: (m: string) => void) {
  const { batch, gapMs } = openFigiLimits();
  const maxRequests = options.maxFigiRequests ?? Number.POSITIVE_INFINITY;
  const retryBefore = new Date(Date.now() - FIGI_RETRY_DAYS * DAY_MS);
  let requests = 0;

  while (requests < maxRequests && !outOf(options)) {
    /* Hiç sorulmamış ya da eşleşmeyip süresi dolmuş CUSIP'ler, en büyük
       pozisyon önce. Opsiyon satırı da aynı CUSIP'i taşıyor. */
    const queue = await db
      .select({ cusip: investorHoldings.cusip, top: sql<number>`max(${investorHoldings.value})` })
      .from(investorHoldings)
      .leftJoin(cusipTickers, eq(cusipTickers.cusip, investorHoldings.cusip))
      .where(
        or(
          isNull(cusipTickers.cusip),
          and(isNull(cusipTickers.ticker), lt(cusipTickers.triedAt, retryBefore)),
        ),
      )
      .groupBy(investorHoldings.cusip)
      .orderBy(desc(sql`max(${investorHoldings.value})`))
      .limit(batch);
    if (queue.length === 0) break;

    if (requests > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
    const res = await mapCusips(queue.map((row) => row.cusip));
    requests += 1;
    if (!res.ok) {
      report.failed.push(`OpenFIGI: ${res.message}`);
      break;
    }
    const now = new Date();
    await db
      .insert(cusipTickers)
      .values(
        res.data.map((match) => ({
          cusip: match.cusip,
          ticker: match.ticker,
          figi: match.figi,
          name: match.name,
          securityType: match.securityType,
          resolvedAt: match.ticker ? now : null,
          triedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: cusipTickers.cusip,
        set: {
          ticker: sql`excluded.ticker`,
          figi: sql`excluded.figi`,
          name: sql`excluded.name`,
          securityType: sql`excluded.security_type`,
          resolvedAt: sql`excluded.resolved_at`,
          triedAt: sql`excluded.tried_at`,
        },
      });
    report.cusips += res.data.length;
    if (requests % 20 === 0) log(`OpenFIGI: ${report.cusips} CUSIP soruldu`);
  }
}

/* --------------------------------------------------------------------------
   Kongre bildirimleri
   -------------------------------------------------------------------------- */

async function syncCongress(options: SyncOptions, report: Report, log: (m: string) => void) {
  const years = options.houseYears ?? [new Date().getUTCFullYear()];
  for (const investor of INVESTORS) {
    if (investor.kind !== "congress" || !investor.house) continue;
    for (const year of years) {
      if (outOf(options)) {
        report.skipped += 1;
        continue;
      }
      const index = await getMemberPtrs(year, investor.house);
      if (!index.ok) {
        report.failed.push(`${investor.slug} ${year} indeks: ${index.message}`);
        continue;
      }
      if (index.data.length === 0) continue;
      const known = await db
        .select({ docId: congressFilings.docId })
        .from(congressFilings)
        .where(inArray(congressFilings.docId, index.data.map((filing) => filing.docId)));
      const seen = new Set(known.map((row) => row.docId));
      for (const filing of index.data) {
        if (seen.has(filing.docId)) continue;
        if (outOf(options)) {
          report.skipped += 1;
          break;
        }
        const parsed = await getPtrTrades(filing);
        if (!parsed.ok) {
          report.failed.push(`${investor.slug} PTR ${filing.docId}: ${parsed.message}`);
          continue;
        }
        await db
          .insert(congressFilings)
          .values({ docId: filing.docId, member: investor.slug, filedAt: filing.filedAt, tradeCount: parsed.data.length })
          .onConflictDoNothing();
        if (parsed.data.length > 0) {
          await db
            .insert(congressTrades)
            .values(parsed.data.map((trade) => ({ docId: filing.docId, member: investor.slug, ...trade })))
            .onConflictDoNothing();
        }
        report.ptrs += 1;
        report.trades += parsed.data.length;
        log(`${investor.slug} PTR ${filing.docId} (${filing.filedAt}) · ${parsed.data.length} işlem`);
      }
    }
  }
}

/**
 * Hepsi — cron ve betik bunu çağırıyor. Hata DEĞER olarak dönüyor (rapor
 * dizesinde); veritabanı hatası (tablo yok) fırlatılıyor ve cron onu
 * kendi `catch`inde rapora yazıyor.
 */
export async function syncInvestors(options: SyncOptions = {}): Promise<{ changed: boolean; summary: string }> {
  const log = options.log ?? (() => {});
  const report: Report = { filings: 0, failed: [], skipped: 0, cusips: 0, ptrs: 0, trades: 0 };
  await sync13F(options, report, log);
  await syncCongress(options, report, log);
  await resolveCusips(options, report, log);
  const parts = [
    `13F +${report.filings}`,
    `CUSIP ${report.cusips}`,
    `PTR +${report.ptrs} (${report.trades} işlem)`,
  ];
  if (report.skipped > 0) parts.push(`${report.skipped} iş bütçe yüzünden atlandı`);
  if (report.failed.length > 0) parts.push(`hata: ${report.failed.slice(0, 3).join(" | ")}`);
  return {
    changed: report.filings > 0 || report.cusips > 0 || report.ptrs > 0,
    summary: parts.join(" · "),
  };
}
