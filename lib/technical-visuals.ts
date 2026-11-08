/* "use client" DEĞİL: hem sunucu bileşeni (PlanAtlas, ScenarioRail) hem
   testler okuyor. Buradaki her şey saf aritmetik — kayıttaki seviyelerin
   ve fiyatın geometrisi; yeni bir iddia üretmiyor. */
import type { VerdictKey } from "@/lib/analysis";
import type { Locale } from "@/lib/i18n";
import { planPosition } from "@/lib/technical";

/* --------------------------------------------------------------------------
   Plan atlası — /teknik tepesindeki "16 Hisse, Tek Harita" (25 Ekim).

   On altı kartın her biri kendi fiyat ölçeğinde: MU 832–984, ONDS 6–7.
   Fiyatın PLAN İÇİNDEKİ yerini yan yana okumak için ölçek ortaklaşıyor:
   stop = 0, ilk hedef = 1. Alım bölgesi o ölçekte bir bant, fiyat bir
   nokta; on altı satır alt alta durunca "hangisi bölgeye yakın, hangisi
   stopa" tek bakışta sıralanıyor.

   SAT görüşünde alım planı yok (bölge, stop, hedef boş; satırda tepkide
   satış seviyeleri ve destekler var). O satırlar AYNI ölçeği taklit
   etmiyor: 0 = fiyatın altındaki en yakın destek, 1 = üstündeki en yakın
   satış seviyesi. Grup başlığı ekseni adıyla söylüyor; iki ölçek aynı
   grupta karışmıyor.
   -------------------------------------------------------------------------- */

/** Ortak eksenin görünen aralığı (normalize birimde). Stopun biraz altı ve
 *  ilk hedefin yarım adım ötesi: ölçülen 13 planda ikinci hedef 1,34–1,56
 *  arasında (25 Ekim, canlı kayıt) — 1,6 hepsini kırpmadan alıyor. */
export const ATLAS_DOMAIN = { min: -0.2, max: 1.6 } as const;
/** "Bölgeye yakın" eşiği — pano künyesiyle AYNI sayı ve aynı yuvarlama. */
export const NEAR_ZONE_PCT = 1;
/** "Stopa yakın" eşiği: fiyatın stopa uzaklığı fiyatın %3'ünden az. */
export const NEAR_STOP_PCT = 3;
/** İki seviye bu oranda yakınsa aynı çentik sayılır (ikinci kez çizilmez). */
const SAME_LEVEL = 0.002;

export type AtlasTickKind =
  | "stop"
  | "target"
  | "target2"
  | "support"
  | "resistance"
  | "sell"
  | "sell2"
  | "level";

export type AtlasInput = {
  verdict: VerdictKey;
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
};

