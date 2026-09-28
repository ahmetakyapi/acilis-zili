import {
  amountMatches,
  findDate,
  normalizeSymbol,
  parseAmount,
  type ImportedDividend,
  type ImportedTrade,
  type ImportResult,
  type RowFlag,
  type SkippedLine,
} from "./core";

/**
 * MIDAS — aylık "Hesap Ekstresi" PDF'i (Midas Menkul Değerler).
 *
 * Midas biçimi YAYIMLAMIYOR ve örnek bir ekstre görseli de bulunamadı
 * (28 Eylül). Aşağıdaki düzen, gerçek Midas PDF'lerini okuyan altı açık
 * kaynak projenin kodundan çıkarıldı; altısı birbiriyle tutarlı:
 *   github.com/umuterturk/vergi-hesapla        (pdf.js, tarayıcıda)
 *   github.com/Safa675/bist-quant              (midas_pdf_parser.py)
 *   github.com/BurakPozut/midas-vergi          (extract_tables.py)
 *   github.com/Baskeladd/Lidya-web             (main.js)
 *   github.com/OzanBtw/midas-tax-calc          (pdf.py)
 *   github.com/erdalyaslica/trade-dashboard    (tradeAnalysis.js)
 * Ekstreye giden yol Midas'ın destek sayfasında: Profil → Belgeler →
 * Ekstreler, ay seçilir (getmidas.com/destek/…/ekstrelerimi-nereden-ve-nasil-gorebilirim).
 * ABD ve TL hesapları AYRI PDF; ABD işlemlerinin karşı aracı kurumu Alpaca
 * ama ekstreyi Midas basıyor.
 *
 * BÖLÜMLER (kesinlik: yüksek): "PORTFÖY ÖZETİ", "YATIRIM İŞLEMLERİ",
 * "HESAP İŞLEMLERİ", "TEMETTÜ İŞLEMLERİ", "HİSSE TRANSFERLERİ".
 *
 * YATIRIM İŞLEMLERİ, 12 sütun (kesinlik: yüksek):
 *   Tarih ("02/03/26 13:21:14") · İşlem Türü ("Limit Emri", "Piyasa Emri")
 *   · Sembol · İşlem Tipi ("Alış" | "Satış") · İşlem Durumu ("Gerçekleşti",
 *   "İptal Edildi", "Kalan İptal Edildi") · Para Birimi ("USD") · Emir Adedi
 *   · Emir Tutarı · Gerçekleşen Adet · Ortalama İşlem Fiyatı · İşlem Ücreti
 *   · İşlem Tutarı
 * Sayılar Türkçe: ondalık virgül (kesin), binlik nokta (orta). Boş hücre
 * "-". Kesirli adet var ("0,123456").
 *
 * TEMETTÜ İŞLEMLERİ (kesinlik: yüksek sütunlar, orta para birimi yazımı):
 *   Ödeme Tarihi ("15/05/26") · Sermaye Piyasası Aracı ("AAPL - Apple Inc.")
 *   · Brüt Temettü Tutarı · Stopaj · Net Temettü Tutarı
 *
 * OKUMA YÖNTEMİ. PDF'te bir tablo satırı birden fazla metin satırına
 * kırılabiliyor ("Kalan İptal / Edildi", uzun şirket adları) ve sayfa
 * başlığı ile altlığı tablonun ortasına düşebiliyor. Bu yüzden bölüm metni
 * TEK AKIŞ olarak birleştiriliyor ve satırlar tarih+saat damgasından
 * bölünüyor (vergi-hesapla'nın yöntemi). Satırın içinde hücreler konumla
 * değil İÇERİKLE bulunuyor: yön kelimesi, onun hemen önündeki sembol, para
 * birimi ve onu izleyen İLK ALTI sayısal hücre. Sayıları sağdan saymak
 * kırılan metinde yanlış hücreyi okurdu.
 *
 * DURUM SÜTUNUNA GÜVENİLMİYOR, GERÇEKLEŞEN ADEDE GÜVENİLİYOR. "Kalan İptal
 * Edildi" kısmen dolmuş bir emir ve hesaba girer; "İptal Edildi" girmez. İkisi
 * kırıldığında metinden ayırt etmek kırılgan; gerçekleşen adet ise ikisinde
 * de doğru sayıyı taşıyor (iptalde "-" ya da 0).
 */

const SECTION_TRADES = /YATIRIM\s+İŞLEMLERİ/i;
const SECTION_DIVIDENDS = /TEMETTÜ\s+İŞLEMLERİ/i;
const SECTION_ANY = /(PORTFÖY\s+ÖZETİ|YATIRIM\s+İŞLEMLERİ|HESAP\s+İŞLEMLERİ|TEMETTÜ\s+İŞLEMLERİ|HİSSE\s+TRANSFERLERİ)/gi;

