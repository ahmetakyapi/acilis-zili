import { db } from "./db";
import { taxTariffs } from "./schema";
import { TAX_YEARS } from "./tax";
import { fetchGibTariff, listGibTariffs } from "./providers/gib-tariff";

/**
 * Gelir vergisi tarifesi senkronu — günlük cron, idempotent (28 Eylül).
 *
 * GİB portalının tarife listesi tek bir küçük JSON; her gün soruluyor. PDF
 * yalnızca tabloda OLMAYAN bir yıl için indiriliyor, yani yılda bir kez.
 * Kodda zaten olan yıl da bir kez okunup karşılaştırılıyor: GİB sonradan
 * düzeltme yayımlarsa ya da koddaki elle girilmiş sayı yanlışsa rapor
 * bunu "fark" diye söylüyor (kod ezilmiyor, gözle bakılıyor).
 */

/** Bu yıldan eskisi sorulmuyor: hesaplayıcı yalnızca son yılları taşıyor. */
const OLDEST_YEAR = 2025;

export async function syncTaxTariffs(): Promise<{ changed: boolean; summary: string }> {
  const list = await listGibTariffs();
  if (!list.ok) return { changed: false, summary: `hata: ${list.message}` };

  const stored = new Set((await db.select({ year: taxTariffs.year }).from(taxTariffs)).map((row) => row.year));
  const added: number[] = [];
  const notes: string[] = [];
  for (const link of list.data) {
    if (link.year < OLDEST_YEAR || stored.has(link.year)) continue;
    const tariff = await fetchGibTariff(link);
    if (!tariff.ok) {
      notes.push(tariff.message);
      continue;
    }
    const known = TAX_YEARS[link.year];
    if (known && JSON.stringify(known.brackets) !== JSON.stringify(tariff.data)) {
      notes.push(`${link.year}: GİB tarifesi koddakinden farklı, gözle bak`);
    }
    await db
      .insert(taxTariffs)
      .values({ year: link.year, brackets: tariff.data, sourceUrl: link.url })
      .onConflictDoNothing();
    if (!known) added.push(link.year);
  }
  const parts = [added.length > 0 ? `yeni yıl: ${added.join(", ")}` : "yeni yıl yok"];
  if (notes.length > 0) parts.push(notes.slice(0, 3).join(" | "));
  return { changed: added.length > 0, summary: parts.join(" · ") };
}