export type AtlasGeometry = {
  /** "plan": stop → ilk hedef; "levels": en yakın destek → en yakın satış/direnç. */
  scale: "plan" | "levels";
  /** 0 ve 1'in fiyat karşılıkları. */
  base: number;
  unit: number;
  /** Fiyatın normalize değeri (kırpılmamış) — sıralama bununla. */
  norm: number;
  /** Fiyatın eksendeki yeri, 0–1 (kırpılmış). */
  at: number;
  /** Fiyat eksenin dışında mı (-1 sol, 1 sağ). */
  clamped: -1 | 0 | 1;
  /** Alım bölgesi, eksende 0–1. */
  zone: { from: number; to: number } | null;
  ticks: { at: number; kind: AtlasTickKind }[];
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Normalize değerin eksendeki yeri (0–1). */
export function domainFraction(norm: number): number {
  return clamp01((norm - ATLAS_DOMAIN.min) / (ATLAS_DOMAIN.max - ATLAS_DOMAIN.min));
}

const sameLevel = (a: number, b: number) => Math.abs(a - b) <= Math.abs(b) * SAME_LEVEL;

/**
 * Bir planın ortak eksendeki geometrisi; çizilemiyorsa null (fiyat yok ya
 * da iki uçtan biri yok). Çağıran null satırı "seviye yok" diye basar,
 * uydurma bir ölçeğe oturtmaz.
 */
export function atlasGeometry(input: AtlasInput): AtlasGeometry | null {
  const { price, entryLow, entryHigh, stop, targets, supports, resistances, verdict } = input;
  if (price === null || !(price > 0)) return null;
  const sortedTargets = [...targets].sort((a, b) => a - b);
  const first = sortedTargets[0];

  let scale: AtlasGeometry["scale"];
  let base: number;
  let unit: number;
  const marks: { price: number; kind: AtlasTickKind }[] = [];

  if (
    verdict !== "sell" &&
    stop !== null &&
    entryHigh !== null &&
    first !== undefined &&
    first > entryHigh &&
    entryHigh > stop
  ) {
    scale = "plan";
    base = stop;
    unit = first;
    marks.push({ price: stop, kind: "stop" }, { price: first, kind: "target" });
    for (const target of sortedTargets.slice(1)) marks.push({ price: target, kind: "target2" });
  } else {
    /* Plansız satır: fiyatın iki yanındaki en yakın seviyeler. SAT'ta üst
       uç satış seviyesi (hedefler, yoksa dirençler — `PlanRail` ile aynı
       kural), TUT'ta direnç. */
    const upper = verdict === "sell" ? (targets.length ? targets : resistances) : resistances;
    const below = supports.filter((level) => level < price).sort((a, b) => b - a)[0];
    const above = [...upper].filter((level) => level > price).sort((a, b) => a - b)[0];
    if (below === undefined || above === undefined) return null;
    scale = "levels";
    base = below;
    unit = above;
    marks.push(
      { price: below, kind: "support" },
      { price: above, kind: verdict === "sell" ? "sell" : "resistance" },
    );
    if (verdict === "sell") {
      for (const level of upper) if (level > above) marks.push({ price: level, kind: "sell2" });
    }
  }

  const span = unit - base;
  const toNorm = (value: number) => (value - base) / span;
  /* Destek ve dirençler ince çentik — planın kendi seviyeleriyle ya da
     bölgenin uçlarıyla çakışan ikinci kez çizilmiyor. */
  const taken = [...marks.map((mark) => mark.price)];
  if (scale === "plan" && entryLow !== null && entryHigh !== null) taken.push(entryLow, entryHigh);
  for (const level of [...supports, ...resistances]) {
    if (taken.some((other) => sameLevel(level, other))) continue;
    taken.push(level);
    marks.push({ price: level, kind: "level" });
  }

  const norm = toNorm(price);
  const inside = (value: number) => value >= ATLAS_DOMAIN.min && value <= ATLAS_DOMAIN.max;
  return {
    scale,
    base,
    unit,
    norm,
    at: domainFraction(norm),
    clamped: norm < ATLAS_DOMAIN.min ? -1 : norm > ATLAS_DOMAIN.max ? 1 : 0,
    zone:
      scale === "plan" && entryLow !== null && entryHigh !== null
        ? { from: domainFraction(toNorm(entryLow)), to: domainFraction(toNorm(entryHigh)) }
        : null,
    /* Eksen dışına düşen seviye kenara yığılmıyor: kırpılmış bir çentik
       olmayan bir seviyeyi gösterirdi. */
    ticks: marks
      .map((mark) => ({ norm: toNorm(mark.price), kind: mark.kind }))
      .filter((mark) => inside(mark.norm))
      .map((mark) => ({ at: domainFraction(mark.norm), kind: mark.kind })),
  };
}

export type AtlasSummary = {
  /** Alım bölgesi olan plan sayısı (cümlenin paydası). */
  plans: number;
  inZone: number;
  /** Bölgenin dışında ama %1'den yakın. */
  near: number;
  /** Stopun üstünde, stopa %3'ten yakın. */
  nearStop: number;
  belowStop: number;
};

type SummaryInput = Pick<AtlasInput, "price" | "entryLow" | "entryHigh" | "stop">;

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Fiyatın planlara göre dağılımı. Pano araç çubuğundaki üç sayı ve atlasın
 * cümlesi BU fonksiyondan: aynı fiyat (canlı, yoksa fotoğraf), aynı
 * `planPosition`, "yakın" kararı kart rozetinin YAZDIĞI yuvarlanmış yüzdeyle
 * — rozet "%1,0" derken cümle onu "%1'den yakın" saymasın.
 */
export function atlasSummary(rows: readonly SummaryInput[]): AtlasSummary {
  const summary: AtlasSummary = { plans: 0, inZone: 0, near: 0, nearStop: 0, belowStop: 0 };
  for (const row of rows) {
    const position = planPosition(row.price, row.entryLow, row.entryHigh, row.stop);
    if (!position || row.price === null) continue;
    summary.plans += 1;
    if (position.kind === "inZone") summary.inZone += 1;
    else if (position.kind === "belowStop") summary.belowStop += 1;
    else if (round1(position.pct) < NEAR_ZONE_PCT) summary.near += 1;
    if (position.kind !== "belowStop" && row.stop !== null && row.price > 0) {
      if (round1(((row.price - row.stop) / row.price) * 100) < NEAR_STOP_PCT) summary.nearStop += 1;
    }
  }
  return summary;
}

export type AtlasSentenceCopy = {
  zoneSome: string;
  zoneNone: string;
  nearOne: string;
  nearMany: string;
  stopOne: string;
  stopMany: string;
  stopNone: string;
  belowOne: string;
  belowMany: string;
};

/**
 * Ekranın tepesindeki tek cümle — şablon + sayı, uydurma yok.
 * Bölge cümlesi her zaman, stop cümlesi her zaman (sıfırsa "hiçbiri"
 * güven veren bir bilgi), yakınlık ve stop altı yalnız sıfırdan büyükse.
 */
export function atlasSentence(summary: AtlasSummary, copy: AtlasSentenceCopy): string | null {
  if (summary.plans === 0) return null;
  const fill = (template: string, n: number) =>
    template.replace("{n}", String(n)).replace("{total}", String(summary.plans));
  const head = fill(summary.inZone > 0 ? copy.zoneSome : copy.zoneNone, summary.inZone);
  const tail: string[] = [];
  if (summary.near > 0) tail.push(fill(summary.near === 1 ? copy.nearOne : copy.nearMany, summary.near));
  if (summary.belowStop > 0) {
    tail.push(fill(summary.belowStop === 1 ? copy.belowOne : copy.belowMany, summary.belowStop));
  }
  tail.push(
    summary.nearStop === 0
      ? copy.stopNone
      : fill(summary.nearStop === 1 ? copy.stopOne : copy.stopMany, summary.nearStop),
  );
  return `${head}; ${tail.join(", ")}.`;
}

/* --------------------------------------------------------------------------
   Senaryo rayı — /teknik/[symbol] "Senaryolar" (25 Ekim).

   Senaryolar iki paragraf ve sayıları metnin içinde ("348,36 zirvesinin
   üstünde kapanış 350,29 ve 352,37'yi açar"). Rayın seviyeleri METİNDEN
   okunuyor ama yalnız kaydın bildiği bir seviyeyle (bölge, stop, hedef,
   destek, direnç, ortalamalar, pivotlar) birebir eşleşen sayı kabul
   ediliyor: metindeki "%1,5" ya da "10 gün" çizime giremiyor, modelin
   uydurduğu bir seviye de. Eşleşme yoksa en yakın destek/direnç — o hâlde
   etiketi "tetik" değil, adıyla "En Yakın Direnç".
   -------------------------------------------------------------------------- */

/** Metindeki sayılar, metnin dilinin biçimiyle ("1.231,91" / "1,231.91"). */
export function figuresIn(text: string, lang: Locale): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(/\d[\d.,]*\d|\d/g)) {
    const raw = match[0];
    const normalized = lang === "tr" ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
    const value = Number(normalized);
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

/** İki fiyat aynı seviye mi — kayıt iki ondalık tutuyor, metin de öyle yazıyor. */
const matchesLevel = (value: number, level: number) =>
  Math.abs(value - level) <= Math.max(0.005, Math.abs(level) * 1e-4);

export type ScenarioPath = {
  /** Senaryonun ilk seviyesi (tetik ya da en yakın seviye). */
  trigger: number;
  /** "text": metinde geçen ve kayıtta olan seviye; "nearest": metinden çıkmadı. */
  source: "text" | "nearest";
  /** Tetikten sonraki duraklar, fiyattan uzaklaşan sırada. */
  path: number[];
};

/**
 * Bir senaryonun fiyat eksenindeki yolu. `side` yönü söylüyor: yükselişte
 * fiyatın üstündeki, düşüşte altındaki seviyeler. Tetik, metinde ADI GEÇEN
 * ilk seviye (metnin sırası korunuyor; "348,36 zirvesinin üstünde kapanış"
 * cümlesinin ilk sayısı tetiktir).
 */
export function scenarioPath(
  text: string,
  lang: Locale,
  known: readonly number[],
  side: "up" | "down",
  price: number,
  fallback: readonly number[],
): ScenarioPath | null {
  const onSide = (value: number) => (side === "up" ? value > price : value < price);
  const found: number[] = [];
  for (const value of figuresIn(text, lang)) {
    const level = known.find((candidate) => matchesLevel(value, candidate));
    if (level === undefined || !onSide(level)) continue;
    if (!found.some((other) => matchesLevel(other, level))) found.push(level);
  }
  const away = (a: number, b: number) => (side === "up" ? a - b : b - a);
  if (found.length > 0) {
    const [trigger, ...rest] = found;
    return { trigger, source: "text", path: rest.filter((value) => away(value, trigger) > 0).sort(away) };
  }
  const nearest = fallback.filter(onSide).sort(away)[0];
  return nearest === undefined ? null : { trigger: nearest, source: "nearest", path: [] };
}

/* --------------------------------------------------------------------------
   Kapak çizimlerinin geometrisi (8 Kasım) — /teknik görüş dağılımının logo
   ızgarası ve detay kapağının gösterge çizimleri (`SignalGauges`). Saf
   aritmetik; hiçbiri yeni bir sayı üretmiyor, kayıttaki sayının yeri.
   -------------------------------------------------------------------------- */

/** Dağılımda satır başına en çok logo: 1440'ta satır ~410 piksel, 44
    piksellik karo + 8 aralık. */
export const LOGOS_PER_ROW = 8;

/**
 * Logo ızgarasının sütun sayısı — satırlar EŞİT dolsun: 11 → 6 (6 + 5),
 * 16 → 8 (8 + 8), 5 → 5. Serbest sarmada son satıra tek logo düşüyordu
 * (1440'ta 11 logoluk SAT satırı 10 + 1; gerekçe `TechnicalPulse`).
 */
export function balancedColumns(count: number, max = LOGOS_PER_ROW): number {
  if (!Number.isFinite(count) || count <= 1) return 1;
  if (count <= max) return Math.floor(count);
  return Math.ceil(count / Math.ceil(count / max));
}

/** RSI'nin 0–100 yay üstündeki payı; eşikler göstergenin kendi tanımından. */
export const RSI_ZONES = { oversold: 30, overbought: 70 } as const;

export function rsiFraction(rsi: number): number {
  return clamp01(rsi / 100);
}

/**
 * Yarım daire üstünde bir payın noktası — sol uç 0, sağ uç 1, tepe 0,5.
 * Merkez (cx, cy), yarıçap r; SVG ekseni (y aşağı).
 */
export function arcPoint(fraction: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const angle = Math.PI * (1 - clamp01(fraction));
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

/**
 * Hacim ölçeği — son seans hacminin 20 günlük ortalamaya oranı. Ölçek
 * 0'dan en az 3×'e (oran büyükse bir üst tam sayıya) uzanıyor; ortalama
 * (1×) ölçeğin üstünde bir çentik. `fill` şeridin payı.
 */
export function volumeScale(ratio: number): { max: number; fill: number; average: number } {
  const max = Math.max(3, Math.ceil(ratio));
  return { max, fill: clamp01(ratio / max), average: 1 / max };
}

/**
 * Trend ölçeği — fiyat ile 50 ve 200 günlük ortalamaların AYNI eksendeki
 * yeri. Eksen üç sayının en küçüğünden en büyüğüne, iki uçta %10 pay; eksik
 * ortalama (yeni halka arz) çizilmez. İkiden az sayı varsa null.
 */
export function trendScale(
  price: number | null,
  sma50: number | null,
  sma200: number | null,
): { price: number; sma50: number | null; sma200: number | null } | null {
  const values = [price, sma50, sma200].filter((value): value is number => value !== null && Number.isFinite(value));
  if (price === null || values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || hi * 0.02 || 1;
  const at = (value: number | null) => (value === null ? null : 0.1 + ((value - lo) / span) * 0.8);
  return { price: at(price)!, sma50: at(sma50), sma200: at(sma200) };
}

/**
 * Yatay etiket itmesi — kapaktaki fiyat ölçeğinin (`LevelScale`) etiketleri
 * çakışmasın. Girdi sıralı olmak zorunda değil; çıktı girdinin sırasıyla.
 * Çakışan etiketler bir küme olur ve küme kendi hedeflerinin ortalamasına
 * ortalanır (`priceLadderLayout`un yatay karşılığı); [min, max] dışına
 * taşmaz. `gap` etiketler arası en az pay (0–1).
 */
export function spreadLabels(xs: readonly number[], gap: number, min = 0, max = 1): number[] {
  const order = xs.map((x, index) => ({ x, index })).sort((a, b) => a.x - b.x || a.index - b.index);
  type Cluster = { from: number; size: number; start: number };
  const place = (cluster: Cluster) => {
    let sum = 0;
    for (let i = 0; i < cluster.size; i++) sum += order[cluster.from + i]!.x - i * gap;
    const ideal = sum / cluster.size;
    cluster.start = Math.min(Math.max(ideal, min), max - (cluster.size - 1) * gap);
  };
  const clusters: Cluster[] = [];
  order.forEach((_, index) => {
    const cluster: Cluster = { from: index, size: 1, start: 0 };
    place(cluster);
    clusters.push(cluster);
    while (clusters.length > 1) {
      const last = clusters[clusters.length - 1]!;
      const prev = clusters[clusters.length - 2]!;
      if (prev.start + prev.size * gap <= last.start + 1e-9) break;
      prev.size += last.size;
      clusters.pop();
      place(prev);
    }
  });
  const out = new Array<number>(xs.length);
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.size; i++) out[order[cluster.from + i]!.index] = cluster.start + i * gap;
  }
  return out;
}
