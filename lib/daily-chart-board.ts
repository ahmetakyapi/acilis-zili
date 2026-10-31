import type { DailyChartBlock } from "@/lib/daily-chart";
import { barSpan, divergingScale, memberSymbolOf, sectorFundOf, type DivergingScale } from "@/lib/daily-chart-figure";
import { formatPercent, SIGN_GAP } from "@/lib/utils";

/* ==========================================================================
   Günün Grafiği — kart panosunun saf mantığı (25 Ekim, kart turu)

   Sahibinin sözü: "İlk açılırken sadece yatay çubuk açılmasın, KARTLAR
   olsun, o kartlardan okuyalım verileri." Sayfa artık bir pano: üstte
   künye kartları, altında bloğun her satırı kendi küçük kartında. Bu dosya
   kartların NE taşıyacağını React'siz kuruyor; çizim
   `components/daily-chart/ChartBoard.tsx`, testi
   `tests/daily-chart-board.test.ts`.

   Ölçek DEĞİŞMEDİ: karttaki ince çubuk sayfanın eski grafiğiyle ve
   paylaşım görseliyle aynı `divergingScale`ten (lib/daily-chart-figure.ts).
   Kartlar ayrı ayrı dursa da −1,92'nin çubuğu her yerde aynı boyda.

   GRAFİĞİN YÖNÜ (31 Ekim). Sahibinin sözü: "neden en güçlü Dell
   gözüküyor? burayı da daha anlamlı yapalım." 30 Ekim'in grafiği "En Çok
   Düşen Hisseler"di (sekiz kalemin hepsi eksi) ve künye mekanik olarak
   "En Güçlü −10,77 Dell", "Artıda / Ekside 0 / 8" diyordu: düşüş listesinde
   "en güçlü" okuru yanıltıyor, "0 / 8" ise başlığın zaten söylediğini
   tekrarlıyordu. Artık künye ve kart sırası grafiğin YÖNÜNE göre
   (`boardTrend`):
     · karışık işaret → en güçlü, en zayıf, kaç kalem artıda (eski hâl);
     · hepsi eksi     → en çok düşen önce, en az düşen, ortalama düşüş;
     · hepsi artı     → en çok yükselen önce, en az yükselen, ortalama.
   Kart ızgarası da hikâyenin sırasıyla: düşüş listesinde en sert düşüş
   başta (rutinin yazdığı sıra), eskiden en az düşen başa geçiyordu.
   "Endekse göre kaç kat" künyesi BİLEREK yok: blok d1, d5 ya da d21
   olabiliyor ve yanındaki Nasdaq 100 kartı hep o günün değişimi; dönemi
   bilinmeyen iki yüzdeyi oranlamak uydurma kesinlik olurdu.
   ========================================================================== */

type BarsBlock = Extract<DailyChartBlock, { kind: "bars" }>;

export type TileDir = "up" | "down" | "flat";

/** Grafiğin yönü: kalemlerin hepsi aynı taraftaysa künye onu anlatır. */
export type BoardTrend = "mixed" | "allUp" | "allDown";

/**
 * Bir ucun okura söylenen adı — kartın küçük etiketi ve künye başlığı aynı
 * sözlük anahtarından (`board.roles`).
 *   strongest/weakest — karışık işaret; mostUp/leastUp ve mostDown/leastDown
 *   tek yönlü grafik; largest/smallest nötr (yönsüz) blok.
 */
export type TileRole =
  | "strongest"
  | "weakest"
  | "mostUp"
  | "leastUp"
  | "mostDown"
  | "leastDown"
  | "largest"
  | "smallest";

export type BoardTile = {
  name: string;
  /** Ekranda basılan yazılış: yüzde blokta birimiyle ("−%10,77"). */
  display: string;
  value: number;
  /** Ad bir sektörse fonu (simge ve bağlantı); değilse null. */
  fund: string | null;
  /** Ad bir endeks üyesinin adıysa sembolü (logo ve bağlantı); değilse null. */
  symbol: string | null;
  dir: TileDir;
  /** Çubuk: alanın yüzdesi olarak başlangıç ve boy; çubuksuz blokta null. */
  bar: { start: number; size: number } | null;
  /** Sıralamanın uçları: en yüksek ve en düşük DEĞER. */
  rank: "top" | "bottom" | null;
  /** Ucun okura adı (kartın küçük etiketi); uç değilse null. */
  role: TileRole | null;
  /**
   * Kart vurgulu mu (yön yıkaması). Karışık grafikte iki uç da; tek yönlü
   * grafikte yalnız HİKÂYENİN ucu (en çok düşen / en çok yükselen) — en az
   * düşeni kırmızıyla vurgulamak onu ikinci bir manşet yapıyordu.
   */
  emphasis: boolean;
};

