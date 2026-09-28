/**
 * Ünlü yatırımcılar ekranlarının HESAPLARI — saf modül (28 Eylül).
 *
 * Veritabanı ya da Next içe aktarmıyor; `tests/investor-view.test.ts`
 * ölçüyor. Okuma katmanı (lib/investor-data.ts) satırları buraya veriyor,
 * sayfalar sonucu çiziyor.
 */

export type FilingRecord = {
  id: string;
  cik: number;
  accession: string;
  form: string;
  /** "restatement" | "new-holdings" | "unknown" | null */
  amendment: string | null;
  period: string;
  filedAt: string;
  valueScaled: boolean;
};

export type HoldingRecord = {
  cusip: string;
  /** "long" | "call" | "put" */
  position: string;
  issuer: string;
  titleOfClass: string | null;
  amount: number;
  /** "SH" | "PRN" */
  amountType: string;
  value: number;
};

/* --------------------------------------------------------------------------
   Dönem: hangi dosyalar birlikte okunur
   -------------------------------------------------------------------------- */

export type PeriodPlan = {
  period: string;
  cik: number;
  /** Portföyün tabanı: asıl bildirim ya da onu baştan yazan son düzeltme. */
  base: FilingRecord;
  /** Tabana EKLENEN pozisyonlar — gizliliği kalkıp sonradan bildirilenler. */
  additions: FilingRecord[];
  /** Ekranın künyesi: dönemin en son dosyalanma tarihi. */
  filedAt: string;
  valueScaled: boolean;
};

function newer(a: FilingRecord, b: FilingRecord): number {
  return a.filedAt.localeCompare(b.filedAt) || a.accession.localeCompare(b.accession);
}

/**
 * Dosyalardan dönemler, yeniden eskiye.
 *
 * KURAL (SEC'in düzeltme türlerine göre):
 *   - Taban: asıl bildirim (13F-HR) ya da RESTATEMENT düzeltmesi —
 *     hangisi en son verildiyse. Düzeltme dönemi baştan yazıyor.
 *   - Ekler: NEW HOLDINGS düzeltmeleri, tabandan SONRA verilenler. Bunlar
 *     gizli tutulup süresi dolunca açıklanan pozisyonlar; tabana eklenir.
 *     Tabandan önce verilmiş bir ek, sonraki bir RESTATEMENT'ın içinde
 *     zaten var.
 *   - Türü okunamayan düzeltme (`unknown`) YOK SAYILIYOR: neyi değiştirdiği
 *     bilinmeyen bir dosyayı eklemek de tabanı onunla değiştirmek de
 *     uydurma olurdu.
 *
 * BİRDEN ÇOK CIK. Bir dönem için birden çok CIK taban vermişse `ciks`
 * sırasında önce gelen kazanıyor (lib/investors.ts → Ackman). O dönemin
 * bütün dosyaları kazanan CIK'ten okunuyor.
 */
export function planPeriods(filings: readonly FilingRecord[], ciks: readonly number[]): PeriodPlan[] {
  const byPeriod = new Map<string, FilingRecord[]>();
  for (const filing of filings) {
    const list = byPeriod.get(filing.period) ?? [];
    list.push(filing);
    byPeriod.set(filing.period, list);
  }
  const plans: PeriodPlan[] = [];
  for (const [period, list] of byPeriod) {
    const isBase = (filing: FilingRecord) => filing.amendment === null || filing.amendment === "restatement";
    const cik = ciks.find((candidate) => list.some((filing) => filing.cik === candidate && isBase(filing)));
    if (cik === undefined) continue;
    const own = list.filter((filing) => filing.cik === cik);
    const base = own.filter(isBase).sort(newer).at(-1)!;
    const additions = own
      .filter((filing) => filing.amendment === "new-holdings" && newer(filing, base) > 0)
      .sort(newer);
    const last = [base, ...additions].sort(newer).at(-1)!;
    plans.push({
      period,
      cik,
      base,
      additions,
      filedAt: last.filedAt,
      valueScaled: base.valueScaled || additions.some((filing) => filing.valueScaled),
    });
  }
  return plans.sort((a, b) => b.period.localeCompare(a.period));
}

