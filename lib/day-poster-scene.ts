import type { PosterStock } from "./day-poster";

/**
 * GÜNÜN POSTERİ — SAHNE (25 Ekim, ikinci yeniden kurulum).
 *
 * SAHİBİNİN İTİRAZI (canlıdaki ekran görüntüsü üzerine): "Burası hiç görsel
 * değil; çok daha görsel, çok daha anlaşılır olmalı." İlk iki sürümün
 * sahnesi yalnız SAYIYI çiziyordu: 130 yeşil nokta solda, 363 kırmızı nokta
 * sağda, sırasız bir ızgarada. Hangi hissenin nerede olduğu, sektörlerin
 * içinin ne yaptığı, günün uç hisseleri hiçbir yerde yoktu; sektör
 * kulvarları ise sıradan bir çubuk grafikti.
 *
 * Yeni sahne tek görselde dört soruyu birden yanıtlıyor: S&P 500'ün HER
 * hissesi bir nokta, sektörüne göre kendi satırında; YATAY konum günün
 * değişimi (sıfırın solu düştü, sağı yükseldi), BOY piyasa değeri, RENK
 * yalnız yön. Satır içinde noktalar üst üste binmeden yığılıyor (arı kovanı
 * düzeni, "beeswarm"): yığının şekli o sektörün günü — sıfırın iki yanına
 * yayılmış mı, bir yana mı akmış, tek bir dev hisse mi taşımış.
 *
 * Bu dosya SAF (veritabanı yok, DOM yok): sayfa, paylaşım görseli ve arşiv
 * minyatürü AYNI yerleşimi buradan alıyor. Testler `tests/day-poster-scene.test.ts`.
 *
 * Birim: "sahne birimi". Sayfada her satır kendi SVG'si ve `viewBox`u
 * bu birimde; tarayıcı satırı kabın enine ölçekliyor (yükseklik oranla
 * geliyor, yer tutucu gerçek boyu ayırıyor, sayfa kaymıyor).
 */

/* --------------------------------------------------------------------------
   Hisseler ve sektörleri
   -------------------------------------------------------------------------- */

/**
 * GICS sektörü → SPDR sektör fonu. Üye listesinin sektör adı GICS
 * (`db/seed/indices.ts`), posterin satırları fon sembolüyle (`SECTOR_FUNDS`).
 * Ölçüldü (25 Ekim): 499 üyenin 499'unun sektörü bu on bir addan biri.
 */