export type BoardTiles = {
  tiles: BoardTile[];
  /** İşaretli blokta iki yönlü ölçek (ölçek künyesi de bunu çizer). */
  scale: DivergingScale | null;
  /** İşaretli mi: renk yön taşır. Nötr blokta çubuk tek tonda. */
  signed: boolean;
  trend: BoardTrend;
  /** Değerler birimsiz yazılmış yüzdeler mi (blok etiketi "%" taşıyor). */
  percent: boolean;
};

const dirOf = (value: number): TileDir => (value > 0 ? "up" : value < 0 ? "down" : "flat");

/** Bloğun yönü — sıfır bir kalem "hepsi eksi" demeyi bozar (o karışık). */
export function boardTrend(values: readonly number[]): BoardTrend {
  if (values.length === 0) return "mixed";
  if (values.every((value) => value < 0)) return "allDown";
  if (values.every((value) => value > 0)) return "allUp";
  return "mixed";
}

/** Birimsiz sayı yazılışı: "+1,23", "-10,77", "−0,5", "0,00". */
const BARE_NUMBER = /^([+\-−])?\s*(\d[\d.,]*)$/u;

/**
 * Yüzde blok mu (31 Ekim). Rutin değerleri paketteki `pct` yazılışıyla,
 * BİRİMSİZ yazıyor ("-10,77"); birimi blok etiketi taşıyor ("Günlük
 * Değişim %"). Kartlarda "−10,77" ile yanındaki Nasdaq kartının "−%3,47"si
 * iki ayrı birim gibi okunuyordu. Etiket "%" taşıyor ve her değer birimsiz
 * bir sayıysa kart yazılışa "%" ekler; sayı aynı kalır, yalnız birim gelir.
 */
export function isPercentBlock(block: BarsBlock): boolean {
  if (block.unscaled || !block.label.includes("%")) return false;
  return block.items.every((item) => BARE_NUMBER.test(item.display.trim()));
}

/**
 * Birimsiz yazılışa yüzde birimi — sayının rakamları DOKUNULMADAN (yuvarlama
 * yok), işaret sitenin biçimiyle ("−" ve ince boşluk, `formatPercent`).
 * Birimsiz sayı değilse yazılış olduğu gibi döner.
 */
export function percentDisplay(display: string, locale: string): string {
  const match = BARE_NUMBER.exec(display.trim());
  if (!match) return display;
  const [, sign, digits] = match;
  const zero = !/[1-9]/.test(digits);
  const mark = zero || !sign ? "" : sign === "+" ? "+" : "−";
  const lead = mark ? `${mark}${SIGN_GAP}` : "";
  return locale === "tr" ? `${lead}%${digits}` : `${lead}${digits}%`;
}

/** Bloğun yazdığı en çok ondalık hane — ortalama bundan fazlasını basmaz. */
function decimalsOf(displays: readonly string[], locale: string): number {
  const separator = locale === "tr" ? "," : ".";
  return Math.max(
    0,
    ...displays.map((display) => {
      const at = display.lastIndexOf(separator);
      return at < 0 ? 0 : display.slice(at + 1).replace(/\D/g, "").length;
    }),
  );
}

function roleOf(trend: BoardTrend, signed: boolean, rank: "top" | "bottom"): TileRole {
  if (!signed) return rank === "top" ? "largest" : "smallest";
  if (trend === "allDown") return rank === "top" ? "leastDown" : "mostDown";
  if (trend === "allUp") return rank === "top" ? "mostUp" : "leastUp";
  return rank === "top" ? "strongest" : "weakest";
}

