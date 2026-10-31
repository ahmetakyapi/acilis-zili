import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { SECTOR_FUNDS } from "@/db/seed/symbols";
import type { DailyChartBlock } from "@/lib/daily-chart";

/* ==========================================================================
   Günün Grafiği — çizimin saf mantığı (25 Ekim, görsel tur)

   React'siz: sayfadaki kart panosu (`components/daily-chart/ChartTiles.tsx`),
   küçük hâl (`ChartThumb`), paylaşım görseli (`lib/daily-chart-og.tsx`) ve
   testi (`tests/daily-chart-figure.test.ts`) aynı hesabı buradan alıyor.
   Üçü aynı ölçeği kurmazsa sayfadaki −1,92 ile görseldeki −1,92 farklı
   boyda çizilirdi (CLAUDE.md "Veri dürüstlüğü" 3'ün çizim karşılığı).
   ========================================================================== */

/* --------------------------------------------------------------------------
   Sıfırdan iki yöne ölçek
   -------------------------------------------------------------------------- */

export type DivergingScale = {
  /** Alanın sol ucu (≤ 0) ve sağ ucu (≥ 0), değerin kendi biriminde. */
  lo: number;
  hi: number;
  /** Sıfır çizgisinin yeri, alanın yüzdesi (0–100). */
  zero: number;
};

/** Hepsi sıfırsa alan çökmesin diye en küçük açıklık. */
const MIN_SPAN = 0.01;

/**
 * Sıfırdan iki yöne TEK ölçek (25 Ekim).
 *
 * Eski çizimde her çubuk soldan başlıyordu: −1,92 ile +1,92 aynı yönde aynı
 * boyda duruyor, işaret yalnız renkten okunuyordu. Şimdi alan
 * [min(0, en küçük), max(0, en büyük)] ve sıfır çizgisi bu alanın içinde
 * gerçek yerinde: on bir sektörün yedisi artıdaysa sıfır sola kayar, artı
 * taraf daha çok yer alır. Ölçek tek, iki yarıya ayrı ölçek YOK; ayrı
 * ölçekte +0,4'lük bir çubuk −1,9'luk çubukla aynı boyda görünürdü.
 *
 * Tek işaretli blokta (hepsi artı ya da hepsi eksi) sıfır kenarda kalır ve
 * çizim eski tek yönlü grafiğe döner.
 */
export function divergingScale(values: readonly number[]): DivergingScale {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = Math.max(hi - lo, MIN_SPAN);
  /* `lo` 0 iken `-lo` eksi sıfır olur; künye ve testler düz sıfır görsün. */
  return { lo, hi, zero: lo === 0 ? 0 : (-lo / span) * 100 };
}

/** Bir değerin çubuğu: sıfırdan başlangıcı ve boyu, alanın yüzdesi. */
export function barSpan(value: number, scale: DivergingScale): { start: number; size: number } {
  const span = Math.max(scale.hi - scale.lo, MIN_SPAN);
  const size = (Math.abs(value) / span) * 100;
  return { start: value < 0 ? scale.zero - size : scale.zero, size };
}

/* --------------------------------------------------------------------------
   Satırın kimliği: sektör fonu
   -------------------------------------------------------------------------- */

/**
 * Satır adı bir sektörün adıysa fonu ("Enerji" / "Energy" → XLE).
 *
 * Rutin satıra sembol değil AD yazıyor (`docs/claude-rutinler.md`); bağlam
 * paketindeki sektör adları `SECTOR_FUNDS`tan geldiği için eşleme aynı
 * listeden. Büyük-küçük harf Türkçe kuralıyla (`İ`/`ı`), boşluklar
 * kırpılarak. Eşleşmeyen ad null: satır simgesiz ve bağlantısız çizilir,
 * tahminle bir fona bağlanmaz.
 */
