/**
 * Çift çizgi grafiğinin SAF geometrisi (25 Ekim, kişisel ekranlar turu).
 *
 * Grafik iki yüzde serisini (portföy ↔ SPY, tema medyanı ↔ ölçüt fonu)
 * aynı eksende çiziyor ve aradaki farkı bir ALAN olarak boyuyor: A, B'nin
 * üstündeyse `--up-wash`, altındaysa `--down-wash`. Alan iki çizginin
 * kesiştiği yerde bölünüyor; kesişme noktası doğrusal aradeğerle bulunuyor
 * ki bant çizgiden taşmasın. Çizim bileşeni (`components/charts/DuoLineChart`)
 * istemcide; buradaki hesap sunucu ve test için de aynı, DOM'suz.
 */

/** Grafiğin bir noktası — `b` yoksa (seri o gün yok) fark alanı orada kesilir. */
export type DuoValue = { a: number; b: number | null };

export type GapBand = {
  /** `up`: A ≥ B; `down`: A < B. */
  sign: "up" | "down";
  /** Kapalı çokgenin köşeleri, veri biriminde: [x (indis, kesirli), y (yüzde)]. */
  points: [number, number][];
};

const signOf = (diff: number): GapBand["sign"] => (diff >= 0 ? "up" : "down");

/**
 * A ile B arasındaki fark bantları.
 *
 * Her bant: A'nın üst kenarı soldan sağa, B'nin kenarı sağdan sola. İşaret
 * değiştiği segmentte kesişme noktası (t = d0 / (d0 − d1)) iki bandın ortak
 * köşesi oluyor. B'si olmayan nokta bandı bitiriyor; tek noktalık bant
 * alan kaplamadığı için düşülüyor.
 */
export function gapBands(values: readonly DuoValue[]): GapBand[] {
  const bands: GapBand[] = [];
  let top: [number, number][] = [];
  let bottom: [number, number][] = [];
  let sign: GapBand["sign"] | null = null;

  const close = () => {
    if (sign !== null && top.length >= 2) {
      bands.push({ sign, points: [...top, ...bottom.reverse()] });
    }
    top = [];
    bottom = [];
    sign = null;
  };

  for (let i = 0; i < values.length; i += 1) {
    const { a, b } = values[i];
    if (b === null || !Number.isFinite(a) || !Number.isFinite(b)) {
      close();
      continue;
    }
    const diff = a - b;
    const current = signOf(diff);
    if (sign === null) {
      sign = current;
      top.push([i, a]);
      bottom.push([i, b]);
      continue;
    }
    if (current !== sign && diff !== 0) {
      /* İşaret bu segmentte değişti: kesişmeyi bul, eski bandı orada kapat,
         yenisini aynı noktadan aç. Önceki nokta kesin olarak var (sign ≠ null). */
      const prev = values[i - 1];
      const d0 = prev.a - (prev.b as number);
      const t = d0 / (d0 - diff);
      const x = i - 1 + t;
      const y = prev.a + (a - prev.a) * t;
      top.push([x, y]);
      bottom.push([x, y]);
      close();
      sign = current;
      top.push([x, y]);
      bottom.push([x, y]);
    }
    top.push([i, a]);
    bottom.push([i, b]);
  }
  close();
  return bands;
}

/**
 * Dikey ölçeğin uçları — sıfır her zaman içeride (iki seri de sıfırdan
 * okunuyor), üstte ve altta %8 pay. Bütün değerler sıfırsa ±1.
 */
export function duoDomain(values: readonly DuoValue[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const { a, b } of values) {
    if (Number.isFinite(a)) {
      if (a < min) min = a;
      if (a > max) max = a;
    }
    if (b !== null && Number.isFinite(b)) {
      if (b < min) min = b;
      if (b > max) max = b;
    }
  }
  const span = max - min;
  if (span === 0) return { min: -1, max: 1 };
  const pad = span * 0.08;
  return { min: min - pad, max: max + pad };
}

/** "Yuvarlak" adımlar — ölçek çizgileri 1-2-5 dizisinde. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * Ölçek çizgileri: sıfır ve iki yönde yuvarlak adımlar, en fazla `count`
 * çizgi. Sayı grafiğin üstünde etiket olarak duruyor; okuyucu çizginin
 * yüksekliğini bir yüzdeye bağlayabiliyor ("ölçekli sayı").
 */
export function duoTicks(domain: { min: number; max: number }, count = 4): number[] {
  const span = domain.max - domain.min;
  if (!(span > 0)) return [0];
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE_STEPS.find((n) => n * magnitude >= raw) ?? 10) * magnitude;
  const ticks: number[] = [];
  for (let v = Math.ceil(domain.min / step) * step; v <= domain.max + 1e-9; v += step) {
    /* Kayan nokta artığı (-0, 4.999999) etikette görünmesin. */
    ticks.push(Math.round(v / step) * step || 0);
  }
  return ticks;
}

/**
 * Eşit aralıklı eksen etiketlerinin indisleri — kısa pencerede (1A, 3A) ay
 * başı bir ya da iki kez geliyor ve eksen boş kalıyordu. Uçlar her zaman
 * içeride.
 */
export function evenTicks(length: number, count = 4): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];
  const slots = Math.max(2, Math.min(count, length));
  const out = new Set<number>();
  for (let i = 0; i < slots; i += 1) out.add(Math.round((i / (slots - 1)) * (length - 1)));
  return [...out];
}