/**
 * `bar` bloğunun kartları — HİKÂYENİN SIRASIYLA (kararlı: eşitlikte blokta
 * önce gelen önde). Varsayılan yüksekten düşüğe; hepsi eksi bir blokta
 * düşükten yükseğe, yani en sert düşüş başta (31 Ekim). Rutin bloğu
 * çoğunlukla sıralı yazıyor ama yazmak zorunda değil; kart ızgarası okuma
 * sırası olduğu için sırayı burada garanti ediyoruz.
 *
 * `unscaled` blok (değerler ortak ölçeğe oturmuyor, `parse-blocks.ts`)
 * sıralanmaz ve çubuk çizilmez: değerlerin hepsi 0, sıra rutinin sırası.
 */
export function boardTiles(block: BarsBlock, locale = "tr"): BoardTiles {
  const signed = !block.neutral && !block.unscaled;
  const trend = signed ? boardTrend(block.items.map((item) => item.value)) : "mixed";
  const percent = isPercentBlock(block);
  const ascending = trend === "allDown";
  const ordered = block.unscaled
    ? block.items.map((item, index) => ({ item, index }))
    : block.items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => (ascending ? a.item.value - b.item.value : b.item.value - a.item.value) || a.index - b.index);
  const scale = signed ? divergingScale(block.items.map((item) => item.value)) : null;
  const peak = Math.max(...block.items.map((item) => Math.abs(item.value)), 0);
  const last = ordered.length - 1;
  const ranked = !block.unscaled && ordered.length >= 2;

  const tiles = ordered.map(({ item }, position): BoardTile => {
    let bar: BoardTile["bar"] = null;
    if (scale) bar = barSpan(item.value, scale);
    else if (!block.unscaled && peak > 0) bar = { start: 0, size: (Math.abs(item.value) / peak) * 100 };
    const edge = !ranked ? null : position === 0 ? "first" : position === last ? "last" : null;
    /* Sıra artan ise ilk kart en DÜŞÜK değer. */
    const rank = edge === null ? null : (edge === "first") !== ascending ? "top" : "bottom";
    const fund = sectorFundOf(item.name);
    return {
      name: item.name,
      display: percent ? percentDisplay(item.display, locale) : item.display,
      value: item.value,
      fund,
      symbol: fund ? null : memberSymbolOf(item.name),
      dir: signed ? dirOf(item.value) : "flat",
      bar,
      rank,
      role: rank ? roleOf(trend, signed, rank) : null,
      emphasis: rank !== null && (trend === "mixed" || edge === "first"),
    };
  });
  return { tiles, scale, signed, trend, percent };
}

/* --------------------------------------------------------------------------
   Kart ızgarasının sütunları
   -------------------------------------------------------------------------- */

/** Kabın enine göre en çok sütun: <520 · 520 · 680 · 980 (ChartBoard.module.css). */
export const TILE_TIERS = [2, 3, 4, 6] as const;

export type TileTier = { cols: number; /** Ölçek künyesi ızgaranın boş hücresinde mi. */ legendInGrid: boolean };

/**
 * Her genişlik basamağında kaç sütun (31 Ekim). Eskiden sütun sayısı
 * kalem sayısından bağımsızdı ve ölçek kartı hep ızgaranın SON hücresiydi:
 * 11 sektörde 6×2'yi tamamlıyordu ama 8 hissede (6 sütun) ikinci satırda
 * iki kart, ölçek kartı ve üç boş hücre kalıyordu — kart yetim.
 *
 * Kural: basamağın tavanından aşağı doğru (6'lık basamakta en az 4, ötekinde
 * en az bir eksiği) satırları boşluksuz dolduran sütun sayısı aranır; tek
 * boş hücre kalıyorsa ve işaretli blokta ölçek künyesi varsa künye o hücreye
 * oturur (11 sektör: 6×2). Hiçbiri boşluksuz değilse en az boşluk bırakan,
 * eşitlikte geniş olan. Künye ızgaraya girmiyorsa ızgaranın ALTINDA tek
 * satırlık ince ölçek olarak durur.
 */
