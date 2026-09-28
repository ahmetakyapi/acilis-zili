import test from "node:test";
import assert from "node:assert/strict";

import {
  findDate,
  importCsv,
  importPdfLines,
  mergeResults,
  normalizeSymbol,
  parseAmount,
  parseGenericLines,
  splitCsvLine,
} from "../lib/tax-import";
import { groupLines } from "../components/tax/pdf-text";
import { formatDecimalInput, isAmbiguous, parseDecimalInput } from "../lib/decimal-input";

/**
 * Ekstreden aktarım — saf ayrıştırıcılar. GERÇEK MÜŞTERİ VERİSİ YOK: bütün
 * örnekler sentetik ve belgelenmiş düzene göre yazıldı (kaynaklar
 * lib/tax-import/midas.ts ve ibkr.ts başında). PDF yolu METİN katmanında
 * sınanıyor: pdf.js'nin çıkardığı satırlar → işlemler. Satır kurma
 * (`groupLines`) ayrıca konumlu parçalarla sınanıyor.
 */

/* --------------------------------------------------------------------------
   Sayı ve tarih
   -------------------------------------------------------------------------- */

test("sayı: iki ayraçta sondaki ondalık, tek ayraçta belgenin dili", () => {
  assert.equal(parseAmount("1.740,00", ","), 1740);
  assert.equal(parseAmount("1,740.00", "."), 1740);
  assert.equal(parseAmount("0,123456", ","), 0.123456);
  assert.equal(parseAmount("227,40", ","), 227.4);
  assert.equal(parseAmount("1.234", ","), 1234);
  assert.equal(parseAmount("1,234", "."), 1234);
  assert.equal(parseAmount("12.5", ","), 12.5);
  assert.equal(parseAmount("-1,000", "."), -1000);
  assert.equal(parseAmount("(2.10)", "."), -2.1);
  assert.equal(parseAmount("$172.50", "."), 172.5);
  assert.equal(parseAmount("-", ","), null);
  assert.equal(parseAmount("", "."), null);
  assert.equal(parseAmount("abc", "."), null);
});

test("tarih: Midas iki haneli yılı, IBKR ISO, ay adları", () => {
  assert.equal(findDate("02/03/26 13:21:14 Limit Emri")?.date, "2026-03-02");
  assert.equal(findDate("\"2024-03-15, 10:30:12\"")?.date, "2024-03-15");
  assert.equal(findDate("15.03.2024")?.date, "2024-03-15");
  assert.equal(findDate("15 Mart 2024")?.date, "2024-03-15");
  assert.equal(findDate("Mar 15, 2024")?.date, "2024-03-15");
  /* İkinci sayı 12'den büyükse ABD sırası kesin. */
  assert.equal(findDate("03/15/2024")?.date, "2024-03-15");
  assert.equal(findDate("31/02/2024"), null);
  assert.equal(findDate("Sayfa 2"), null);
});

test("sembol: sınıflı hisse noktaya, rakamlı sembol reddedilir", () => {
  assert.equal(normalizeSymbol("BRK B"), "BRK.B");
  assert.equal(normalizeSymbol("brk/b"), "BRK.B");
  assert.equal(normalizeSymbol("AAPL"), "AAPL");
  assert.equal(normalizeSymbol("12345"), null);
});

test("csv hücresi: tırnaklı ayraç ve çift tırnak", () => {
  assert.deepEqual(splitCsvLine('Trades,Data,"2024-03-15, 10:30:12","1,000","a ""b"""'), [
    "Trades",
    "Data",
    "2024-03-15, 10:30:12",
    "1,000",
    'a "b"',
  ]);
});

/* --------------------------------------------------------------------------
   Midas
   -------------------------------------------------------------------------- */

/**
 * pdf.js'nin bir Midas ekstresinden çıkaracağı satırlar: sütun sınırları
 * sekme. İçinde bilerek zor durumlar var:
 *   - binlik noktalı tutar ("1.740,00")
 *   - kesirli adet ("0,123456")
 *   - hiç dolmamış iptal emri ("-" hücreler) → önerilmez, atlanmaz da
 *   - kısmen dolmuş emir, durum metni iki satıra kırılmış
 *   - sayfa sonu altlığı ve tekrarlayan başlık tablonun ortasında
 *   - HESAP İŞLEMLERİ'ndeki saatli satırlar → işlem sayılmaz
 *   - sütunları kaymış bir satır → "Tutar Tutmuyor"
 */
