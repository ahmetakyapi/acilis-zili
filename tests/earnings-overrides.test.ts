import test from "node:test";
import assert from "node:assert/strict";
import { judgeOverride, mergeEarnings, type OverrideRow } from "../lib/earnings-overrides";

const TODAY = "2026-10-13";
const override = (patch: Partial<OverrideRow>): OverrideRow => ({
  id: "o1",
  symbol: "NVDA",
  reportDate: "2026-11-18",
  timing: "amc",
  sourceUrl: "https://investor.nvidia.com/",
  status: "active",
  closedReason: null,
  providerDate: null,
  providerHour: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  closedAt: null,
  ...patch,
});

test("sağlayıcıda kayıt yoksa açık kalır", () => {
  assert.equal(judgeOverride(override({}), [], TODAY).status, "active");
});

test("aynı tarih ve pencere → kapanır", () => {
  const verdict = judgeOverride(override({}), [{ reportDate: "2026-11-18", hour: "amc" }], TODAY);
  assert.equal(verdict.status, "closed");
  assert.equal(verdict.closedReason, "provider-match");
});

test("aynı tarih, pencere boş → açık kalır (pencereyi taşıyan elle kayıt)", () => {
  assert.equal(judgeOverride(override({}), [{ reportDate: "2026-11-18", hour: null }], TODAY).status, "active");
});

test("farklı tarih ya da pencere → çelişki", () => {
  assert.equal(judgeOverride(override({}), [{ reportDate: "2026-11-25", hour: "amc" }], TODAY).status, "conflict");
  assert.equal(judgeOverride(override({}), [{ reportDate: "2026-11-18", hour: "bmo" }], TODAY).status, "conflict");
});

test("bir sonraki çeyreğin satırı aynı rapor sayılmaz", () => {
  assert.equal(judgeOverride(override({}), [{ reportDate: "2027-02-24", hour: "amc" }], TODAY).status, "active");
});

test("yedi günden eski kayıt kapanır", () => {
  const verdict = judgeOverride(override({ reportDate: "2026-10-01" }), [], TODAY);
  assert.equal(verdict.closedReason, "past");
});

type Row = { symbol: string; reportDate: string; hour: string | null; epsEstimate: number | null };
const synth = (o: OverrideRow): Row => ({ symbol: o.symbol, reportDate: o.reportDate, hour: o.timing, epsEstimate: null });

test("birleştirme: elle kayıt öne geçer, eski sağlayıcı satırı düşer", () => {
  const provider: Row[] = [
    { symbol: "NVDA", reportDate: "2026-11-25", hour: null, epsEstimate: 1.2 },
    { symbol: "MU", reportDate: "2026-11-20", hour: "amc", epsEstimate: 3 },
  ];
  const merged = mergeEarnings(provider, [override({ status: "conflict", providerDate: "2026-11-25" })], { from: "2026-10-13", to: "2026-11-30" }, synth);
  assert.deepEqual(merged.map((row) => [row.symbol, row.reportDate, row.hour, row.dateSource]), [
    ["NVDA", "2026-11-18", "amc", "manual"],
    ["MU", "2026-11-20", "amc", "provider"],
  ]);
  assert.equal(merged[0].conflict?.providerDate, "2026-11-25");
});

test("birleştirme: aynı günlü sağlayıcı satırının beklentisi korunur, pencere elle kayıttan", () => {
  const provider: Row[] = [{ symbol: "NVDA", reportDate: "2026-11-18", hour: null, epsEstimate: 1.2 }];
  const [row] = mergeEarnings(provider, [override({})], { from: "2026-11-01", to: "2026-11-30" }, synth);
  assert.equal(row.epsEstimate, 1.2);
  assert.equal(row.hour, "amc");
  assert.equal(row.dateSource, "manual");
});

test("birleştirme: aralık dışına taşınan rapor aralıktaki eski satırı düşürür", () => {
  const provider: Row[] = [{ symbol: "NVDA", reportDate: "2026-11-25", hour: null, epsEstimate: null }];
  const merged = mergeEarnings(provider, [override({ reportDate: "2026-12-02" })], { from: "2026-11-23", to: "2026-11-27" }, synth);
  assert.equal(merged.length, 0);
});

test("birleştirme: kapalı kayıt yok sayılır", () => {
  const provider: Row[] = [{ symbol: "NVDA", reportDate: "2026-11-25", hour: "amc", epsEstimate: null }];
  const merged = mergeEarnings(provider, [override({ status: "closed" })], { from: "2026-11-01", to: "2026-11-30" }, synth);
  assert.equal(merged[0].dateSource, "provider");
});