export function tileTiers(count: number, legend: boolean): TileTier[] {
  const cells = count + (legend ? 1 : 0);
  return TILE_TIERS.map((tier) => {
    let max = Math.max(1, Math.min(tier, cells));
    /* Üç ve daha çok kalem EN AZ İKİ SATIR: tek satırda kartlar, yanındaki
       uzun metin kolonunun boyuna gerilip boş kulelere dönüyordu (27 Ekim,
       dört endeks, 1440'ta 200 piksellik kartlar; ölçüldü). */
    if (count >= 3) max = Math.min(max, Math.ceil(cells / 2));
    const floor = Math.max(Math.min(2, max), Math.min(tier === 6 ? 4 : Math.max(tier - 1, 2), max - 1));
    let best: (TileTier & { score: number }) | null = null;
    for (let cols = max; cols >= floor; cols -= 1) {
      const empty = (cols - (count % cols)) % cols;
      const fills = legend && empty === 1;
      const score = fills ? 0 : empty;
      if (!best || score < best.score) best = { cols, legendInGrid: fills, score };
    }
    const chosen = best ?? { cols: max, legendInGrid: false, score: 0 };
    return { cols: chosen.cols, legendInGrid: chosen.legendInGrid };
  });
}

/* --------------------------------------------------------------------------
   Künye kartları
   -------------------------------------------------------------------------- */

export type BoardKey =
  | {
      kind: "extreme";
      /** Ucun adı (sözlükte `board.roles`); `share` en büyük pay. */
      role: TileRole | "share";
      name: string;
      display: string;
      fund: string | null;
      symbol: string | null;
      dir: TileDir;
    }
  | { kind: "count"; up: number; down: number; flat: number; total: number }
  | {
      kind: "mean";
      /** Ortalama, bloğun en çok ondalığıyla biçimli ("−%14,57"). */
      display: string;
      value: number;
      dir: TileDir;
      total: number;
      trend: "allUp" | "allDown";
      /** Ortalamanın çubuğu, kartlarla aynı ölçekte. */
      bar: { start: number; size: number } | null;
      zero: number;
    };

/**
 * Panonun tepesindeki künye kartları — YALNIZ bloktan (bloktaki yazılış
 * taşınır; tek hesaplanan sayı tek yönlü grafiğin ortalaması).
 *
 * - Karışık işaretli `bar`: en güçlü, en zayıf, kaç kalem artıda/ekside.
 * - Hepsi eksi / hepsi artı: hikâyenin ucu önce (en çok düşen / en çok
 *   yükselen), öteki uç, ortalama. "0 / 8" sayımı başlığın söylediğini
 *   tekrarlıyordu; ortalama ise kalemlerin TİPİK hareketini söylüyor. Yalnız
 *   yüzde blokta: birimi bilinmeyen sayıların ortalaması basılmaz, orada
 *   sayım kalır.
 * - Nötr `bar`: en büyük ve en küçük (yönsüz, renk yok).
 * - `pay`: en büyük pay.
 * - `oncesi` ve ölçeksiz `bar`: künye yok; ana kart zaten iki sayı ya da
 *   sırasız bir liste, aynı sayıyı ikinci kez basmak ekranı uzatırdı.
 *
 * Piyasa kartı (Nasdaq 100 ve genişlik) bloktan değil günün bağlamından
 * geliyor; onu çizici ekliyor.
 */
export function boardKeys(block: DailyChartBlock, locale = "tr"): BoardKey[] {
  if (block.kind === "shift") return [];
  if (block.items.length === 0) return [];
  if (block.kind === "share") {
    const top = block.items.reduce((best, item) => (item.value > best.value ? item : best), block.items[0]);
    return [
      { kind: "extreme", role: "share", name: top.name, display: top.display, fund: sectorFundOf(top.name), symbol: null, dir: "flat" },
    ];
  }
  if (block.unscaled) return [];
  const { tiles, signed, trend, percent, scale } = boardTiles(block, locale);
  const extreme = (tile: BoardTile): BoardKey => ({
    kind: "extreme",
    role: tile.role ?? (tile.rank === "bottom" ? "weakest" : "strongest"),
    name: tile.name,
    display: tile.display,
    fund: tile.fund,
    symbol: tile.symbol,
    dir: tile.dir,
  });
  /* Kart sırası hikâyenin sırası: tek yönlü grafikte ilk kart en uç. */
  const keys: BoardKey[] = [extreme(tiles[0]), extreme(tiles[tiles.length - 1])];
  if (!signed) return keys;
  if (trend !== "mixed" && percent) {
    const total = block.items.length;
    const value = block.items.reduce((sum, item) => sum + item.value, 0) / total;
    keys.push({
      kind: "mean",
      display: formatPercent(value, locale, decimalsOf(block.items.map((item) => item.display), locale)),
      value,
      dir: dirOf(value),
      total,
      trend,
      bar: scale ? barSpan(value, scale) : null,
      zero: scale?.zero ?? 0,
    });
    return keys;
  }
  const up = block.items.filter((item) => item.value > 0).length;
  const down = block.items.filter((item) => item.value < 0).length;
  keys.push({ kind: "count", up, down, flat: block.items.length - up - down, total: block.items.length });
  return keys;
}


