import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { BROKERS, commissionFor } from "../content/brokers";
import {
  CURVE_RANGE,
  crossSentence,
  dodgeLabels,
  dodgeSpans,
  feeCurves,
  leaderSegments,
  logGrid,
  MONTHS,
  yearlyCosts,
} from "../lib/broker-board";
import { BROKER_BRANDS, brandVars } from "../lib/broker-brand";

test("logGrid uçları tutar ve artan sırada", () => {
  const grid = logGrid(100, 50_000, 97);
  assert.equal(grid.length, 97);
  assert.ok(Math.abs(grid[0] - 100) < 1e-9);
  assert.ok(Math.abs(grid[96] - 50_000) < 1e-6);
  for (let i = 1; i < grid.length; i++) assert.ok(grid[i] > grid[i - 1]);
  assert.deepEqual(logGrid(5, 10, 1), [5]);
});

test("feeCurves: tarifesinden komisyon çıkmayan kurum eğriye girmez", () => {
  const curves = feeCurves(BROKERS, logGrid(...CURVE_RANGE, 9));
  const none = BROKERS.filter((b) => b.commission.kind === "none").map((b) => b.id);
  assert.ok(none.length > 0);
  for (const id of none) assert.ok(!curves.some((c) => c.id === id));
  for (const curve of curves) assert.equal(curve.points.length, 9);
});

test("leaderSegments: aralığı boşluksuz kaplar, uçlar Garanti ve Midas", () => {
  const segments = leaderSegments(BROKERS);
  assert.ok(segments.length >= 2);
  assert.ok(Math.abs(segments[0].from - CURVE_RANGE[0]) < 1e-9);
  assert.ok(Math.abs(segments[segments.length - 1].to - CURVE_RANGE[1]) < 1e-6);
  for (let i = 1; i < segments.length; i++) assert.equal(segments[i].from, segments[i - 1].to);
  assert.deepEqual(segments[0].ids, ["garanti-bbva-yatirim"]);
  assert.ok(Math.abs(segments[0].to - 1000 / 3) < 0.05, `Garanti sınırı ${segments[0].to}`);
  assert.deepEqual(segments[segments.length - 1].ids, ["midas"]);
  assert.ok(Math.abs(segments[segments.length - 1].from - 30_000) < 1, "Midas sınırı 30.000 $");
});

test("leaderSegments: her dilimin ortasında lider gerçekten en ucuz", () => {
  for (const seg of leaderSegments(BROKERS)) {
    const mid = Math.sqrt(seg.from * seg.to);
    const fees = BROKERS.map((b) => [b.id, commissionFor(b.commission, mid)] as const).filter(
      (entry): entry is readonly [string, number] => entry[1] !== null,
    );
    const min = Math.min(...fees.map(([, fee]) => fee));
    for (const id of seg.ids) {
      const fee = fees.find(([other]) => other === id)?.[1];
      assert.ok(fee !== undefined && fee - min < 0.005, `${id} @ ${mid.toFixed(0)}`);
    }
  }
});

test("leaderSegments: kuruş izi dilim olarak kalmaz", () => {
  const span = Math.log(CURVE_RANGE[1]) - Math.log(CURVE_RANGE[0]);
  for (const seg of leaderSegments(BROKERS)) {
    assert.ok((Math.log(seg.to) - Math.log(seg.from)) / span >= 0.015, `${seg.from}–${seg.to}`);
  }
});

test("crossSentence: tek dilimde 'same', çok dilimde ilk ve son", () => {
  const money = (v: number) => `$${Math.round(v)}`;
  const names = (ids: readonly string[]) => ids.join("+");
  const t = { same: "{lo}-{hi}:{first}", change: "<{to}:{first} >{from}:{last}" };
  assert.equal(crossSentence([], names, money, t), null);
  assert.equal(crossSentence([{ from: 100, to: 500, ids: ["a"] }], names, money, t), "$100-$500:a");
  assert.equal(
    crossSentence(
      [
        { from: 100, to: 300, ids: ["a"] },
        { from: 300, to: 900, ids: ["b", "c"] },
        { from: 900, to: 5000, ids: ["d"] },
      ],
      names,
      money,
      t,
    ),
    "<$300:a >$900:d",
  );
});

