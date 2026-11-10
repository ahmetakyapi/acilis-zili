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
 * Yön kulvarlarının ölçek TABANI (10 Kasım 2026): tam kol en az kaç yüzde.
 * (Sabah SABİT ölçekti; gece listeye göre açılır oldu — aşağıda `laneSpan`.)
 *
 * Tablo şeridi listenin en büyük hareketine göre ölçekliyordu; "Daha Fazla
 * Göster"e ya da başka sekmeye basınca aynı %1 başka uzunlukta çiziliyordu
 * ve 56 piksellik dar kulvarda tek bir %20'lik satır ötekileri 1 piksele
 * indirirdi. Sabit ölçekte aynı uzunluk her yerde aynı hareket. Günlük kol
 * ısı haritasının ve histogramın doyduğu eşikte (`HISTOGRAM_LIMIT`) dolar;
 * haftalık kol sektör tablosunun 1H tam tonunda (±%8).
 *
 * 10 Kasım (gece): İKİ TABLO, TEK SABİT. Şirketler dizini kendi sayfasında
 * ayrı sabit tutuyordu (günlük ±%5, haftalık ±%12): aynı %4'lük hafta
 * Endeks Bileşenleri'nde kolun yarısı, Şirketler'de üçte biriydi. İki tablo
 * da artık bu sabitleri okur (`components/markets/BoardTable.tsx` →
 * `ZeroBar`); dizinin küçük şirketlerinde eşiği aşan hareket kolu doldurur,
 * büyüklüğünü yanındaki sayı söyler.
 */
export const DAY_LANE_SPAN = HISTOGRAM_LIMIT;
export const WEEK_LANE_SPAN = 8;

/**
 * ÖLÇEK LİSTEYE GÖRE AÇILIR; SABİT ARTIK TABAN (10 Kasım, gece — ana
 * oturumun kararı, sahibinin sözü: "mantıklı bulduklarını uygula; standart
 * haline gelsin ve göze hitap etsin").
 *
 * Sabit ±%3 ölçekte "en çok düşen" sıralamasının ilk satırları AYNI boydaydı
 * (−%9,34, −%3,88, −%3,01: üçü de dolu kol; farkı yalnız sayı söylüyordu).
 * Ölçek şimdi listenin dağılımından, okunur bir basamağa yuvarlanarak
 * (`LANE_STEPS`); taban eski sabit (günlük ±%3, haftalık ±%8): sakin günde
 * ±%0,4'lük hareketler kolu doldurup büyük bir gün gibi görünmez.
 *
 * İKİ OKUMA, AYNI LİSTE (`mode`):
 * - "body" (olağan sıra: ad, fiyat, piyasa değeri…): mutlak değişimlerin
 *   90. yüzdeliği. Görünen satırlar listenin gövdesidir; uçtaki onda bir
 *   ölçeği belirlemez (tek bir %20'lik satır herkesi çizgiye indirirdi —
 *   `spreadScale`, lib/theme-view.ts ile aynı ders).
 * - "rise" / "fall" (liste O DEĞİŞİME göre sıralıyken; azalan sırada
 *   "rise", artanda "fall"): görünen satırlar listenin o yöndeki UCUDUR ve
 *   gövdenin ölçeğinde hepsi dolu kol olurdu — kararın çıkış noktası. Ölçek
 *   o yönün ucundan: yükselenlerin (ya da düşenlerin) en büyük İKİNCİSİ,
 *   büyük listede o yöndeki ilk yüzde birin eşiği. Tek uç değer yine
 *   ölçeği belirlemez, kola dayanır. (İlk denemede üçüncüydü: −%3,88 ve
 *   −%3,01'in önde olduğu listede ölçek tabanda kaldı ve ikisi yine aynı
 *   dolu koldu — ölçüldü.) YÖNE GÖRE, çünkü ilk denemede iki
 *   yönün ortak ucu kullanıldı ve en sert hareketlerin hepsi yükseliş olan
 *   günde "en çok düşenler" ±%15'lik cetvelde ~15 piksellik çubuklara indi
 *   (ölçüldü, 1440; kol 60 piksel). Yön değişince görünen satırların TAMAMI
 *   değişir; korunacak bir süreklilik yok.
 * Hesap listenin TAMAMINDAN (yalnız açık satırlardan değil): "Daha Fazla
 * Göster" ölçeği oynatmaz, açık satırların çubukları yeniden çizilmez.
 * Ölçek sıralama ölçüsü ya da yönü değişince değişebilir; künye her zaman
 * gerçek ölçeği yazar (`laneScaleNote`).
 *
 * Ölçeği aşan çubuk kola dayanır ve ucunda kesik taşır (`laneOver`;
 * BoardTable.module.css → `.fill[data-over]`): "bu çubuk burada bitmiyor".
 * Ana oturumun önerisi tek okumaydı (bütün listenin 90. yüzdeliği); o hâlde
 * 100 üyeli endekste "en çok düşen" sıralamasının ilk satırları yine aynı
 * boyda kalıyordu: −%9,34 · −%3,88 · −%3,01 örneğinde gövdenin 90.
 * yüzdeliği %3'ün altında, üçü de dolu kol (tests/market-scales.test.ts).
 */
