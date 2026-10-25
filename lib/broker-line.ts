import { commissionFor, SCENARIO_SHARE_PRICE, type Broker } from "@/content/brokers";

/**
 * Aracı kurum MALİYET ÇİZGİSİ — saf hesap (25 Ekim). Test
 * `tests/broker-line.test.ts`; çizim `components/brokers/BrokerCostLine.tsx`.
 *
 * Senaryo iki sabit tutardı (1.000 $ ve 10.000 $) ve iki ayrı ölçekle
 * çiziliyordu. Kaydırıcı okuyucunun KENDİ alım tutarını soruyor; her
 * kurumun tarifesi o tutardan geçiyor (`commissionFor`, tek hesap) ve
 * kurumlar tek bir ortak ölçekte, komisyona göre diziliyor.
 *
 * Sıra bir ÖNERİ DEĞİL: yalnız bu tutardaki işlem komisyonunun büyüklüğü.
 * Kur farkı, saklama, borsa ücretleri yok (tarifelerin çoğu yazmıyor);
 * ekran bunu künyede söylüyor. Eşit komisyonda veri dosyasının sırası
 * korunuyor — eşitliği bozan bir "kazanan" uydurulmuyor.
 *
 * Hesaplanamayan kurum (tarifesi çelişen ya da yalnız asgari veren) çizgiye
 * KONMUYOR ve nedeniyle ayrı listede: çizgide bir yer vermek, bilmediğimiz
 * bir ücreti biliyormuş gibi göstermek olurdu.
 */

/** Kaydırıcının durakları, dolar — ara değerler tarifelerin kırılma noktalarını (asgari ücretler) geçiyor. */
export const LINE_STEPS_USD = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000] as const;
export const LINE_DEFAULT_USD = 1_000;

export type LineEntry = {
  id: string;
  name: string;
  fee: number;
  /** Ücretin tutara oranı, yüzde. */
  pct: number;
  /** Aynı ücrette olanlar aynı sırayı paylaşır (1'den). */
  rank: number;
};

export type CostLine = {
  amount: number;
  priced: LineEntry[];
  unpriced: { id: string; name: string; reason: { tr: string; en: string } | null }[];
  min: number | null;
  max: number | null;
};

/** Sent altı farkı eşitlik say — tarife sentten küçük birim yazmıyor. */
const CENT = 0.005;

export function costLine(
  brokers: readonly Broker[],
  amount: number,
  sharePriceUsd: number = SCENARIO_SHARE_PRICE,
): CostLine {
  const priced: Omit<LineEntry, "rank">[] = [];
  const unpriced: CostLine["unpriced"] = [];
  for (const broker of brokers) {
    const fee = commissionFor(broker.commission, amount, sharePriceUsd);
    if (fee === null) {
      unpriced.push({
        id: broker.id,
        name: broker.name,
        reason: broker.commission.kind === "none" ? broker.commission.reason : null,
      });
      continue;
    }
    priced.push({ id: broker.id, name: broker.name, fee, pct: (fee / amount) * 100 });
  }
  /* Kararlı sıralama: eşitlikte veri dosyasının sırası. */
  const sorted = priced
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.fee - b.entry.fee || a.index - b.index)
    .map(({ entry }) => entry);
  const ranked: LineEntry[] = [];
  sorted.forEach((entry, i) => {
    const prev = ranked[i - 1];
    const rank = prev && Math.abs(prev.fee - entry.fee) < CENT ? prev.rank : i + 1;
    ranked.push({ ...entry, rank });
  });
  return {
    amount,
    priced: ranked,
    unpriced,
    min: ranked.length > 0 ? ranked[0].fee : null,
    max: ranked.length > 0 ? ranked[ranked.length - 1].fee : null,
  };
}
