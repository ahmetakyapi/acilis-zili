import {
  sourceNumbers,
  type Bi,
  type Broker,
  type BrokerCell,
  type BrokerColumn,
} from "@/content/brokers";
import type { CostLine } from "@/lib/broker-line";

/**
 * Aracı kurum KARTLARI — saf mantık (25 Ekim görsel turu). Test
 * `tests/broker-cards.test.ts`; çizim `components/brokers/BrokerCards.tsx`.
 *
 * Sahibinin şikâyeti: 8×8 metin matrisi "görsel olarak eksik ve çok
 * okunamıyor". Kurum başına bir kart, kalem başına ikon + etiket satırı;
 * matris kaynak katmanı olarak katlanmış hâlde kalıyor (BrokerTable).
 *
 * ÜÇ DURUM, ÜÇ AYRI İŞARET. Var/yok sorusu olan kalemlerde (kesirli hisse,
 * W-8BEN, opsiyon) kaynak "var" diyorsa ✓, açıkça "yok" diyorsa ✗,
 * hiçbir şey demiyorsa "Belirtilmemiş" — kesik çizgili boş halka. Üçüncüsü
 * ✗ ile karışmamalı: bulunamayan bilgi bir "yok" değil, ve onu ✗ çizmek
 * kurumu olmayan bir eksikle damgalamak olurdu (content/brokers.ts kural 1).
 *
 * RENK YOK. ✓ yeşil, ✗ kırmızı değil: renk bu sitede yalnız yön ve
 * etkileşim; burada bir "iyi" demek bir öneri olurdu. Ayrım biçimde.
 */

/** Kartın satırları, tablo sütunlarının sırasıyla. Komisyon kartın tepesinde ayrı, lisans rozette. */
export const CARD_FEATURES = [
  "minimum",
  "custody",
  "fractional",
  "data",
  "w8ben",
  "options",
] as const satisfies readonly BrokerColumn[];

export type CardFeature = (typeof CARD_FEATURES)[number];

/** Var/yok sorusu olan kalemler; ötekiler bir tutar ya da koşul. */
const TOGGLE_FEATURES: ReadonlySet<BrokerColumn> = new Set(["fractional", "w8ben", "options"]);

export type FeatureMark = "yes" | "no" | "unspecified" | "value";

export function featureMark(column: BrokerColumn, cell: BrokerCell): FeatureMark {
  if (cell.kind === "unspecified") return "unspecified";
  if (cell.absent) return "no";
  return TOGGLE_FEATURES.has(column) ? "yes" : "value";
}

/* ------------------------------------------------------------ görünüm */

export type CardRef = { n: number; href: string; title: string };

export type CardRow = {
  column: BrokerColumn;
  mark: FeatureMark;
  /** Kaynaktaki değer; belirtilmemişse null. */
  value: string | null;
  note: string | null;
  refs: CardRef[];
};

export type BrokerCardView = {
  id: string;
  name: string;
  monogram: string;
  channel: string | null;
  counterparty: { name: string; refs: CardRef[] } | null;
  licence: Broker["licence"];
  /** Lisans hücresinin notu (IBKR: hangi şirketin hesabı açtığı belirtilmemiş). */
  licenceNote: string | null;
  licenceRefs: CardRef[];
  /** Tarife satırı: komisyonun kaynaktaki yazılışı. */
  tariff: CardRow;
  rows: CardRow[];
  /** Kurumun kaynakları içinde en eski okunma günü ("YYYY-MM-DD"). */
  checked: string;
  sourceCount: number;
  /**
   * Kartta bir DÜRÜSTLÜK NOTU var mı: işaretli bir hücre notu (`caveat`)
   * ya da tarifeden tek anlamlı komisyon çıkmıyor. Telefonda notlar katlı;
   * bu doğruysa katlama düğmesinin yanında "Not Var" basılıyor.
   */
  caveat: boolean;
};

export function hasCaveat(broker: Broker): boolean {
  return (
    broker.commission.kind === "none" ||
    Object.values(broker.cells).some((cell) => cell.caveat === true)
  );
}

/** Ad işaretinde sayılmayan genel sözcük: "İş Yatırım" ile "İnfo Yatırım" aynı "İY" olmasın. */
const GENERIC_WORDS = new Set(["yatırım"]);

