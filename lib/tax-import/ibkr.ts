import {
  amountMatches,
  findDate,
  normalizeSymbol,
  parseAmount,
  splitCsvLine,
  toLines,
  type ImportedDividend,
  type ImportedTrade,
  type ImportResult,
  type RowFlag,
  type SkippedLine,
} from "./core";

/**
 * INTERACTIVE BROKERS — Activity Statement (CSV ve PDF metni).
 *
 * CSV BİÇİMİ (kesinlik: yüksek). Dosya bölümlerden oluşuyor ve her satırın
 * ilk iki hücresi bölüm adı ile satır türü: `Trades,Header,…` sütun adlarını
 * verir, `Trades,Data,…` veridir, `SubTotal`/`Total` ara toplamdır. Aynı
 * bölümde başlık birden fazla kez gelebilir (hisse ve döviz işlemlerinin
 * sütunları farklı), yani sütunlar her `Header` satırında yeniden okunuyor.
 * Hisse işlemi satırının alanları:
 *   DataDiscriminator (Order | ClosedLot | …) · Asset Category ("Stocks") ·
 *   Currency · Symbol · Date/Time ("2024-03-15, 10:30:12") · Quantity
 *   (alış +, satış −; binlikli ise tırnaklı "1,000") · T. Price · Proceeds ·
 *   Comm/Fee (eksi) · Basis · Realized P/L · Code
 * Temettü: `Dividends,Data,USD,2024-05-16,"AAPL(US0378331005) Cash Dividend
 * USD 0.25 per Share (Ordinary Dividend)",2.5`; kesinti ayrı bölümde,
 * `Withholding Tax`, aynı açıklama kalıbı ve eksi tutar.
 * Kaynaklar: IBKR Reporting Guide, "Activity Statement → Trades" ve
 * "Dividends / Withholding Tax" bölümleri (ibkrguides.com/reportingreference),
 * ayrıca bu CSV'yi okuyan açık kaynak araçların başlık satırları (raporda).
 *
 * `ClosedLot` satırları bir satışın HANGİ alışları kapattığını IBKR'nin
 * kendi yöntemiyle anlatıyor; hesaplayıcı eşleşmeyi ilk giren ilk çıkar ile
 * kendisi yaptığı için yalnızca `Order` (ya da ayrım sütunu olmayan eski
 * biçimde her veri satırı) alınıyor. Aksi hâlde aynı satış iki kez sayılırdı.
 */

/** Hisse dışı varlık sınıfları (opsiyon, vadeli, döviz) aktarılmıyor. */
const STOCK_CATEGORY = /^stocks?$/i;

export function looksLikeIbkrCsv(text: string): boolean {
  return /^﻿?(Statement|Trades|Account Information),Header,/m.test(text);
}

export function parseIbkrCsv(text: string): ImportResult {
  const trades: ImportedTrade[] = [];
  const skipped: SkippedLine[] = [];
  const headers = new Map<string, string[]>();
  const dividendRows: { symbol: string; date: string; amount: number; currency: string; source: string }[] = [];
  const taxRows: { symbol: string; date: string; amount: number }[] = [];

  for (const line of toLines(text)) {
    const cells = splitCsvLine(line);
    const [section, kind] = cells;
    if (kind === "Header") {
      headers.set(section, cells.slice(2));
      continue;
    }
    if (kind !== "Data") continue;
    const columns = headers.get(section);
    if (!columns) continue;
    const row = new Map<string, string>();
    columns.forEach((name, i) => row.set(name, cells[i + 2] ?? ""));

    if (section === "Trades") {
      const discriminator = row.get("DataDiscriminator");
      if (discriminator !== undefined && discriminator !== "Order" && discriminator !== "Trade") continue;
      const category = row.get("Asset Category") ?? "";
      if (!STOCK_CATEGORY.test(category)) {
        skipped.push({ source: line, reason: "notStock" });
        continue;
      }
      const trade = ibkrTrade({
        symbol: row.get("Symbol") ?? "",
        dateTime: row.get("Date/Time") ?? row.get("TradeDate") ?? "",
        quantity: row.get("Quantity") ?? "",
        price: row.get("T. Price") ?? row.get("TradePrice") ?? "",
        proceeds: row.get("Proceeds") ?? "",
        commission: row.get("Comm/Fee") ?? row.get("Comm in USD") ?? row.get("IBCommission") ?? "",
        currency: row.get("Currency") ?? "",
        source: line,
      });
      if ("reason" in trade) skipped.push(trade);
      else trades.push(trade);
      continue;
    }

    if (section === "Dividends" || section === "Withholding Tax") {
      const currency = row.get("Currency") ?? "";
      /* Bölümün "Total" satırları `Data` türüyle geliyor, para birimi
         hücresinde "Total" yazıyor. */
      if (/total/i.test(currency)) continue;
      const description = row.get("Description") ?? "";
      const symbol = dividendSymbol(description);
      const date = findDate(row.get("Date") ?? "")?.date ?? "";
      const amount = parseAmount(row.get("Amount"), ".");
      if (!symbol || amount === null) {
        skipped.push({ source: line, reason: symbol ? "unreadable" : "noSymbol" });
        continue;
      }
      if (section === "Dividends") dividendRows.push({ symbol, date, amount, currency, source: line });
      else taxRows.push({ symbol, date, amount });
    }
  }

  return { broker: "ibkr", trades, dividends: joinDividends(dividendRows, taxRows), skipped };
}

