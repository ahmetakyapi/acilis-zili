/**
 * Fiyat alarmlarının SAF çekirdeği — tipler, tavanlar, değerlendirme.
 *
 * VERİTABANSIZ AYRI MODÜL (20 Ekim). Bu parçalar lib/price-alerts.ts'teydi;
 * istemcideki alarm düğmesi (`components/alerts/PriceAlertButton.tsx`)
 * `alertProgress` ile `alertDistancePct`ı oradan aldığı için modülün üst
 * düzey `db` ve şema içe aktarımları da tarayıcı paketine giriyordu: Neon
 * sürücüsü, drizzle ve bütün `pgTable` tanımları — hisse sayfasında ve
 * favorilerde ~75 KB gzip, hiç çalışmayan kod ("DATABASE_URL tanımlı değil"
 * metni bile istemci parçasındaydı). Burada `db`, `@/lib/schema` ya da
 * React `cache` İÇE AKTARILMAZ; okuma tarafı lib/price-alerts.ts'te kalıyor
 * ve bu modülü yeniden dışa aktarıyor, sunucu çağıranları değişmedi.
 */

export type AlertDirection = "above" | "below";

export type PriceAlert = {
  id: string;
  symbol: string;
  direction: AlertDirection;
  target: number;
  refPrice: number | null;
  createdAt: string;
  triggeredAt: string | null;
  triggeredPrice: number | null;
};

/** Hesap başına ve sembol başına tavan — gerekçe `app/actions/alerts.ts`. */
export const MAX_ALERTS = 50;
export const MAX_ALERTS_PER_SYMBOL = 5;

export function isDirection(value: unknown): value is AlertDirection {
  return value === "above" || value === "below";
}

/** Fiyat hedefi geçti mi — eşitlik de geçmiş sayılır. */
export function alertCrossed(
  alert: Pick<PriceAlert, "direction" | "target">,
  price: number,
): boolean {
  return alert.direction === "above" ? price >= alert.target : price <= alert.target;
}

/**
 * Hedefe kalan yol, yüzde olarak ve FİYATA göre: "hedefe %4,2". Negatif
 * değer yok; geçilmişse 0.
 */
export function alertDistancePct(
  alert: Pick<PriceAlert, "direction" | "target">,
  price: number,
): number {
  if (price <= 0) return 0;
  const gap = alert.direction === "above" ? alert.target - price : price - alert.target;
  return Math.max(0, (gap / price) * 100);
}

/**
 * Kurulduğu fiyattan hedefe giden yolun ne kadarı alındı (0–1). Kuruluş
 * fiyatı yoksa ya da fiyat ters yöne gittiyse 0.
 */
export function alertProgress(
  alert: Pick<PriceAlert, "direction" | "target" | "refPrice">,
  price: number,
): number {
  if (alert.refPrice == null || alert.refPrice === alert.target) return 0;
  const done = (price - alert.refPrice) / (alert.target - alert.refPrice);
  return Math.min(1, Math.max(0, done));
}
