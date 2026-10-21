import {
  amountMatches,
  findDate,
  normalizeSymbol,
  parseAmount,
  splitCsvLine,
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
  /* Hücreler GERÇEK ayraçtan bölünüyor (20 Ekim). Eskiden her virgül ve
     noktalı virgül boşluğa çevriliyordu: TR Excel dökümünde (noktalı
     virgül + ondalık virgül) "174,50" iki sayıya ayrılıp fiyat 174
     okunuyor, "0,5" adetli satır "Adet Okunamadı"ya düşüyordu; EN'de
     tırnaklı "1,000" da bölünüyordu. Hücre bütün kalınca ondalığı
     `guessDecimal` görüyor. */
  const lines = toLines(text);
  const sep = csvSeparator(lines);
  return parseGenericLines(lines.map((line) => splitCsvLine(line, sep).join(" ")));
}

/**
 * Dosyanın ayracı: BÜTÜN satırlarda en sık geçen. Yalnızca başlığa ya da
 * "bir satırda ; var mı"ya bakmak, başlıksız dosyada ya da bir hücresinde
 * noktalı virgül geçen EN dosyasında yanlış ayraç seçip satırları sessizce
 * düşürürdü. Eşitlikte noktalı virgül: TR satırında noktalı virgül (hücre
 * sayısı − 1) ondalık virgülden nadiren az, EN dosyasında ise hiç geçmiyor.
 */
function csvSeparator(lines: readonly string[]): "," | ";" | "\t" {
  const count = (ch: string) => lines.reduce((sum, line) => sum + line.split(ch).length - 1, 0);
  const comma = count(",");
  const semicolon = count(";");
  const tab = count("\t");
  if (semicolon > 0 && semicolon >= comma && semicolon >= tab) return ";";
  return tab > comma ? "\t" : ",";
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
 * görünebiliyor. Anahtar zaman damgası + sembol + yön + adet + fiyat.
 *
 * TEKRAR YALNIZCA DOSYALAR ARASINDA (20 Ekim). Tek dosyanın içinde aynı
 * anahtarlı iki satır iki ayrı işlemdir ve ikisi de kalır; sonraki dosya
 * bir anahtarı ancak önceki dosyalardan birinde gördüğü SAYI kadar düşürür
 * (çoklu küme). Eskiden tek bir küme dosyanın içinde de ayıklıyordu ve
 * damga her satırda saat taşımıyor (genel tanıyıcı, saati alt satıra
 * kırılan Midas ya da IBKR PDF satırı): aynı gün aynı fiyattan aynı
 * adetteki iki emirden biri sessizce düşüyor, FIFO maliyeti ve beyan
 * edilen kazanç kayıyordu. Dosyalar arasında ise aynı damgada aynı fiyattan
 * aynı adet iki ayrı emir gerçekte çok nadir ve ayrıştırıcı onu ayırt
 * edemez — bilinçli tercih.
 */
export function mergeResults(results: readonly ImportResult[]): ImportResult {
  const brokers = new Set(results.map((r) => r.broker));
  const tradeSeen = new Map<string, number>();
  const dividendSeen = new Map<string, number>();
  const merged: ImportResult = {
    broker: brokers.size === 1 ? [...brokers][0] : null,
    trades: [],
    dividends: [],
    skipped: [],
  };
  for (const result of results) {
    /* Satır satır `push` (20 Ekim): `push(...dosya)` bütün satırları
       argüman olarak geçiriyordu; JavaScriptCore'da 65.536, V8'de ~120 bin
       argümanda fırlatıyor ve 20 MB'lık yıllık IBKR dökümü oraya varabilir. */
    unseen(result.trades, tradeSeen, (t) => [t.stamp || t.date, t.symbol, t.side, t.quantity, t.priceUsd].join("|"), merged.trades);
    unseen(result.dividends, dividendSeen, (d) => [d.date, d.symbol, d.grossUsd].join("|"), merged.dividends);
    for (const row of result.skipped) merged.skipped.push(row);
  }
  /* Damga kurumun kendi biçiminde ("02/03/26 13:21"), sıralama ISO günle;
     aynı gün içinde damga sırası ekstrenin sırasını koruyor. */
  merged.trades.sort((a, b) => a.date.localeCompare(b.date));
  merged.dividends.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

/** Bir dosyanın, önceki dosyaların karşılamadığı satırlarını `out`a ekler;
 *  `seen` her anahtarın bir dosyada görülen en büyük sayısını tutar. */
function unseen<T>(rows: readonly T[], seen: Map<string, number>, keyOf: (row: T) => string, out: T[]): void {
  const local = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    const n = (local.get(key) ?? 0) + 1;
    local.set(key, n);
    if (n > (seen.get(key) ?? 0)) out.push(row);
  }
  for (const [key, n] of local) seen.set(key, Math.max(n, seen.get(key) ?? 0));
}
