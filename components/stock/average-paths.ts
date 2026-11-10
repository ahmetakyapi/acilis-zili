/**
 * Hareketli Ortalamalar kartının çizimi için SERİLER (10 Kasım 2026).
 *
 * Kart yalnız üç sayının son değerini basıyordu; ortalamaların fiyata göre
 * NASIL geldiği (yaklaşıyor mu, kesti mi) okunmuyordu. Aynı barlardan —
 * kart zaten `getChartBars(symbol, "1Y")` çekiyor, yeni istek yok — fiyatın
 * ve her pencerenin kayan ortalamasının yolu çıkarılıyor.
 *
 * PENCERE DOLMADAN NOKTA YOK (`hareketliOrtalama` ile aynı kural, lib/utils.ts):
 * 200 günlük ortalama ilk 199 barda `null`; yol o noktada başlar, yarım
 * pencereden değer uydurulmaz. Geçersiz kapanış görülen pencere de `null`.
 *
 * Saf fonksiyonlar; testi tests/average-paths.test.ts.
 */

/** Her bar için kayan ortalama; pencere dolmadıysa ya da veri bozuksa null. */
export function rollingAverage(closes: readonly number[], window: number): (number | null)[] {
  if (!Number.isInteger(window) || window <= 0) return closes.map(() => null);
  const out: (number | null)[] = [];
  let sum = 0;
  /** Pencerede kaç geçersiz değer var; sıfır değilse ortalama basılmaz. */
  let bad = 0;
  const valid = (v: number) => typeof v === "number" && Number.isFinite(v);
  for (let i = 0; i < closes.length; i++) {
    const entering = closes[i]!;
    if (valid(entering)) sum += entering;
    else bad++;
    if (i >= window) {
      const leaving = closes[i - window]!;
      if (valid(leaving)) sum -= leaving;
      else bad--;
    }
    out.push(i >= window - 1 && bad === 0 ? sum / window : null);
  }
  return out;
}

/** Çizim alanı: değerlerin en küçüğü ile en büyüğü, iki yanda `pad` oranında pay. */
export function seriesDomain(series: readonly (readonly (number | null)[])[], pad = 0.06): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s) {
      if (v === null || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const span = max - min || Math.abs(max) || 1;
  return { min: min - span * pad, max: max + span * pad };
}

/**
 * 0–100 × 0–100 alanında SVG yolu. `null` aralıkta yol kesilir (M ile
 * yeniden başlar); tek noktalık parça çizilmez. Y ekseni ters: büyük değer
 * yukarıda.
 */
export function seriesPath(values: readonly (number | null)[], domain: { min: number; max: number }): string {
  const n = values.length;
  if (n < 2) return "";
  const span = domain.max - domain.min || 1;
  const parts: string[] = [];
  let open = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      open = false;
      continue;
    }
    const next = values[i + 1];
    const hasNext = next !== null && next !== undefined && Number.isFinite(next);
    if (!open && !hasNext) continue;
    const x = (i / (n - 1)) * 100;
    const y = (1 - (v - domain.min) / span) * 100;
    parts.push(`${open ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
    open = true;
  }
  return parts.join(" ");
}

/** Değerin alandaki dikey yeri, yüzde (0 üst, 100 alt). */
export function seriesY(value: number, domain: { min: number; max: number }): number {
  const span = domain.max - domain.min || 1;
  return Math.min(100, Math.max(0, (1 - (value - domain.min) / span) * 100));
}