const MIDAS_LINES = [
  "Midas Menkul Değerler A.Ş.",
  "01/03/26 - 31/03/26 HESAP EKSTRESİ",
  "PORTFÖY ÖZETİ (31/03/26)",
  "AAPL - Apple Inc.\t10,5\t227,40\t2.387,70",
  "YATIRIM İŞLEMLERİ (USD) 01/03/26 31/03/26",
  "Tarih\tİşlem Türü\tSembol\tİşlem Tipi\tİşlem Durumu\tPara Birimi\tEmir Adedi\tEmir Tutarı\tGerçekleşen Adet\tOrtalama İşlem Fiyatı\tİşlem Ücreti\tİşlem Tutarı",
  "02/03/26 13:21:14\tLimit Emri\tAAPL\tAlış\tGerçekleşti\tUSD\t10\t-\t10\t174,00\t1,50\t1.741,50",
  "03/03/26 16:45:02\tPiyasa Emri\tNVDA\tAlış\tGerçekleşti\tUSD\t-\t15,00\t0,123456\t121,50\t0,00\t15,00",
  "04/03/26 10:00:00\tLimit Emri\tTSLA\tAlış\tİptal Edildi\tUSD\t5\t-\t-\t-\t-\t-",
  "05/03/26 17:30:45\tLimit Emri\tMSFT\tSatış\tKalan İptal\tUSD\t8\t-\t3\t410,20\t1,00\t1.229,60",
  "Edildi",
  "www.midasmenkul.com\t1/3",
  "01/03/26 - 31/03/26 HESAP EKSTRESİ",
  "Tarih\tİşlem Türü\tSembol\tİşlem Tipi\tİşlem Durumu\tPara Birimi\tEmir Adedi\tEmir Tutarı\tGerçekleşen Adet\tOrtalama İşlem Fiyatı\tİşlem Ücreti\tİşlem Tutarı",
  "20/03/26 15:02:11\tLimit Emri\tAAPL\tSatış\tGerçekleşti\tUSD\t4\t-\t4\t190,25\t1,50\t759,50",
  "21/03/26 15:02:11\tLimit Emri\tAMD\tSatış\tGerçekleşti\tUSD\t2\t-\t2\t150,00\t1,50\t9.999,00",
  "HESAP İŞLEMLERİ",
  "01/03/26 09:00:00\t01/03/26 09:01:00\tPara Yatırma\tBanka\tUSD\t2.000,00",
  "TEMETTÜ İŞLEMLERİ (USD) 01/03/26 31/03/26",
  "Ödeme Tarihi\tSermaye Piyasası Aracı\tBrüt Temettü Tutarı\tStopaj*\tNet Temettü Tutarı",
  "13/03/26\tAAPL - Apple Inc.\t2,63\t0,53\t2,10",
  "26/03/26\tKO - The Coca-Cola\t12,50\t2,50\t10,00",
  "Company",
  "HİSSE TRANSFERLERİ",
  "www.midasmenkul.com\t3/3",
];

test("Midas: kurum tanınır, dolmuş emirler önerilir, iptal emri sessizce düşer", () => {
  const result = importPdfLines(MIDAS_LINES);
  assert.equal(result.broker, "midas");
  assert.deepEqual(
    result.trades.map((t) => [t.symbol, t.side, t.date, t.quantity, t.priceUsd, t.commissionUsd]),
    [
      ["AAPL", "buy", "2026-03-02", 10, 174, 1.5],
      ["NVDA", "buy", "2026-03-03", 0.123456, 121.5, 0],
      ["MSFT", "sell", "2026-03-05", 3, 410.2, 1],
      ["AAPL", "sell", "2026-03-20", 4, 190.25, 1.5],
      ["AMD", "sell", "2026-03-21", 2, 150, 1.5],
    ],
  );
  assert.equal(result.trades.some((t) => t.symbol === "TSLA"), false);
  assert.equal(result.skipped.some((s) => s.source.includes("TSLA")), false);
});

test("Midas: temiz satırda bayrak yok, kaymış tutar işaretlenir", () => {
  const { trades } = importPdfLines(MIDAS_LINES);
  const flagsOf = (symbol: string) => trades.find((t) => t.symbol === symbol)?.flags;
  assert.deepEqual(flagsOf("AAPL"), []);
  assert.deepEqual(flagsOf("MSFT"), []);
  assert.deepEqual(flagsOf("AMD"), ["amountMismatch"]);
  assert.equal(trades.every((t) => t.currency === "USD"), true);
});

