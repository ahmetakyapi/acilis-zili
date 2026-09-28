import test from "node:test";
import assert from "node:assert/strict";

import { importCsv, importPdfLines } from "../lib/tax-import";
import { collapseLots, netPositions, planImport, type ImportTradeInput } from "../lib/portfolio-import";

/**
 * Ekstreden portföye — ayrıştırıcı (vergi ekranıyla ORTAK) + net pozisyon.
 * GERÇEK MÜŞTERİ VERİSİ YOK: satırlar sentetik, düzen lib/tax-import/midas.ts
 * başındaki belgelenmiş sütunlara göre yazıldı.
 */

const t = (side: "buy" | "sell", symbol: string, date: string, quantity: number, priceUsd: number): ImportTradeInput => ({
  side,
  symbol,
  date,
  quantity,
  priceUsd,
});

test("FIFO: satış en eski alıştan düşer, kalan lotlar kendi gün ve fiyatıyla kalır", () => {
  const [plan] = netPositions([
    t("buy", "AAPL", "2025-01-10", 10, 150),
    t("buy", "AAPL", "2025-03-05", 5, 170),
    t("sell", "AAPL", "2025-04-01", 12, 190),
  ]);
  assert.equal(plan.status, "open");
  assert.equal(plan.quantity, 3);
  assert.deepEqual(plan.lots, [{ symbol: "AAPL", date: "2025-03-05", quantity: 3, costUsd: 170 }]);
  assert.equal(plan.avgCostUsd, 170);
});

test("sıra tarihe göre: ekstre sırası karışık gelse de satış doğru alıştan düşer", () => {
  const [plan] = netPositions([
    t("sell", "MSFT", "2025-06-01", 2, 400),
    t("buy", "MSFT", "2025-02-01", 2, 300),
    t("buy", "MSFT", "2025-01-01", 2, 250),
  ]);
  assert.deepEqual(plan.lots.map((l) => [l.date, l.quantity, l.costUsd]), [["2025-02-01", 2, 300]]);
});

test("tamamen satılan sembol eklenmez, fazla satış sembolü eksik yapar", () => {
  const plans = netPositions([
    t("buy", "NVDA", "2025-01-02", 4, 120),
    t("sell", "NVDA", "2025-02-02", 4, 130),
    t("buy", "AMD", "2025-01-02", 1, 150),
    t("sell", "AMD", "2025-02-02", 3, 160),
  ]);
  const bySymbol = Object.fromEntries(plans.map((p) => [p.symbol, p]));
  assert.equal(bySymbol.NVDA.status, "closed");
  assert.equal(bySymbol.NVDA.lots.length, 0);
  assert.equal(bySymbol.AMD.status, "incomplete");
  assert.equal(bySymbol.AMD.quantity, null);
  assert.equal(bySymbol.AMD.missingQuantity, 2);
});

test("kesirli adet: kayan nokta kırıntısı açık pozisyon bırakmaz", () => {
  const [plan] = netPositions([
    t("buy", "NVDA", "2025-01-02", 0.1, 120),
    t("buy", "NVDA", "2025-01-03", 0.2, 121),
    t("sell", "NVDA", "2025-02-02", 0.3, 130),
  ]);
  assert.equal(plan.status, "closed");
});

test("sembol başına tek satır: ağırlıklı ortalama, en eski kalan gün", () => {
  const [lot] = collapseLots([
    { symbol: "KO", date: "2025-05-01", quantity: 10, costUsd: 60 },
    { symbol: "KO", date: "2025-02-01", quantity: 30, costUsd: 64 },
  ]);
  assert.equal(lot.date, "2025-02-01");
  assert.equal(lot.quantity, 40);
  assert.equal(lot.costUsd, 63);
});