export function sectorFundOf(name: string): string | null {
  const key = name.trim().toLocaleLowerCase("tr-TR");
  if (!key) return null;
  for (const fund of SECTOR_FUNDS) {
    if (fund.nameTr.toLocaleLowerCase("tr-TR") === key || fund.nameEn.toLocaleLowerCase("tr-TR") === key) {
      return fund.symbol;
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
   Satırın kimliği: endeks üyesi hisse
   -------------------------------------------------------------------------- */

/** Şirket adının sonundaki tüzel ekler: "Coherent Corp." → "coherent". */
const LEGAL_SUFFIX = /\s+(?:corp(?:oration)?|inc(?:orporated)?|ltd|limited|plc|group|holdings?|co|company|n\.?v|s\.?a|se|ag)\.?$/u;

const normalName = (name: string) => {
  let key = name.trim().toLocaleLowerCase("en-US").replace(/[,]/g, "").replace(/\s+/g, " ");
  /* "Nebius Group N.V." gibi üst üste ekler: değişmeyene kadar kırp. */
  for (let previous = ""; previous !== key; ) {
    previous = key;
    key = key.replace(LEGAL_SUFFIX, "").replace(/\.$/, "").trim();
  }
  return key;
};

/** Ad → sembol dizinleri; tek anlamlı olmayan anahtar null (eşlenmez). */
type NameIndex = { exact: Map<string, string | null>; loose: Map<string, string | null>; symbols: Set<string> };
let nameIndex: NameIndex | null = null;

function memberIndex(): NameIndex {
  if (nameIndex) return nameIndex;
  const exact = new Map<string, string | null>();
  const loose = new Map<string, string | null>();
  const put = (map: Map<string, string | null>, key: string, symbol: string) => {
    if (!key) return;
    const current = map.get(key);
    map.set(key, current === undefined || current === symbol ? symbol : null);
  };
  const members = primaryOnly(ALL_MEMBERS);
  for (const member of members) {
    put(exact, member.name.trim().toLocaleLowerCase("en-US"), member.symbol);
    put(loose, normalName(member.name), member.symbol);
  }
  nameIndex = { exact, loose, symbols: new Set(members.map((member) => member.symbol)) };
  return nameIndex;
}

/**
 * Satır adı bir endeks üyesinin adıysa sembolü ("Intel" → INTC, "Coherent"
 * → COHR) — logo ve hisse bağlantısı için (31 Ekim).
 *
 * Rutin satıra AD yazıyor ve adı bağlam paketinden kopyalıyor; paketin
 * `movers` adları `ALL_MEMBERS`tan (`lib/daily-chart-context.ts`). Eşleme
 * aynı listeden ve yalnız TEK ANLAMLIYSA: önce adın kendisi (büyük-küçük
 * harf duyarsız), sonra tüzel ekler kırpılmış hâli ("Coherent Corp." ile
 * "Coherent", "Oracle Corporation" ile "Oracle"). İki üyeye birden uyan ad
 * eşlenmez; sektör adı (`sectorFundOf`) ve endeks adları ("Nasdaq 100")
 * hiçbir üyenin adı değil. Satırda doğrudan sembol yazıyorsa ("NVDA") o.
 * Tahmin yok: eşleşmeyen satır logosuz ve bağlantısız kalır.
 */
export function memberSymbolOf(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || sectorFundOf(trimmed)) return null;
  const index = memberIndex();
  if (index.symbols.has(trimmed)) return trimmed;
  const exact = index.exact.get(trimmed.toLocaleLowerCase("en-US"));
  if (exact !== undefined) return exact;
  return index.loose.get(normalName(trimmed)) ?? null;
}

/* --------------------------------------------------------------------------
   Grafiğin tek cümlesi
   -------------------------------------------------------------------------- */

type Named = { name: string; display: string };

/**
 * Grafiğin söylediği, sayılarla (25 Ekim). Başlığı rutin yazıyor; bu cümle
 * ise YALNIZ bloğun kendisinden kuruluyor: kaç satır artıda, en uçta kim.
 * Sayı uydurulmuyor, bloktaki yazılış (`display`) olduğu gibi taşınıyor.
 */
export type ChartSummary =
  | { kind: "signed"; total: number; up: number; down: number; top: Named; bottom: Named }
  | { kind: "ranked"; total: number; top: Named; bottom: Named }
  | { kind: "share"; total: number; top: Named }
  | { kind: "shift"; from: Named; to: Named };

export function chartSummary(block: DailyChartBlock): ChartSummary | null {
  if (block.kind === "shift") {
    return {
      kind: "shift",
      from: { name: block.from.label, display: block.from.display },
      to: { name: block.to.label, display: block.to.display },
    };
  }
  if (block.items.length === 0) return null;
  /* En büyük ve en küçük DEĞERE göre, satır sırasına değil: rutin bloğu
     çoğunlukla sıralı yazıyor ama sıralamak zorunda değil. Eşitlikte ilk
     geçen (kararlı). */
  let top = block.items[0];
  let bottom = block.items[0];
  for (const item of block.items) {
    if (item.value > top.value) top = item;
    if (item.value < bottom.value) bottom = item;
  }
  const pick = (item: { name: string; display: string }) => ({ name: item.name, display: item.display });
  if (block.kind === "share") return { kind: "share", total: block.items.length, top: pick(top) };
  if (block.neutral || block.unscaled) {
    return { kind: "ranked", total: block.items.length, top: pick(top), bottom: pick(bottom) };
  }
  return {
    kind: "signed",
    total: block.items.length,
    up: block.items.filter((item) => item.value > 0).length,
    down: block.items.filter((item) => item.value < 0).length,
    top: pick(top),
    bottom: pick(bottom),
  };
}

export type SummaryLabels = {
  /** "{total} satırın {up} tanesi artıda, {down} tanesi ekside." */
  signed: string;
  /** Hepsi aynı yönde: "{total} satırın hepsi artıda." */
  allUp: string;
  allDown: string;
  /** "En güçlü {top} ({topValue}), en zayıf {bottom} ({bottomValue})." */
  extremes: string;
  /** "En büyük {top} ({topValue}), en küçük {bottom} ({bottomValue})." */
  ranked: string;
  /** "En büyük pay {top}: {topValue}." */
  share: string;
  /** "{from} {fromValue}, {to} {toValue}." */
  shift: string;
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/** Özetin cümlesi — şablon sözlükte, sayılar bloktan. */
export function summaryText(summary: ChartSummary, labels: SummaryLabels): string {
  if (summary.kind === "shift") {
    return fill(labels.shift, {
      from: summary.from.name,
      fromValue: summary.from.display,
      to: summary.to.name,
      toValue: summary.to.display,
    });
  }
  if (summary.kind === "share") {
    return fill(labels.share, { top: summary.top.name, topValue: summary.top.display });
  }
  const extremes = { top: summary.top.name, topValue: summary.top.display, bottom: summary.bottom.name, bottomValue: summary.bottom.display };
  if (summary.kind === "ranked") return fill(labels.ranked, extremes);
  const count =
    summary.down === 0 && summary.up === summary.total
      ? fill(labels.allUp, { total: summary.total })
      : summary.up === 0 && summary.down === summary.total
        ? fill(labels.allDown, { total: summary.total })
        : fill(labels.signed, { total: summary.total, up: summary.up, down: summary.down });
  /* Tek yönlü blokta "en güçlü/en zayıf" yine doğru: sıralamanın uçları. */
  return `${count} ${fill(labels.extremes, extremes)}`;
}