export const GICS_SECTOR_FUND: Readonly<Record<string, string>> = {
  "Information Technology": "XLK",
  Financials: "XLF",
  "Health Care": "XLV",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Industrials: "XLI",
  Materials: "XLB",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

export type SceneMember = { symbol: string; name: string; sector?: string };

/** Sahnenin bir hissesi. `cap` dolar; bilinmiyorsa `null` (en küçük boy). */
export type SceneStock = { symbol: string; name: string; sector: string; change: number; cap: number | null };

/** Değişim dört ondalıkla taşınıyor (%0,0001): sahnede yarım pikselin çok
 *  altında, istemciye giden yük üçte bir. Piyasa değeri üç anlamlı basamak. */
const CHANGE_ROUND = 1e4;
const CAP_DIGITS = 3;

function roundCap(cap: number | null): number | null {
  if (cap === null || !Number.isFinite(cap) || cap <= 0) return null;
  return Number(cap.toPrecision(CAP_DIGITS));
}

/**
 * Posterin hisselerini sahneye çevirir: ad ve sektör üye listesinden,
 * piyasa değeri çağıranın verdiği `capOf`tan (o günün kapanışı × hisse
 * sayısı). Sektörü bilinmeyen üye sahneye girmiyor ve `unplaced`te
 * sayılıyor (künye yazar); genişlik sayımında yine var.
 */
export function sceneStocks(
  stocks: readonly PosterStock[],
  members: readonly SceneMember[],
  capOf: (symbol: string, close: number) => number | null,
): { stocks: SceneStock[]; unplaced: number } {
  const bySymbol = new Map(members.map((member) => [member.symbol, member] as const));
  const out: SceneStock[] = [];
  let unplaced = 0;
  for (const stock of stocks) {
    const member = bySymbol.get(stock.symbol);
    const sector = member?.sector ? GICS_SECTOR_FUND[member.sector] : undefined;
    if (!member || !sector) {
      unplaced += 1;
      continue;
    }
    out.push({
      symbol: stock.symbol,
      name: member.name,
      sector,
      change: Math.round(stock.change * CHANGE_ROUND) / CHANGE_ROUND,
      cap: roundCap(capOf(stock.symbol, stock.close)),
    });
  }
  return { stocks: out, unplaced };
}

/* --------------------------------------------------------------------------
   Ölçek
   -------------------------------------------------------------------------- */

/** Eksenin tabanı (yüzde puan): sakin bir günde ±%0,3'lük hareket
 *  kenardan kenara yayılıp "büyük gün" gibi görünmesin. Posterin kulvar
 *  ölçeğiyle aynı taban (`POSTER_SCALE_FLOOR`). */
export const SWARM_FLOOR = 1;

/**
 * UÇ HİSSELER EKSENİ ESİR ALMASIN. Bir günde tek bir hisse %20 oynayınca
 * eksen ona göre kurulursa kalan 498 nokta ortada üst üste biner. Eksen bu
 * yüzden hisselerin %1'lik iki ucunu (beşer hisse) dışarıda bırakıp kuruluyor;
 * dışarıda kalan hisse SİLİNMİYOR: kenara, halkalı olarak konuyor ve adı ile
 * gerçek değeri etiketinde ve ipucunda yazıyor (`clip`).
 */
export const SWARM_CLIP_QUANTILE = 0.01;

/** Eksen adımları — okunur yüzdeler. En fazla altı aralık. */
const NICE_STEPS = [0.5, 1, 2, 2.5, 5, 10, 20, 50] as const;
const MAX_INTERVALS = 6;

export type SwarmDomain = { lo: number; hi: number; step: number; ticks: number[] };

function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

/** Ondalık kırıntısız çarpım: 0,1 × 3 = 0,30000000000000004 olmasın. */
const tidy = (value: number) => Math.round(value * 1e6) / 1e6;

export function swarmDomain(changes: readonly number[]): SwarmDomain {
  const sorted = [...changes].sort((a, b) => a - b);
  const rawLo = Math.min(-SWARM_FLOOR, quantile(sorted, SWARM_CLIP_QUANTILE));
  const rawHi = Math.max(SWARM_FLOOR, quantile(sorted, 1 - SWARM_CLIP_QUANTILE));
  const span = rawHi - rawLo;
  const step = NICE_STEPS.find((candidate) => span / candidate <= MAX_INTERVALS) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const lo = tidy(Math.floor(rawLo / step) * step);
  const hi = tidy(Math.ceil(rawHi / step) * step);
  const ticks: number[] = [];
  for (let k = Math.round(lo / step); k <= Math.round(hi / step); k++) ticks.push(tidy(k * step));
  return { lo, hi, step, ticks };
}

/* --------------------------------------------------------------------------
   Düzenler
   -------------------------------------------------------------------------- */

/**
 * Sahnenin ölçüleri, birim cinsinden. Satırın SVG'si kabın enine ölçeklendiği
 * için nokta boyu da kapla büyüyüp küçülüyor; iki düzen bu oranı makul
 * aralıkta tutuyor: `narrow` telefonda (şerit ~340 piksel, ölçek ~0,85),
 * `wide` geniş ekranda (şerit 580-760 piksel, ölçek ~0,75-0,95). Seçim
 * CSS kap sorgusuyla (`PosterStage.module.css`), ikisi de sunucuda basılı.
 *
 * - `rMin` en küçük noktanın yarıçapı — bir TABAN: piyasa değeri bundan
 *   küçük çıkan hisse yine görünsün (künyede yazılı).
 * - `labelW`/`labelH` uç hisse etiketinin birimdeki kutusu; satırın etiket
 *   payı, etiketin altında kalan noktalar ve etiket katları bununla.
 *   Etiket PİKSELDE sabit (~105×18 px, en uzun "GOOGL −%10,25"), şerit
 *   ölçekleniyor; kutu düzenin EN KÜÇÜK ölçeğine göre: `narrow` 320'de
 *   0,625, `wide` kabın 720'yi geçtiği yerde 0,662 (ölçüldü, 25 Ekim:
 *   320–1600 arası 20 piksel adımla). Daha büyük ölçekte etiketler yalnız
 *   biraz bol aralıklı duruyor; hiçbir genişlikte noktaya binmiyor.
 */
export type SwarmMode = {
  width: number;
  rMin: number;
  rMax: number;
  gap: number;
  /** Satırın sıfır çizgisinin iki yanındaki en az yükseklik. */
  minHalf: number;
  rowPad: number;
  labelW: number;
  labelH: number;
};

export const SWARM_MODES = {
  narrow: { width: 400, rMin: 2.6, rMax: 11, gap: 0.7, minHalf: 9, rowPad: 5, labelW: 168, labelH: 29 },
  wide: { width: 800, rMin: 3.1, rMax: 17, gap: 0.9, minHalf: 12, rowPad: 7, labelW: 160, labelH: 28 },
  /** Paylaşım görseli (satori), 1200×630 kartın sağ sütunu. */
  og: { width: 700, rMin: 2.8, rMax: 15, gap: 0.7, minHalf: 10, rowPad: 4, labelW: 0, labelH: 0 },
  /** Dikey paylaşım görseli, 1080×1350. */
  ogTall: { width: 760, rMin: 3.4, rMax: 19, gap: 0.8, minHalf: 13, rowPad: 6, labelW: 0, labelH: 0 },
  /** Arşiv kartının minyatürü. */
  mini: { width: 320, rMin: 1.3, rMax: 6, gap: 0.35, minHalf: 3.2, rowPad: 1.5, labelW: 0, labelH: 0 },
} as const satisfies Record<string, SwarmMode>;

export type SwarmModeName = keyof typeof SWARM_MODES;

/** Kenar payı: en büyük nokta eksenin ucunda da kutunun içinde kalsın. */
const padOf = (mode: SwarmMode) => mode.rMax + 1;

/** Bir değişimin x'i ve eksenin dışında kalıp kalmadığı (−1 solda, 1 sağda). */
export function swarmX(value: number, domain: SwarmDomain, mode: SwarmMode): { x: number; clip: -1 | 0 | 1 } {
  const pad = padOf(mode);
  const clip = value < domain.lo ? -1 : value > domain.hi ? 1 : 0;
  const v = Math.min(domain.hi, Math.max(domain.lo, value));
  return { x: pad + ((v - domain.lo) / (domain.hi - domain.lo)) * (mode.width - pad * 2), clip };
}

/**
 * Nokta boyu: ALAN piyasa değeriyle orantılı (yarıçap karekökle), en büyük
 * hisse `rMax`. Taban `rMin`; bilinmeyen değer tabanda.
 */
export function swarmRadius(cap: number | null, capMax: number, mode: SwarmMode, scale = 1): number {
  const rMax = mode.rMax * scale;
  const rMin = mode.rMin * scale;
  if (cap === null || capMax <= 0) return rMin;
  return Math.min(rMax, Math.max(rMin, rMax * Math.sqrt(cap / capMax)));
}

/**
 * BOY ANAHTARI — lejanttaki üç referans daire: günün en büyük şirketinin
 * yuvarlanmış değeri, onun dörtte biri ve on altıda biri. Alan karekökle
 * ölçeklendiği için daireler yarıçapta yarıya iniyor; değerler tek anlamlı
 * basamağa yuvarlı ("4 T $", "1 T $", "300 Mr $") ve yarıçap YUVARLANMIŞ
 * değerden hesaplanıyor, yani anahtar sahneyle aynı ölçekte yalan söylemiyor.
 */
export function sizeKey(capMax: number, mode: SwarmMode): { cap: number; r: number }[] {
  if (capMax <= 0) return [];
  return [1, 4, 16].map((div) => {
    const cap = Number((capMax / div).toPrecision(1));
    return { cap, r: swarmRadius(cap, capMax, mode) };
  });
}

/**
 * Anahtarın dizilişi: daire, künyesi, sonraki daire. Künyenin eni kabaca
 * karakter sayısından (`charW` birim/karakter); daireler hiç üst üste
 * binmesin diye her biri bir öncekinin künyesinden sonra.
 */
export function sizeKeyRow(
  capMax: number,
  mode: SwarmMode,
  textOf: (cap: number) => string,
  charW: number,
): { cap: number; r: number; cx: number; tx: number; text: string }[] {
  const LABEL_GAP = 5;
  const ITEM_GAP = 18;
  const out: { cap: number; r: number; cx: number; tx: number; text: string }[] = [];
  let x = 1;
  for (const item of sizeKey(capMax, mode)) {
    const text = textOf(item.cap);
    const cx = x + item.r;
    const tx = cx + item.r + LABEL_GAP;
    out.push({ ...item, cx, tx, text });
    x = tx + text.length * charW + ITEM_GAP;
  }
  return out;
}

/* --------------------------------------------------------------------------
   Yığma
   -------------------------------------------------------------------------- */

/**
 * ARI KOVANI YIĞMASI. Noktalar BÜYÜKTEN KÜÇÜĞE yerleşiyor (dev hisseler
 * sıfır hattına en yakın, küçükler çevresinde); her nokta x'ini koruyor ve
 * yalnız dikeyde, çarpışmadığı EN YAKIN yüksekliğe kayıyor. Aday
 * yükseklikler yerleşmiş komşulara teğet konumlar; eşit uzaklıkta iki aday
 * varsa sıra yönü seçiyor (çift sıra aşağı, tek sıra yukarı), yığın iki
 * yana dengeli büyüyor. Tohum yok, rastgelelik yok: aynı veri aynı şekil.
 *
 * Karmaşıklık n² × aday; en kalabalık satır 81 hisse (Sanayi), satır başına
 * milisaniyenin altında.
 */
export function packRow(items: readonly { x: number; r: number }[], gap: number): number[] {
  const order = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.r - a.r || a.x - b.x || a.index - b.index);
  const placed: { x: number; y: number; r: number }[] = [];
  const ys = new Array<number>(items.length).fill(0);
  const EPS = 1e-6;
  order.forEach((item, rank) => {
    const near = placed.filter((p) => Math.abs(p.x - item.x) < p.r + item.r + gap);
    const candidates = [0];
    for (const p of near) {
      const reach = p.r + item.r + gap;
      const dy = Math.sqrt(Math.max(0, reach * reach - (p.x - item.x) ** 2));
      candidates.push(p.y + dy, p.y - dy);
    }
    const preferDown = rank % 2 === 0;
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || (preferDown ? b - a : a - b));
    const fits = (y: number) =>
      near.every((p) => (p.x - item.x) ** 2 + (p.y - y) ** 2 >= (p.r + item.r + gap) ** 2 - EPS);
    const y = candidates.find(fits) ?? 0;
    placed.push({ x: item.x, y, r: item.r });
    ys[item.index] = y;
  });
  return ys;
}

