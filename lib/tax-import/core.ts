/**
 * EKSTREDEN AKTARIM — ortak tipler ve küçük ayrıştırıcılar. SAF katman.
 *
 * Aracı kurum ekstresi (Midas PDF, IBKR CSV ya da PDF) TAMAMEN tarayıcıda
 * okunur; bu klasördeki hiçbir şey ağa ya da depoya dokunmuyor. PDF'ten
 * metin çıkarma ayrı ve istemciye özgü (`lib/tax-import/pdf-text.ts`, index.ts onu dışa AKTARMIYOR: Worker kurduğu için yalnızca istemci dinamik `import()` ile çekiyor);
 * buradaki fonksiyonlar yalnızca METİN alıyor, yani PDF kurmadan sınanıyor
 * (tests/tax-import.test.ts).
 *
 * TEK KURAL: UYDURMA YOK. Bir satır ancak SEMBOL, YÖN, ADET ve FİYAT dördü
 * birden okunabildiyse işlem olarak önerilir. Tarih ya da komisyon
 * okunamazsa alan BOŞ gelir ve satır işaretlenir; okuyucu doldurur. Dördünden
 * biri eksik olan ama işlem gibi görünen satır "atlanan" listesine düşer ve
 * önizlemede açılıp okunabilir.
 */

/** `acilis-zili`: vergi hesaplayıcısının kendi indirdiği döküm (own.ts). */
export type Broker = "midas" | "ibkr" | "acilis-zili";

/** Önizlemede satırın yanında duran uyarı. `block` olan satır seçili gelmez. */
export type RowFlag =
  | "noDate"
  | "noWithholding"
  | "unverified"
  | "noCommission"
  | "currency"
  | "amountMismatch"
  | "symbolOdd"
  | "dateRange";

/** Seçili gelmeyen, okuyucunun bakıp açması gereken uyarılar. */
export const BLOCKING_FLAGS: readonly RowFlag[] = [
  "noDate",
  "currency",
  "amountMismatch",
  "symbolOdd",
  "dateRange",
  "unverified",
];

export type ImportedTrade = {
  side: "buy" | "sell";
  symbol: string;
  /** "YYYY-MM-DD" ya da okunamadıysa "". */
  date: string;
  quantity: number;
  priceUsd: number;
  /** İşlemin toplam komisyonu (pozitif); okunamadıysa null. */
  commissionUsd: number | null;
  /** Ekstredeki para birimi; okunamadıysa null (Midas ABD hesabı hep USD). */
  currency: string | null;
  flags: RowFlag[];
  /** Kaynak satır — önizlemede "bu satırdan okundu" diye gösterilir. */
  source: string;
  /**
   * Ekstredeki zaman damgası olduğu gibi (tarih + saat). Yalnızca tekrar
   * ayıklamak için: Midas ekstresi aylık ve ay sonundaki işlem iki PDF'te
   * birden görünebiliyor.
   */
  stamp: string;
};

export type ImportedDividend = {
  symbol: string;
  date: string;
  grossUsd: number;
  /** Kesilen vergi (pozitif); ekstrede yoksa null. */
  withheldUsd: number | null;
  currency: string | null;
  flags: RowFlag[];
  source: string;
};

export type SkipReason = "noSymbol" | "noSide" | "noQuantity" | "noPrice" | "notStock" | "unreadable";

export type SkippedLine = { source: string; reason: SkipReason };

export type ImportResult = {
  broker: Broker | null;
  trades: ImportedTrade[];
  dividends: ImportedDividend[];
  skipped: SkippedLine[];
};

export const EMPTY_RESULT: ImportResult = { broker: null, trades: [], dividends: [], skipped: [] };

/* --------------------------------------------------------------------------
   Sayılar — ekstre ve form alanı aynı kuralı kullanıyor (lib/decimal-input.ts)
   -------------------------------------------------------------------------- */

export { parseAmount } from "../decimal-input";

/* --------------------------------------------------------------------------
   Tarihler
   -------------------------------------------------------------------------- */

