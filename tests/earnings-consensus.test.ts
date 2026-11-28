import assert from "node:assert/strict";
import { test } from "node:test";
import { analysisForQuarter, reconcileEps, recordedEstimate } from "../lib/earnings-consensus";
import { epsSurprise, formatEpsSurprise } from "../components/stock/past-quarters";

/* Canlıdaki çelişki (28 Kasım): Dell 3Ç FY2027 sağlayıcıda 9,45 / 6,75
   (+%40,1), analiz kaydında 9,45 · %44,1. */
const dell3 = { period: "3c-fy2027", reportDate: "2026-11-24", eps: 9.45, epsSurprisePct: 44.1 };
const dell2 = { period: "2c-fy2027", reportDate: "2026-08-28", eps: 7.04, epsSurprisePct: 43.0 };

test("beklenti kayıttan geri çözülür ve sapma kaydınkiyle aynı yazılır", () => {
  const estimate = recordedEstimate(9.45, 44.1);
  assert.ok(estimate !== null);
  assert.equal(estimate.toFixed(2), "6.56");
  const surprise = epsSurprise(estimate, 9.45);
  assert.ok(surprise);
  assert.equal(formatEpsSurprise(surprise, "tr", true).replace(/\s/g, " "), "+ %44,1".replace(/\s/g, " "));
});

test("çözülemeyen kayıt beklenti üretmez", () => {
  assert.equal(recordedEstimate(null, 10), null);
  assert.equal(recordedEstimate(1, null), null);
  assert.equal(recordedEstimate(1, -100), null);
  assert.equal(recordedEstimate(-0.4, 20), null);
  assert.equal(recordedEstimate(1, Number.NaN), null);
});

test("çeyreğin analizi mali çeyrekle, yoksa rapor gününe yakınlıkla bulunur", () => {
  const rows = [dell3, dell2];
  assert.equal(analysisForQuarter(rows, { fiscal: { year: 2027, quarter: 2 } }), dell2);
  assert.equal(analysisForQuarter(rows, { reportDate: "2026-11-25" }), dell3);
  assert.equal(analysisForQuarter(rows, { reportDate: "2026-11-30" }), null);
  assert.equal(analysisForQuarter(rows, { fiscal: { year: 2026, quarter: 4 }, reportDate: null }), null);
});

test("analiz varsa çift kayıttan, yoksa sağlayıcıdan", () => {
  const provider = { epsActual: 9.45, epsEstimate: 6.75 };
  const fromAnalysis = reconcileEps(provider, dell3);
  assert.equal(fromAnalysis.source, "analysis");
  assert.equal(fromAnalysis.epsActual, 9.45);
  assert.equal(fromAnalysis.epsEstimate?.toFixed(2), "6.56");
  assert.deepEqual(reconcileEps(provider, null), { ...provider, source: "provider" });
  assert.deepEqual(reconcileEps(provider, { ...dell3, epsSurprisePct: null }), { ...provider, source: "provider" });
});
