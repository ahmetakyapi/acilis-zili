import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

import {
  aggregateHoldings,
  detectValueScale,
  infoTableName,
  parseCover,
  parseInfoTable,
  thirteenFFilings,
  type RawHolding,
} from "../lib/providers/sec-13f";
import { figiIdType, normalizeFigiTicker, parseFigiResponse } from "../lib/providers/openfigi";
import { isoFromUsDate, memberPtrs, parseAmountRange, parsePtrLines, readZipEntry } from "../lib/providers/house-ptr";
import {
  crowdMoves,
  detectSplit,
  diffPeriods,
  mergeHoldings,
  parseTradeDetail,
  planPeriods,
  topBuys,
  topSells,
  type FilingRecord,
  type HoldingRecord,
} from "../lib/investor-view";
import { pendingFilings } from "../lib/investor-sync";
import { INVESTORS, investorInitials } from "../lib/investors";

/**
 * Ünlü yatırımcılar: SEC 13F ayrıştırması, değer birimi tuzağı, dönem
 * kurma (düzeltmeler ve iki CIK), alım/satım farkı, Kongre PTR'si.
 * Fixture'lar gerçek dosyalardan kısaltıldı (28 Eylül); PDF depoda yok,
 * pdf.js'in ürettiği satırlar var.
 */

/* ---------------------------------------------------------------- 13F XML */

const PREFIXED_TABLE = `<?xml version="1.0" encoding="UTF-8"?>
<ns1:informationTable xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <ns1:infoTable>
    <ns1:nameOfIssuer>AMAZON COM INC</ns1:nameOfIssuer>
    <ns1:titleOfClass>COM</ns1:titleOfClass>
    <ns1:cusip>023135106</ns1:cusip>
    <ns1:value>892310</ns1:value>
    <ns1:shrsOrPrnAmt><ns1:sshPrnamt>3743854</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt>
  </ns1:infoTable>
  <ns1:infoTable>
    <ns1:nameOfIssuer>ALPHABET INC</ns1:nameOfIssuer>
    <ns1:titleOfClass>CAP STK CL C</ns1:titleOfClass>
    <ns1:cusip>02079K107</ns1:cusip>
    <ns1:value>484744</ns1:value>
    <ns1:shrsOrPrnAmt><ns1:sshPrnamt>1371931</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt>
  </ns1:infoTable>
</ns1:informationTable>`;

const PLAIN_TABLE = `<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <infoTable>
    <nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip>
    <value>40000000000</value><shrsOrPrnAmt><sshPrnamt>150000000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
    <otherManager>4</otherManager>
  </infoTable>
  <infoTable>
    <nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip>
    <value>26000000000</value><shrsOrPrnAmt><sshPrnamt>78000000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
    <otherManager>11</otherManager>
  </infoTable>
  <infoTable>
    <nameOfIssuer>PALANTIR TECHNOLOGIES INC</nameOfIssuer><titleOfClass>CL A</titleOfClass><cusip>69608A108</cusip>
    <value>912100000</value><shrsOrPrnAmt><sshPrnamt>5000000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
    <putCall>Put</putCall>
  </infoTable>
  <infoTable>
    <nameOfIssuer>AT&amp;T INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>00206R102</cusip>
    <value>2600000</value><shrsOrPrnAmt><sshPrnamt>100000</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
  </infoTable>
</informationTable>`;

test("info table parses with or without a namespace prefix", () => {
  const prefixed = parseInfoTable(PREFIXED_TABLE);
  assert.equal(prefixed.length, 2);
  assert.deepEqual(prefixed[0], {
    issuer: "AMAZON COM INC",
    titleOfClass: "COM",
    cusip: "023135106",
    value: 892310,
    amount: 3743854,
    amountType: "SH",
    putCall: null,
  });
  const plain = parseInfoTable(PLAIN_TABLE);
  assert.equal(plain.length, 4);
  assert.equal(plain[2].putCall, "put");
  assert.equal(plain[3].issuer, "AT&T INC");
});

