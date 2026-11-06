/**
 * Araç ekranlarının görsel katmanı (25 Ekim, görsel tur): /tarama,
 * /sirketler ve /hisse-secimi. Burada yalnız SAF hesap var — ortanca,
 * yüzdelik, arı kümesi (beeswarm) yerleşimi, pay dağılımı ve tepe cümlesi.
 * Çizim bileşenlerde (`components/screener/`, `components/companies/`,
 * `components/screening/`); bu modül "use client" DEĞİL, iki taraf da
 * kullanıyor (sunucu tepe cümlesini, istemci kümeyi kuruyor).
 *
 * Uydurma yok: cümleler şablon + veri; ölçü kurulamıyorsa (ör. bayat
 * kotasyonda F/K) cümlenin o parçası hiç yazılmaz (testi
 * `tests/tool-visuals.test.ts`).
 */

/** Sıralı dizide doğrusal aradeğerli yüzdelik (0..1). Boş dizide null. */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: readonly (number | null | undefined)[]): number | null {
  const clean = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (clean.length === 0) return null;
  return quantile([...clean].sort((a, b) => a - b), 0.5);
}

/**
 * Değerin evren içindeki yüzdelik konumu (0..1): kendisinden küçüklerin
 * payı + eşitlerin yarısı. Evrende tek değer varsa 0,5.
 */
export function percentileRank(sorted: readonly number[], value: number): number {
  if (sorted.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
    else break;
  }
  return Math.min(1, Math.max(0, (below + equal / 2 - 0.5) / (sorted.length - 1)));
}

/* -------------------------------------------------------------------------
   Arı kümesi (beeswarm)
   ------------------------------------------------------------------------- */

export type SwarmScale = "linear" | "log";

export type SwarmDomain = {
  lo: number;
  hi: number;
  scale: SwarmScale;
};

/** Kırpılan uçların payı: uçtaki birkaç dev değer (F/K 4.500) ölçeği ezmesin. */
const SWARM_TAIL = 0.04;

/**
 * Kümenin alanı. Doğrusal ölçekte %4 ve %96 yüzdelikleri arası;
 * uçtakiler kenara yığılır, imleri boş halka (25 Ekim ekran görüntüsü:
 * %2–%98 ile büyüme süzgecinin F/K kümesinde üst uç 380'di ve noktaların
 * neredeyse hepsi sol kenara yığılıyordu). Log ölçekte (piyasa değeri,
 * F/K) tam aralık — orada büyüklük farkı ölçeğin kendisi.
 */
