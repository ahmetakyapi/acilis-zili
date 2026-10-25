import "server-only";

import { indexMemberOf } from "@/db/seed/indices";
import type { MarketStatus } from "@/lib/market-hours";
import { PEER_METRICS, peerValue, type PeerMetric } from "@/lib/peer-spread";
import { getQuotes } from "@/lib/providers";
import { getSectorMetrics } from "@/lib/symbol-metrics";

/**
 * Temel Göstergeler'in sektör kulvarı için KOMŞULARIN değerleri.
 *
 * Hisse Skor Kartı'yla AYNI evren ve aynı fiyat isteği: satırlar
 * `getSectorMetrics` (istek içi önbellekli), kotasyonlar `getQuotes` aynı
 * sembol kümesiyle — anahtar sıralanmış dize olduğu için skor kartının
 * isteğiyle tek istek. Bayat kotasyon F/K'ye girmez (skor kartının
 * değerleme kuralı): fiyat tazeyken kurulmuş bir oran, dünkü fiyatla
 * sessizce kaymasın.
 *
 * Endeks üyesi değilse (GICS bilinmiyorsa) ya da tablo yoksa null — kart
 * yalın rakamlarla kalır.
 */
export async function sectorPeerValues(
  symbol: string,
  status: MarketStatus,
): Promise<{ sector: string; companies: number; values: Record<PeerMetric, number[]> } | null> {
  const sector = indexMemberOf(symbol)?.sector;
  if (!sector) return null;
  const rows = await getSectorMetrics(sector);
  if (!rows) return null;
  const peers = rows.filter((row) => row.symbol !== symbol);
  if (peers.length === 0) return null;
  const quotes = await getQuotes([symbol, ...peers.map((row) => row.symbol)], status);
  const priceOf = (s: string) => (quotes.ok && !quotes.stale ? (quotes.data[s]?.price ?? null) : null);
  const values = Object.fromEntries(
    PEER_METRICS.map((metric) => [
      metric,
      peers
        .map((row) =>
          peerValue({ symbol: row.symbol, currency: row.currency, metrics: row.metrics, price: priceOf(row.symbol), momentum: null }, metric),
        )
        .filter((v): v is number => v !== null),
    ]),
  ) as Record<PeerMetric, number[]>;
  return { sector, companies: peers.length + 1, values };
}