/* --------------------------------------------------------------------------
   Yerleşim
   -------------------------------------------------------------------------- */

export type SwarmDot = {
  /** `stocks` dizisindeki sıra. */
  i: number;
  x: number;
  /** Satırın kendi kutusunda, üstten. */
  y: number;
  r: number;
  clip: -1 | 0 | 1;
};

export type SwarmNote = {
  i: number;
  x: number;
  y: number;
  r: number;
  /** Etiketin ALT kenarının y'si (noktanınkiyle aynı koordinatta). Etiket
   *  hep yukarıda; bu çizgi kapsadığı enin bütün noktalarının üstünde. */
  labelY: number;
  align: "start" | "middle" | "end";
};

export type SwarmRow = {
  sector: string;
  /** Satırın sahnedeki üst kenarı (birleşik çizimler için: görsel, minyatür). */
  top: number;
  height: number;
  /** Sıfır hattının, yani yığının ortasının satırdaki y'si. */
  mid: number;
  dots: SwarmDot[];
  notes: SwarmNote[];
  /** Sektör fonunun o günkü değişiminin x'i. */
  fundX: number | null;
  advancing: number;
  declining: number;
};

export type SwarmLayout = {
  mode: SwarmModeName;
  width: number;
  height: number;
  zeroX: number;
  domain: SwarmDomain;
  rows: SwarmRow[];
};

