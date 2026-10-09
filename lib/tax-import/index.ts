import {
  amountMatches,
  findDate,
  normalizeSymbol,
  parseAmount,
  toLines,
  type ImportedTrade,
  type ImportResult,
  type RowFlag,
  type SkippedLine,
} from "./core";
import { looksLikeIbkrCsv, looksLikeIbkrText, parseIbkrCsv, parseIbkrText } from "./ibkr";
import { looksLikeMidas, parseMidasText } from "./midas";
import { looksLikeOwnCsv, parseOwnCsv } from "./own";

export * from "./core";
export { parseIbkrCsv, parseIbkrText } from "./ibkr";
export { parseMidasText } from "./midas";
export { parseOwnCsv } from "./own";

/**
 * Ekstre metni → önerilen satırlar. Kurum biçimden tanınıyor; tanınmazsa
 * genel tanıyıcı (aşağıda) devreye giriyor ve sonucu `broker: null` —
 * önizleme bunu okuyucuya söylüyor ve hiçbir satırı seçili getirmiyor.
 */
export function importCsv(text: string): ImportResult {
  /* Önce kendi dökümümüz: geri yüklenen yedek tahminle değil biçimiyle okunsun. */
  if (looksLikeOwnCsv(text)) return parseOwnCsv(text);
  if (looksLikeIbkrCsv(text)) return parseIbkrCsv(text);
  return parseGenericLines(toLines(text).map((line) => line.replace(/[,;]/g, " ")));
}

export function importPdfLines(lines: readonly string[]): ImportResult {
  if (looksLikeMidas(lines)) return parseMidasText(lines);
  if (looksLikeIbkrText(lines)) return parseIbkrText(lines);
  return parseGenericLines(lines);
}

/* --------------------------------------------------------------------------
   Genel tanıyıcı — kurumu bilinmeyen belge
   -------------------------------------------------------------------------- */

const SIDE = /^(alış|alis|alım|alim|buy|bought|bot|satış|satis|satım|satim|sell|sold|sld)$/i;
const SELL = /^(satış|satis|satım|satim|sell|sold|sld)$/i;
/** Sembol sanılmaması gereken büyük harfli sözcükler. */
const NOT_SYMBOL = /^(USD|TRY|TL|EUR|ABD|US|NYSE|NASDAQ|ARCA|BATS|LIMIT|MARKET|LMT|MKT|DAY|GTC|ETF|INC|CORP|LTD|PLC|CO)$/;

/**
 * SEZGİSEL: tarih + yön sözcüğü + sembol + en az iki sayı taşıyan satır.
 * Sayıların İLKİ adet, İKİNCİSİ fiyat sayılıyor; üçüncü bir sayı varsa tutar
 * olarak adet × fiyatı doğrulamak için kullanılıyor. Doğrulanamayan her
 * satır `unverified` ile işaretli ve seçili gelmiyor: sütun sırası bilinmeyen
 * bir belgede "ilk sayı adettir" yalnızca bir tahmin.
 */
export function parseGenericLines(lines: readonly string[]): ImportResult {
  const trades: ImportedTrade[] = [];
  const skipped: SkippedLine[] = [];
  const decimal = guessDecimal(lines);
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const date = findDate(line);
    if (!date) continue;
    const rest = `${line.slice(0, date.index)} ${line.slice(date.index + date.length)}`
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ")
      .split(" ")
      .filter(Boolean);
    const sideToken = rest.find((t) => SIDE.test(t));
    if (!sideToken) continue;
    const symbolToken = rest.find((t) => /^[A-Z][A-Z.]{0,5}$/.test(t) && !NOT_SYMBOL.test(t) && !SIDE.test(t));
    const numbers = rest
      .filter((t) => /\d/.test(t) && /^[-+($]*[\d.,]+\)?$/.test(t))
      .map((t) => parseAmount(t, decimal))
      .filter((n): n is number => n !== null);
    if (!symbolToken) {
      skipped.push({ source: raw, reason: "noSymbol" });
      continue;
    }
    const [quantity, price, amount] = numbers.map(Math.abs);
    if (quantity === undefined || quantity === 0) {
      skipped.push({ source: raw, reason: "noQuantity" });
      continue;
    }
    if (price === undefined || price === 0) {
      skipped.push({ source: raw, reason: "noPrice" });
      continue;
    }
    const flags: RowFlag[] = ["noCommission"];
    if (amount === undefined || !amountMatches(quantity, price, amount, null)) flags.push("unverified");
    const symbol = normalizeSymbol(symbolToken);
    trades.push({
      side: SELL.test(sideToken) ? "sell" : "buy",
      symbol: symbol ?? symbolToken,
      date: date.date,
      quantity,
      priceUsd: price,
      commissionUsd: null,
      currency: null,
      flags,
      source: raw,
      stamp: date.date,
    });
  }
  return { broker: null, trades, dividends: [], skipped };
}

/** Belgede "1.234,56" kalıbı "1,234.56"tan çoksa ondalık virgüldür. */
function guessDecimal(lines: readonly string[]): "," | "." {
  let comma = 0;
  let dot = 0;
  for (const line of lines) {
    comma += (line.match(/\d,\d{1,2}\b(?![.,]\d)/g) ?? []).length;
    dot += (line.match(/\d\.\d{1,2}\b(?![.,]\d)/g) ?? []).length;
  }
  return comma > dot ? "," : ".";
}

/* --------------------------------------------------------------------------
   Birden fazla dosya
   -------------------------------------------------------------------------- */

/**
 * Dosyaların sonucunu birleştirir ve TEKRARI ayıklar. Midas ekstresi aylık:
 * yılın tamamı on iki PDF ve ay sonundaki işlem iki PDF'te birden
 * görünebiliyor. Anahtar zaman damgası + sembol + yön + adet + fiyat; aynı
 * saniyede aynı fiyattan aynı adet iki ayrı emir gerçekte çok nadir ve
 * ayrıştırıcı onu ayırt edemez — bu bilinçli bir tercih.
 */
export function mergeResults(results: readonly ImportResult[]): ImportResult {
  const brokers = new Set(results.map((r) => r.broker));
  const tradeKeys = new Set<string>();
  const dividendKeys = new Set<string>();
  const merged: ImportResult = {
    broker: brokers.size === 1 ? [...brokers][0] : null,
    trades: [],
    dividends: [],
    skipped: [],
  };
  for (const result of results) {
    for (const trade of result.trades) {
      const key = [trade.stamp || trade.date, trade.symbol, trade.side, trade.quantity, trade.priceUsd].join("|");
      if (tradeKeys.has(key)) continue;
      tradeKeys.add(key);
      merged.trades.push(trade);
    }
    for (const dividend of result.dividends) {
      const key = [dividend.date, dividend.symbol, dividend.grossUsd].join("|");
      if (dividendKeys.has(key)) continue;
      dividendKeys.add(key);
      merged.dividends.push(dividend);
    }
    merged.skipped.push(...result.skipped);
  }
  /* Damga kurumun kendi biçiminde ("02/03/26 13:21"), sıralama ISO günle;
     aynı gün içinde damga sırası ekstrenin sırasını koruyor. */
  merged.trades.sort((a, b) => a.date.localeCompare(b.date));
  merged.dividends.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}
