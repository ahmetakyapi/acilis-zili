import test from "node:test";
import assert from "node:assert/strict";
import { DAY_FLOW_EARNINGS_MIN_CAP, hasReported, inDayFlow, splitEarningsToday } from "../lib/earnings-today-split";

const row = (symbol: string, epsActual: number | null = null, revenueActual: number | null = null) => ({ symbol, epsActual, revenueActual });
const caps: Record<string, number> = { CSCO: 271e9, TDG: 74.8e9, CRWV: 49.2e9, TPR: 25.3e9, FOXA: 22.4e9, AMCR: 13.1e9, SMOL: 2e9 };
const ctx = (over: Partial<Parameters<typeof splitEarningsToday>[1]> = {}) => ({
  sameDay: true,
  analyzed: new Set<string>(),
  watched: new Set<string>(),
  marketCap: (symbol: string) => caps[symbol],
  ...over,
});

test("akışa girme kuralı: analiz, takip, adla seçilen ya da eşiğin üstü", () => {
  const base = { analyzed: false, watched: false };
  assert.equal(inDayFlow({ ...base, symbol: "TDG", marketCap: DAY_FLOW_EARNINGS_MIN_CAP }), true);
  assert.equal(inDayFlow({ ...base, symbol: "TPR", marketCap: DAY_FLOW_EARNINGS_MIN_CAP - 1 }), false);
  assert.equal(inDayFlow({ ...base, symbol: "CRWV", marketCap: 49e9 }), true, "adla seçilen (spotlight) eşiği atlar");
  assert.equal(inDayFlow({ ...base, symbol: "SMOL", marketCap: null }), false, "piyasa değeri yoksa eşiğin altı sayılır");
  assert.equal(inDayFlow({ ...base, symbol: "SMOL", marketCap: null, watched: true }), true);
  assert.equal(inDayFlow({ ...base, symbol: "SMOL", marketCap: 1e9, analyzed: true }), true);
});

test("akışta duran ve sonucu bekleyen bilanço panelde tekrar edilmez", () => {
  const split = splitEarningsToday([row("CSCO"), row("TDG"), row("CRWV"), row("TPR"), row("FOXA")], ctx());
  assert.deepEqual(split.panel.map((r) => r.symbol), ["TPR", "FOXA"]);
  assert.deepEqual(split.inFlow.map((r) => r.symbol), ["CSCO", "TDG", "CRWV"], "künye piyasa değeri sırasıyla adlandırır");
});

test("sonucu gelen satır akışta olsa da panelde kalır ve öne çıkar", () => {
  const split = splitEarningsToday(
    [row("TPR"), row("CSCO", 1.04, 14.92e9), row("AMCR", 0.16), row("TDG"), row("FOXA", null, 0)],
    ctx(),
  );
  assert.deepEqual(split.panel.map((r) => r.symbol), ["CSCO", "FOXA", "AMCR", "TPR"], "sıfır gelir de gerçek sonuçtur");
  assert.deepEqual(split.inFlow.map((r) => r.symbol), ["TDG"]);
});

test("analizi yazılmış bilanço sonucu gelmiş sayılır", () => {
  assert.equal(hasReported(row("SMOL"), true), true);
  assert.equal(hasReported(row("SMOL"), false), false);
  const split = splitEarningsToday([row("SMOL"), row("TDG")], ctx({ analyzed: new Set(["TDG"]) }));
  assert.deepEqual(split.panel.map((r) => r.symbol), ["TDG", "SMOL"]);
  assert.equal(split.inFlow.length, 0);
});

test("takip listesindeki küçük şirket akışta olduğu için panelden düşer", () => {
  const split = splitEarningsToday([row("SMOL"), row("TPR")], ctx({ watched: new Set(["SMOL"]) }));
  assert.deepEqual(split.panel.map((r) => r.symbol), ["TPR"]);
  assert.deepEqual(split.inFlow.map((r) => r.symbol), ["SMOL"]);
});

test("panelin günü akışın günü değilse (hafta sonu) hiçbir şey süzülmez", () => {
  const split = splitEarningsToday([row("TPR"), row("CSCO"), row("TDG")], ctx({ sameDay: false }));
  assert.deepEqual(split.panel.map((r) => r.symbol), ["CSCO", "TDG", "TPR"]);
  assert.equal(split.inFlow.length, 0);
});

test("bütün satırlar akışta ve sonuç bekliyorsa panel boş kalır", () => {
  const split = splitEarningsToday([row("CSCO"), row("CRWV")], ctx());
  assert.equal(split.panel.length, 0);
  assert.equal(split.inFlow.length, 2);
});
