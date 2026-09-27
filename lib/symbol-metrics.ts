import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { symbolMetrics, symbols as symbolsTable } from "@/lib/schema";
import { ALL_MEMBERS, indexMemberOf, primaryOnly } from "@/db/seed/indices";
import { getRawMetrics } from "@/lib/providers/finnhub-depth";
import { parseStoredMetrics, storedMetricsFrom, type StoredMetrics } from "@/lib/scorecard";

/**
 * `symbol_metrics` tablosunun okuma ve yazma yolu.
 *
 * Tablo yokken (migration henüz uygulanmadıysa) her fonksiyon SESSİZCE
 * düşüyor: okuma `null`, yazma hiçbir şey. Skor kartı o zaman "Hazırlanıyor"
 * der, sayfanın geri kalanı etkilenmez (`lib/avatar-data.ts` ile aynı desen).
 */

/**
 * Cron koşumu başına tazelenen sembol. Günlük koşum Finnhub'a zaten ~84
 * istek atıyor ve bütçesi 100 saniye (gerekçe cron dosyasının başında);
 * on beş istek toplamı ~99'a çıkarıyor, dakikada 60 sınırıyla yüz saniyelik
 * bütçenin tam içinde. ~500 üyelik evren böylece yedi iş haftasında bir
 * dönüyor — marj, büyüme ve borç çeyrekte bir değişen ölçüler, kabul
 * edilebilir. Sayfa ziyareti kendi satırını ayrıca tazeliyor ve kota
 * dolarsa (429) paket o anda kesiliyor.
 */
export const SYMBOL_METRICS_BATCH = 15;

/**
 * Sayfa ziyaretinin kendi satırını yeniden yazması için gereken yaş. Sayfa
 * metriği zaten çekiyor (Anahtar Metrikler, aynı önbellek anahtarı), yani
 * yazmanın sağlayıcı maliyeti yok; eşik yalnızca her ziyarette veritabanına
 * yazmamak için.
 */
const SELF_REFRESH_MS = 24 * 60 * 60 * 1000;

/** Skor kartının evreni: GICS sektörü bilinen, birincil sınıf endeks üyeleri. */
export function scorecardUniverse(): { symbol: string; sector: string }[] {
  return primaryOnly(ALL_MEMBERS)
    .filter((member): member is typeof member & { sector: string } => Boolean(member.sector))
    .map((member) => ({ symbol: member.symbol, sector: member.sector }));
}

export type SectorMetricsRow = {
  symbol: string;
  currency: string | null;
  metrics: StoredMetrics;
  updatedAt: Date;
};

/** Sektördeki bütün satırlar; tablo yoksa null. */
export async function getSectorMetrics(sector: string): Promise<SectorMetricsRow[] | null> {
  try {
    const rows = await db
      .select({
        symbol: symbolMetrics.symbol,
        currency: symbolMetrics.currency,
        metrics: symbolMetrics.metrics,
        updatedAt: symbolMetrics.updatedAt,
      })
      .from(symbolMetrics)
      .where(eq(symbolMetrics.sector, sector));
    return rows.flatMap((row) => {
      const metrics = parseStoredMetrics(row.metrics);
      return metrics ? [{ ...row, metrics }] : [];
    });
  } catch {
    return null;
  }
}

async function upsert(symbol: string, sector: string, currency: string | null, metrics: StoredMetrics): Promise<boolean> {
  try {
    const now = new Date();
    await db
      .insert(symbolMetrics)
      .values({ symbol, sector, currency, metrics, updatedAt: now })
      .onConflictDoUpdate({
        target: symbolMetrics.symbol,
        set: { sector, currency, metrics, updatedAt: now },
      });
    return true;
  } catch {
    return false;
  }
}

/**
 * Sayfa ziyaretinde kendi satırını yaz — ham metrik zaten çekilmiş.
 * Evrenin dışındaki sembol (GICS yok) yazılmıyor: sektörsüz bir satır hiçbir
 * karşılaştırmaya giremez.
 */
export async function rememberOwnMetrics(
  symbol: string,
  raw: Record<string, unknown>,
  currency: string | null,
  existing: SectorMetricsRow | undefined,
): Promise<void> {
  const sector = indexMemberOf(symbol)?.sector;
  if (!sector) return;
  if (existing && Date.now() - existing.updatedAt.getTime() < SELF_REFRESH_MS) return;
  await upsert(symbol, sector, currency, storedMetricsFrom(raw));
}

/**
 * Cron adımı: hiç yazılmamış semboller önce, sonra en eski güncellenenler.
 *
 * Hiç yazılmamışlar SEKTÖR SEKTÖR sıralanıyor: bir sektörün yüzdeliği ancak
 * `SCORECARD_MIN_PEERS` komşu dolunca açılıyor. Sembolleri sektörler arasında
 * dağıtmak, ilk haftalarda hiçbir sektörü eşiğe ulaştırmadan hepsini yarım
 * bırakırdı; sırayla doldurmak ilk koşumda bir sektörü açıyor.
 */
export async function refreshSymbolMetrics({
  limit = SYMBOL_METRICS_BATCH,
  outOfTime,
}: {
  limit?: number;
  outOfTime: () => boolean;
}): Promise<string> {
  let existing: Map<string, number>;
  try {
    const rows = await db
      .select({ symbol: symbolMetrics.symbol, updatedAt: symbolMetrics.updatedAt })
      .from(symbolMetrics);
    existing = new Map(rows.map((row) => [row.symbol, row.updatedAt.getTime()]));
  } catch {
    return "atlandı: symbol_metrics tablosu yok";
  }

  const universe = scorecardUniverse();
  const missing = universe
    .filter((entry) => !existing.has(entry.symbol))
    .sort((a, b) => a.sector.localeCompare(b.sector));
  const stale = universe
    .filter((entry) => existing.has(entry.symbol))
    .sort((a, b) => existing.get(a.symbol)! - existing.get(b.symbol)!);
  const targets = [...missing, ...stale].slice(0, limit);
  if (targets.length === 0) return "0";

  const currencies = new Map<string, string | null>();
  try {
    const rows = await db
      .select({ symbol: symbolsTable.symbol, currency: symbolsTable.currency })
      .from(symbolsTable)
      .where(inArray(symbolsTable.symbol, targets.map((entry) => entry.symbol)));
    for (const row of rows) currencies.set(row.symbol, row.currency);
  } catch {
    // para birimi bilinmiyorsa null: değerleme ekseni o sembolde kapanır
  }

  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (const entry of targets) {
    if (outOfTime()) {
      skipped++;
      continue;
    }
    const result = await getRawMetrics(entry.symbol);
    if (!result.ok) {
      failed++;
      /* Kota dolduysa kalanı zorlamak yalnızca 429 biriktirir. */
      if (result.reason === "rate-limited") break;
      continue;
    }
    if (await upsert(entry.symbol, entry.sector, currencies.get(entry.symbol) ?? null, storedMetricsFrom(result.data))) {
      written++;
    }
  }
  const notes = [skipped > 0 ? `${skipped} atlandı` : null, failed > 0 ? `${failed} hata` : null].filter(Boolean);
  return notes.length > 0 ? `${written} (${notes.join(", ")})` : String(written);
}