/**
 * Satır başı: "02/03/26 13:21:14". Saat İSTEĞE BAĞLI: tarih sütunu dar ve
 * saat alt satıra kırılırsa pdf.js onu satırın öbür hücrelerinden SONRA
 * verebiliyor; o zaman tarih yine satırı başlatıyor, saat sayı olmayan bir
 * sözcük olarak aradan geçiyor. Bu bölümde başka tarih yok (dönem künyesi
 * `PERIOD_HEAD` ile kesiliyor).
 */
const ROW_STAMP = /\d{2}\/\d{2}\/(?:\d{4}|\d{2})(?!\d)(?:\s+\d{2}:\d{2}(?::\d{2})?)?/g;
/** Temettü satırı saatsiz başlıyor. */
const DIVIDEND_STAMP = /\d{2}\/\d{2}\/(?:\d{4}|\d{2})(?!\d)(?!\s+\d{2}:\d{2})/g;
/** Bölüm başlığının dönem künyesi: "(USD) 01/03/26 31/03/26". Satır değil. */
const PERIOD_HEAD = /^\s*(\([^)]*\))?[\s\t]*\d{2}\/\d{2}\/\d{2,4}\s*-?\s*\d{2}\/\d{2}\/\d{2,4}/;

const SIDE_WORDS: Record<string, "buy" | "sell"> = {
  alış: "buy",
  alis: "buy",
  alım: "buy",
  alim: "buy",
  buy: "buy",
  satış: "sell",
  satis: "sell",
  satım: "sell",
  satim: "sell",
  sell: "sell",
};

const CURRENCIES = /^(USD|TRY|TL|EUR)$/;
/** Sayısal hücre: sayı ya da boş hücre işareti. */
const NUMERIC_CELL = /^(-|[-+]?\(?[\d.,]*\d\)?)$/;
/** Emir tablosunun Para Birimi'nden sonraki sayısal hücre sayısı. */
const TRADE_NUMBERS = 6;
/** Temettü satırının sayısal hücreleri: brüt, stopaj, net. */
const DIVIDEND_NUMBERS = 3;

export function looksLikeMidas(lines: readonly string[]): boolean {
  const text = lines.join("\n");
  return /midas/i.test(text) || (/HESAP\s+EKSTRES[İI]/i.test(text) && SECTION_TRADES.test(text));
}

/** Bölümün metni: başlığından bir sonraki bölüm başlığına kadar, tek akış. */
function sections(lines: readonly string[]): { trades: string; dividends: string } {
  const text = lines.join("\t");
  const marks = [...text.matchAll(SECTION_ANY)].map((m) => ({ name: m[1], index: m.index ?? 0 }));
  let trades = "";
  let dividends = "";
  marks.forEach((mark, i) => {
    const end = marks[i + 1]?.index ?? text.length;
    const body = text.slice(mark.index + mark.name.length, end).replace(PERIOD_HEAD, "");
    if (SECTION_TRADES.test(mark.name)) trades += `\t${body}`;
    else if (SECTION_DIVIDENDS.test(mark.name)) dividends += `\t${body}`;
  });
  return { trades, dividends };
}

/** Damgadan damgaya bölünmüş satırlar. */
function rowsFrom(text: string, stamp: RegExp): string[] {
  const starts = [...text.matchAll(stamp)].map((m) => m.index ?? 0);
  return starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length).replace(/\s+/g, " ").trim());
}

export function parseMidasText(lines: readonly string[]): ImportResult {
  const { trades: tradeText, dividends: dividendText } = sections(lines);
  const trades: ImportedTrade[] = [];
  const skipped: SkippedLine[] = [];

  for (const row of rowsFrom(tradeText, ROW_STAMP)) {
    const result = midasTradeRow(row);
    if (result === null) continue;
    if ("reason" in result) skipped.push(result);
    else trades.push(result);
  }

  const dividends: ImportedDividend[] = [];
  for (const row of rowsFrom(dividendText, DIVIDEND_STAMP)) {
    const result = midasDividendRow(row);
    if (result === null) continue;
    if ("reason" in result) skipped.push(result);
    else dividends.push(result);
  }

  return { broker: "midas", trades, dividends, skipped };
}

/**
 * Tek emir satırı. Dönüş: işlem, atlanan satır ya da null (iptal edilmiş,
 * hiç dolmamış emir — atlanan listesine bile girmez, çünkü işlem değil).
 */
