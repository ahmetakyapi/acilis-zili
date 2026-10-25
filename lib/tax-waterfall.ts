/**
 * Vergi hesaplayıcısının iki çiziminin geometrisi (25 Ekim, görsel tur):
 * kazancın şelalesi ve matrahın dilim bandı. Saf modül — sunucu, istemci ve
 * test aynı hesabı okur (`tests/tax-waterfall.test.ts`). Hiçbir sayı burada
 * ÜRETİLMİYOR: girdiler `lib/tax.ts`in verdiği tutarlar, çıktı yalnızca
 * oranlar (0-1) ve hangi etiketin sığdığı.
 */

/* --------------------------------------------------------------------------
   Şelale
   -------------------------------------------------------------------------- */

export type WaterfallKey = "cost" | "index" | "proceeds" | "gain" | "base";
export type WaterfallTone = "cost" | "index" | "proceeds" | "up" | "down" | "base";

export type WaterfallColumn = {
  key: WaterfallKey;
  /** Sütunun tabanı ve boyu, ölçeğin oranı olarak (0-1). */
  from: number;
  span: number;
  tone: WaterfallTone;
};

/** Bir sütunun ucundan ötekinin kenarına uzanan kesik çizgi. */
export type WaterfallConnector = { from: number; to: number; level: number };

export type Waterfall = {
  columns: WaterfallColumn[];
  connectors: WaterfallConnector[];
};

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * Beş sütun, tek TL ölçeğinde:
 *   1. TL maliyet          0 → maliyet
 *   2. Endeksleme payı     maliyet → endeksli maliyet (yoksa sıfır boy)
 *   3. Satış bedeli        0 → satış
 *   4. Kazanç / zarar      endeksli maliyet ↔ satış (yön rengiyle)
 *   5. Vergi matrahı       0 → matrah (zararda sıfır)
 *
 * Bağlayıcılar yalnızca SEVİYESİ GERÇEKTEN AYNI olan iki ucu birleştirir:
 * maliyetin tepesi endekslemenin tabanı, endeksli maliyet kazancın bir ucu,
 * satış bedeli öteki ucu. Matraha çizgi gitmiyor: matrah kazançla aynı
 * büyüklük ama TABANI sıfır, araya çizgi çekmek "kaldığı yerden devam
 * ediyor" diye yanlış okunurdu.
 */
export function waterfallOf({
  costTl,
  indexedCostTl,
  proceedsTl,
  gainTl,
  baseTl,
}: {
  costTl: number;
  indexedCostTl: number;
  proceedsTl: number;
  gainTl: number;
  baseTl: number;
}): Waterfall {
  const scale = Math.max(costTl, indexedCostTl, proceedsTl, baseTl, 0) || 1;
  const r = (value: number) => clamp01(value / scale);
  const indexAdd = Math.max(0, indexedCostTl - costTl);
  const up = gainTl >= 0;
  const low = Math.min(indexedCostTl, proceedsTl);
  const columns: WaterfallColumn[] = [
    { key: "cost", from: 0, span: r(costTl), tone: "cost" },
    { key: "index", from: r(costTl), span: r(indexAdd), tone: "index" },
    { key: "proceeds", from: 0, span: r(proceedsTl), tone: "proceeds" },
    { key: "gain", from: r(low), span: r(Math.abs(proceedsTl - indexedCostTl)), tone: up ? "up" : "down" },
    { key: "base", from: 0, span: r(Math.max(0, baseTl)), tone: "base" },
  ];
  const connectors: WaterfallConnector[] = [
    { from: 0, to: 1, level: r(costTl) },
    { from: 1, to: 3, level: r(indexedCostTl) },
    { from: 2, to: 3, level: r(proceedsTl) },
  ];
  return { columns, connectors };
}

/* --------------------------------------------------------------------------
   Dilim bandı
   -------------------------------------------------------------------------- */

export type Bracket = { upTo: number | null; ratePct: number };

export type BandSlice = {
  index: number;
  ratePct: number;
  lower: number;
  /** Dilimin üst sınırı; açık uçlu son dilimde bandın sonu. */
  upper: number;
  /** Matrahın bu dilime düşen kısmı ve ondan ödenen vergi. */
  amount: number;
  tax: number;
  state: "past" | "current";
  /** Bandın genişliğine oranla dilimin genişliği ve dolu kısmı (0-1). */
  width: number;
  fill: number;
  /** Oran ve vergi etiketi bu genişliğe sığıyor mu. */
  labeled: boolean;
};