/** Etiketin yatay hizası: kenara yakın etiket kutudan taşmasın. */
const EDGE_ALIGN = 0.16;
/** Kenara yaslı etiketin noktanın merkezinden taşan payı (birim): CSS'teki
 *  10 piksellik `--tx` (PosterStage.module.css → `.note`) en küçük ölçekte. */
const NOTE_OVERHANG = 16;
/** Etiketle altındaki en yüksek nokta arasındaki boşluk (birim). */
const NOTE_GAP = 2;

/** Etiketin yatay kapsamı (birim): hizaya göre noktanın solu, sağı ya da ortası. */
function noteSpan(x: number, align: SwarmNote["align"], mode: SwarmMode): [number, number] {
  if (align === "start") return [x - NOTE_OVERHANG, x - NOTE_OVERHANG + mode.labelW];
  if (align === "end") return [x + NOTE_OVERHANG - mode.labelW, x + NOTE_OVERHANG];
  return [x - mode.labelW / 2, x + mode.labelW / 2];
}

/**
 * UÇ HİSSE ETİKETLERİ HİÇBİR NOKTAYI ÖRTMEZ (25 Ekim, son inceleme).
 *
 * İlk sürüm etiketi noktanın hemen üstüne, çakışırsa altına koyuyordu.
 * Ölçek dışındaki hisseler kenarda AYNI x'te üst üste yığıldığı için (23
 * Ekim: CRWD +%8,25 ve PANW +%7,22 +%6 kenarında) alttaki etiket üstteki
 * halkanın ve yanındaki noktanın üstüne biniyordu; üçüncü bir halka hiç
 * etiketlenemiyordu.
 *
 * Şimdi etiket hep YUKARIDA ve kapsadığı enin (`noteSpan`) EN YÜKSEK
 * noktasının üstünde duruyor; o ende önceki bir etiket varsa onun da
 * üstüne çıkıyor (etiketler kat kat). Satır bu katların payı kadar açılıyor
 * (`swarmLayout`). Yani bir etiket ne kendi satırının bir noktasını ne
 * başka bir etiketi örter; kaç halka olursa olsun her biri etiketli.
 */
