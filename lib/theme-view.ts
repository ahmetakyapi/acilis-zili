/**
 * Tema ekranlarının ÇİZİM hesapları — saf modül, `"use client"` değil.
 *
 * Neden ayrı: ısı haritasının yerleşimi, dağılım şeridinin ölçeği ve renk
 * kademesi sunucuda hesaplanıyor ve hem dizin hem detay sayfası okuyor.
 * İstemciye tek satır JS inmiyor; `tests/theme-view.test.ts` ölçüyor.
 */

/**
 * Isı kademesi — `/piyasalar` ısı haritasıyla AYNI eşikler (0 · 0,5 · 1,5 ·
 * 3 puan). Aynı yüzde iki ekranda iki ayrı tonla boyanırsa okuyucu iki ayrı
 * ölçek öğrenmek zorunda kalırdı.
 */
const HEAT_STEPS = [0.5, 1.5, 3] as const;

export type HeatTone = "up" | "down" | "flat";

export function heatOf(change: number): { tone: HeatTone; level: 0 | 1 | 2 | 3 | 4 } {
  const magnitude = Math.abs(change);
  const tone: HeatTone = change > 0 ? "up" : change < 0 ? "down" : "flat";
  if (magnitude === 0) return { tone, level: 0 };
  const index = HEAT_STEPS.findIndex((step) => magnitude < step);
  return { tone, level: (index === -1 ? 4 : index + 1) as 1 | 2 | 3 | 4 };
}

/**
 * Dağılım şeridinin ORTAK ölçeği (± yüzde puan).
 *
 * Dizindeki on kart aynı ölçeği paylaşıyor: her kart kendi en büyük
 * hareketine göre ölçeklenseydi %1'lik bir günün şeridi %8'lik bir günün
 * şeridiyle aynı genişlikte yayılır ve kartlar arası karşılaştırma yalan
 * söylerdi. Tavan okunur bir sayıya yuvarlanıyor (künyede yazıyor); en az
 * 2 puan, sakin bir günde ±0,3'lük hareketler şeridin iki ucuna yapışmasın.
 *
 * TAVAN EN BÜYÜK HAREKET DEĞİL, YÜZDE 90'LIK DİLİM (28 Eylül, ölçüldü).
 * İlk hâl en büyük mutlak hareketi kullanıyordu; yüzü aşkın çentikten
 * tek bir hissenin 8 puanı aşan günü ölçeği ±10'a açtı ve ötekilerin
 * neredeyse hepsi şeridin ortadaki beşte birine sıkıştı: yayılım
 * okunmuyordu. Artık uçtaki
 * yüzde onluk dilim ölçeği belirlemiyor; o üyeler şeridin ucuna yapışıyor
 * (`spreadPosition`) ve uçta durdukları zaten "en çok oynayanlar" demek.
 */
const SCALE_STEPS = [2, 3, 5, 8, 10, 15, 20, 30, 50] as const;
const SCALE_QUANTILE = 0.9;

export function spreadScale(values: readonly number[]): number {
  const sorted = values.map((value) => Math.abs(value)).sort((a, b) => a - b);
  const peak = sorted.length === 0 ? 0 : sorted[Math.max(0, Math.ceil(sorted.length * SCALE_QUANTILE) - 1)];
  return SCALE_STEPS.find((step) => peak <= step) ?? SCALE_STEPS[SCALE_STEPS.length - 1];
}

/** Değerin şeritteki yeri, 0-100 (50 sıfır). Tavanı aşan uca yapışır. */
export function spreadPosition(value: number, scale: number): number {
  const clamped = Math.max(-scale, Math.min(scale, value));
  return 50 + (clamped / scale) * 50;
}

/* --------------------------------------------------------------------------
   Kare haritası (squarified treemap — Bruls, Huizing, van Wijk 2000)

   Karolar piyasa değeriyle orantılı ALANDA. Algoritma satırları, içindeki
   karoların en/boy oranı en kötü hâlinde bile kareye en yakın kalacak
   şekilde dolduruyor; yüzde olarak döndüğü için kabın gerçek piksel boyunu
   bilmesi gerekmiyor, yalnızca ORANINI (`aspect` = genişlik / yükseklik).
   -------------------------------------------------------------------------- */

export type TreemapRect = {
  index: number;
  /** Kabın yüzdesi olarak. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export function squarify(weights: readonly number[], aspect: number): TreemapRect[] {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0 || weights.length === 0) return [];

  /* Hesap, alanı `aspect × 1` olan bir dikdörtgende yapılıyor; en sonda
     yüzdeye çevriliyor. */
  const items = weights
    .map((weight, index) => ({ index, area: (Math.max(0, weight) / total) * aspect }))
    .filter((item) => item.area > 0)
    .sort((a, b) => b.area - a.area);

  const rects: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let width = aspect;
  let height = 1;

  const worst = (row: readonly { area: number }[], side: number) => {
    const sum = row.reduce((acc, item) => acc + item.area, 0);
    const max = Math.max(...row.map((item) => item.area));
    const min = Math.min(...row.map((item) => item.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layout = (row: readonly { index: number; area: number }[]) => {
    const sum = row.reduce((acc, item) => acc + item.area, 0);
    if (width >= height) {
      /* Satır solda dikey bir sütun olarak diziliyor. */
      const columnWidth = sum / height;
      let offset = y;
      for (const item of row) {
        const itemHeight = item.area / columnWidth;
        rects.push({ index: item.index, x, y: offset, w: columnWidth, h: itemHeight });
        offset += itemHeight;
      }
      x += columnWidth;
      width -= columnWidth;
    } else {
      const rowHeight = sum / width;
      let offset = x;
      for (const item of row) {
        const itemWidth = item.area / rowHeight;
        rects.push({ index: item.index, x: offset, y, w: itemWidth, h: rowHeight });
        offset += itemWidth;
      }
      y += rowHeight;
      height -= rowHeight;
    }
  };

  let row: { index: number; area: number }[] = [];
  for (const item of items) {
    const side = Math.min(width, height);
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item);
    } else {
      layout(row);
      row = [item];
    }
  }
  if (row.length > 0) layout(row);

  return rects.map((rect) => ({
    index: rect.index,
    x: (rect.x / aspect) * 100,
    y: rect.y * 100,
    w: (rect.w / aspect) * 100,
    h: rect.h * 100,
  }));
}
