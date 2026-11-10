/**
 * Piyasalar ekranının çizim ölçekleri (10 Kasım 2026).
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

/* ---- Bileşen tablosunun satır içi ölçekleri ---- */

/**
 * Yön kulvarlarının SABİT ölçeği (10 Kasım 2026): tam kol kaç yüzde.
 *
 * Tablo şeridi listenin en büyük hareketine göre ölçekliyordu; "Daha Fazla
 * Göster"e ya da başka sekmeye basınca aynı %1 başka uzunlukta çiziliyordu
 * ve 56 piksellik dar kulvarda tek bir %20'lik satır ötekileri 1 piksele
 * indirirdi. Sabit ölçekte aynı uzunluk her yerde aynı hareket. Günlük kol
 * ısı haritasının ve histogramın doyduğu eşikte (`HISTOGRAM_LIMIT`) dolar;
 * haftalık kol sektör tablosunun 1H tam tonunda (±%8).
 */
export const DAY_LANE_SPAN = HISTOGRAM_LIMIT;
export const WEEK_LANE_SPAN = 8;
/** "Büyük hareket" eşiği — günlük kulvarın dolduğu yer; satırda yüzde hap zemini alır. */
export const BIG_MOVE = HISTOGRAM_LIMIT;

/** Sıfır ortalı kulvarda kolun payı, 0–50 (kulvar genişliğinin yüzdesi). */
export function laneArm(value: number, span: number): number {
  if (!Number.isFinite(value) || !(span > 0)) return 0;
  return Math.min(1, Math.abs(value) / span) * 50;
}

/* ---- Piyasa değeri payı (bileşen tablosunda sayının yanındaki yüzde) ---- */

/** Değeri bilinen üyelerin oranı bunun altındaysa pay HİÇ basılmaz. */
export const CAP_SHARE_MIN_COVERAGE = 0.9;

/**
 * Bir şirketin piyasa değerinin, listedeki şirketlerin TOPLAM piyasa
 * değerine oranı (yüzde).
 *
 * KARAR GEÇMİŞİ. 26 Eylül: doğrusal çubuk (en büyüğe göre) — Nasdaq 100'de
 * 60 satırın 52'sinde dolgu 3 pikselin altındaydı. 10 Kasım sabah: onluk
 * eksende nokta (`capAxis`) — logaritmik ÇUBUK yasak (uzunluğun sıfırı yok),
 * konum olur. 10 Kasım, sahibinin itirazı ("piyasa değerini de direkt yazsak
 * daha doğru olacak"): nokta ekseni sayıyı dolaylı okutuyordu ve 132
 * piksellik sütun asıl sayıyı soluk bırakıyordu. Eksen KALKTI (`capAxis`
 * silindi); sayı güçlü mürekkeple yazılıyor, yanında yalnız bu pay duruyor.
 * Pay bir çizim değil SAYI: doğrusal çubuğun okunmayan küçük uçlarını
 * ("%0,07") yazıyla söyler, ölçek çarpıtması yok. Logaritmik çubuk yasağı
 * yerinde duruyor.
 *
 * DÜRÜSTLÜK: bu resmî endeks ağırlığı DEĞİL (Nasdaq 100 tavanlı, S&P 500
 * halka açıklık düzeltmeli); tablo künyesi bunu yazar. Fiyat ağırlıklı
 * endekste (Dow) çağıran hiç basmaz. Toplam yalnız değeri bilinenlerden
 * kurulduğu için eksik çoksa pay şişer: bilinenlerin oranı
 * `CAP_SHARE_MIN_COVERAGE` altındaysa `null` (pay basılmaz).
 */
export function capShares(values: readonly (number | null | undefined)[]): ((value: number | null | undefined) => number | null) | null {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (values.length === 0 || known.length / values.length < CAP_SHARE_MIN_COVERAGE) return null;
  const total = known.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  return (value) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? (value / total) * 100 : null);
}
