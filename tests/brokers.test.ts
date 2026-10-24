import test from "node:test";
import assert from "node:assert/strict";

import {
  BROKER_COLUMNS,
  BROKERS,
  commissionFor,
  danglingSources,
  scenarioRows,
  sourceNumbers,
} from "../content/brokers";

/**
 * Aracı kurum karşılaştırması: veri sözleşmesi ve senaryo hesabı. Beklenen
 * sayılar tarifelerden elle hesaplandı (kaynaklar content/brokers.ts'te).
 */

test("flat fee does not depend on the trade size", () => {
  assert.equal(commissionFor({ kind: "flat", usd: 1.5 }, 1_000), 1.5);
  assert.equal(commissionFor({ kind: "flat", usd: 1.5 }, 10_000), 1.5);
});

test("percent fee respects the minimum", () => {
  const qnb = { kind: "percent", pct: 0.2, minUsd: 25 } as const;
  assert.equal(commissionFor(qnb, 1_000), 25); // %0,2 = 2 $, asgari 25 $
  assert.equal(commissionFor(qnb, 12_500), 25); // eşik: tam asgari
  assert.equal(commissionFor(qnb, 20_000), 40);
  assert.equal(commissionFor({ kind: "percent", pct: 0.3, minUsd: 0 }, 1_000), 3);
});

test("per-share fee uses the assumed price, minimum and cap", () => {
  const gedik = { kind: "perShare", usd: 0.05, minUsd: 1 } as const;
  assert.equal(commissionFor(gedik, 1_000, 100), 1); // 10 adet → 0,50 $ → asgari 1 $
  assert.equal(commissionFor(gedik, 2_000, 100), 1); // 20 adet → tarifedeki "1-20 adet 1 USD"
  assert.equal(commissionFor(gedik, 3_000, 100), 1.5); // tarifedeki örnek: 30 × 0,05
  assert.equal(commissionFor(gedik, 10_000, 100), 5);

  const ibkr = { kind: "perShare", usd: 0.005, minUsd: 1, maxPctOfTrade: 1 } as const;
  assert.equal(commissionFor(ibkr, 10_000, 100), 1); // 100 adet → 0,50 $ → asgari 1 $
  assert.equal(commissionFor(ibkr, 50, 0.5), 0.5); // 100 adet ama tavan %1 = 0,50 $
});

test("an ambiguous tariff is never priced", () => {
  assert.equal(commissionFor({ kind: "none", reason: { tr: "x", en: "x" } }, 1_000), null);
  assert.equal(commissionFor({ kind: "flat", usd: 1 }, 0), null);
});

test("every broker fills every column and every source reference resolves", () => {
  for (const broker of BROKERS) {
    for (const column of BROKER_COLUMNS) assert.ok(broker.cells[column], `${broker.id}.${column}`);
  }
  assert.deepEqual(danglingSources(), []);
});

test("every stated value carries a source and every source a check date", () => {
  for (const broker of BROKERS) {
    for (const [column, cell] of Object.entries(broker.cells)) {
      if (cell.kind === "value") assert.ok(cell.src.length > 0, `${broker.id}.${column}`);
    }
    for (const [id, source] of Object.entries(broker.sources)) {
      assert.match(source.checked, /^\d{4}-\d{2}-\d{2}$/, `${broker.id}:${id}`);
      assert.match(source.url, /^https:\/\//, `${broker.id}:${id}`);
    }
  }
});

test("no source link carries a referral or tracking parameter", () => {
  for (const broker of BROKERS) {
    for (const source of Object.values(broker.sources)) {
      assert.doesNotMatch(source.url, /[?&](ref|aff|utm_|referral|promo)/i, source.url);
    }
  }
});

test("source numbers follow the broker's source order", () => {
  const midas = BROKERS.find((broker) => broker.id === "midas")!;
  assert.deepEqual(sourceNumbers(midas, ["fees", "spk"]), [1, 5]);
  assert.deepEqual(sourceNumbers(midas, ["missing"]), []);
});

test("scenario prices only the brokers with an unambiguous tariff", () => {
  const rows = scenarioRows();
  const fees = Object.fromEntries(rows.map((row) => [row.broker.id, row.fees]));
  assert.deepEqual(fees.midas, [1.5, 1.5]);
  assert.deepEqual(fees["is-yatirim"], [2.5, 25]);
  assert.deepEqual(fees["garanti-bbva-yatirim"], [3, 30]);
  assert.deepEqual(fees["qnb-invest"], [25, 25]);
  assert.deepEqual(fees.gedik, [1, 5]);
  assert.deepEqual(fees["interactive-brokers"], [1, 1]);
  assert.deepEqual(fees["yapi-kredi-yatirim"], [null, null]);
  assert.deepEqual(fees["info-yatirim"], [null, null]);
});