export function planFilingIds(plan: PeriodPlan): string[] {
  return [plan.base.id, ...plan.additions.map((filing) => filing.id)];
}

/** Dönemin pozisyonları: taban + ekler, CUSIP + türe göre toplanmış. */
export function mergeHoldings(lists: readonly (readonly HoldingRecord[])[]): HoldingRecord[] {
  const map = new Map<string, HoldingRecord>();
  for (const list of lists) {
    for (const holding of list) {
      const key = `${holding.cusip}|${holding.position}`;
      const current = map.get(key);
      if (current) {
        current.amount += holding.amount;
        current.value += holding.value;
      } else {
        map.set(key, { ...holding });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/* --------------------------------------------------------------------------
   İki dönemin farkı: ne aldı, ne sattı
   -------------------------------------------------------------------------- */

export type Move = "new" | "increased" | "decreased" | "soldOut" | "unchanged";

export type PositionView = HoldingRecord & {
  /** Hisse portföyündeki payı, 0-1. */
  weight: number;
  prevAmount: number | null;
  prevValue: number | null;
  /** Önceki dönem yoksa null — "bilinmiyor", "değişmedi" değil. */
  move: Move | null;
  /** Adet değişimi, yüzde. Yeni pozisyonda null. */
  changePct: number | null;
  /** Aradaki hisse bölünmesi (ör. 10) — adetler ona göre karşılaştırıldı. */
  split: number | null;
};

export type SoldView = {
  cusip: string;
  issuer: string;
  titleOfClass: string | null;
  prevAmount: number;
  prevValue: number;
  /** Önceki dönemdeki payı, 0-1. */
  prevWeight: number;
};

export type PeriodDiff = {
  positions: PositionView[];
  sold: SoldView[];
  /** Opsiyon satırları — değer DAYANAK hissenin değeri. */
  options: HoldingRecord[];
  /** Hisse (uzun) portföyünün toplamı, dolar. Opsiyonlar dahil değil. */
  longValue: number;
  optionValue: number;
  counts: { new: number; increased: number; decreased: number; soldOut: number };
  /** Önceki dönem var mı — yoksa hareket sütunu hiç basılmaz. */
  compared: boolean;
};

/** Değişim bundan küçükse "aynı" sayılır: 0,1'lik yuvarlama farkı haber değil. */
export const UNCHANGED_EPSILON = 0.0005;
/** Bölünme sayılan oranın tam sayıya uzaklığı. */
const SPLIT_TOLERANCE = 0.01;
/** Bölünmede hisse başı değer de o oranda düşmüş olmalı — pay. */
const SPLIT_PRICE_TOLERANCE = 0.35;

/**
 * HİSSE BÖLÜNMESİ ALIM DEĞİLDİR. NVDA 10'a bölündüğünde adet on katına
 * çıkıyor ve basit karşılaştırma "%900 artırdı" diyordu. Adet oranı bir
 * tam sayıya (2, 3, 4, 10…) çok yakınsa VE hisse başı değer aynı oranda
 * düşmüşse, aradaki fark bölünme sayılıyor ve önceki adet o oranla
 * düzeltilip karşılaştırılıyor. Ters bölünme de aynı kural (1/k). Saf.
 */
export function detectSplit(prev: HoldingRecord, cur: HoldingRecord): number | null {
  if (prev.amount <= 0 || cur.amount <= 0 || prev.value <= 0 || cur.value <= 0) return null;
  if (prev.amountType !== "SH" || cur.amountType !== "SH") return null;
  const ratio = cur.amount / prev.amount;
  const candidates: number[] = [];
  if (ratio >= 1.9) candidates.push(Math.round(ratio));
  if (ratio <= 0.55) candidates.push(1 / Math.round(1 / ratio));
  for (const k of candidates) {
    if (Math.abs(ratio - k) / k > SPLIT_TOLERANCE) continue;
    const priceRatio = cur.value / cur.amount / (prev.value / prev.amount);
    if (Math.abs(priceRatio * k - 1) < SPLIT_PRICE_TOLERANCE) return k;
  }
  return null;
}

export function diffPeriods(current: readonly HoldingRecord[], previous: readonly HoldingRecord[] | null): PeriodDiff {
  const longs = current.filter((holding) => holding.position === "long");
  const options = current.filter((holding) => holding.position !== "long").sort((a, b) => b.value - a.value);
  const longValue = longs.reduce((sum, holding) => sum + holding.value, 0);
  const optionValue = options.reduce((sum, holding) => sum + holding.value, 0);

  const prevLongs = (previous ?? []).filter((holding) => holding.position === "long");
  const prevMap = new Map(prevLongs.map((holding) => [holding.cusip, holding]));
  const prevTotal = prevLongs.reduce((sum, holding) => sum + holding.value, 0);
  const counts = { new: 0, increased: 0, decreased: 0, soldOut: 0 };

  const positions: PositionView[] = longs
    .map((holding) => {
      const prev = prevMap.get(holding.cusip) ?? null;
      let move: Move | null = null;
      let changePct: number | null = null;
      let split: number | null = null;
      if (previous) {
        if (!prev) {
          move = "new";
        } else {
          split = detectSplit(prev, holding);
          const base = prev.amount * (split ?? 1);
          const change = base > 0 ? holding.amount / base - 1 : 0;
          if (Math.abs(change) < UNCHANGED_EPSILON) move = "unchanged";
          else move = change > 0 ? "increased" : "decreased";
          changePct = change * 100;
        }
        if (move === "new" || move === "increased" || move === "decreased") counts[move] += 1;
      }
      return {
        ...holding,
        weight: longValue > 0 ? holding.value / longValue : 0,
        prevAmount: prev?.amount ?? null,
        prevValue: prev?.value ?? null,
        move,
        changePct,
        split,
      };
    })
    .sort((a, b) => b.value - a.value);

  const currentCusips = new Set(longs.map((holding) => holding.cusip));
  const sold: SoldView[] = previous
    ? prevLongs
        .filter((holding) => !currentCusips.has(holding.cusip))
        .map((holding) => ({
          cusip: holding.cusip,
          issuer: holding.issuer,
          titleOfClass: holding.titleOfClass,
          prevAmount: holding.amount,
          prevValue: holding.value,
          prevWeight: prevTotal > 0 ? holding.value / prevTotal : 0,
        }))
        .sort((a, b) => b.prevValue - a.prevValue)
    : [];
  counts.soldOut = sold.length;

  return { positions, sold, options, longValue, optionValue, counts, compared: previous !== null };
}

/* --------------------------------------------------------------------------
   Çeyreğin hareketleri — yatırımcılar arası
   -------------------------------------------------------------------------- */

export type CrowdEntry = {
  /** Sembol varsa sembol, yoksa CUSIP — gruplama anahtarı. */
  key: string;
  ticker: string | null;
  issuer: string;
  /** Kimler — slug listesi, hareket türüne göre. */
  added: string[];
  opened: string[];
  trimmed: string[];
  exited: string[];
};

/**
 * Aynı hisse üzerinde kaç yatırımcı aynı yöne gitti. Girdi yatırımcı başına
 * bir fark ve CUSIP → sembol eşlemesi; sembolü bilinmeyen CUSIP kendi
 * başına bir anahtar (iki ayrı CUSIP'i adıyla birleştirmek tahmin olurdu).
 * Saf; sınanıyor.
 */
export function crowdMoves(
  diffs: readonly { slug: string; diff: PeriodDiff }[],
  tickerOf: (cusip: string) => string | null,
): CrowdEntry[] {
  const map = new Map<string, CrowdEntry>();
  const entry = (cusip: string, issuer: string) => {
    const ticker = tickerOf(cusip);
    const key = ticker ?? cusip;
    let found = map.get(key);
    if (!found) {
      found = { key, ticker, issuer, added: [], opened: [], trimmed: [], exited: [] };
      map.set(key, found);
    }
    return found;
  };
  for (const { slug, diff } of diffs) {
    if (!diff.compared) continue;
    for (const position of diff.positions) {
      if (position.move === "new") entry(position.cusip, position.issuer).opened.push(slug);
      else if (position.move === "increased") entry(position.cusip, position.issuer).added.push(slug);
      else if (position.move === "decreased") entry(position.cusip, position.issuer).trimmed.push(slug);
    }
    for (const sold of diff.sold) entry(sold.cusip, sold.issuer).exited.push(slug);
  }
  return [...map.values()];
}

/** Alım tarafı: yeni açan + artıran sayısına göre, eşitlikte yeni açan önde. */
export function topBuys(entries: readonly CrowdEntry[], limit: number): CrowdEntry[] {
  return entries
    .filter((entry) => entry.opened.length + entry.added.length >= 2)
    .sort(
      (a, b) =>
        b.opened.length + b.added.length - (a.opened.length + a.added.length) ||
        b.opened.length - a.opened.length ||
        a.key.localeCompare(b.key),
    )
    .slice(0, limit);
}

/** Satış tarafı: tamamen satan + azaltan sayısına göre, eşitlikte tamamen satan önde. */
export function topSells(entries: readonly CrowdEntry[], limit: number): CrowdEntry[] {
  return entries
    .filter((entry) => entry.exited.length + entry.trimmed.length >= 2)
    .sort(
      (a, b) =>
        b.exited.length + b.trimmed.length - (a.exited.length + a.trimmed.length) ||
        b.exited.length - a.exited.length ||
        a.key.localeCompare(b.key),
    )
    .slice(0, limit);
}

/* --------------------------------------------------------------------------
   Kongre bildirimi: açıklama satırını okunur hâle getir
   -------------------------------------------------------------------------- */

export type TradeDetail =
  | { kind: "shares"; side: "buy" | "sell"; shares: number }
  | { kind: "options"; contracts: number; right: "call" | "put"; strike: number; expiry: string | null }
  | { kind: "exercise"; contracts: number; right: "call" | "put"; shares: number | null; strike: number | null }
  | { kind: "other"; text: string };

function num(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** "6/17/27" → "2027-06-17". */
function isoShort(raw: string): string | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/**
 * Bildirimin İngilizce açıklaması → yapı. Tanınan üç kalıp (hisse alımı ya
 * da satışı, opsiyon alımı, opsiyon kullanımı) ekranda dile göre
 * yazılıyor; tanınmayan satır OLDUĞU GİBİ duruyor — çevirisini tahmin
 * etmek yanlış bir cümle üretebilirdi. Saf; sınanıyor.
 */
export function parseTradeDetail(description: string | null): TradeDetail | null {
  if (!description) return null;
  const text = description.replace(/\s+/g, " ").trim();
  const options = text.match(
    /^Purchased ([\d,]+) (call|put) options? with a strike price of \$([\d,.]+) and an expiration date of (\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  );
  if (options) {
    return {
      kind: "options",
      contracts: num(options[1]),
      right: options[2].toLowerCase() as "call" | "put",
      strike: num(options[3]),
      expiry: isoShort(options[4]),
    };
  }
  const exercise = text.match(/^Exercised ([\d,]+) (call|put) options?/i);
  if (exercise) {
    const shares = text.match(/\(([\d,]+) shares\)/i);
    const strike = text.match(/strike price of \$([\d,.]+)/i);
    return {
      kind: "exercise",
      contracts: num(exercise[1]),
      right: exercise[2].toLowerCase() as "call" | "put",
      shares: shares ? num(shares[1]) : null,
      strike: strike ? num(strike[1]) : null,
    };
  }
  const shares = text.match(/^(Purchased|Sold) ([\d,]+) shares\.?$/i);
  if (shares) {
    return { kind: "shares", side: shares[1].toLowerCase() === "sold" ? "sell" : "buy", shares: num(shares[2]) };
  }
  return { kind: "other", text };
}
