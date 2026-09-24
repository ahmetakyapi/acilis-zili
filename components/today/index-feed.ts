import "server-only";

import { INDEX_STRIP } from "@/db/seed/symbols";
import { getQuotes } from "@/lib/providers";
import {
  SESSION_BOUNDS,
  etDateTimeToUtc,
  quoteBasis,
  type MarketStatus,
  type QuoteBasis,
} from "@/lib/market-hours";

/**
 * KAHRAMANIN ENDEKS PAKETİ — sunucu çizimi ile canlı tazelemenin TEK kaynağı.
 *
 * Aynı dört sembolü üç yer okuyor: kahramanın endeks kartları, alt şerit
 * (`TickerFeed`) ve seans içinde kartları tazeleyen `/api/endeks` ucu.
 * Üçü de `getQuotes([...INDEX_STRIP])` soruyor; anahtar sıralı sembol dizesi
 * olduğu için istek içinde tek tur (CLAUDE.md "İstemci ile sunucu sınırı").
 * Burada yalnızca istemciye inecek biçim kuruluyor: tarih nesneleri ISO
 * dizesine, her kotasyonun YÜZDESİNİN hangi seansı anlattığı da
 * `quoteBasis` ile sunucuda hesaplanıyor — istemcinin elinde `status` yok
 * ve kural tek yerde kalmalı (Veri dürüstlüğü 4).
 */
export type IndexQuote = {
  price: number;
  changePct: number | null;
  prevClose: number | null;
  tradedAt: string | null;
  basis: QuoteBasis;
};

export type IndexFeed =
  | {
      ok: true;
      source: string;
      fetchedAt: string;
      stale: boolean;
      quotes: Record<string, IndexQuote>;
    }
  | { ok: false };

export async function loadIndexFeed(status: MarketStatus): Promise<IndexFeed> {
  const result = await getQuotes([...INDEX_STRIP], status);
  if (!result.ok) return { ok: false };
  const quotes: Record<string, IndexQuote> = {};
  for (const symbol of INDEX_STRIP) {
    const quote = result.data[symbol];
    if (!quote) continue;
    quotes[symbol] = {
      price: quote.price,
      changePct: quote.changePct,
      prevClose: quote.prevClose,
      tradedAt: quote.tradedAt ? quote.tradedAt.toISOString() : null,
      basis: quoteBasis(quote, status),
    };
  }
  return {
    ok: true,
    source: result.source,
    fetchedAt: result.fetchedAt.toISOString(),
    stale: Boolean(result.stale),
    quotes,
  };
}

/**
 * Kıvılcım çizgisinin ZAMAN EKSENİ: anlatılan seans gününün 04:00'ı ile
 * uzatılmış seansın sonu, unix saniye. Barlar bu eksene zamanlarıyla
 * yerleşiyor; ön seansın kırk beşinci dakikasında çizgi kartın yalnızca
 * sol ucunu kaplıyor, günün ne kadarının geçtiği boş kalan sağ taraftan
 * okunuyor.
 *
 * Gün `sessionDate` — takvim günü değil (gece yarısından sonra hâlâ dünkü
 * seans anlatılıyor). Kapanış o günün kendi kapanışı; seans günü takvim
 * gününden geride kaldıysa `closeMinutes` bugünü anlatır ve olağan 16:00
 * kullanılır — `quoteBasis` ile aynı kabul. Saat aritmetiği
 * `lib/market-hours.ts`te kalıyor.
 */
export function sessionDomain(status: MarketStatus): {
  domain: [number, number];
  openAt: number;
  closeAt: number;
  /** Eksenin anlattığı ET günü — gün akışının işaretleri yalnızca bu günse çizilir. */
  day: string;
  /** Eksenin iki ucu, ET dakikası (04:00 ve uzatılmış seansın sonu). */
  minutes: [number, number];
} {
  const close =
    status.sessionDate === status.etDate
      ? status.closeMinutes
      : SESSION_BOUNDS.regularClose;
  const end = close + (SESSION_BOUNDS.afterHoursClose - SESSION_BOUNDS.regularClose);
  const at = (minutes: number) =>
    Math.round(
      etDateTimeToUtc(
        status.sessionDate,
        `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
      ).getTime() / 1000,
    );
  return {
    domain: [at(SESSION_BOUNDS.preMarketOpen), at(end)],
    openAt: at(SESSION_BOUNDS.regularOpen),
    closeAt: at(close),
    day: status.sessionDate,
    minutes: [SESSION_BOUNDS.preMarketOpen, end],
  };
}