export function placeNotes(
  noted: readonly { i: number; x: number; y: number; r: number }[],
  mode: SwarmMode,
  dots: readonly { x: number; y: number; r: number }[] = noted,
): SwarmNote[] {
  /* Alttaki nokta önce: etiket katlarının sırası noktaların sırasıyla aynı
     (en alttaki etiket en alttaki halkanın). */
  const sorted = [...noted].sort((a, b) => b.y - b.r - (a.y - a.r) || a.x - b.x || a.i - b.i);
  const out: SwarmNote[] = [];
  const spans: [number, number][] = [];
  const overlaps = (a: [number, number], lo: number, hi: number) => a[0] < hi && lo < a[1];
  for (const dot of sorted) {
    const align = dot.x < mode.width * EDGE_ALIGN ? "start" : dot.x > mode.width * (1 - EDGE_ALIGN) ? "end" : "middle";
    const span = noteSpan(dot.x, align, mode);
    let labelY = dot.y - dot.r;
    for (const other of dots) {
      if (overlaps(span, other.x - other.r, other.x + other.r)) labelY = Math.min(labelY, other.y - other.r);
    }
    labelY -= NOTE_GAP;
    /* Önceki etiketlerle kat kat: dikeyde çakışan varsa onun üstüne. */
    for (let moved = true; moved; ) {
      moved = false;
      for (const [k, other] of out.entries()) {
        if (!overlaps(span, spans[k][0], spans[k][1])) continue;
        if (labelY > other.labelY - mode.labelH && labelY - mode.labelH < other.labelY) {
          labelY = other.labelY - mode.labelH;
          moved = true;
        }
      }
    }
    out.push({ ...dot, labelY, align });
    spans.push(span);
  }
  return out.sort((a, b) => a.x - b.x || a.i - b.i);
}