/**
 * Logo yerine BAŞ HARF ROZETİ — sitenin harf karosu kalıbı (`LogoTile`).
 * Kurum logoları depoda yok ve logolarının kullanım izni kayıtlı değil
 * (CLAUDE.md, fotoğraf kuralının gerekçesi): harf karosu tek dürüst yol.
 * İki sözcük → iki baş harf ("GB", "IB"); tek sözcük → ilk iki harf, ikincisi
 * küçük ("Mi", "İş"). Türkçe büyük harf `tr-TR` ile (`İ`, `I` değil).
 */
export function brokerMonogram(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((word) => word && !GENERIC_WORDS.has(word.toLocaleLowerCase("tr-TR")));
  const list = words.length > 0 ? words : [name];
  if (list.length >= 2) {
    return (list[0].charAt(0) + list[1].charAt(0)).toLocaleUpperCase("tr-TR");
  }
  const word = list[0];
  return word.charAt(0).toLocaleUpperCase("tr-TR") + word.charAt(1).toLocaleLowerCase("tr-TR");
}

export function brokerCardView(
  broker: Broker,
  locale: "tr" | "en",
  /** "Kaynak {n}: {title}" — erişilebilir ad. */
  refLabel: string,
): BrokerCardView {
  const pick = (bi: Bi) => (locale === "en" ? bi.en : bi.tr);
  const order = Object.keys(broker.sources);
  const refs = (ids: readonly string[] | undefined): CardRef[] =>
    ids && ids.length > 0
      ? [...sourceNumbers(broker, ids)].sort((a, b) => a - b).map((n) => {
          const title = pick(broker.sources[order[n - 1]].title);
          return {
            n,
            href: `#kaynak-${broker.id}-${n}`,
            title: refLabel.replace("{n}", String(n)).replace("{title}", title),
          };
        })
      : [];
  const row = (column: BrokerColumn): CardRow => {
    const cell = broker.cells[column];
    return {
      column,
      mark: featureMark(column, cell),
      value: cell.kind === "value" ? pick(cell.value) : null,
      note: cell.note ? pick(cell.note) : null,
      refs: refs(cell.src),
    };
  };
  const licence = broker.cells.license;
  const checked = Object.values(broker.sources)
    .map((source) => source.checked)
    .sort()[0];
  return {
    id: broker.id,
    name: broker.name,
    monogram: brokerMonogram(broker.name),
    channel: broker.channel ? pick(broker.channel) : null,
    counterparty: broker.counterparty
      ? { name: pick(broker.counterparty.value), refs: refs(broker.counterparty.src) }
      : null,
    licence: broker.licence,
    licenceNote: licence.note ? pick(licence.note) : null,
    licenceRefs: refs(licence.src),
    tariff: row("commission"),
    rows: CARD_FEATURES.map(row),
    checked,
    sourceCount: order.length,
    caveat: hasCaveat(broker),
  };
}

/* ------------------------------------------------------------ sıralama */

export const CARD_SORTS = ["ad", "komisyon"] as const;
export type CardSort = (typeof CARD_SORTS)[number];
/**
 * VARSAYILAN AD SIRASI. Sayfa hiçbir kurumu önermiyor (BrokerNotes →
 * tarafsızlık); varsayılan bir maliyet sırası, en üstteki kurumu sayfanın
 * seçimi gibi gösterirdi. Komisyon sırası okuyucunun seçimi ve künyesi
 * hangi tutarın komisyonu olduğunu yazıyor.
 */
export const DEFAULT_CARD_SORT: CardSort = "ad";

export function isCardSort(value: unknown): value is CardSort {
  return typeof value === "string" && (CARD_SORTS as readonly string[]).includes(value);
}

/**
 * Kart sırası, id listesi. "komisyon": seçili tutardaki komisyon artan,
 * eşitlikte ad; hesaplanamayan kurumlar sonda (kendi aralarında ad).
 */
