/**
 * Yüzde alarmlarının SAF çekirdeği — tipler, eşik aralığı, değerlendirme.
 * Veritabansız ayrı modül (20 Ekim): istemcideki alarm düğmesi eşik
 * sınırlarını ve `thresholdDigits`i buradan alıyor, lib/percent-alerts.ts'in
 * `db`/şema içe aktarımları tarayıcı paketine girmesin diye — gerekçe
 * lib/price-alerts-core.ts. Okuma tarafı lib/percent-alerts.ts'te ve bu
 * modülü yeniden dışa aktarıyor.
 */

export type PercentDirection = "up" | "down";

export type PercentAlert = {
  id: string;
  symbol: string;
  direction: PercentDirection;
  thresholdPct: number;
  createdAt: string;
  triggeredAt: string | null;
  triggeredPct: number | null;
};

/** Eşiğin makul aralığı — %0,5 altı gürültü, %90 üstü yazım hatası. */
export const MIN_THRESHOLD_PCT = 0.5;
export const MAX_THRESHOLD_PCT = 90;

/**
 * Eşiğin GÖSTERİM hanesi — kayıtlı hassasiyet kadar (16 Ekim). Sabit bir
 * hane "2,25" eşiğini "2,3" basıyordu; −%2,26'da gelen bildirim "−%2,3
 * eşiği aşıldı" diyerek kendisiyle çelişiyordu. 0, 1 ya da 2 hane.
 */
export function thresholdDigits(value: number): number {
  const near = (x: number) => Math.abs(x - Math.round(x)) < 1e-6;
  return near(value) ? 0 : near(value * 10) ? 1 : 2;
}

export function isPercentDirection(value: unknown): value is PercentDirection {
  return value === "up" || value === "down";
}

/**
 * Günlük değişim eşiği geçti mi — eşitlik de geçmiş sayılır.
 * `changePct` null ise ÇAĞIRANIN atlaması gerekir: null "sıfır" değil
 * "önceki kapanış bilinmiyor" demek (lib/providers/alpaca.ts notu).
 */
export function percentCrossed(
  alert: Pick<PercentAlert, "direction" | "thresholdPct">,
  changePct: number,
): boolean {
  return alert.direction === "up"
    ? changePct >= alert.thresholdPct
    : changePct <= -alert.thresholdPct;
}