/**
 * Bütün sahne: satırlar `sectorOrder` sırasıyla (posterde güçlüden zayıfa),
 * her satır kendi yığını ve uç hisse etiketleri için payı kadar yüksek.
 * `scale` yarıçapları küçültür (paylaşım görseli kutusuna sığdırma,
 * `fitSwarm`); x'ler değişmez.
 */
export function swarmLayout({
  stocks,
  sectorOrder,
  fundChange,
  mode: modeName,
  domain,
  notes = [],
  scale = 1,
}: {
  stocks: readonly SceneStock[];
  sectorOrder: readonly string[];
  fundChange?: (sector: string) => number | null;
  mode: SwarmModeName;
  domain: SwarmDomain;
  /** Etiketlenecek hisselerin `stocks` sırası. */
  notes?: readonly number[];
  scale?: number;
}): SwarmLayout {
  const mode: SwarmMode = SWARM_MODES[modeName];
  const capMax = Math.max(0, ...stocks.map((stock) => stock.cap ?? 0));
  const noted = new Set(notes);
  const rows: SwarmRow[] = [];
  let top = 0;
  for (const sector of sectorOrder) {
    const members = stocks.flatMap((stock, i) => (stock.sector === sector ? [{ stock, i }] : []));
    const items = members.map(({ stock, i }) => {
      const { x, clip } = swarmX(stock.change, domain, mode);
      return { i, x, clip, r: swarmRadius(stock.cap, capMax, mode, scale) };
    });
    const ys = packRow(items, mode.gap * scale);
    let up = mode.minHalf * scale;
    let down = mode.minHalf * scale;
    items.forEach((item, k) => {
      up = Math.max(up, item.r - ys[k]);
      down = Math.max(down, item.r + ys[k]);
    });
    const rel = items.map((item, k) => ({ ...item, y: ys[k] }));
    const rowNotes = placeNotes(
      rel.filter((item) => noted.has(item.i)),
      mode,
      rel,
    );
    /* Etiketin payı: etiket alt kenarından bir etiket boyu yukarı
       uzanıyor; satır o kadar açılıyor ki komşu satıra binmesin. */
    for (const note of rowNotes) up = Math.max(up, mode.labelH - note.labelY);
    const mid = mode.rowPad + up;
    const height = mid + down + mode.rowPad;
    const fund = fundChange?.(sector);
    rows.push({
      sector,
      top,
      height,
      mid,
      dots: rel.map(({ i, x, y, r, clip }) => ({ i, x, y: mid + y, r, clip })),
      notes: rowNotes.map((note) => ({ ...note, y: mid + note.y, labelY: mid + note.labelY })),
      fundX: fund === null || fund === undefined ? null : swarmX(fund, domain, mode).x,
      advancing: members.filter(({ stock }) => stock.change > 0).length,
      declining: members.filter(({ stock }) => stock.change < 0).length,
    });
    top += height;
  }
  return { mode: modeName, width: mode.width, height: top, zeroX: swarmX(0, domain, mode).x, domain, rows };
}

/** Sığdırmada yarıçapın en çok küçüleceği oran. */
const FIT_MIN_SCALE = 0.4;
const FIT_STEP = 0.92;