export type Band = {
  slices: BandSlice[];
  /** Etiketi sığmayan geçilmiş dilimlerin tek, birleşik etiketi (varsa). */
  merged: { width: number; fromRate: number; toRate: number; tax: number } | null;
  /** Bandın sonu (TL): içinde bulunulan dilimin üst sınırı. */
  end: number;
  /** Sonraki dilime kalan tutar; en üst dilimde null. */
  toNext: number | null;
  nextRate: number | null;
};

/** Etiketin sığdığı en dar dilim, bandın oranı olarak. */
export const BAND_LABEL_MIN = 0.14;
/** Açık uçlu son dilimde bandın matrahın ne kadar ötesine uzandığı. */
export const BAND_TOP_HEADROOM = 1.15;

/**
 * Matrah dilim dilim: geçilen dilimler tam dolu, içinde bulunulan dilim
 * matraha kadar dolu, geri kalanı hayalet (sonraki dilime kalan yol).
 * ÖLÇEK BÜYÜKLÜK ÖLÇEĞİ: dilimin genişliği TL aralığıyla orantılı; bu yüzden
 * bant içinde bulunulan dilimin sonunda biter, ulaşılmamış dilimler
 * çizilmez (tarifenin tamamı altındaki tabloda).
 */
export function bracketBand(brackets: readonly Bracket[], base: number): Band | null {
  if (!(base > 0) || brackets.length === 0) return null;
  let current = brackets.findIndex((bracket) => bracket.upTo === null || base <= bracket.upTo);
  if (current === -1) current = brackets.length - 1;
  const lowerOf = (i: number) => (i === 0 ? 0 : (brackets[i - 1].upTo ?? 0));
  const openTop = brackets[current].upTo === null;
  const end = openTop ? Math.max(base * BAND_TOP_HEADROOM, lowerOf(current) * BAND_TOP_HEADROOM) : (brackets[current].upTo as number);
  const slices: BandSlice[] = [];
  for (let i = 0; i <= current; i += 1) {
    const lower = lowerOf(i);
    const upper = i === current ? end : (brackets[i].upTo as number);
    const amount = Math.max(0, Math.min(base, upper) - lower);
    const width = (upper - lower) / end;
    slices.push({
      index: i,
      ratePct: brackets[i].ratePct,
      lower,
      upper,
      amount,
      tax: (amount * brackets[i].ratePct) / 100,
      state: i === current ? "current" : "past",
      width,
      fill: upper > lower ? clamp01(amount / (upper - lower)) : 0,
      labeled: width >= BAND_LABEL_MIN,
    });
  }
  const hidden = slices.filter((slice) => slice.state === "past" && !slice.labeled);
  const hiddenWidth = hidden.reduce((sum, slice) => sum + slice.width, 0);
  /* Dar dilimler ancak bir arada sığıyorsa ve hepsi BAŞTAN ardışıksa
     birleşir (dilimler küçükten büyüğe, yani dar olanlar hep baştadır). */
  const merged =
    hidden.length > 1 && hiddenWidth >= BAND_LABEL_MIN && hidden.every((slice, i) => slice.index === i)
      ? {
          width: hiddenWidth,
          fromRate: hidden[0].ratePct,
          toRate: hidden[hidden.length - 1].ratePct,
          tax: hidden.reduce((sum, slice) => sum + slice.tax, 0),
        }
      : null;
  const next = brackets[current + 1];
  return {
    slices,
    merged,
    end,
    toNext: openTop || !next ? null : (brackets[current].upTo as number) - base,
    nextRate: openTop || !next ? null : next.ratePct,
  };
}

/* --------------------------------------------------------------------------
   Beyan takviminin ay ölçeği
   -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;
const isoDay = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / DAY_MS;

/**
 * İşlem yılının başından ikinci taksidin bitimine gerçek gün ölçeği: bir
 * tarihin bu aralıktaki yeri (0-1). Aralığın dışı uca yapışır.
 */
export function timeShare(date: string, start: string, end: string): number {
  const span = isoDay(end) - isoDay(start);
  return span > 0 ? clamp01((isoDay(date) - isoDay(start)) / span) : 0;
}

/** Aralıktaki ayların başları ("YYYY-MM-01"), ilk ay dahil. */
export function monthStarts(start: string, end: string): string[] {
  const out: string[] = [];
  let year = +start.slice(0, 4);
  let month = +start.slice(5, 7);
  const last = end.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key > last) break;
    out.push(`${key}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