const MONTHS: Record<string, number> = {
  oca: 1, ocak: 1, jan: 1, january: 1,
  şub: 2, sub: 2, şubat: 2, subat: 2, feb: 2, february: 2,
  mar: 3, mart: 3, march: 3,
  nis: 4, nisan: 4, apr: 4, april: 4,
  may: 5, mayıs: 5, mayis: 5,
  haz: 6, haziran: 6, jun: 6, june: 6,
  tem: 7, temmuz: 7, jul: 7, july: 7,
  ağu: 8, agu: 8, ağustos: 8, agustos: 8, aug: 8, august: 8,
  eyl: 9, eylül: 9, eylul: 9, sep: 9, sept: 9, september: 9,
  eki: 10, ekim: 10, oct: 10, october: 10,
  kas: 11, kasım: 11, kasim: 11, nov: 11, november: 11,
  ara: 12, aralık: 12, aralik: 12, dec: 12, december: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** İki basamaklı yıl 2000'li yıllar: ekstre 2000 öncesini kapsamıyor. */
const CENTURY = 2000;

/**
 * Metnin içindeki İLK tarihi bulur ve "YYYY-MM-DD" döndürür.
 * Tanınan biçimler: 2024-03-15 · 15.03.2024 · 15/03/2024 · 15-03-2024 ·
 * 15 Mart 2024 · 15 Mar 2024 · Mar 15, 2024 · 20240315 (IBKR Flex).
 * Eğik çizgili tarihte gün önce okunur (Türkiye ve Midas); ikinci sayı
 * 12'den büyükse ABD sırası olduğu kesindir ve öyle okunur.
 */
export function findDate(text: string): { date: string; index: number; length: number } | null {
  const patterns: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => iso(+m[1], +m[2], +m[3])],
    [/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/, (m) => {
      let y = +m[3];
      if (m[3].length === 2) y += CENTURY;
      const a = +m[1];
      const b = +m[2];
      return b > 12 && a <= 12 ? iso(y, a, b) : iso(y, b, a);
    }],
    [/\b(\d{1,2})[\s-]([A-Za-zÇĞİÖŞÜçğıöşü]{3,9})\.?[\s-](\d{4})\b/, (m) => {
      const month = MONTHS[m[2].toLocaleLowerCase("tr-TR")] ?? MONTHS[m[2].toLowerCase()];
      return month ? iso(+m[3], month, +m[1]) : null;
    }],
    [/\b([A-Za-z]{3,9})\.?\s(\d{1,2}),?\s(\d{4})\b/, (m) => {
      const month = MONTHS[m[1].toLowerCase()];
      return month ? iso(+m[3], month, +m[2]) : null;
    }],
    [/\b(20\d{2})(\d{2})(\d{2})\b/, (m) => iso(+m[1], +m[2], +m[3])],
  ];
  let best: { date: string; index: number; length: number } | null = null;
  for (const [re, build] of patterns) {
    const m = re.exec(text);
    if (!m) continue;
    const date = build(m);
    if (date && (best === null || m.index < best.index)) best = { date, index: m.index, length: m[0].length };
  }
  return best;
}

export function yearOf(date: string): number {
  return date ? Number(date.slice(0, 4)) : Number.NaN;
}

/* --------------------------------------------------------------------------
   Sembol
   -------------------------------------------------------------------------- */

/**
 * Ekstre sembolü → hesaplayıcının sembolü (`isValidSymbol`: harf, nokta,
 * tire). IBKR sınıflı hisseyi boşlukla yazıyor ("BRK B"), Midas eğik
 * çizgiyle yazabiliyor ("BRK/B"); ikisi de noktaya çevriliyor. Rakam içeren
 * ya da on karakteri aşan sembol null — tahmin edilmiyor.
 */
export function normalizeSymbol(raw: string): string | null {
  const text = raw.trim().toUpperCase().replace(/[\s/]+/g, ".");
  return /^[A-Z][A-Z.-]{0,9}$/.test(text) ? text : null;
}

/* --------------------------------------------------------------------------
   CSV
   -------------------------------------------------------------------------- */

/** RFC 4180 satırı: tırnaklı hücre ayracı ve çift tırnağı taşıyabilir. */
export function splitCsvLine(line: string, sep = ","): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/** Satırlara böl: BOM, CRLF ve boş satırlar temizlenir. */
export function toLines(text: string): string[] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line.trim() !== "");
}

/* --------------------------------------------------------------------------
   Denetim
   -------------------------------------------------------------------------- */

/** Adet × fiyat ile ekstrenin kendi tutarı arasında kabul edilen sapma. */
const AMOUNT_TOLERANCE = 0.01;
/** Kuruş yuvarlamasına pay: küçük işlemlerde yüzde tek başına yetmiyor. */
const AMOUNT_SLACK_USD = 0.05;

/**
 * Ekstre bir TUTAR da veriyorsa adet × fiyat onunla karşılaştırılır; yüzde
 * birden fazla fark sütunların kaydığını (ör. adet yerine fiyat okunduğunu)
 * gösterir ve satır seçili gelmez. Komisyon tutara dahil de olabilir, hariç
 * de; ikisinden biri tutuyorsa satır temiz.
 */
export function amountMatches(quantity: number, price: number, amount: number, commission: number | null): boolean {
  const gross = quantity * price;
  const target = Math.abs(amount);
  const candidates = [gross, gross + (commission ?? 0), gross - (commission ?? 0)];
  return candidates.some((value) => Math.abs(value - target) <= Math.max(target * AMOUNT_TOLERANCE, AMOUNT_SLACK_USD));
}