/**
 * Sabit kutulu çizimler (paylaşım görseli) için: yerleşim `maxHeight`e
 * sığana kadar yarıçaplar adım adım küçülüyor. Taban oranda da sığmıyorsa
 * en küçük hâli dönüyor (çağıran kutuyu ölçekler).
 */
export function fitSwarm(args: Parameters<typeof swarmLayout>[0], maxHeight: number): SwarmLayout {
  let scale = 1;
  let layout = swarmLayout({ ...args, scale });
  while (layout.height > maxHeight && scale * FIT_STEP >= FIT_MIN_SCALE) {
    scale *= FIT_STEP;
    layout = swarmLayout({ ...args, scale });
  }
  return layout;
}

/* --------------------------------------------------------------------------
   Uçlar
   -------------------------------------------------------------------------- */

export const SWARM_EXTREMES = 3;

/**
 * Günün en çok yükselen ve en çok düşen hisseleri (`stocks` sırası).
 * Yükselen listesine yalnız gerçekten yükselen girer: hepsinin düştüğü bir
 * günde "en çok yükselen" diye bir düşüşü etiketlemiyoruz.
 */
export function swarmExtremes(stocks: readonly SceneStock[], n = SWARM_EXTREMES): { up: number[]; down: number[] } {
  const ranked = stocks.map((stock, i) => ({ change: stock.change, symbol: stock.symbol, i }));
  const up = ranked
    .filter((s) => s.change > 0)
    .sort((a, b) => b.change - a.change || a.symbol.localeCompare(b.symbol, "en"))
    .slice(0, n)
    .map((s) => s.i);
  const down = ranked
    .filter((s) => s.change < 0)
    .sort((a, b) => a.change - b.change || a.symbol.localeCompare(b.symbol, "en"))
    .slice(0, n)
    .map((s) => s.i);
  return { up, down };
}

/**
 * Eksenin dışında kalan hisseler (`stocks` sırası). Kenarda halkalı
 * çiziliyorlar; gerçek değerleri yalnız etiketlerinde okunduğu için HER
 * biri etiketli (`placeNotes`), yalnız günün üç ucu değil.
 */
export function swarmClipped(stocks: readonly SceneStock[], domain: SwarmDomain): number[] {
  return stocks.flatMap((stock, i) => (stock.change < domain.lo || stock.change > domain.hi ? [i] : []));
}

/* --------------------------------------------------------------------------
   Perde planı ve giriş
   -------------------------------------------------------------------------- */

/**
 * PERDELER — sahne kaydırmayla dört perdede açılıyor, kaydırma ele
 * geçirilmeden (her perde ekrana girdiği an bir kez oynuyor):
 *   1. `breadth`  — genişlik: "130 Yükseldi / 363 Düştü", şerit dolar.
 *   2. `sectors`  — satırlar: noktalar sıfır hattından yerlerine akar.
 *   3. `extremes` — uç hisselerin etiketleri, noktalar oturunca.
 *   4. `indices`  — künye kartındaki endeks kulvarları.
 * Verisi olmayan perde planda yok (genişlik hesaplanamadıysa ilk perde
 * yok; o gün hiç hisse yükselmediyse "uçlar" yine var, düşenlerle).
 */
export const POSTER_ACTS = ["breadth", "sectors", "extremes", "indices"] as const;
export type PosterAct = (typeof POSTER_ACTS)[number];

export function posterActs({
  breadth,
  stocks,
  indices,
}: {
  breadth: boolean;
  stocks: number;
  indices: number;
}): PosterAct[] {
  return POSTER_ACTS.filter((act) => {
    if (act === "breadth") return breadth;
    if (act === "sectors" || act === "extremes") return stocks > 0;
    return indices > 0;
  });
}