test("value unit: thousands (Baupost) are detected per filing, dollars are left alone", () => {
  /* Baupost Q2 2026: AMZN 892.310 ÷ 3.743.854 = 0,238 — bin dolar. */
  assert.equal(detectValueScale(parseInfoTable(PREFIXED_TABLE)), 1000);
  assert.equal(detectValueScale(parseInfoTable(PLAIN_TABLE)), 1);
  assert.equal(detectValueScale([]), 1);
  /* Tahvil (PRN) satırı oranı bozmaz: anapara fiyat değil. */
  const bondsOnly: RawHolding[] = [
    { issuer: "X", titleOfClass: null, cusip: "1", value: 990, amount: 1000, amountType: "PRN", putCall: null },
  ];
  assert.equal(detectValueScale(bondsOnly), 1);
});

test("rows are summed per CUSIP and position type; options stay separate", () => {
  const holdings = aggregateHoldings(parseInfoTable(PLAIN_TABLE), 1);
  const apple = holdings.find((h) => h.cusip === "037833100")!;
  assert.equal(apple.amount, 228_000_000);
  assert.equal(apple.value, 66_000_000_000);
  assert.equal(holdings.find((h) => h.cusip === "69608A108")!.position, "put");
  assert.equal(holdings[0].cusip, "037833100", "sorted by value");
  const scaled = aggregateHoldings(parseInfoTable(PREFIXED_TABLE), 1000);
  assert.equal(scaled[0].value, 892_310_000);
});

test("cover page: period, amendment type and totals", () => {
  const cover = parseCover(`<edgarSubmission><headerData><filerInfo><periodOfReport>03-31-2025</periodOfReport></filerInfo></headerData>
    <formData><coverPage><amendmentInfo><amendmentType>NEW HOLDINGS</amendmentType></amendmentInfo></coverPage>
    <summaryPage><tableEntryTotal>4</tableEntryTotal><tableValueTotal>1106550356</tableValueTotal></summaryPage></formData></edgarSubmission>`);
  assert.deepEqual(cover, { period: "2025-03-31", amendment: "new-holdings", valueTotal: 1106550356, entryTotal: 4 });
  assert.equal(parseCover("<amendmentType>RESTATEMENT</amendmentType>").amendment, "restatement");
});

test("filing index: the info table is the XML that is not primary_doc", () => {
  assert.equal(
    infoTableName({ directory: { item: [{ name: "x-index.html" }, { name: "primary_doc.xml" }, { name: "BGLLCQ22026.xml" }] } }),
    "BGLLCQ22026.xml",
  );
  assert.equal(infoTableName({ directory: { item: [{ name: "primary_doc.xml" }] } }), null);
});

test("submissions: only 13F forms, newest first", () => {
  const refs = thirteenFFilings(1067983, {
    filings: {
      recent: {
        form: ["4", "13F-HR", "13F-HR/A", "13F-NT"],
        accessionNumber: ["a", "b", "c", "d"],
        filingDate: ["2026-09-01", "2026-05-15", "2026-08-14", "2026-08-14"],
        reportDate: ["2026-08-30", "2026-03-31", "2025-03-31", "2026-06-30"],
      },
    },
  });
  assert.deepEqual(refs.map((r) => r.accession), ["d", "c", "b"]);
});

/* ------------------------------------------------------------ dönem kurma */

function filing(partial: Partial<FilingRecord> & Pick<FilingRecord, "id" | "period">): FilingRecord {
  return { cik: 1, accession: partial.id, form: "13F-HR", amendment: null, filedAt: "2026-08-14", valueScaled: false, ...partial };
}

