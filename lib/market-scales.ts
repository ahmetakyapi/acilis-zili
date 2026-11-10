/**
 * Piyasalar ekranının iki çizim ölçeği (10 Kasım 2026).
 *
 * İkisi de ekrana ZATEN gelen sayılardan türer (üyelerin günlük yüzdesi,
 * canlı piyasa değeri); yeni veri yok, yalnız okuma biçimi.
 */

/* ---- Günlük değişimlerin dağılımı (genişlik şeridindeki histogram) ---- */

/** Kutu genişliği, yüzde puan. */
export const HISTOGRAM_STEP = 0.5;
/** Bunun ötesi iki uçtaki açık kutuya düşer ("≤ −%3", "≥ +%3"). Isı
    haritasının en koyu kademesiyle aynı eşik: iki çizim aynı sayıda doyuyor. */
export const HISTOGRAM_LIMIT = 3;

export type HistogramBin = {
  /** Kutunun alt ve üst sınırı; uç kutularda dış sınır sonsuz. */
  from: number;
  to: number;
  count: number;
  side: "down" | "up";
};

export type ChangeHistogram = {
  bins: HistogramBin[];
  /** Tam %0 — yön iddiası yok, kutulara girmez; sayısı ayrıca yazılır. */
  flat: number;
  /** En dolu kutunun sayısı — çubuk boylarının paydası. */
  peak: number;
  total: number;
};

/**
 * Yüzdeleri sıfırın iki yanında eşit genişlikte kutulara dağıtır.
 *
 * SIFIR BİR SINIR, KUTU DEĞİL: eksi değerler sol yarıya, artılar sağ yarıya
 * düşer; böylece çubukların rengi (yön) kutunun kendisinden okunur ve "yatay"
 * hisseler hiçbir yöne sayılmaz (genişlik sayacının kuralı — bilinmeyen de
 * sıfır da artı ya da eksi değildir). Sonlu olmayan değer atlanır.
 */
export function changeHistogram(values: readonly number[]): ChangeHistogram {
  const perSide = Math.round(HISTOGRAM_LIMIT / HISTOGRAM_STEP) + 1;
  const down: HistogramBin[] = [];
  const up: HistogramBin[] = [];
  for (let i = 0; i < perSide; i += 1) {
    const near = i * HISTOGRAM_STEP;
    const far = i === perSide - 1 ? Infinity : (i + 1) * HISTOGRAM_STEP;
    down.push({ from: -far, to: near === 0 ? 0 : -near, count: 0, side: "down" });
    up.push({ from: near, to: far, count: 0, side: "up" });
  }
  let flat = 0;
  let total = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    total += 1;
    if (value === 0) { flat += 1; continue; }
    /* Sınırdaki değer sıfıra YAKIN kutuda: %0,5 "0–0,5" kutusunda, %3
       "2,5–3" kutusunda; uç kutu yalnız eşiği AŞANLAR. Kayan nokta
       gürültüsü (0,5 / 0,5 = 1,0000001) sınırı atlatmasın diye pay. */
    const index = Math.min(perSide - 1, Math.max(0, Math.ceil(Math.abs(value) / HISTOGRAM_STEP - 1e-9) - 1));
    (value < 0 ? down : up)[index].count += 1;
  }
  const bins = [...down.reverse(), ...up];
  return { bins, flat, peak: Math.max(0, ...bins.map((bin) => bin.count)), total };
}

/**
 * Bir yüzdenin histogram eksenindeki yatay payı (0 sol uç, 1 sağ uç).
 * Uç kutular birer adım genişliğinde çizildiği için eşiğin ötesi uç
 * kutunun ORTASINA sabitlenir: ölçek orada doğrusal değil, im de bunu
 * iddia etmez.
 */
export function histogramShare(value: number): number {
  const edge = HISTOGRAM_LIMIT + HISTOGRAM_STEP;
  const clamped = Math.abs(value) > HISTOGRAM_LIMIT ? Math.sign(value) * (HISTOGRAM_LIMIT + HISTOGRAM_STEP / 2) : value;
  return (clamped + edge) / (edge * 2);
}

/* ---- Piyasa değeri ekseni (bileşen tablosundaki nokta) ---- */

export type CapAxis = {
  /** Eksenin iki ucu — onluk basamaklar (10 Mr, 100 Mr, 1 T…). */
  min: number;
  max: number;
  /** Uçlar dahil her onluk basamak. */
  ticks: number[];
  /** Değerin eksendeki payı, 0–1 (logaritmik). */
  at: (value: number) => number;
};

/**
 * Piyasa değerleri için LOGARİTMİK KONUM ekseni.
 *
 * Doğrusal çubukta listenin devi (4 T $) rayı dolduruyor, kalan doksan
 * şirketin çubuğu bir pikselin altında kalıyordu: sütun "boş" okunuyordu
 * (1440, ölçüldü: 60 satırın 52'sinde dolgu < 3 piksel). Logaritmik ÇUBUK
 * ise yalan söyler — uzunluğun sıfırı yoktur. Çözüm çubuk değil NOKTA:
 * konum, onluk basamakları çizili bir eksende (her çentik on kat). Okur
 * uzunluk değil yer okur, çentikler ölçeğin doğrusal olmadığını söyler.
 * Uçlar veriyi saran en yakın onluklar; pozitif sonlu değer yoksa `null`.
 */
export function capAxis(values: readonly (number | null | undefined)[]): CapAxis | null {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (known.length === 0) return null;
  const lo = Math.floor(Math.log10(Math.min(...known)) + 1e-9);
  let hi = Math.ceil(Math.log10(Math.max(...known)) - 1e-9);
  if (hi <= lo) hi = lo + 1;
  const ticks: number[] = [];
  for (let power = lo; power <= hi; power += 1) ticks.push(10 ** power);
  return {
    min: 10 ** lo,
    max: 10 ** hi,
    ticks,
    at: (value) => (value > 0 ? Math.min(1, Math.max(0, (Math.log10(value) - lo) / (hi - lo))) : 0),
  };
}