/**
 * GİRİŞİN ZAMANLAMASI (saniye). Her nokta sıfır hattından kendi x'ine
 * akıyor: süre yolun uzunluğuyla büyüyor (motion-design: mesafe süreyi
 * ölçekler), böylece uzağa giden hızlanmadan, yakındaki aceleye gelmeden
 * varıyor. Küçük bir dağılma (`spread`) sıra sıra değil dalga gibi
 * gelsinler diye; dizinden türetiliyor, rastgele değil. Satırlar aynı anda
 * ekrana girerse aralarında `rowStep` var, en çok `rowCap` satır.
 * Eğri `--ease-brand`; yay yok.
 */
export const ENTRY = {
  base: 0.5,
  travel: 0.42,
  spread: 0.14,
  rowStep: 0.07,
  rowCap: 5,
  noteAfter: 0.08,
} as const;

/** Dizinden 0…1 arası sabit bir sayı (Knuth çarpımsal karması). */
function hashUnit(i: number): number {
  return ((Math.imul(i + 1, 2654435761) >>> 0) % 1000) / 1000;
}

export function entryTiming(
  dot: Pick<SwarmDot, "i" | "x">,
  zeroX: number,
  maxDist: number,
  batchIndex = 0,
): { delay: number; duration: number } {
  const dist = maxDist > 0 ? Math.min(1, Math.abs(dot.x - zeroX) / maxDist) : 0;
  const row = Math.min(batchIndex, ENTRY.rowCap) * ENTRY.rowStep;
  return { delay: row + ENTRY.spread * hashUnit(dot.i), duration: ENTRY.base + ENTRY.travel * dist };
}

/** Bir satırın etiketleri: o satırın en geç oturan noktasından hemen sonra. */
export function noteDelay(row: Pick<SwarmRow, "dots">, zeroX: number, maxDist: number, batchIndex = 0): number {
  let end = 0;
  for (const dot of row.dots) {
    const t = entryTiming(dot, zeroX, maxDist, batchIndex);
    end = Math.max(end, t.delay + t.duration);
  }
  return end + ENTRY.noteAfter;
}

/* --------------------------------------------------------------------------
   Minyatür (arşiv kartı) — düz SVG metni
   -------------------------------------------------------------------------- */

export type SwarmInk = { up: string; down: string; flat: string; zero: string; lane: string };

const fixed = (value: number) => Number(value.toFixed(1));

/**
 * Arşiv kartının statik SVG'si (`/gun/[tarih]/minyatur`). Kart `img` ile
 * tembel yükleniyor: otuz kartın 15.000 noktası sayfanın HTML'ine girmesin
 * (ölçüm `PosterArchive.tsx`). Renkler çağırandan (temaya göre iki dosya),
 * satırlar arası ince ayraç, sıfır hattı. Metin yok; okunan karşılığı
 * kartın kendisinde.
 */
export function swarmSvg(layout: SwarmLayout, stocks: readonly SceneStock[], ink: SwarmInk): string {
  const parts: string[] = [];
  const w = layout.width;
  const h = fixed(layout.height);
  parts.push(`<line x1="${fixed(layout.zeroX)}" y1="0" x2="${fixed(layout.zeroX)}" y2="${h}" stroke="${ink.zero}" stroke-width="1"/>`);
  layout.rows.forEach((row, k) => {
    if (k > 0) parts.push(`<line x1="0" y1="${fixed(row.top)}" x2="${w}" y2="${fixed(row.top)}" stroke="${ink.lane}" stroke-width="0.6"/>`);
    const byTone: Record<"up" | "down" | "flat", string[]> = { up: [], down: [], flat: [] };
    for (const dot of row.dots) {
      const change = stocks[dot.i].change;
      const tone = change > 0 ? "up" : change < 0 ? "down" : "flat";
      byTone[tone].push(`<circle cx="${fixed(dot.x)}" cy="${fixed(row.top + dot.y)}" r="${fixed(dot.r)}"/>`);
    }
    for (const tone of ["up", "down", "flat"] as const) {
      if (byTone[tone].length) parts.push(`<g fill="${ink[tone]}">${byTone[tone].join("")}</g>`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join("")}</svg>`;
}