test("period plan: restatement replaces, new holdings are added, unknown amendments ignored", () => {
  const plans = planPeriods(
    [
      filing({ id: "q1", period: "2025-03-31", filedAt: "2025-05-15" }),
      filing({ id: "q1nh", period: "2025-03-31", filedAt: "2025-08-14", form: "13F-HR/A", amendment: "new-holdings" }),
      filing({ id: "q4", period: "2024-12-31", filedAt: "2025-02-14" }),
      filing({ id: "q4r", period: "2024-12-31", filedAt: "2025-03-01", form: "13F-HR/A", amendment: "restatement" }),
      filing({ id: "q4x", period: "2024-12-31", filedAt: "2025-04-01", form: "13F-HR/A", amendment: "unknown" }),
    ],
    [1],
  );
  assert.deepEqual(plans.map((p) => p.period), ["2025-03-31", "2024-12-31"]);
  assert.equal(plans[0].base.id, "q1");
  assert.deepEqual(plans[0].additions.map((f) => f.id), ["q1nh"]);
  assert.equal(plans[0].filedAt, "2025-08-14");
  assert.equal(plans[1].base.id, "q4r");
  assert.equal(plans[1].additions.length, 0);
});

test("period plan: CIK order decides overlapping periods (Ackman)", () => {
  const ackman = INVESTORS.find((i) => i.slug === "bill-ackman")!;
  const [oldCik, newCik] = ackman.ciks;
  const plans = planPeriods(
    [
      filing({ id: "old-q1", cik: oldCik, period: "2026-03-31" }),
      filing({ id: "new-q1", cik: newCik, period: "2026-03-31" }),
      filing({ id: "new-q2", cik: newCik, period: "2026-06-30" }),
    ],
    ackman.ciks,
  );
  assert.equal(plans.find((p) => p.period === "2026-03-31")!.base.id, "old-q1");
  assert.equal(plans.find((p) => p.period === "2026-06-30")!.base.id, "new-q2");
});

test("pending filings: last N periods, preferred CIK only, skips known accessions", () => {
  const pending = pendingFilings(
    { ciks: [10, 20] },
    [
      { cik: 10, accession: "a", form: "13F-HR", filedAt: "2026-05-15", period: "2026-03-31" },
      { cik: 20, accession: "b", form: "13F-HR", filedAt: "2026-05-15", period: "2026-03-31" },
      { cik: 20, accession: "c", form: "13F-HR", filedAt: "2026-08-14", period: "2026-06-30" },
      { cik: 10, accession: "d", form: "13F-NT", filedAt: "2026-08-14", period: "2026-06-30" },
      { cik: 10, accession: "e", form: "13F-HR", filedAt: "2025-02-14", period: "2024-12-31" },
    ],
    new Set(["e"]),
    2,
  );
  assert.deepEqual(pending.map((r) => r.accession), ["c", "a"]);
});

/* ------------------------------------------------------------ alım/satım */

function holding(cusip: string, amount: number, value: number, extra: Partial<HoldingRecord> = {}): HoldingRecord {
  return { cusip, position: "long", issuer: cusip, titleOfClass: "COM", amount, amountType: "SH", value, ...extra };
}

test("diff: new, increased, decreased, sold out and unchanged by SHARE COUNT", () => {
  const previous = [holding("A", 100, 1000), holding("B", 100, 1000), holding("C", 100, 1000), holding("D", 100, 1000)];
  const current = [
    holding("A", 100, 1300), // fiyat arttı, adet aynı → aynı
    holding("B", 150, 1500),
    holding("C", 50, 500),
    holding("E", 10, 200),
    holding("P", 5, 9000, { position: "put" }),
  ];
  const diff = diffPeriods(current, previous);
  const move = (cusip: string) => diff.positions.find((p) => p.cusip === cusip)!.move;
  assert.equal(move("A"), "unchanged");
  assert.equal(move("B"), "increased");
  assert.equal(move("C"), "decreased");
  assert.equal(move("E"), "new");
  assert.deepEqual(diff.sold.map((s) => s.cusip), ["D"]);
  assert.deepEqual(diff.counts, { new: 1, increased: 1, decreased: 1, soldOut: 1 });
  assert.equal(diff.options.length, 1, "options are listed apart");
  assert.equal(diff.longValue, 3500, "options stay out of the stock portfolio");
  assert.equal(diff.optionValue, 9000);
  assert.ok(Math.abs(diff.positions.reduce((sum, p) => sum + p.weight, 0) - 1) < 1e-9);
  assert.equal(diff.positions.find((p) => p.cusip === "B")!.changePct, 50);
});