test("Midas: temettü brüt ve stopajıyla, kırılan şirket adı sayıları bozmaz", () => {
  const { dividends } = importPdfLines(MIDAS_LINES);
  assert.deepEqual(
    dividends.map((d) => [d.symbol, d.date, d.grossUsd, d.withheldUsd, d.flags]),
    [
      ["AAPL", "2026-03-13", 2.63, 0.53, []],
      ["KO", "2026-03-26", 12.5, 2.5, []],
    ],
  );
});

test("Midas: saat alt satıra kırılsa da satır tarihinden başlar", () => {
  const { trades } = importPdfLines([
    "Midas",
    "YATIRIM İŞLEMLERİ (USD) 01/03/26 31/03/26",
    "02/03/26\tLimit Emri\tAAPL\tAlış\tGerçekleşti\tUSD\t10\t-\t10\t174,00\t1,50\t1.741,50",
    "13:21:14",
    "03/03/26\tLimit Emri\tAAPL\tAlış\tGerçekleşti\tUSD\t1\t-\t1\t175,00\t1,50\t176,50",
    "09:01:02",
  ]);
  assert.deepEqual(trades.map((t) => [t.date, t.quantity, t.flags]), [
    ["2026-03-02", 10, []],
    ["2026-03-03", 1, []],
  ]);
});

test("Midas: TL hesabının satırı 'Dolar Değil' ile işaretli", () => {
  const { trades } = importPdfLines([
    "Midas",
    "YATIRIM İŞLEMLERİ (TRY) 01/03/26 31/03/26",
    "02/03/26 11:00:00\tLimit Emri\tTHYAO\tAlış\tGerçekleşti\tTRY\t10\t-\t10\t300,00\t0,00\t3.000,00",
  ]);
  assert.deepEqual(trades[0].flags, ["currency"]);
});

test("Midas: yönü okunamayan tarihli emir satırı atlanan listesine düşer", () => {
  const { trades, skipped } = importPdfLines([
    "Midas",
    "YATIRIM İŞLEMLERİ (USD) 01/03/26 31/03/26",
    "02/03/26 11:00:00\tLimit Emri\tAAPL\t???\tGerçekleşti\tUSD\t10\t-\t10\t300,00\t0,00\t3.000,00",
  ]);
  assert.equal(trades.length, 0);
  assert.equal(skipped[0].reason, "noSide");
});

test("birden fazla ekstre: ay sonundaki işlem iki dosyada olsa da bir kez", () => {
  const march = importPdfLines(MIDAS_LINES);
  const april = importPdfLines([
    "Midas",
    "YATIRIM İŞLEMLERİ (USD) 01/04/26 30/04/26",
    "21/03/26 15:02:11\tLimit Emri\tAMD\tSatış\tGerçekleşti\tUSD\t2\t-\t2\t150,00\t1,50\t9.999,00",
    "02/04/26 10:10:10\tLimit Emri\tAAPL\tSatış\tGerçekleşti\tUSD\t1\t-\t1\t200,00\t1,50\t198,50",
  ]);
  const merged = mergeResults([march, april]);
  assert.equal(merged.broker, "midas");
  assert.equal(merged.trades.filter((t) => t.symbol === "AMD").length, 1);
  assert.equal(merged.trades.length, march.trades.length + 1);
  assert.equal(merged.trades.at(-1)?.date, "2026-04-02");
});

/* --------------------------------------------------------------------------
   IBKR CSV
   -------------------------------------------------------------------------- */

