import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { etParts, todayEt } from "@/lib/market-hours";
import { effectiveSplits, splitAdjustments, type SplitAdjustment, type SplitLot } from "@/lib/portfolio-splits";
import { rowsOf } from "@/lib/portfolio-write";
import { getStockSplits } from "@/lib/providers/alpaca-corporate";

/**
 * Portföy partilerine hisse bölünmelerini uygular (24 Kasım; kural
 * lib/portfolio-splits.ts). `/api/cron/bolunme` çağırır.
 *
 * TEK DEYİM, KOŞULLU: parti yalnız OKUDUĞUMUZ adet ve maliyetteyse
 * güncellenir ve aynı deyim işaret defterini yazar. Arada okur sattıysa ya
 * da düzelttiyse satır eşleşmez, ne parti ne defter değişir; sonraki koşu
 * güncel satırla yeniden bakar. Ayrı iki deyimde defter yazılıp adet
 * yazılamazsa bölünme sessizce atlanmış olurdu.
 *
 * BİLİNEN SINIR: bölünmeden ÖNCE yapılmış bir satışın geri alınması
 * (`undoSale`) eski (bölünmemiş) adedi geri koyar. Geri alma satışın hemen
 * ardından kullanılıyor; araya bölünme girmesi nadir, okur partiyi elle
 * düzeltir (düzeltme defteri işaretler).
 */

/** Pencere tavanı: en eski partiden bu yana, en çok iki yıl geriye. */
const MAX_LOOKBACK_DAYS = 730;

export type SplitRun =
  | { ok: true; lots: number; symbols: number; splits: number; adjusted: SplitAdjustment[]; skipped: number }
  | { ok: false; reason: "no-table" | "db" | "provider"; detail?: string };

type LotRow = { id: string; symbol: string; quantity: string; cost_usd: string; bought_at: string; created_date: string; through: string | null };

export async function applyPendingSplits(now: Date = new Date()): Promise<SplitRun> {
  let rows: LotRow[];
  try {
    /* Defter tablosu yoksa (0047 uygulanmadı) sorgu düşer: hiçbir şey yazmadan dön. */
    const result = await db.execute(sql`
      select p.id, p.symbol, p.quantity::text as quantity, p.cost_usd::text as cost_usd,
             p.bought_at::text as bought_at,
             ((p.created_at at time zone 'America/New_York')::date)::text as created_date,
             m.through::text as through
        from portfolio_positions p
        left join portfolio_split_marks m on m.position_id = p.id`);
    rows = rowsOf(result) as LotRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: /portfolio_split_marks/.test(message) && /does not exist/.test(message) ? "no-table" : "db", detail: message.slice(0, 200) };
  }
  if (rows.length === 0) return { ok: true, lots: 0, symbols: 0, splits: 0, adjusted: [], skipped: 0 };

  const today = todayEt(now);
  const lots: SplitLot[] = rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    quantity: row.quantity,
    costUsd: row.cost_usd,
    boughtAt: row.bought_at,
    createdDate: row.created_date,
    through: row.through,
  }));
  const symbols = [...new Set(lots.map((lot) => lot.symbol))];
  const oldest = lots.reduce((min, lot) => (lot.boughtAt < min ? lot.boughtAt : min), today);
  const floor = new Date(Date.parse(`${today}T12:00:00Z`) - MAX_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const splitsResult = await getStockSplits(symbols, oldest > floor ? oldest : floor, today);
  if (!splitsResult.ok) return { ok: false, reason: "provider", detail: splitsResult.message };

  const splits = effectiveSplits(
    splitsResult.data.map((record) => ({ symbol: record.symbol, exDate: record.exDate, ratio: record.newRate / record.oldRate })),
    today,
    etParts(now).minutes,
  );
  const adjustments = splitAdjustments(lots, splits);
  const adjusted: SplitAdjustment[] = [];
  let skipped = 0;
  for (const adjustment of adjustments) {
    try {
      const result = await db.execute(sql`
        with updated as (
          update portfolio_positions
             set quantity = ${adjustment.quantity}::numeric, cost_usd = ${adjustment.costUsd}::numeric
           where id = ${adjustment.id}
             and quantity = ${adjustment.fromQuantity}::numeric
             and cost_usd = ${adjustment.fromCostUsd}::numeric
          returning id
        )
        insert into portfolio_split_marks (position_id, through, updated_at)
        select id, ${adjustment.through}::date, now() from updated
        on conflict (position_id) do update set through = excluded.through, updated_at = now()
        returning position_id`);
      if (rowsOf(result).length > 0) adjusted.push(adjustment);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { ok: true, lots: lots.length, symbols: symbols.length, splits: splits.length, adjusted, skipped };
}

/**
 * Okur partiyi elle düzeltti: rakamları bugünkü hâli sayılır, bugüne kadarki
 * bölünmeler bir daha uygulanmaz. Tablo yoksa sessizce düşer (düzeltmenin
 * kendisi zaten kaydedildi).
 */
export async function markSplitsReflected(positionId: string, now: Date = new Date()): Promise<void> {
  try {
    await db.execute(sql`
      insert into portfolio_split_marks (position_id, through, updated_at)
      values (${positionId}, ${todayEt(now)}::date, now())
      on conflict (position_id) do update set through = excluded.through, updated_at = now()`);
  } catch {
    /* 0047 uygulanmadıysa defter yok; düzeltme işi de koşmuyor. */
  }
}