test("diff without a previous period does not invent moves", () => {
  const diff = diffPeriods([holding("A", 1, 1)], null);
  assert.equal(diff.compared, false);
  assert.equal(diff.positions[0].move, null);
  assert.equal(diff.sold.length, 0);
});

test("a stock split is not a purchase", () => {
  /* NVDA 10'a bölündü: adet 10 katı, hisse başı değer onda biri. */
  assert.equal(detectSplit(holding("N", 100, 100_000), holding("N", 1000, 110_000)), 10);
  assert.equal(detectSplit(holding("N", 100, 100_000), holding("N", 250, 260_000)), null, "a real buy");
  const diff = diffPeriods([holding("N", 1000, 110_000)], [holding("N", 100, 100_000)]);
  assert.equal(diff.positions[0].move, "unchanged");
  assert.equal(diff.positions[0].split, 10);
});

test("merged period holdings add up amendments", () => {
  const merged = mergeHoldings([[holding("A", 1, 10)], [holding("A", 2, 20), holding("B", 1, 5)]]);
  assert.deepEqual(merged.map((h) => [h.cusip, h.amount, h.value]), [["A", 3, 30], ["B", 1, 5]]);
});

test("crowd moves group by ticker and need two investors", () => {
  const prev = [holding("M1", 10, 10), holding("X", 10, 10)];
  const a = diffPeriods([holding("M1", 20, 20), holding("N", 1, 1)], prev);
  const b = diffPeriods([holding("M2", 5, 5)], prev);
  const tickers: Record<string, string> = { M1: "META", M2: "META", N: "NEW", X: "OLD" };
  const crowd = crowdMoves([{ slug: "a", diff: a }, { slug: "b", diff: b }], (c) => tickers[c] ?? null);
  const meta = crowd.find((e) => e.key === "META")!;
  assert.deepEqual([meta.added, meta.opened], [["a"], ["b"]]);
  assert.deepEqual(topBuys(crowd, 5).map((e) => e.key), ["META"]);
  assert.deepEqual(topSells(crowd, 5).map((e) => e.key), ["OLD"]);
});

/* ------------------------------------------------------------ OpenFIGI */

test("OpenFIGI: class separator and CINS ids", () => {
  assert.equal(normalizeFigiTicker("BRK/B"), "BRK.B");
  assert.equal(normalizeFigiTicker(""), null);
  assert.equal(figiIdType("G0403H108"), "ID_CINS");
  assert.equal(figiIdType("093712107"), "ID_CUSIP");
  const matches = parseFigiResponse(["093712107", "000000000"], [
    { data: [{ figi: "BBG000N7KBZ3", ticker: "BE", name: "BLOOM ENERGY CORP- A", securityType: "Common Stock" }] },
    { warning: "No identifier found." },
  ]);
  assert.equal(matches[0].ticker, "BE");
  assert.equal(matches[1].ticker, null, "no invented ticker");
});

/* ------------------------------------------------------------ Kongre */

test("zip reader extracts a deflated entry without dependencies", () => {
  const content = Buffer.from("<FinancialDisclosure><Member><Last>Pelosi</Last></Member></FinancialDisclosure>");
  const deflated = deflateRawSync(content);
  const name = Buffer.from("2026FD.xml");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + name.length + deflated.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  const zip = new Uint8Array(Buffer.concat([local, name, deflated, central, name, end]));
  assert.equal(new TextDecoder().decode(readZipEntry(zip, "2026FD.xml")!), content.toString());
  assert.equal(readZipEntry(zip, "yok.xml"), null);
});

