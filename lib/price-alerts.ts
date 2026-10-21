import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { isSessionTrade, type MarketStatus } from "@/lib/market-hours";
import { isDirection, type PriceAlert } from "@/lib/price-alerts-core";
import type { Quote } from "@/lib/providers/types";
import { priceAlerts } from "@/lib/schema";

/**
 * Fiyat alarmları — okuma ve saf değerlendirme. Yazma `app/actions/alerts.ts`,
 * sayfada tetik lib/alert-settle.ts, tarama app/api/cron/alarmlar.
 *
 * Gerekçe ve tetik anlamı şemada (`lib/schema.ts` → priceAlerts). Kısaca:
 * alarm, okuyucunun güncel bir kotasyon gördüğü sayfada değerlendiriliyor
 * ve tetik anı "hedefin geçildiğinin GÖRÜLDÜĞÜ kontrol".
 *
 * SUNUCU TARAFI. Tipler, tavanlar ve `alertCrossed`/`alertProgress` gibi saf
 * değerlendiriciler lib/price-alerts-core.ts'te ve buradan yeniden dışa
 * aktarılıyor (20 Ekim); istemci bileşeni ÇEKİRDEĞİ içe aktarır, bu modülü
 * değil — bu modülün `db` içe aktarımı tarayıcı paketine Neon sürücüsünü
 * taşıyordu (gerekçe çekirdeğin künyesinde).
 */

export * from "@/lib/price-alerts-core";

/** Değerlendirmenin bir kotasyondan okuduğu üç alan. */
export type SessionQuote = Pick<Quote, "price" | "changePct" | "tradedAt">;

/**
 * SEMBOL BAŞINA SEANS KAPISI (16 Ekim) — alarm yalnız BU seansın işlemini
 * taşıyan kotasyonla değerlendirilir.
 *
 * Tazelik paketin geneline soruluyordu (`packCurrent`, paketteki EN YENİ
 * işlem). Tarama bütün bekleyen sembolleri tek pakette istiyor: ön seansta
 * NVDA işlem görünce paket "güncel" sayılıyor, henüz işlem görmemiş bir
 * hissenin kotasyonu ise hâlâ DÜNÜN işlemini ve dünün yüzdesini taşıyor.
 * "Bugün %5 düşerse haber ver" alarmı sabah dünkü düşüşle tetikleniyor ve
 * okuyucunun telefonuna yanlış bir haber gidiyordu. 04:00–04:15 ET arasında
 * paket kuralı işlemlere hiç bakmıyor (`closedResponseCurrent`) — o pencerede
 * de her kotasyon önceki seansındı.
 *
 * Tek ölçü ekranla aynı: `isSessionTrade` (CLAUDE.md "Veri dürüstlüğü" 4).
 * Seansa ait olmayan sembol atlanır; ilk işlemi gelince değerlendirilir.
 */
export function sessionReadings(
  quotes: Record<string, SessionQuote | null | undefined>,
  status: MarketStatus,
): { prices: Record<string, number>; changes: Record<string, number | null> } {
  const prices: Record<string, number> = {};
  const changes: Record<string, number | null> = {};
  for (const [symbol, quote] of Object.entries(quotes)) {
    if (!quote || !isSessionTrade(quote.tradedAt, status)) continue;
    prices[symbol] = quote.price;
    changes[symbol] = quote.changePct;
  }
  return { prices, changes };
}

function toAlert(row: typeof priceAlerts.$inferSelect): PriceAlert | null {
  if (!isDirection(row.direction)) return null;
  const target = Number(row.target);
  if (!Number.isFinite(target)) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    target,
    refPrice: row.refPrice == null ? null : Number(row.refPrice),
    createdAt: row.createdAt.toISOString(),
    triggeredAt: row.triggeredAt ? row.triggeredAt.toISOString() : null,
    triggeredPrice: row.triggeredPrice == null ? null : Number(row.triggeredPrice),
  };
}

/**
 * Hesabın bütün alarmları, eskiden yeniye.
 *
 * `available: false` TABLO YOK demek (migration henüz uygulanmamış):
 * arayüz o zaman alarm bölümünü hiç basmıyor — kurulamayacak bir alarm
 * düğmesi göstermek tıklamayı yutmak olurdu. Hata yutuluyor ve bu bilinçli
 * (aynı kalıp `lib/avatar-data.ts`).
 *
 * İstek içinde önbellekli: hisse sayfasında başlık ve alarm düğmesi aynı
 * istekte soruyor.
 */
export const getUserAlerts = cache(
  async (userId: string): Promise<{ available: boolean; alerts: PriceAlert[] }> => {
    try {
      const rows = await db
        .select()
        .from(priceAlerts)
        .where(eq(priceAlerts.userId, userId))
        .orderBy(asc(priceAlerts.createdAt));
      return {
        available: true,
        alerts: rows.map(toAlert).filter((alert): alert is PriceAlert => alert !== null),
      };
    } catch {
      return { available: false, alerts: [] };
    }
  },
);

/* Sayfada değerlendirme (`settleAlerts`) sunucuya özel modülde: lib/alert-settle.ts. */