/** IBKR Reporting Guide'daki başlıklar; satırlar sentetik. */
const IBKR_CSV = [
  "﻿Statement,Header,Field Name,Field Value",
  "Statement,Data,BrokerName,Interactive Brokers LLC",
  "Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code",
  'Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:12",10,172.5,173.1,-1725,-1,1726,0,6,O',
  'Trades,Data,Order,Stocks,USD,AAPL,"2024-11-20, 15:59:01",-4,228.1,228.4,912.4,-1.0035,-690.4,221,-1.2,C;P',
  'Trades,Data,ClosedLot,Stocks,USD,AAPL,2024-03-15,4,172.6,,,,690.4,221,,ST',
  'Trades,Data,Order,Stocks,USD,BRK B,"2024-06-03, 09:45:00","1,000",410.5,411,"-410,500",-5,"410,505",0,500,O',
  'Trades,SubTotal,,Stocks,USD,AAPL,,6,,,-812.6,-2.0035,1035.6,221,4.8,',
  'Trades,Total,,Stocks,USD,,,,,,-411312.6,-7.0035,,221,504.8,',
  'Trades,Data,Order,Equity and Index Options,USD,AAPL 240621C00180000,"2024-05-01, 10:00:00",1,5.2,5.5,-520,-0.65,520.65,0,30,O',
  "Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,,Proceeds,Comm in USD,,,MTM in USD,Code",
  'Trades,Data,Order,Forex,USD,EUR.USD,"2024-02-01, 12:00:00",-1000,1.08,,1080,-2,,,0,',
  "Dividends,Header,Currency,Date,Description,Amount",
  "Dividends,Data,USD,2024-05-16,AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend),2.5",
  "Dividends,Data,USD,2024-08-15,KO(US1912161007) Cash Dividend USD 0.485 per Share (Ordinary Dividend),48.5",
  "Dividends,Data,Total,,,51",
  "Withholding Tax,Header,Currency,Date,Description,Amount,Code",
  "Withholding Tax,Data,USD,2024-05-16,AAPL(US0378331005) Cash Dividend USD 0.25 per Share - US Tax,-0.5,",
  "Withholding Tax,Data,Total,,,-0.5,",
].join("\r\n");

test("IBKR CSV: yalnızca hisse emirleri, ClosedLot ve ara toplamlar sayılmaz", () => {
  const result = importCsv(IBKR_CSV);
  assert.equal(result.broker, "ibkr");
  assert.deepEqual(
    result.trades.map((t) => [t.symbol, t.side, t.date, t.quantity, t.priceUsd, t.commissionUsd]),
    [
      ["AAPL", "buy", "2024-03-15", 10, 172.5, 1],
      ["AAPL", "sell", "2024-11-20", 4, 228.1, 1.0035],
      ["BRK.B", "buy", "2024-06-03", 1000, 410.5, 5],
    ],
  );
  assert.equal(result.trades.every((t) => t.flags.length === 0), true);
  assert.deepEqual(result.skipped.map((s) => s.reason), ["notStock", "notStock"]);
});

test("IBKR CSV: temettü ve kesintisi aynı güne bağlanır, kesintisiz olan null", () => {
  const { dividends } = importCsv(IBKR_CSV);
  assert.deepEqual(
    dividends.map((d) => [d.symbol, d.date, d.grossUsd, d.withheldUsd]),
    [
      ["AAPL", "2024-05-16", 2.5, 0.5],
      ["KO", "2024-08-15", 48.5, null],
    ],
  );
});

/* --------------------------------------------------------------------------
   IBKR PDF metni
   -------------------------------------------------------------------------- */

test("IBKR PDF metni: Trades tablosu satırları, opsiyon bölümü atlanır", () => {
  const result = importPdfLines([
    "Interactive Brokers LLC",
    "Activity Statement",
    "January 1, 2024 - December 31, 2024",
    "Trades",
    "Symbol Date/Time Quantity T. Price C. Price Proceeds Comm/Fee Basis Realized P/L MTM P/L Code",
    "Stocks",
    "USD",
    "AAPL 2024-03-15, 10:30:12 10 172.50 173.10 -1,725.00 -1.00 1,726.00 0.00 6.00 O",
    "AAPL 2024-11-20, 15:59:01 -4 228.10 228.40 912.40 -1.00 -690.40 221.00 -1.20 C",
    "Total AAPL 6 -812.60 -2.00 1,035.60 221.00 4.80",
    "Equity and Index Options",
    "AAPL 21JUN24 180 C 2024-05-01, 10:00:00 1 5.20 5.50 -520.00 -0.65 520.65 0.00 30.00 O",
    "Dividends",
    "Date Description Amount",
    "USD",
    "2024-05-16 AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend) 2.50",
    "Total 2.50",
    "Withholding Tax",
    "2024-05-16 AAPL(US0378331005) Cash Dividend USD 0.25 per Share - US Tax -0.50",
  ]);
  assert.equal(result.broker, "ibkr");
  assert.deepEqual(
    result.trades.map((t) => [t.symbol, t.side, t.date, t.quantity, t.priceUsd, t.commissionUsd, t.flags]),
    [
      ["AAPL", "buy", "2024-03-15", 10, 172.5, 1, []],
      ["AAPL", "sell", "2024-11-20", 4, 228.1, 1, []],
    ],
  );
  assert.deepEqual(result.skipped.map((s) => s.reason), ["notStock"]);
  assert.deepEqual(result.dividends.map((d) => [d.symbol, d.grossUsd, d.withheldUsd]), [["AAPL", 2.5, 0.5]]);
});