test("member index keeps only the member's PTRs", () => {
  const xml = `<FinancialDisclosure>
    <Member><Last>Pelosi</Last><First>Nancy</First><FilingType>P</FilingType><Year>2026</Year><FilingDate>8/21/2026</FilingDate><DocID>20035143</DocID></Member>
    <Member><Last>Pelosi</Last><First>Nancy</First><FilingType>O</FilingType><Year>2026</Year><FilingDate>5/15/2026</FilingDate><DocID>10075701</DocID></Member>
    <Member><Last>Smith</Last><First>Adam</First><FilingType>P</FilingType><Year>2026</Year><FilingDate>1/2/2026</FilingDate><DocID>1</DocID></Member>
  </FinancialDisclosure>`;
  assert.deepEqual(memberPtrs(xml, { last: "Pelosi", first: "Nancy" }), [
    { docId: "20035143", filedAt: "2026-08-21", year: 2026 },
  ]);
  assert.equal(isoFromUsDate("6/17/27"), "2027-06-17");
});

/* pdf.js'in 20035143 numaralı PTR'den ürettiği satırlar (sekmeyle sekiz
   sütun). Etiketlerin düşen harfleri gerçekte NUL karakteri olarak geliyor;
   ilk kayıttaki "F…S" satırı onu sınıyor. */
const PTR_LINES = [
  "ID\tOwner\tAsset\tTransaction\tDate\tNotification\tAmount\tCap.",
  "\t\t\tType\t\tDate\t\tGains >",
  "\t\t\t\t\t\t\t$200?",
  "\tSP\tBloom Energy Corporation Class A\tP\t07/24/2026\t07/24/2026\t$1,000,001 -\t",
  "\t\tCommon Stock (BE) [ST]\t\t\t\t$5,000,000\t",
  "\t\tF\u0000\u0000\u0000\u0000 S\u0000\u0000\u0000: New\t\t\t\t\t",
  "\t\tD : Purchased 10,000 shares.\t\t\t\t\t",
  "\tSP\tBloom Energy Corporation Class A\tP\t07/24/2026\t07/24/2026\t$1,000,001 -\t",
  "\t\tCommon Stock (BE) [OP]\t\t\t\t$5,000,000\t",
  "\t\tF S : New\t\t\t\t\t",
  "\t\tD : Purchased 100 call options with a strike price of $100 and an expiration date of 6/17/27.\t\t\t\t\t",
  "\tSP\tIntel Corporation - Common Stock\tP\t07/24/2026\t07/24/2026\t$250,001 -\t",
  "\t\t(INTC) [OP]\t\t\t\t$500,000\t",
  "\t\tF S : New\t\t\t\t\t",
  "\t\tD : Purchased 50 call options with a strike price of $50 and an expiration date of 6/17/27.\t\t\t\t\t",
  /* Sayfa geçişi kaydın ortasına düşüyor (20033725): başlık tekrar eder,
     varlık adının devamı yeni sayfada gelir. */
  "\tSP\tTempus AI, Inc. - Class A Common\tS (partial)\t01/16/2026\t01/16/2026\t$50,001 -\t",
  "ID\tOwner\tAsset\tTransaction\tDate\tNotification\tAmount\tCap.",
  "\t\t\tType\t\tDate\t\tGains >",
  "\t\t\t\t\t\t\t$200?",
  "\t\tStock (TEM) [ST]\t\t\t\t$100,000\t",
  "\t\tF S : New\t\t\t\t\t",
  "\t\tD : Exercised 50 call options purchased 1/14/25 (5,000 shares) at a strike price of $20 with an expiration date of\t\t\t\t\t",
  "\t\t1/16/26.\t\t\t\t\t",
  "\t\tREOF XXV, LLC [AB]\tE\t07/27/2026\t\t$15.00\t",
  "* For the complete list of asset type abbreviations, please visit https://fd.house.gov/reference/asset-type-codes.aspx.\t\t\t\t\t\t\t",
  "\tSP\tNot A Trade\tP\t07/30/2026\t07/30/2026\t$1,001 - $15,000\t",
];