test("yearlyCosts: komisyon = ücret × ayda alım × 12; sıra bilinen toplama göre", () => {
  const amount = 1000;
  for (const perMonth of [1, 4, 10]) {
    const rows = yearlyCosts(BROKERS, amount, perMonth);
    for (const row of rows) {
      const broker = BROKERS.find((b) => b.id === row.id);
      assert.ok(broker);
      const fee = commissionFor(broker.commission, amount);
      assert.ok(fee !== null);
      assert.ok(Math.abs(row.commission - fee * perMonth * MONTHS) < 0.006);
      assert.ok(Math.abs(row.total - (row.commission + (row.custody ?? 0))) < 0.006);
    }
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i].total >= rows[i - 1].total);
      if (Math.abs(rows[i].total - rows[i - 1].total) < 0.005) assert.equal(rows[i].rank, rows[i - 1].rank);
      else assert.equal(rows[i].rank, i + 1);
    }
  }
});

test("yearlyCosts: saklama: ücretsiz sıfır, bilinmeyen sıfır sayılmaz, avro asgarisi dolara çevrilmez", () => {
  const rows = yearlyCosts(BROKERS, 1000, 1);
  for (const row of rows) {
    const model = BROKERS.find((b) => b.id === row.id)?.custodyModel;
    assert.ok(model);
    if (model.kind === "free") {
      assert.equal(row.custody, 0);
      assert.equal(row.custodyFree, true);
    } else {
      assert.equal(row.custodyFree, false);
    }
    if (model.kind === "unknown") assert.equal(row.custody, null);
  }
  const qnb = rows.find((row) => row.id === "qnb-invest");
  assert.ok(qnb);
  assert.equal(qnb.custody, null);
  assert.equal(qnb.custodyFloorEurMonth, 6);
});

test("yearlyCosts: yıllık oran ay sonu bakiyelerinden (1+…+12 = 78 ay-tutar)", () => {
  const amount = 1000;
  const perMonth = 1;
  for (const row of yearlyCosts(BROKERS, amount, perMonth)) {
    const model = BROKERS.find((b) => b.id === row.id)?.custodyModel;
    if (model?.kind !== "pctYear" || model.floorEurMonth !== undefined) continue;
    const expected = Math.round(((amount * 78 * model.pct) / 100 / 12) * 100) / 100;
    assert.equal(row.custody, expected);
  }
});

test("dodgeLabels: en az aralık, sınır içinde, sıra korunur", () => {
  const out = dodgeLabels([50, 52, 51, 200, 199], 20, 0, 210);
  const sorted = [...out].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= 20 - 1e-9);
  for (const y of out) assert.ok(y >= 0 && y <= 210);
  assert.ok(out[0] < out[2] && out[2] < out[1], "eşit olmayan hedeflerde sıra korunur");
  assert.ok(out[4] < out[3]);
  assert.deepEqual(dodgeLabels([], 10, 0, 100), []);
});

test("dodgeSpans: kümeler kendi enleriyle çakışmaz, sınır içinde, sıra korunur", () => {
  const widths = [20, 20, 34, 20, 20];
  const out = dodgeSpans([10, 30, 32, 120, 196], widths, 4, 0, 200);
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i] - widths[i] / 2 - (out[i - 1] + widths[i - 1] / 2) >= 4 - 1e-9, `küme ${i} çakışıyor`);
  }
  out.forEach((c, i) => assert.ok(c - widths[i] / 2 >= -1e-9 && c + widths[i] / 2 <= 200 + 1e-9));
  /* Yer varken kıpırdamaz. */
  assert.deepEqual(dodgeSpans([50, 150], [20, 20], 4, 0, 200), [50, 150]);
  assert.deepEqual(dodgeSpans([], [], 4, 0, 100), []);
});

test("marka kaydı: her kurumun logosu depoda, iki temalı rengi ve kaynağı var", () => {
  for (const broker of BROKERS) {
    const brand = BROKER_BRANDS[broker.id];
    assert.ok(brand, `${broker.id} marka kaydı yok`);
    assert.ok(existsSync(join(process.cwd(), "public", brand.logo)), `${brand.logo} yok`);
    assert.match(brand.color.light, /^#[0-9a-f]{6}$/);
    assert.match(brand.color.dark, /^#[0-9a-f]{6}$/);
    assert.match(brand.source.page, /^https:\/\//);
    assert.match(brand.source.downloaded, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(brandVars("yok-boyle-kurum"), undefined);
  assert.deepEqual(Object.keys(brandVars("midas") ?? {}), ["--brand-l", "--brand-d"]);
});