/* --------------------------------------------------------------------------
   Genel tanıyıcı
   -------------------------------------------------------------------------- */

test("genel tanıyıcı: tutarla doğrulanan satır temiz, doğrulanamayan işaretli", () => {
  const result = parseGenericLines([
    "15.03.2024 Alış AAPL 10 172,50 1.725,00",
    "20.03.2024 Satış MSFT 3 410,00",
    "Toplam 1.725,00",
    "22.03.2024 Alış 5 100,00",
  ]);
  assert.equal(result.broker, null);
  assert.deepEqual(
    result.trades.map((t) => [t.symbol, t.side, t.quantity, t.priceUsd, t.flags]),
    [
      ["AAPL", "buy", 10, 172.5, ["noCommission"]],
      ["MSFT", "sell", 3, 410, ["noCommission", "unverified"]],
    ],
  );
  assert.deepEqual(result.skipped.map((s) => s.reason), ["noSymbol"]);
});

/* --------------------------------------------------------------------------
   PDF satır kurma
   -------------------------------------------------------------------------- */

test("pdf satırları: aynı hat birleşir, geniş boşluk sekme olur", () => {
  const h = 10;
  const lines = groupLines([
    { x: 200, y: 700, w: 30, h, str: "AAPL" },
    { x: 40, y: 700.4, w: 50, h, str: "02/03/26" },
    { x: 92, y: 700, w: 40, h, str: "13:21:14" },
    { x: 40, y: 680, w: 40, h, str: "Edildi" },
  ]);
  assert.deepEqual(lines, ["02/03/26 13:21:14\tAAPL", "Edildi"]);
});

/* --------------------------------------------------------------------------
   Form alanı: dilin ondalık ayracı (lib/decimal-input.ts)
   -------------------------------------------------------------------------- */

test("sayı girişi: TR virgül ondalık, nokta yalnızca üçlü gruplarda binlik", () => {
  assert.equal(parseDecimalInput("1,845211", "tr"), 1.845211);
  assert.equal(parseDecimalInput("1.845,50", "tr"), 1845.5);
  assert.equal(parseDecimalInput("243.1", "tr"), 243.1);
  assert.equal(parseDecimalInput("243,10", "tr"), 243.1);
  /* Belirsiz: Türkçe yazımda nokta binliktir ve alan bunu söyler. */
  assert.equal(parseDecimalInput("1.845", "tr"), 1845);
  assert.equal(isAmbiguous("1.845", "tr"), true);
  assert.equal(isAmbiguous("1,845", "tr"), false);
  assert.equal(parseDecimalInput("1.845211", "tr"), 1.845211);
  assert.equal(parseDecimalInput("", "tr"), null);
  assert.equal(parseDecimalInput("abc", "tr"), null);
});

test("sayı girişi: EN nokta ondalık, virgül üçlü gruplarda binlik", () => {
  assert.equal(parseDecimalInput("1.845", "en"), 1.845);
  assert.equal(parseDecimalInput("1,845.50", "en"), 1845.5);
  assert.equal(parseDecimalInput("1,845", "en"), 1845);
  assert.equal(isAmbiguous("1,845", "en"), true);
  assert.equal(parseDecimalInput("1,5", "en"), 1.5);
});

test("sayı girişi: alana yazılan değer dilin ayracıyla ve gruplamasız", () => {
  assert.equal(formatDecimalInput(1.845211, "tr"), "1,845211");
  assert.equal(formatDecimalInput(243.1, "tr"), "243,1");
  assert.equal(formatDecimalInput(1845.5, "tr"), "1845,5");
  assert.equal(formatDecimalInput(1.845211, "en"), "1.845211");
  assert.equal(formatDecimalInput(243.1, "tr", { money: true }), "243,10");
  assert.equal(formatDecimalInput(0.0035, "en", { money: true }), "0.0035");
  /* Gidiş dönüş kayıpsız. */
  for (const v of [0.123456, 1845.5, 243.1, 10]) {
    assert.equal(parseDecimalInput(formatDecimalInput(v, "tr"), "tr"), v);
    assert.equal(parseDecimalInput(formatDecimalInput(v, "en"), "en"), v);
  }
});