export function sortCardIds(
  cards: readonly { id: string; name: string }[],
  sort: CardSort,
  line: CostLine,
  /** Ad sırası dilin alfabesiyle: Türkçede I, İ'den önce gelir. */
  locale: "tr" | "en" = "tr",
): string[] {
  const collator = locale === "en" ? "en-US" : "tr-TR";
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, collator, { sensitivity: "base" });
  const fees = new Map(line.priced.map((entry) => [entry.id, entry.fee]));
  return [...cards]
    .sort((a, b) => {
      if (sort === "komisyon") {
        const fa = fees.get(a.id) ?? null;
        const fb = fees.get(b.id) ?? null;
        if (fa === null && fb !== null) return 1;
        if (fb === null && fa !== null) return -1;
        if (fa !== null && fb !== null && Math.abs(fa - fb) >= 0.005) return fa - fb;
      }
      return byName(a, b);
    })
    .map((card) => card.id);
}

/* ------------------------------------------------------------ karşılaştırma */

/** Yan yana en çok üç kurum: 390'da iki sütun sığıyor, üçüncü kaydırmayla. */
export const COMPARE_MAX = 3;
export const COMPARE_PARAM = "karsilastir";
export const SORT_PARAM = "sira";

/** Adresteki seçim: bilinmeyen ve yinelenen id düşer, en çok `COMPARE_MAX`, seçim sırası korunur. */
export function parseCompare(raw: string | null | undefined, ids: readonly string[]): string[] {
  if (!raw) return [];
  const known = new Set(ids);
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (known.has(id) && !out.includes(id)) out.push(id);
    if (out.length === COMPARE_MAX) break;
  }
  return out;
}

/** Seçiliyse çıkarır, değilse (yer varsa) sona ekler. Dolu listede yeni id değiştirmez. */
export function toggleCompare(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((item) => item !== id);
  if (list.length >= COMPARE_MAX) return [...list];
  return [...list, id];
}

/**
 * Komisyonun tutara oranı kaç ondalıkla yazılır: büyük alımda sabit ücret
 * yüzde binde birlerin altına iniyor (50.000 $'da 1,50 $ = %0,003) ve iki
 * ondalık onu "%0,00" diye sıfır gösteriyordu.
 */
export function pctDigits(pct: number): number {
  return pct > 0 && pct < 0.1 ? 3 : 2;
}

/* ------------------------------------------------------------ tepe cümlesi */

export type BrokersLeadFacts = {
  amount: number;
  min: number | null;
  max: number | null;
  total: number;
  /** Kesirli hisseyi kaynağında "var" diye yazan kurum sayısı. */
  fractional: number;
  unpriced: number;
};

export function brokersLeadFacts(brokers: readonly Broker[], line: CostLine): BrokersLeadFacts {
  return {
    amount: line.amount,
    min: line.min,
    max: line.max,
    total: brokers.length,
    fractional: brokers.filter((broker) => featureMark("fractional", broker.cells.fractional) === "yes").length,
    unpriced: line.unpriced.length,
  };
}

export type BrokersLeadTemplates = {
  /** {amount} {min} {max} {total} {fractional} */
  range: string;
  /** {amount} {min} {total} {fractional} — bütün komisyonlar eşit. */
  same: string;
  /** {n} — tek kurum. */
  unpricedOne: string;
  /** {n} */
  unpriced: string;
};

/**
 * Ekranın tepesindeki TEK CÜMLE, veriden. Şablon + sayı; sayıya ek
 * getiren kalıp yok ("5'i" gibi): ek sayının okunuşuna bağlı, şablon onu
 * bilemez — "8 kurumun 3 tanesi" kalıbı (CLAUDE.md yazım).
 */
export function brokersLead(
  facts: BrokersLeadFacts,
  templates: BrokersLeadTemplates,
  money: (value: number, digits?: number) => string,
): string | null {
  if (facts.min === null || facts.max === null) return null;
  const same = Math.abs(facts.max - facts.min) < 0.005;
  const head = (same ? templates.same : templates.range)
    .replace("{amount}", money(facts.amount, 0))
    .replace("{min}", money(facts.min))
    .replace("{max}", money(facts.max))
    .replace("{total}", String(facts.total))
    .replace("{fractional}", String(facts.fractional));
  if (facts.unpriced === 0) return head;
  const tail = (facts.unpriced === 1 ? templates.unpricedOne : templates.unpriced).replace(
    "{n}",
    String(facts.unpriced),
  );
  return `${head} ${tail}`;
}