/* --------------------------------------------------------------------------
   Pay halkası
   -------------------------------------------------------------------------- */

/** Pay paleti: ilk dört dilim kendi tonunda, gerisi tek "diğer" tonunda. */
export const SHARE_TONES = 4;

export type RingSlice = {
  name: string;
  display: string;
  /** Bütünün yüzdesi (0–100) ve halkadaki başlangıcı. */
  part: number;
  start: number;
  /** `--share-1` … `--share-4`, sonrası `--share-rest` (0 = rest). */
  tone: number;
};

/**
 * Halkanın dilimleri, büyükten küçüğe (ayrıştırıcı zaten sıralıyor,
 * `parse-blocks.ts`; yine de burada garanti). Toplam 0 ya da negatifse boş:
 * bütünü olmayan bir pay çizilmez.
 */
export function ringSlices(items: readonly { name: string; value: number; display: string }[]): RingSlice[] {
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  if (total <= 0) return [];
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.value - a.item.value || a.index - b.index);
  let start = 0;
  return sorted.map(({ item }, position) => {
    const part = (Math.max(item.value, 0) / total) * 100;
    const slice = { name: item.name, display: item.display, part, start, tone: position < SHARE_TONES ? position + 1 : 0 };
    start += part;
    return slice;
  });
}

/** `conic-gradient` durakları; dilimler arasında `gapDeg` derecelik zemin. */
export function ringGradient(slices: readonly RingSlice[], gapDeg = 1.5): string {
  if (slices.length === 0) return "none";
  const stops = slices.flatMap((slice) => {
    const color = slice.tone === 0 ? "var(--share-rest)" : `var(--share-${slice.tone})`;
    const from = slice.start * 3.6;
    const to = (slice.start + slice.part) * 3.6;
    const inner = Math.min(to, from + (slices.length > 1 ? gapDeg : 0));
    return slices.length > 1 ? [`transparent ${from}deg ${inner}deg`, `${color} ${inner}deg ${to}deg`] : [`${color} 0deg 360deg`];
  });
  return `conic-gradient(${stops.join(", ")})`;
}

/* --------------------------------------------------------------------------
   Arşiv kartının mozaiği
   -------------------------------------------------------------------------- */

export type MosaicCell = { dir: TileDir; /** 0–1, grubun en büyüğüne göre. */ weight: number };

/** Mozaik hücresinin en soluk tonu: en küçük değer de görünür kalsın. */
const MOSAIC_FLOOR = 0.22;

/**
 * Arşiv kartında grafiğin minyatürü: sıralı küçük kareler, ton yön, koyuluk
 * büyüklük. Ölçek grubun en büyüğü (sayfadaki kartlarla aynı sıra).
 * `pay` ve `oncesi` için yön yok; ton tek ve koyuluk büyüklük.
 */
export function mosaicCells(block: DailyChartBlock): MosaicCell[] {
  const values =
    block.kind === "shift"
      ? [block.from.value ?? 0, block.to.value ?? 0]
      : block.kind === "share"
        ? ringSlices(block.items).map((slice) => slice.part)
        : boardTiles(block).tiles.map((tile) => tile.value);
  const signed = block.kind === "bars" && !block.neutral && !block.unscaled;
  const peak = Math.max(...values.map(Math.abs), 0);
  return values.map((value) => ({
    dir: signed ? dirOf(value) : "flat",
    weight: peak > 0 ? MOSAIC_FLOOR + (1 - MOSAIC_FLOOR) * (Math.abs(value) / peak) : MOSAIC_FLOOR,
  }));
}
