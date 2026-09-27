import { daysBetweenEt, prevTradingDay, type MarketHoliday } from "@/lib/market-hours";
import type { CashDividend } from "@/lib/providers/alpaca-corporate";

/**
 * Temettü hesapları — saf fonksiyonlar (takvim ve hisse paneli ortak).
 *
 * İKİ KURAL, İKİSİ DE UYDURMA KESİNLİĞE KARŞI:
 *
 * 1. YILLIK GETİRİ YALNIZCA SIKLIK KANITLANABİLİYORSA. "Tutar × 4 / fiyat"
 *    yazmak her şirketin üç ayda bir ödediğini varsaymak olurdu; aylık
 *    ödeyen bir REIT'te getiriyi üçte bire, yılda bir ödeyen bir şirkette
 *    dört katına çıkarırdı. Sıklık geçmişten çıkarılıyor: ardışık hak kesim
 *    günleri arasındaki aralıklar tutarlıysa (hepsi medyanın yakınında) ve
 *    medyan bilinen bir kalıba (aylık, çeyreklik, altı aylık, yıllık)
 *    düşüyorsa. Aksi hâlde getiri HİÇ yazılmaz.
 *
 * 2. ALMAK İÇİN SON GÜN, HAK KESİMDEN BİR ÖNCEKİ İŞLEM GÜNÜ. ABD'de takas
 *    Mayıs 2024'ten beri T+1: hak kesim günü kayıt günüyle aynı ve temettüyü
 *    almak için hisse hak kesim gününden ÖNCEKİ işlem gününün kapanışına
 *    kadar alınmış olmalı. "Önceki gün" takvim günü değil: pazartesi hak
 *    kesimde son gün cuma, cuma tatilse perşembe. Tatil takvimi
 *    `lib/market-hours.ts`te; kopyası yazılmıyor.
 */

type Frequency = { perYear: number; minDays: number; maxDays: number };

/**
 * Kalıplar ve aralık bantları (gün). Bantlar geniş tutuldu: şirketler
 * hak kesim gününü haftanın gününe göre birkaç gün oynatıyor (Apple 2025:
 * 91, 91, 91, 91 gün; Coca-Cola 94, 77, 102 gün).
 */
const FREQUENCIES: readonly Frequency[] = [
  { perYear: 12, minDays: 20, maxDays: 45 },
  { perYear: 4, minDays: 70, maxDays: 115 },
  { perYear: 2, minDays: 150, maxDays: 215 },
  { perYear: 1, minDays: 320, maxDays: 410 },
];

/** Aralıkların medyandan en fazla bu oranda sapmasına izin var. */
const GAP_TOLERANCE = 0.4;
/** Sıklık için gereken en az aralık sayısı (üç ödeme). */
const MIN_GAPS = 2;
/**
 * Yıllık ödeyenlerde tek aralık yeterli sayılıyor: iki yıllık geçmişte
 * yalnızca iki ödeme var ve üçüncüyü beklemek, yıllık ödeyen hiçbir
 * şirkete getiri yazmamak demek.
 */
const MIN_GAPS_ANNUAL = 1;
const HALF = 0.5;
const PERCENT = 100;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) * HALF : sorted[middle];
}

/** Olağan (özel olmayan) temettüler, hak kesim sırasıyla, gün başına tek. */
export function regularHistory(dividends: readonly CashDividend[]): CashDividend[] {
  const byDate = new Map<string, CashDividend>();
  for (const item of dividends) {
    if (item.special) continue;
    byDate.set(item.exDate, item);
  }
  return [...byDate.values()].sort((a, b) => a.exDate.localeCompare(b.exDate));
}

/**
 * Yılda kaç ödeme — geçmişten kanıtlanabiliyorsa; yoksa null.
 * Girdi tek sembolün olağan temettüleri (bkz. `regularHistory`).
 */
export function inferFrequency(history: readonly CashDividend[]): number | null {
  const dates = [...new Set(history.map((item) => item.exDate))].sort();
  const gaps: number[] = [];
  for (let index = 1; index < dates.length; index++) {
    gaps.push(daysBetweenEt(dates[index - 1], dates[index]));
  }
  if (gaps.length === 0) return null;
  const typical = median(gaps);
  const pattern = FREQUENCIES.find((entry) => typical >= entry.minDays && typical <= entry.maxDays);
  if (!pattern) return null;
  const needed = pattern.perYear === 1 ? MIN_GAPS_ANNUAL : MIN_GAPS;
  if (gaps.length < needed) return null;
  const consistent = gaps.every((gap) => Math.abs(gap - typical) <= typical * GAP_TOLERANCE);
  return consistent ? pattern.perYear : null;
}

/**
 * Yıllık getiri tahmini, yüzde. Son olağan tutar × yıllık sıklık / fiyat.
 * Sıklık ya da fiyat yoksa, ödeme özel ya da yabancı ihraççıdansa null:
 * ADR tutarı kurla ve şirketin kendi para biriminde değişiyor, son tutarı
 * yıllığa çevirmek sahte bir kesinlik olurdu.
 */
export function annualYieldPct(
  dividend: Pick<CashDividend, "rate" | "special" | "foreign">,
  frequency: number | null,
  price: number | null | undefined,
): number | null {
  if (dividend.special || dividend.foreign || frequency === null) return null;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  return ((dividend.rate * frequency) / price) * PERCENT;
}

/**
 * Temettüyü almak için hissenin en geç alınması gereken işlem günü.
 * Tatil listesi okunamadıysa null: hafta sonunu bilmek yetmiyor, bir
 * tatil pazartesisinin öncesinde yanlış gün yazılırdı.
 */
export function lastBuyDay(exDate: string, holidays: readonly MarketHoliday[] | null): string | null {
  if (!holidays) return null;
  return prevTradingDay(exDate, [...holidays]);
}