test("PTR lines become trades with ranges, owner, ticker and both dates", () => {
  const trades = parsePtrLines(PTR_LINES);
  assert.equal(trades.length, 5, "stops at the asset-type footnote");
  assert.deepEqual(trades[0], {
    rowNo: 1,
    owner: "SP",
    asset: "Bloom Energy Corporation Class A Common Stock",
    ticker: "BE",
    assetType: "ST",
    txType: "P",
    txDate: "2026-07-24",
    notifiedDate: "2026-07-24",
    amountLow: 1_000_001,
    amountHigh: 5_000_000,
    description: "Purchased 10,000 shares.",
  });
  assert.equal(trades[1].assetType, "OP");
  assert.equal(trades[2].ticker, "INTC");
  assert.equal(trades[2].amountHigh, 500_000);
  assert.equal(trades[3].txType, "S (partial)");
  assert.equal(trades[3].ticker, "TEM");
  assert.equal(trades[3].amountHigh, 100_000);
  assert.match(trades[3].description!, /expiration date of 1\/16\/26\.$/);
  assert.equal(trades[4].owner, null);
  assert.equal(trades[4].amountLow, null, "an exchange has no amount range");
});

test("amount ranges are never collapsed into a single number", () => {
  assert.deepEqual(parseAmountRange("$1,000,001 - $5,000,000"), { low: 1_000_001, high: 5_000_000 });
  assert.deepEqual(parseAmountRange("Over $50,000,000"), { low: 50_000_000, high: null });
  assert.deepEqual(parseAmountRange("$15.00"), { low: null, high: null });
});

test("trade descriptions: options, exercises and share counts", () => {
  assert.deepEqual(parseTradeDetail("Purchased 100 call options with a strike price of $100 and an expiration date of 6/17/27."), {
    kind: "options",
    contracts: 100,
    right: "call",
    strike: 100,
    expiry: "2027-06-17",
  });
  assert.deepEqual(
    parseTradeDetail("Exercised 50 call options purchased 1/14/25 (5,000 shares) at a strike price of $150 with an expiration date of 1/16/26."),
    { kind: "exercise", contracts: 50, right: "call", shares: 5000, strike: 150 },
  );
  assert.deepEqual(parseTradeDetail("Sold 20,000 shares."), { kind: "shares", side: "sell", shares: 20000 });
  assert.equal(parseTradeDetail("Contribution of 7,704 shares to Donor-Advised Fund.")!.kind, "other");
  assert.equal(parseTradeDetail(null), null);
});

/* ------------------------------------------------------------ liste */

test("roster: unique slugs, 13F investors carry CIKs, Burry is closed", () => {
  const slugs = INVESTORS.map((i) => i.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const investor of INVESTORS) {
    if (investor.kind === "13f") assert.ok(investor.ciks.length > 0, investor.slug);
    else assert.ok(investor.house, investor.slug);
  }
  assert.equal(INVESTORS.find((i) => i.slug === "michael-burry")!.status, "closed");
  assert.equal(investorInitials("Stanley Druckenmiller"), "SD");
  assert.equal(investorInitials("Li Lu"), "LL");
});

test("fillParts: değeri boş yer tutucunun parçası düşüyor", async () => {
  const { fillParts } = await import("../components/investors/format");
  const tpl = "{contracts} Kontrat {right} Kullanıldı · {shares} Hisse · Kullanım {strike}";
  assert.equal(
    fillParts(tpl, { contracts: "20", right: "Alım", shares: "", strike: "" }),
    "20 Kontrat Alım Kullanıldı",
  );
  assert.equal(
    fillParts(tpl, { contracts: "20", right: "Alım", shares: "2.000", strike: "$50" }),
    "20 Kontrat Alım Kullanıldı · 2.000 Hisse · Kullanım $50",
  );
});