export function swarmDomain(values: readonly number[], scale: SwarmScale): SwarmDomain | null {
  const clean = values.filter((v) => Number.isFinite(v) && (scale === "linear" || v > 0)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  let lo = scale === "log" ? clean[0] : quantile(clean, SWARM_TAIL)!;
  let hi = scale === "log" ? clean[clean.length - 1] : quantile(clean, 1 - SWARM_TAIL)!;
  if (hi === lo) {
    const pad = scale === "log" ? lo * 0.5 : Math.abs(lo) * 0.1 || 1;
    lo -= scale === "log" ? 0 : pad;
    hi += pad;
  }
  return { lo, hi, scale };
}

/** Değer → 0..1 konum; alan dışı kenara yapışır, `clipped` bunu söyler. */
export function swarmPosition(value: number, domain: SwarmDomain): { t: number; clipped: boolean } {
  const f = (v: number) => (domain.scale === "log" ? Math.log10(Math.max(v, Number.MIN_VALUE)) : v);
  const lo = f(domain.lo);
  const hi = f(domain.hi);
  const raw = hi === lo ? 0.5 : (f(value) - lo) / (hi - lo);
  return { t: Math.min(1, Math.max(0, raw)), clipped: raw < -1e-9 || raw > 1 + 1e-9 };
}

/**
 * Noktaları yatayda değere, dikeyde çarpışmasız en yakın yere koyar.
 * `xs` piksel; dönen `ys` merkez çizgisinden piksel (artı aşağı).
 * Klasik açgözlü küme: x sırasıyla, her nokta için komşulara teğet
 * adaylar arasından |y|'si en küçük boş yer seçilir.
 */
export function swarmLayout(xs: readonly number[], radius: number, padding = 0.6): number[] {
  const d = radius * 2 + padding;
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  const placed: { x: number; y: number }[] = [];
  const ys = new Array<number>(xs.length).fill(0);
  let start = 0;
  for (const { x, i } of order) {
    while (start < placed.length && placed[start].x < x - d) start += 1;
    const near = placed.slice(start);
    const candidates = [0];
    for (const p of near) {
      const dx = x - p.x;
      const dy = Math.sqrt(Math.max(0, d * d - dx * dx));
      candidates.push(p.y + dy, p.y - dy);
    }
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    const free = (y: number) => near.every((p) => (x - p.x) ** 2 + (y - p.y) ** 2 >= d * d - 1e-6);
    const y = candidates.find(free) ?? 0;
    ys[i] = y;
    placed.push({ x, y });
  }
  return ys;
}

/** Denenen yarıçaplar — büyükten küçüğe; ilk sığan kullanılır. */
const SWARM_RADII = [4.5, 4, 3.5, 3, 2.6, 2.2, 1.8] as const;

/**
 * Genişliğe ve yükseklik payına göre yarıçap seçip yerleşimi kurar.
 * Hiçbiri sığmazsa en küçük yarıçap kalır ve fazlası yükseklikte kırpılır
 * (`ys` tavana sıkıştırılır) — taşma olmaz.
 */
export function fitSwarm(
  ts: readonly number[],
  width: number,
  halfHeight: number,
): { radius: number; xs: number[]; ys: number[] } {
  let last: { radius: number; xs: number[]; ys: number[] } | null = null;
  for (const radius of SWARM_RADII) {
    const inner = Math.max(1, width - radius * 2);
    const xs = ts.map((t) => radius + t * inner);
    const ys = swarmLayout(xs, radius);
    const peak = ys.reduce((m, y) => Math.max(m, Math.abs(y)), 0);
    last = { radius, xs, ys };
    if (peak + radius <= halfHeight) return last;
  }
  const limit = Math.max(0, halfHeight - last!.radius);
  return { ...last!, ys: last!.ys.map((y) => Math.max(-limit, Math.min(limit, y))) };
}

/* -------------------------------------------------------------------------
   Pay dağılımı (sektör şeritleri)
   ------------------------------------------------------------------------- */

export type ShareSlice<K extends string = string> = {
  key: K;
  count: number;
  value: number;
  countShare: number;
  valueShare: number;
};

/**
 * Anahtar başına adet ve toplam değer; paylar 0..1. Değeri olmayan (null)
 * kayıt adetine girer, değer toplamına girmez. Sıra: değer payı, sonra adet.
 */
export function shareSlices<K extends string>(
  items: readonly { key: K; value: number | null }[],
): ShareSlice<K>[] {
  const map = new Map<K, { count: number; value: number }>();
  for (const item of items) {
    const entry = map.get(item.key) ?? { count: 0, value: 0 };
    entry.count += 1;
    if (item.value !== null && Number.isFinite(item.value) && item.value > 0) entry.value += item.value;
    map.set(item.key, entry);
  }
  const totalCount = items.length || 1;
  const totalValue = [...map.values()].reduce((s, e) => s + e.value, 0) || 1;
  return [...map.entries()]
    .map(([key, e]) => ({
      key,
      count: e.count,
      value: e.value,
      countShare: e.count / totalCount,
      valueShare: e.value / totalValue,
    }))
    .sort((a, b) => b.valueShare - a.valueShare || b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

/**
 * Dilimleri iki yığılı şeride yerleştirir (adet ve değer, aynı sıra):
 * her dilimin iki şeritteki başlangıcı ve genişliği, `gap` aralıklı.
 */
export function stackSlices<K extends string>(
  slices: readonly ShareSlice<K>[],
  width: number,
  gap: number,
): (ShareSlice<K> & { cx: number; cw: number; vx: number; vw: number })[] {
  const usable = width - gap * Math.max(0, slices.length - 1);
  return slices.reduce<(ShareSlice<K> & { cx: number; cw: number; vx: number; vw: number })[]>((acc, slice) => {
    const prev = acc[acc.length - 1];
    const cx = prev ? prev.cx + prev.cw + gap : 0;
    const vx = prev ? prev.vx + prev.vw + gap : 0;
    acc.push({ ...slice, cx, cw: slice.countShare * usable, vx, vw: slice.valueShare * usable });
    return acc;
  }, []);
}

/** Katlanan kuyruğun anahtarı — gerçek bir grup anahtarıyla (ör. "diger")
 *  çakışmasın diye sözcük değil. */
export const REST_SLICE = "__rest" as const;

/**
 * İlk `keep` dilimi olduğu gibi bırakır, kalanı tek bir "kalan" dilimine
 * katlar (en sonda). Kapaktaki kompakt sektör şeridi için: on dört grubun
 * hepsi 550 piksellik şeritte okunmuyor, kuyruktaki gruplar birkaç piksel.
 *
 * `pinned` (seçili süzgeç) ilk `keep`in dışındaysa kuyruktan çıkarılır ve
 * son tutulan dilimin yerine geçer: okuyucu tabloyu hangi gruba süzdüyse o
 * grubun payını şeritte görmeli, "kalan"ın içinde kaybolmamalı. Katlanacak
 * tek dilim varsa katlanmaz (tek grubu "kalan 1 grup" diye yazmak boşuna).
 */
export function foldSlices<K extends string>(
  slices: readonly ShareSlice<K>[],
  keep: number,
  pinned: K | null = null,
): { slices: ShareSlice<K | typeof REST_SLICE>[]; restGroups: number } {
  if (slices.length <= keep + 1) return { slices: [...slices], restGroups: 0 };
  let kept = slices.slice(0, keep);
  const pinnedSlice = pinned === null ? undefined : slices.find((slice) => slice.key === pinned);
  if (pinnedSlice && !kept.includes(pinnedSlice)) kept = [...kept.slice(0, keep - 1), pinnedSlice];
  const rest = slices.filter((slice) => !kept.includes(slice));
  const sum = (pick: (slice: ShareSlice<K>) => number) => rest.reduce((total, slice) => total + pick(slice), 0);
  return {
    slices: [
      ...kept,
      {
        key: REST_SLICE,
        count: sum((slice) => slice.count),
        value: sum((slice) => slice.value),
        countShare: sum((slice) => slice.countShare),
        valueShare: sum((slice) => slice.valueShare),
      },
    ],
    restGroups: rest.length,
  };
}

/** Payı yüzde tamsayıya çevirir; sıfırdan büyük ama %1'in altındaysa "<1" yerine 1. */
export function sharePercent(share: number): number {
  if (share <= 0) return 0;
  return Math.max(1, Math.round(share * 100));
}

/* -------------------------------------------------------------------------
   Tepe cümleleri — şablon + veri
   ------------------------------------------------------------------------- */

export type ScreenerSentenceCopy = {
  /** "Süzgeçten {n} hisse geçti" */
  filtered: string;
  /** "Evrende {n} hisse var" */
  all: string;
  /** "en kalabalık sektör {sector} ({k} hisse)" */
  topSector: string;
  /** "tamamı {sector}" */
  oneSector: string;
  /** "ortanca F/K {fk}" */
  medianFk: string;
  /** "Süzgeçten hisse geçmedi." */
  none: string;
};

/** Ortanca F/K'nın yazılması için gereken en az ölçü — azında ortanca gürültü. */
export const MEDIAN_FK_MIN = 5;

export function screenerSentence(
  input: {
    count: number;
    filtered: boolean;
    sectors: { label: string; count: number }[];
    fkValues: readonly (number | null)[];
    formatFk: (value: number) => string;
  },
  copy: ScreenerSentenceCopy,
): string {
  if (input.count === 0) return copy.none;
  const head = (input.filtered ? copy.filtered : copy.all).replace("{n}", String(input.count));
  const parts: string[] = [];
  const sectors = [...input.sectors].filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
  if (sectors.length === 1) {
    parts.push(copy.oneSector.replace("{sector}", sectors[0].label));
  } else if (sectors.length > 1 && sectors[0].count > sectors[1].count) {
    /* Eşitlikte "en kalabalık" yazılmaz: iki sektör aynı sayıdaysa
       birini seçmek uydurma bir sıralama olurdu. */
    parts.push(copy.topSector.replace("{sector}", sectors[0].label).replace("{k}", String(sectors[0].count)));
  }
  const fk = input.fkValues.filter((v): v is number => v !== null && Number.isFinite(v));
  if (fk.length >= MEDIAN_FK_MIN) {
    parts.push(copy.medianFk.replace("{fk}", input.formatFk(median(fk)!)));
  }
  return parts.length ? `${head}; ${parts.join(", ")}.` : `${head}.`;
}

/* -------------------------------------------------------------------------
   Puan kulvarı (/hisse-secimi hızlı bakış)
   ------------------------------------------------------------------------- */

/**
 * Bant eşikleri — `lib/screening.ts` → `evaluate` içindeki 80 / 65 / 50
 * ile aynı (orada satır içi; değişirse burası da). Kulvardaki çentikler.
 */
export const SCORE_BAND_FLOORS = { strong: 80, worth: 65, mixed: 50 } as const;

/** Bir kulvar etiketinin yeri: `row` satırı (0 üstte yakın, 1 altta yakın,
    2 üstte uzak, 3 altta uzak), `shift` noktadan yatay kayma (piksel). */
export type LaneLabelPlace = { row: number; shift: number };

/**
 * KULVAR ETİKETLERİ ÇAKIŞMASIZ (6 Kasım). Önceki çözüm (`labelRows`)
 * yakın etiketi bir üst satıra itiyordu: 1440'ta on altı hissenin
 * etiketleri üç kata istiflendi, SPCX/SNDK/GOOGL ve META/AMD üst üste
 * okunuyordu, ince bağlantı çizgileri birbirine karışıyordu. Şimdi her
 * etiket kendi noktasının hizasında durmaya çalışıyor; sığmayan küme yana
 * AÇILIYOR — en az toplam kaymayla, sıra korunarak, kulvarın içinde.
 *
 * Yöntem tek boyutlu etiket yerleşiminin kesin çözümü: sıralı etiketlerin
 * arka arkaya en az (w₁+w₂)/2 + gap uzak durması gerekiyor; bu şart
 * birikimli payı (`o`) çıkarınca "y artmayan olmasın" şartına dönüşüyor ve
 * en küçük kareler çözümü izotonik regresyon (PAV). Kulvar sınırı ortak bir
 * kutu olduğu için çözüm kutuya kırpılıyor. Sıra korunduğu için noktadan
 * etikete giden çizgiler hiç kesişmiyor.
 *
 * Satır sayısı en azdan başlıyor: sıralı etiketler satırlara dönüşümlü
 * dağıtılıyor (komşu iki etiket aynı satırda değil), her satır ayrı
 * yayılıyor; en büyük kayma `maxShift`i aşmayan ilk satır sayısı seçiliyor.
 * Hiçbiri tutmazsa sığan seçenekler içinden en az kayanı. Genişlikler
 * piksel; `track` o kırılımdaki EN DAR kulvar — daha geniş kulvarda
 * noktalar açılır, kayma aynı kaldığı için etiketler yine çakışmaz
 * (komşu aralığı (pᵢ₊₁−pᵢ)·(W−W₀) kadar büyür).
 */
export function laneLabelLayout(
  items: readonly { at: number; width: number }[],
  opts: { track: number; gap: number; maxRows: number; maxShift: number },
): LaneLabelPlace[] {
  const order = items.map((item, i) => ({ ...item, i })).sort((a, b) => a.at - b.at || a.i - b.i);
  let best: { places: LaneLabelPlace[]; worst: number; fits: boolean } | null = null;
  for (let rows = 1; rows <= Math.max(1, opts.maxRows); rows++) {
    const places = new Array<LaneLabelPlace>(items.length);
    let worst = 0;
    let fits = true;
    for (let row = 0; row < rows; row++) {
      const members = order.filter((_, k) => k % rows === row);
      const spread = spreadLabels(
        members.map((m) => (m.at / 100) * opts.track),
        members.map((m) => m.width),
        opts.track,
        opts.gap,
      );
      fits &&= spread.fits;
      members.forEach((m, k) => {
        const shift = Math.round(spread.shifts[k] * 10) / 10;
        worst = Math.max(worst, Math.abs(shift));
        places[m.i] = { row, shift };
      });
    }
    if (fits && worst <= opts.maxShift) return places;
    const better = !best || (fits && !best.fits) || (fits === best.fits && worst < best.worst);
    if (better) best = { places, worst, fits };
  }
  return best!.places;
}

/** Tek satırın kesin yayılımı (gerekçe `laneLabelLayout`). */
function spreadLabels(ideal: number[], widths: number[], track: number, gap: number): { shifts: number[]; fits: boolean } {
  const n = ideal.length;
  if (n === 0) return { shifts: [], fits: true };
  const offset = [0];
  for (let i = 1; i < n; i++) offset[i] = offset[i - 1] + (widths[i - 1] + widths[i]) / 2 + gap;
  /* PAV: y = ideal − offset dizisini azalmayan en yakın diziye oturt. */
  const blocks: { sum: number; count: number }[] = [];
  for (let i = 0; i < n; i++) {
    blocks.push({ sum: ideal[i] - offset[i], count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.count <= last.sum / last.count) break;
      prev.sum += last.sum;
      prev.count += last.count;
      blocks.pop();
    }
  }
  const lo = widths[0] / 2;
  const hi = track - widths[n - 1] / 2 - offset[n - 1];
  const fits = lo <= hi;
  const y: number[] = [];
  for (const block of blocks) {
    const mean = block.sum / block.count;
    const value = fits ? Math.min(hi, Math.max(lo, mean)) : (lo + hi) / 2;
    for (let k = 0; k < block.count; k++) y.push(value);
  }
  return { shifts: y.map((v, i) => v + offset[i] - ideal[i]), fits };
}