export function midasTradeRow(row: string): ImportedTrade | SkippedLine | null {
  const date = findDate(row);
  const tokens = row.split(" ").filter(Boolean);
  const sideIndex = tokens.findIndex((t) => SIDE_WORDS[t.toLocaleLowerCase("tr-TR")] !== undefined);
  if (sideIndex < 0) return { source: row, reason: "noSide" };
  const side = SIDE_WORDS[tokens[sideIndex].toLocaleLowerCase("tr-TR")];

  /* Sembol yönün hemen önünde. Emir türü ("Limit Emri") araya girerse
     bir önceki büyük harfli sözcüğe bakılıyor. */
  let symbolRaw = "";
  for (let i = sideIndex - 1; i >= 0 && i >= sideIndex - 2; i -= 1) {
    if (/^[A-Z][A-Z0-9./-]{0,11}$/.test(tokens[i])) {
      symbolRaw = tokens[i];
      break;
    }
  }

  const currencyIndex = tokens.findIndex((t, i) => i > sideIndex && CURRENCIES.test(t));
  const numberStart = currencyIndex >= 0 ? currencyIndex + 1 : sideIndex + 1;
  const numbers: string[] = [];
  for (let i = numberStart; i < tokens.length && numbers.length < TRADE_NUMBERS; i += 1) {
    if (NUMERIC_CELL.test(tokens[i])) numbers.push(tokens[i]);
  }
  const [, , filledRaw, priceRaw, feeRaw, totalRaw] = numbers;
  const filled = parseAmount(filledRaw, ",");
  const price = parseAmount(priceRaw, ",");

  /* Hiç dolmamış emir: işlem değil. Durum metni ne derse desin. */
  if (numbers.length === TRADE_NUMBERS && (filled === null || filled === 0) && /İptal|Cancel|Doldu|Expired/i.test(row)) {
    return null;
  }
  if (!symbolRaw) return { source: row, reason: "noSymbol" };
  if (filled === null || filled <= 0) return { source: row, reason: "noQuantity" };
  if (price === null || price <= 0) return { source: row, reason: "noPrice" };

  const flags: RowFlag[] = [];
  if (!date) flags.push("noDate");
  const feeValue = parseAmount(feeRaw, ",");
  const commission = feeValue === null ? null : Math.abs(feeValue);
  if (commission === null && feeRaw !== "-") flags.push("noCommission");
  const currency = currencyIndex >= 0 ? tokens[currencyIndex] : null;
  if (currency && currency !== "USD") flags.push("currency");
  const total = parseAmount(totalRaw, ",");
  if (total !== null && !amountMatches(filled, price, total, commission)) flags.push("amountMismatch");
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) flags.push("symbolOdd");

  return {
    side,
    symbol: symbol ?? symbolRaw,
    date: date?.date ?? "",
    quantity: filled,
    priceUsd: price,
    /* "-" boş hücre: ücretsiz işlem. Sıfır okunuyor, uyarı yok. */
    commissionUsd: feeRaw === "-" ? 0 : commission,
    currency,
    flags,
    source: row,
    stamp: row.match(/^\S+\s+\d{2}:\d{2}(?::\d{2})?/)?.[0] ?? date?.date ?? "",
  };
}

/** Tek temettü satırı: "15/05/26 AAPL - Apple Inc. 12,50 1,88 10,62". */
export function midasDividendRow(row: string): ImportedDividend | SkippedLine | null {
  const date = findDate(row);
  if (!date) return null;
  const rest = row.slice(date.index + date.length).trim();
  const symbolMatch = /^([A-Z][A-Z0-9./]{0,11})\s+-\s/.exec(rest) ?? /^([A-Z][A-Z0-9./]{0,11})\b/.exec(rest);
  const tokens = rest.slice(symbolMatch?.[0].length ?? 0).split(" ").filter(Boolean);
  const numbers = tokens.filter((t) => NUMERIC_CELL.test(t) && t !== "-");
  /* Üç tutarı olmayan tarihli metin (sayfa künyesi, dönem başlığı) bir
     temettü satırı değil; atlanan listesine de girmiyor. */
  if (numbers.length < DIVIDEND_NUMBERS) return null;
  if (!symbolMatch) return { source: row, reason: "noSymbol" };
  const [grossRaw, taxRaw, netRaw] = numbers.slice(-DIVIDEND_NUMBERS);
  const gross = parseAmount(grossRaw, ",");
  const tax = parseAmount(taxRaw, ",");
  const net = parseAmount(netRaw, ",");
  if (gross === null || gross <= 0) return { source: row, reason: "unreadable" };

  const flags: RowFlag[] = [];
  const withheld = tax === null ? null : Math.abs(tax);
  if (withheld === null) flags.push("noWithholding");
  if (withheld !== null && net !== null && !amountMatches(1, gross - withheld, net, null)) flags.push("amountMismatch");
  const symbol = normalizeSymbol(symbolMatch[1]);
  if (!symbol) flags.push("symbolOdd");
  const currency = /\bTRY\b|\bTL\b/.test(rest) ? "TRY" : /\bUSD\b/.test(rest) ? "USD" : null;
  if (currency && currency !== "USD") flags.push("currency");

  return {
    symbol: symbol ?? symbolMatch[1],
    date: date.date,
    grossUsd: gross,
    withheldUsd: withheld,
    currency,
    flags,
    source: row,
  };
}