/**
 * Tek bir işlem satırı → önerilen işlem ya da atlanan satır. CSV ve PDF
 * aynı yoldan geçiyor; fark yalnızca hücrelerin nereden geldiği.
 */
export function ibkrTrade(cells: {
  symbol: string;
  dateTime: string;
  quantity: string;
  price: string;
  proceeds: string;
  commission: string;
  currency: string;
  source: string;
}): ImportedTrade | SkippedLine {
  const symbol = normalizeSymbol(cells.symbol);
  const quantity = parseAmount(cells.quantity, ".");
  const price = parseAmount(cells.price, ".");
  if (!cells.symbol.trim()) return { source: cells.source, reason: "noSymbol" };
  if (quantity === null || quantity === 0) return { source: cells.source, reason: "noQuantity" };
  if (price === null || price < 0) return { source: cells.source, reason: "noPrice" };

  const flags: RowFlag[] = [];
  const date = findDate(cells.dateTime)?.date ?? "";
  if (!date) flags.push("noDate");
  const commissionRaw = parseAmount(cells.commission, ".");
  const commission = commissionRaw === null ? null : Math.abs(commissionRaw);
  if (commission === null) flags.push("noCommission");
  const currency = cells.currency.trim().toUpperCase() || null;
  if (currency && currency !== "USD") flags.push("currency");
  const proceeds = parseAmount(cells.proceeds, ".");
  if (proceeds !== null && !amountMatches(Math.abs(quantity), price, proceeds, commission)) flags.push("amountMismatch");
  if (!symbol) flags.push("symbolOdd");

  return {
    side: quantity > 0 ? "buy" : "sell",
    symbol: symbol ?? cells.symbol.trim().toUpperCase(),
    date,
    quantity: Math.abs(quantity),
    priceUsd: price,
    commissionUsd: commission,
    currency,
    flags,
    source: cells.source,
    stamp: cells.dateTime.trim(),
  };
}