test("çakışma: portföyde birebir duran lot ayıklanır, yeni lot soruya düşer", () => {
  const plans = netPositions([
    t("buy", "AAPL", "2025-01-10", 10, 150),
    t("buy", "AAPL", "2025-03-05", 5, 170),
    t("buy", "TSLA", "2025-03-05", 2, 200),
  ]);
  const existing = [{ symbol: "AAPL", quantity: 10, costUsd: 150, boughtAt: "2025-01-10" }];
  const [aapl, tsla] = planImport(plans, existing, "lots");
  assert.equal(aapl.duplicates, 1);
  assert.equal(aapl.lots.length, 1);
  assert.equal(aapl.conflict, true);
  assert.equal(tsla.conflict, false);

  /* Aynı ekstre ikinci kez: her şey zaten var, soru da yok. */
  const again = planImport(plans, [...existing, { symbol: "AAPL", quantity: 5, costUsd: 170, boughtAt: "2025-03-05" }], "lots");
  assert.equal(again[0].lots.length, 0);
  assert.equal(again[0].conflict, false);
});

/* --------------------------------------------------------------------------
   Uçtan uca: ekstre metni → net pozisyon
   -------------------------------------------------------------------------- */

/** pdf.js'nin sentetik bir Midas aylık ekstresinden çıkaracağı satırlar. */
const MIDAS_LINES = [
  "Midas Menkul Değerler A.Ş.",
  "01/03/26 - 31/03/26 HESAP EKSTRESİ",
  "YATIRIM İŞLEMLERİ (USD) 01/03/26 31/03/26",
  "Tarih\tİşlem Türü\tSembol\tİşlem Tipi\tİşlem Durumu\tPara Birimi\tEmir Adedi\tEmir Tutarı\tGerçekleşen Adet\tOrtalama İşlem Fiyatı\tİşlem Ücreti\tİşlem Tutarı",
  "02/03/26 13:21:14\tLimit Emri\tAAPL\tAlış\tGerçekleşti\tUSD\t10\t-\t10\t174,00\t1,50\t1.741,50",
  "03/03/26 16:45:02\tPiyasa Emri\tNVDA\tAlış\tGerçekleşti\tUSD\t-\t15,00\t0,123456\t121,50\t0,00\t15,00",
  "04/03/26 10:00:00\tLimit Emri\tTSLA\tAlış\tİptal Edildi\tUSD\t5\t-\t-\t-\t-\t-",
  "10/03/26 15:30:00\tLimit Emri\tAAPL\tAlış\tGerçekleşti\tUSD\t5\t-\t5\t180,00\t1,00\t901,00",
  "www.midasmenkul.com\t1/2",
  "20/03/26 15:02:11\tLimit Emri\tAAPL\tSatış\tGerçekleşti\tUSD\t12\t-\t12\t190,25\t1,50\t2.281,50",
  "21/03/26 15:02:11\tLimit Emri\tMSFT\tSatış\tGerçekleşti\tUSD\t2\t-\t2\t410,00\t1,50\t818,50",
  "HESAP İŞLEMLERİ",
  "01/03/26 09:00:00\t01/03/26 09:01:00\tPara Yatırma\tBanka\tUSD\t2.000,00",
  "www.midasmenkul.com\t2/2",
];

test("Midas PDF metni → açık pozisyonlar: iptal düşer, satış FIFO, eksik geçmiş işaretlenir", () => {
  const result = importPdfLines(MIDAS_LINES);
  assert.equal(result.broker, "midas");
  const plans = netPositions(result.trades);
  const bySymbol = Object.fromEntries(plans.map((p) => [p.symbol, p]));
  assert.deepEqual(Object.keys(bySymbol).sort(), ["AAPL", "MSFT", "NVDA"]);
  /* 10 @174 + 5 @180, 12 satış → ilk lot biter, ikinciden 2 düşer. */
  assert.deepEqual(bySymbol.AAPL.lots, [{ symbol: "AAPL", date: "2026-03-10", quantity: 3, costUsd: 180 }]);
  assert.equal(bySymbol.NVDA.quantity, 0.123456);
  assert.equal(bySymbol.MSFT.status, "incomplete");
  assert.equal(bySymbol.TSLA, undefined);
});

test("IBKR CSV → açık pozisyonlar", () => {
  const csv = [
    "Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code",
    'Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:12",20,172.5,173,-3450,-1,3451,0,10,O',
    'Trades,Data,Order,Stocks,USD,AAPL,"2024-06-03, 11:00:00",-5,190,190,950,-1,-862.75,86.25,0,C',
  ].join("\n");
  const plans = netPositions(importCsv(csv).trades);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].lots, [{ symbol: "AAPL", date: "2024-03-15", quantity: 15, costUsd: 172.5 }]);
});
