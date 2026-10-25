import type { DailyChartBlock } from "@/lib/daily-chart";
import { barSpan, divergingScale, sectorFundOf, type DivergingScale } from "@/lib/daily-chart-figure";

/* ==========================================================================
   Günün Grafiği — kart panosunun saf mantığı (25 Ekim, kart turu)

   Sahibinin sözü: "İlk açılırken sadece yatay çubuk açılmasın, KARTLAR
   olsun, o kartlardan okuyalım verileri." Sayfa artık bir pano: üstte
   künye kartları (en güçlü, en zayıf, kaç kalem artıda), altında bloğun
   her satırı kendi küçük kartında. Bu dosya kartların NE taşıyacağını
   React'siz kuruyor; çizim `components/daily-chart/ChartBoard.tsx`, testi
   `tests/daily-chart-board.test.ts`.

   Ölçek DEĞİŞMEDİ: karttaki ince çubuk sayfanın eski grafiğiyle ve
   paylaşım görseliyle aynı `divergingScale`ten (lib/daily-chart-figure.ts).
   Kartlar ayrı ayrı dursa da −1,92'nin çubuğu her yerde aynı boyda.
   ========================================================================== */

type BarsBlock = Extract<DailyChartBlock, { kind: "bars" }>;

export type TileDir = "up" | "down" | "flat";

export type BoardTile = {
  name: string;
  display: string;
  value: number;
  /** Ad bir sektörse fonu (simge ve bağlantı); değilse null. */
  fund: string | null;
  dir: TileDir;
  /** Çubuk: alanın yüzdesi olarak başlangıç ve boy; çubuksuz blokta null. */
  bar: { start: number; size: number } | null;
  /** Sıralamanın uçları vurgulanır: en güçlü ve en zayıf. */
  rank: "top" | "bottom" | null;
};

export type BoardTiles = {
  tiles: BoardTile[];
  /** İşaretli blokta iki yönlü ölçek (ölçek kartı da bunu çizer). */
  scale: DivergingScale | null;
  /** İşaretli mi: renk yön taşır. Nötr blokta çubuk tek tonda. */
  signed: boolean;
};

const dirOf = (value: number): TileDir => (value > 0 ? "up" : value < 0 ? "down" : "flat");

/**
 * `bar` bloğunun kartları — YÜKSEKTEN DÜŞÜĞE sıralı (kararlı: eşitlikte
 * blokta önce gelen önde). Rutin bloğu çoğunlukla sıralı yazıyor ama
 * yazmak zorunda değil; kart ızgarası okuma sırası olduğu için sırayı
 * burada garanti ediyoruz.
 *
 * `unscaled` blok (değerler ortak ölçeğe oturmuyor, `parse-blocks.ts`)
 * sıralanmaz ve çubuk çizilmez: değerlerin hepsi 0, sıra rutinin sırası.
 */
export function boardTiles(block: BarsBlock): BoardTiles {
  const signed = !block.neutral && !block.unscaled;
  const ordered = block.unscaled
    ? block.items.map((item, index) => ({ item, index }))
    : block.items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => b.item.value - a.item.value || a.index - b.index);
  const scale = signed ? divergingScale(block.items.map((item) => item.value)) : null;
  const peak = Math.max(...block.items.map((item) => Math.abs(item.value)), 0);
  const last = ordered.length - 1;

  const tiles = ordered.map(({ item }, position): BoardTile => {
    let bar: BoardTile["bar"] = null;
    if (scale) bar = barSpan(item.value, scale);
    else if (!block.unscaled && peak > 0) bar = { start: 0, size: (Math.abs(item.value) / peak) * 100 };
    return {
      name: item.name,
      display: item.display,
      value: item.value,
      fund: sectorFundOf(item.name),
      dir: signed ? dirOf(item.value) : "flat",
      bar,
      rank: block.unscaled || ordered.length < 2 ? null : position === 0 ? "top" : position === last ? "bottom" : null,
    };
  });
  return { tiles, scale, signed };
}

/* --------------------------------------------------------------------------
   Künye kartları
   -------------------------------------------------------------------------- */

export type BoardKey =
  | {
      kind: "extreme";
      /** top/bottom: sıralamanın uçları; share: en büyük pay. */
      role: "top" | "bottom" | "share";
      name: string;
      display: string;
      fund: string | null;
      dir: TileDir;
    }
  | { kind: "count"; up: number; down: number; flat: number; total: number };

/**
 * Panonun tepesindeki künye kartları — YALNIZ bloktan (sayı uydurulmaz,
 * bloktaki yazılış olduğu gibi taşınır).
 *
 * - İşaretli `bar`: en güçlü, en zayıf, kaç kalem artıda/ekside.
 * - Nötr `bar`: en büyük ve en küçük (yönsüz, renk yok).
 * - `pay`: en büyük pay.
 * - `oncesi` ve ölçeksiz `bar`: künye yok; ana kart zaten iki sayı ya da
 *   sırasız bir liste, aynı sayıyı ikinci kez basmak ekranı uzatırdı.
 *
 * Piyasa kartı (Nasdaq 100 ve genişlik) bloktan değil günün bağlamından
 * geliyor; onu çizici ekliyor.
 */
export function boardKeys(block: DailyChartBlock): BoardKey[] {
  if (block.kind === "shift") return [];
  if (block.items.length === 0) return [];
  if (block.kind === "share") {
    const top = block.items.reduce((best, item) => (item.value > best.value ? item : best), block.items[0]);
    return [{ kind: "extreme", role: "share", name: top.name, display: top.display, fund: sectorFundOf(top.name), dir: "flat" }];
  }
  if (block.unscaled) return [];
  const { tiles, signed } = boardTiles(block);
  const top = tiles[0];
  const bottom = tiles[tiles.length - 1];
  const extreme = (tile: BoardTile, role: "top" | "bottom"): BoardKey => ({
    kind: "extreme",
    role,
    name: tile.name,
    display: tile.display,
    fund: tile.fund,
    dir: tile.dir,
  });
  const keys: BoardKey[] = [extreme(top, "top"), extreme(bottom, "bottom")];
  if (signed) {
    const up = block.items.filter((item) => item.value > 0).length;
    const down = block.items.filter((item) => item.value < 0).length;
    keys.push({ kind: "count", up, down, flat: block.items.length - up - down, total: block.items.length });
  }
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