/** "AAPL(US0378331005) Cash Dividend …" → "AAPL". */
export function dividendSymbol(description: string): string | null {
  const match = /^\s*([A-Z][A-Z0-9. ]{0,11}?)\s*\(/.exec(description);
  return match ? normalizeSymbol(match[1]) : null;
}

/**
 * Temettü ve kesintisi ayrı bölümlerde; sembol + gün ile birleşiyor. Aynı
 * günde birden fazla satır (düzeltme, iade) toplanıyor. Kesinti satırı
 * bulunamayan temettünün kesintisi null — sıfır değil, bilinmiyor.
 */
export function joinDividends(
  dividends: { symbol: string; date: string; amount: number; currency: string; source: string }[],
  taxes: { symbol: string; date: string; amount: number }[],
): ImportedDividend[] {
  const byKey = new Map<string, ImportedDividend>();
  for (const row of dividends) {
    const key = `${row.symbol}|${row.date}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.grossUsd += row.amount;
      continue;
    }
    const flags: RowFlag[] = [];
    if (!row.date) flags.push("noDate");
    const currency = row.currency.trim().toUpperCase() || null;
    if (currency && currency !== "USD") flags.push("currency");
    byKey.set(key, {
      symbol: row.symbol,
      date: row.date,
      grossUsd: row.amount,
      withheldUsd: null,
      currency,
      flags,
      source: row.source,
    });
  }
  for (const tax of taxes) {
    const target = byKey.get(`${tax.symbol}|${tax.date}`);
    /* Kesinti eksi yazılıyor, iadesi artı: net kesinti = −toplam. */
    if (target) target.withheldUsd = (target.withheldUsd ?? 0) - tax.amount;
  }
  for (const d of byKey.values()) if (d.withheldUsd !== null && d.withheldUsd < 0) d.withheldUsd = 0;
  /* Tamamen geri alınmış temettü (brüt toplam sıfır ya da eksi) önerilmez. */
  return [...byKey.values()].filter((d) => d.grossUsd > 0);
}

/* --------------------------------------------------------------------------
   PDF metni
   -------------------------------------------------------------------------- */

/**
 * IBKR Activity Statement PDF'inin Trades tablosu (kesinlik: orta). Metin
 * katmanında tablo satırları şu sırayla geliyor:
 *   Symbol · Date/Time · Quantity · T. Price · C. Price · Proceeds ·
 *   Comm/Fee · Basis · Realized P/L · MTM P/L · Code
 * ve "Stocks" / "USD" alt başlıkları ile "Total …" satırları arada. Tarih
 * ile saat tek hücrede ("2024-03-15, 10:30:12") ama PDF'te ikiye
 * bölünebiliyor; saat varsa atlanıyor. Bölüm, "Trades" başlığından bir
 * sonraki bölüm başlığına kadar okunur; alt başlık "Stocks" değilse (opsiyon,
 * döviz) satırlar atlanır.
 */
const IBKR_SECTIONS = /^(Trades|Dividends|Withholding Tax|Open Positions|Deposits & Withdrawals|Fees|Interest|Change in Dividend Accruals|Financial Instrument Information|Codes|Mark-to-Market Performance Summary|Realized & Unrealized Performance Summary|Cash Report|Net Asset Value|Corporate Actions|Transfers)\b/;

export function looksLikeIbkrText(lines: readonly string[]): boolean {
  const head = lines.slice(0, 80).join("\n");
  return /Interactive Brokers|Activity Statement/i.test(head) && lines.some((l) => /^Trades\b/.test(l.trim()));
}

export function parseIbkrText(lines: readonly string[]): ImportResult {
  const trades: ImportedTrade[] = [];
  const skipped: SkippedLine[] = [];
  const dividendRows: { symbol: string; date: string; amount: number; currency: string; source: string }[] = [];
  const taxRows: { symbol: string; date: string; amount: number }[] = [];
  let section = "";
  let category = "";
  let currency = "";

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    const heading = IBKR_SECTIONS.exec(line);
    if (heading && !/\d{4}-\d{2}-\d{2}/.test(line)) {
      section = heading[1];
      category = "";
      continue;
    }
    if (/^(Stocks|Equity and Index Options|Forex|Futures|Bonds|Options|Warrants|CFDs)$/i.test(line)) {
      category = line;
      continue;
    }
    if (/^[A-Z]{3}$/.test(line)) {
      currency = line;
      continue;
    }
    if (/^(Total|SubTotal)\b/i.test(line) || /^Symbol\b/.test(line) || /^Date\b/.test(line)) continue;

    if (section === "Trades") {
      const date = findDate(line);
      if (!date) continue;
      if (category && !STOCK_CATEGORY.test(category)) {
        skipped.push({ source: rawLine, reason: "notStock" });
        continue;
      }
      const before = line.slice(0, date.index).trim();
      const after = line
        .slice(date.index + date.length)
        .replace(/^,?\s*\d{1,2}:\d{2}(:\d{2})?/, "")
        .trim()
        .split(" ")
        .filter((token) => token !== "");
      /* Sayısal hücreler: Quantity, T. Price, C. Price, Proceeds, Comm/Fee,
         Basis, Realized P/L, MTM P/L — sonra harf kodları (O, C, P…). */
      const numbers = after.filter((token) => parseAmount(token, ".") !== null);
      if (numbers.length < 2) {
        skipped.push({ source: rawLine, reason: numbers.length === 0 ? "noQuantity" : "noPrice" });
        continue;
      }
      const trade = ibkrTrade({
        symbol: before,
        dateTime: line.slice(date.index, date.index + date.length),
        quantity: numbers[0],
        price: numbers[1],
        proceeds: numbers[3] ?? "",
        commission: numbers[4] ?? "",
        currency,
        source: rawLine,
      });
      if ("reason" in trade) skipped.push(trade);
      else trades.push(trade);
      continue;
    }

    if (section === "Dividends" || section === "Withholding Tax") {
      const date = findDate(line);
      if (!date) continue;
      const rest = line.slice(date.index + date.length).trim();
      const symbol = dividendSymbol(rest);
      const tokens = rest.split(" ");
      const amount = parseAmount(tokens[tokens.length - 1], ".");
      if (!symbol || amount === null) {
        skipped.push({ source: rawLine, reason: symbol ? "unreadable" : "noSymbol" });
        continue;
      }
      if (section === "Dividends") dividendRows.push({ symbol, date: date.date, amount, currency, source: rawLine });
      else taxRows.push({ symbol, date: date.date, amount });
    }
  }
  return { broker: "ibkr", trades, dividends: joinDividends(dividendRows, taxRows), skipped };
}