export const LANE_STEPS = [3, 5, 8, 10, 15, 20, 30, 50] as const;
const LANE_BODY_QUANTILE = 0.9;
/** Uç okumasında ölçeği belirleyen sıra: o yöndeki yüzde bir, en az ikinci. */
const LANE_TAIL_SHARE = 0.01;
const LANE_TAIL_MIN_RANK = 2;

export type LaneMode = "body" | "rise" | "fall";

/** Sıralama ölçüsü bu değişimse yönüne göre uç okuması, değilse gövde. */
export function laneModeOf(sortedByThis: boolean, dir: "asc" | "desc"): LaneMode {
  return sortedByThis ? (dir === "desc" ? "rise" : "fall") : "body";
}

/** Kulvarın tam kolu, yüzde: `floor`dan küçük olmaz, `LANE_STEPS` basamağına oturur. */
export function laneSpan(values: readonly (number | null | undefined)[], floor: number, mode: LaneMode = "body"): number {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  let mark = 0;
  if (mode === "body") {
    const sorted = known.map((value) => Math.abs(value)).sort((a, b) => a - b);
    if (sorted.length > 0) mark = sorted[Math.max(0, Math.ceil(sorted.length * LANE_BODY_QUANTILE) - 1)];
  } else {
    /* O yöndeki değerler, büyüklüğe göre artan; sıra yönün kendi sayısından.
       Yönde sıradan az değer varsa en küçüğü ölçer (tek düşenli günde o
       tek satır taşmasın). */
    const side = known.filter((value) => (mode === "rise" ? value > 0 : value < 0)).map((value) => Math.abs(value)).sort((a, b) => a - b);
    if (side.length > 0) {
      const rank = Math.max(LANE_TAIL_MIN_RANK, Math.ceil(side.length * LANE_TAIL_SHARE));
      mark = side[Math.max(0, side.length - rank)];
    }
  }
  const need = Math.max(floor, mark);
  /* Kayan nokta payı: tam %5'lik hareket 5 basamağında kalır. */
  return LANE_STEPS.find((step) => need <= step + 1e-9) ?? LANE_STEPS[LANE_STEPS.length - 1];
}

/** Değer ölçeği aşıyor mu — çubuk kola dayanır, ucunda kesik taşır. */
export function laneOver(value: number, span: number): boolean {
  return Number.isFinite(value) && span > 0 && Math.abs(value) > span + 1e-9;
}
/** "Büyük hareket" eşiği — günlük kulvarın dolduğu yer; satırda yüzde hap zemini alır. */
export const BIG_MOVE = HISTOGRAM_LIMIT;

/** Sıfır ortalı kulvarda kolun payı, 0–50 (kulvar genişliğinin yüzdesi). */
export function laneArm(value: number, span: number): number {
  if (!Number.isFinite(value) || !(span > 0)) return 0;
  return Math.min(1, Math.abs(value) / span) * 50;
}

/**
 * Bir fiyatın gün aralığındaki yeri, 0–100 (dip 0, tepe 100).
 *
 * Tablo satırındaki gün aralığı şeridinin dolgusu: dipten fiyata. Aralık
 * yoksa (dip = tepe, eksik ya da sonlu olmayan değer) `null` — şerit HİÇ
 * çizilmez; sıfır genişlik "dipte" demek olurdu ve o da bir iddia. Aralığın
 * dışındaki fiyat (seans dışı işlem) uca sabitlenir.
 */
export function rangeShare(low: number | null | undefined, high: number | null | undefined, value: number | null | undefined): number | null {
  if (typeof low !== "number" || typeof high !== "number" || typeof value !== "number") return null;
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(value) || !(high > low)) return null;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

/** Kademeli çizimde gecikme alan satır sayısı: 10 × `--step` (40 ms) = 400 ms tavan. */
export const DRAW_STAGGER_ROWS = 10;

/**
 * Satırın çizim kademesi (`--i`): ilk on satır sırayla, gerisi gecikmesiz.
 * Ekranın altındaki satır kendi görünüşünde oynar (`data-draw`); ona kademe
 * vermek kaydıran okuru bekletirdi.
 */
export function drawStep(index: number): number {
  return index >= 0 && index < DRAW_STAGGER_ROWS ? index : 0;
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
