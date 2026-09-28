import test from "node:test";
import assert from "node:assert/strict";

import { parseArkCsv } from "../lib/providers/ark";
import { arkDay, flowFactor, fundTrades, type ArkHolding } from "../lib/ark-view";

const CSV = `date,fund,company,ticker,cusip,shares,market value ($),weight (%)
09/28/2026,ARKK,TESLA INC,TSLA,88160R101,"2,141,056","$796,708,348.16",9.12%
09/28/2026,ARKK,BRERA HOLDINGS PLC WTS,,BREADUMMY,"431,626","$936,627.77",0.01%
"Investors should carefully consider ... ""NAV"" ... written permission."`;

test("ARK CSV: tırnaklı sayılar, boş sembol ve yasal not", () => {
  const rows = parseArkCsv(CSV);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    asOf: "2026-09-28",
    fund: "ARKK",
    company: "TESLA INC",
    ticker: "TSLA",
    cusip: "88160R101",
    shares: 2141056,
    marketValue: 796708348.16,
    weight: 9.12,
  });
  assert.equal(rows[1].ticker, null);
});

function holding(cusip: string, shares: number, fund = "ARKK", price = 10): ArkHolding {
  return { fund, cusip, ticker: cusip, company: `${cusip} INC`, shares, marketValue: shares * price };
}

const BASE = ["A", "B", "C", "D", "E", "F"].map((cusip) => holding(cusip, 1000));

test("akış yoksa çarpan 1 ve yalnızca değişen pozisyon işlem", () => {
  const curr = BASE.map((row) => (row.cusip === "B" ? holding("B", 1200) : row));
  assert.equal(flowFactor(BASE, curr), 1);
  const trades = fundTrades(BASE, curr);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].shares, 200);
});

test("pay yaratma: hepsi %3 büyüdüyse alım yok, sapan tek pozisyon işlem", () => {
  const curr = BASE.map((row) => holding(row.cusip, row.cusip === "C" ? 900 : row.shares * 1.03));
  assert.ok(Math.abs(flowFactor(BASE, curr) - 1.03) < 1e-9);
  const trades = fundTrades(BASE, curr);
  assert.equal(trades.length, 1);
  assert.equal(trades[0].row.cusip, "C");
  assert.ok(trades[0].shares < 0);
});

test("yuvarlama gürültüsü işlem sayılmıyor", () => {
  const curr = BASE.map((row) => (row.cusip === "A" ? holding("A", 1001) : row));
  assert.equal(fundTrades(BASE, curr).length, 0);
});

test("yeni ve kapanan pozisyon; sembolsüz satır yok sayılıyor", () => {
  const cash = { ...holding("CASH", 50), ticker: null };
  const curr = [...BASE.filter((row) => row.cusip !== "F"), holding("G", 300), { ...cash, shares: 9000 }];
  const day = arkDay("2026-09-25", "2026-09-28", [...BASE, cash], curr);
  assert.equal(day.buys, 1);
  assert.equal(day.sells, 1);
  const g = day.trades.find((trade) => trade.cusip === "G");
  assert.ok(g?.opened);
  const f = day.trades.find((trade) => trade.cusip === "F");
  assert.ok(f?.closed);
  assert.equal(f?.direction, "sell");
});

test("fonlar birleşiyor; fonlar arası aktarım net sıfırsa düşüyor", () => {
  const prev = [...BASE, ...BASE.map((row) => ({ ...row, fund: "ARKW" }))];
  const curr = [
    ...BASE.map((row) => (row.cusip === "A" ? holding("A", 1500) : row.cusip === "B" ? holding("B", 1300) : row)),
    ...BASE.map((row) => ({ ...(row.cusip === "A" ? holding("A", 1200) : row.cusip === "B" ? holding("B", 700) : row), fund: "ARKW" })),
  ];
  const day = arkDay("d1", "d2", prev, curr);
  const a = day.trades.find((trade) => trade.cusip === "A");
  assert.equal(a?.shares, 700);
  assert.deepEqual(a?.funds, ["ARKK", "ARKW"]);
  assert.equal(day.trades.find((trade) => trade.cusip === "B"), undefined);
});
