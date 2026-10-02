import { z } from "zod";
import { addEtDays } from "./market-hours";

/**
 * ORTALAMA ANALİST HEDEFİ — doğrulama kuralları (2 Ekim).
 *
 * Sayı bir sağlayıcıdan değil, günlük rutinin araştırmasından geliyor
 * (gerekçe `lib/schema.ts` → `analystTargets`). Araştırma yanlış bir sayı
 * okuyabilir ya da eski bir sayfadan alabilir; ekrana çıkmadan önce burada
 * duruyor. Kurallar SAF fonksiyonda ki test edilebilsin
 * (tests/analyst-targets.test.ts); yazma ucu (`/api/hedef`) yalnızca
 * bağlamı (bugün, canlı fiyat, önceki kayıt) toplayıp buraya soruyor.
 *
 *  - Tarih: gelecek değil, yedi günden eski değil. "Güncel ortalama"
 *    iddiası bir haftalık bir sayıyı taşımaz.
 *  - İç tutarlılık: düşük ≤ ortalama ≤ yüksek, medyan da aralıkta; analist
 *    sayısı en az bir (sayısız "ortalama" bir ortalama değil).
 *  - Kaynak: adı ve https adresi zorunlu — ekranda künye, okuyucu
 *    tıklayıp doğrulayabilsin.
 *  - Makullük: ortalama canlı fiyatın üçte biri ile üç katı arasında.
 *    Ölçeği kaçmış bir okuma (bölünme öncesi fiyat, binlik ayraç
 *    karışıklığı: 1.600 → 1,6) burada yakalanıyor.
 *  - Sıçrama: son on dört gündeki kayıttan %20'den fazla sapma reddedilir;
 *    rutin sebebini doğruladıysa `confirm_jump` ile yazar. Konsensüs gün
 *    gün böyle oynamaz — oynarsa çoğu zaman bölünme ya da okuma hatası.
 */

export const targetItemSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,9}$/),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mean: z.number().finite().positive(),
  median: z.number().finite().positive().nullish(),
  high: z.number().finite().positive().nullish(),
  low: z.number().finite().positive().nullish(),
  analyst_count: z.number().int().min(1).max(100),
  source: z.string().trim().min(2).max(40),
  source_url: z.string().trim().url().startsWith("https://").max(500),
  confirm_jump: z.boolean().optional(),
});
export type TargetItem = z.infer<typeof targetItemSchema>;

export const TARGET_INPUT_SHAPE = {
  items: [
    {
      symbol: "MU",
      as_of: "YYYY-MM-DD",
      mean: 1600,
      median: "1650 | null",
      high: "2000 | null",
      low: "1100 | null",
      analyst_count: 32,
      source: "MarketBeat",
      source_url: "https://…",
      confirm_jump: "true — yalnızca %20+ sapma doğrulandıysa",
    },
  ],
};

export const MAX_TARGET_AGE_DAYS = 7;
const PRICE_RATIO_MIN = 1 / 3;
const PRICE_RATIO_MAX = 3;
const JUMP_LIMIT = 0.2;
const JUMP_WINDOW_DAYS = 14;

export type TargetRejection =
  | "future-date"
  | "too-old"
  | "range-order"
  | "median-out-of-range"
  | "implausible-vs-price"
  | "jump-unconfirmed";

export function validateTarget(
  item: TargetItem,
  context: {
    todayEt: string;
    /** Canlı fiyat; yoksa makullük kontrolü atlanır (öteki kurallar yeter). */
    price: number | null;
    previous: { mean: number; asOf: string } | null;
  },
): { ok: true } | { ok: false; reason: TargetRejection } {
  if (item.as_of > context.todayEt) return { ok: false, reason: "future-date" };
  if (item.as_of < addEtDays(context.todayEt, -MAX_TARGET_AGE_DAYS)) return { ok: false, reason: "too-old" };
  const { low, high, median, mean } = item;
  if ((low != null && low > mean) || (high != null && high < mean) || (low != null && high != null && low > high)) {
    return { ok: false, reason: "range-order" };
  }
  if (median != null && ((low != null && median < low) || (high != null && median > high))) {
    return { ok: false, reason: "median-out-of-range" };
  }
  if (context.price && context.price > 0) {
    const ratio = mean / context.price;
    if (ratio < PRICE_RATIO_MIN || ratio > PRICE_RATIO_MAX) return { ok: false, reason: "implausible-vs-price" };
  }
  const prev = context.previous;
  if (
    prev &&
    prev.asOf >= addEtDays(item.as_of, -JUMP_WINDOW_DAYS) &&
    Math.abs(mean / prev.mean - 1) > JUMP_LIMIT &&
    !item.confirm_jump
  ) {
    return { ok: false, reason: "jump-unconfirmed" };
  }
  return { ok: true };
}
