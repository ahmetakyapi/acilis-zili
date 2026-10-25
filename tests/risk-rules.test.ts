import test from "node:test";
import assert from "node:assert/strict";

import { adviceMatches } from "../lib/advice-guard";
import { riskDeskEn, riskDeskTr } from "../lib/i18n/dictionaries/risk-desk";
import {
  RULE_PRESETS,
  RuleInputSchema,
  describeCondition,
  describeRule,
  evaluateRule,
  type ConditionLabels,
  type MarketFacts,
  type PositionFacts,
} from "../lib/risk/rules";

const market: MarketFacts = {
  regime: "riskOff",
  vix: 27.4,
  vxn: 31,
  termRatio: 1.04,
  breadth: 38,
  creditChange: 0.6,
  spyBelow: { 50: true, 100: true, 200: false },
  spyCrossedBelow: { 100: true, 200: false },
  spyCross: null,
};

const pos = (symbol: string, over: Partial<PositionFacts> = {}): PositionFacts => ({
  symbol,
  beta: 1,
  atrPct: 2,
  volPctile: 50,
  below: { 50: false, 100: false, 200: false },
  crossedBelow: { 100: false, 200: false },
  cross: null,
  ...over,
});

test("piyasa koşulları", () => {
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "vixAbove", value: 25 }] }, market, []).triggered, true);
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "vixAbove", value: 30 }] }, market, []).triggered, false);
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "termAbove", value: 1 }] }, market, []).triggered, true);
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "regime", regime: "cautious" }] }, market, []).triggered, true, "Temkinli ya da daha kötü");
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "spyCrossBelowMa", window: 100 }] }, market, []).triggered, true);
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "spyBelowMa", window: 200 }] }, market, []).triggered, false);
});

test("pozisyon koşullarını AYNI pozisyon sağlamalı", () => {
  const positions = [pos("NVDA", { beta: 1.8 }), pos("KO", { below: { 50: true, 100: true, 200: true } })];
  const rule = { symbol: null, conditions: [{ kind: "betaAbove" as const, value: 1.3 }, { kind: "belowMa" as const, window: 200 as const }] };
  assert.deepEqual(evaluateRule(rule, market, positions), { triggered: false, symbols: [] });
  const one = { symbol: null, conditions: [{ kind: "regime" as const, regime: "riskOff" as const }, { kind: "betaAbove" as const, value: 1.3 }] };
  assert.deepEqual(evaluateRule(one, market, positions), { triggered: true, symbols: ["NVDA"] });
  assert.equal(evaluateRule({ ...one, symbol: "KO" }, market, positions).triggered, false, "sembole bağlı kural");
});

test("okunamayan ölçü tetiklemez", () => {
  const blind: MarketFacts = { ...market, vix: null, regime: null };
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "vixAbove", value: 10 }] }, blind, []).triggered, false);
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "regime", regime: "cautious" }] }, blind, []).triggered, false);
  assert.equal(evaluateRule({ symbol: null, conditions: [{ kind: "betaAbove", value: 0 }] }, market, [pos("X", { beta: null })]).triggered, false);
});

test("şema: etiket kullanıcının, en çok üç koşul, eşikler sınırlı", () => {
  const ok = RuleInputSchema.safeParse({ label: "Sat Uyarısı", tone: "sell", symbol: "nvda", conditions: [{ kind: "vixAbove", value: 25 }] });
  assert.ok(ok.success);
  assert.equal(ok.success && ok.data.symbol, "NVDA");
  assert.equal(RuleInputSchema.safeParse({ label: "", tone: "sell", symbol: null, conditions: [{ kind: "vixAbove", value: 25 }] }).success, false);
  assert.equal(RuleInputSchema.safeParse({ label: "x", tone: "purple", symbol: null, conditions: [{ kind: "vixAbove", value: 25 }] }).success, false);
  assert.equal(RuleInputSchema.safeParse({ label: "x", tone: "up", symbol: null, conditions: [] }).success, false);
  const four = Array.from({ length: 4 }, () => ({ kind: "vixAbove", value: 25 }));
  assert.equal(RuleInputSchema.safeParse({ label: "x", tone: "up", symbol: null, conditions: four }).success, false);
  assert.equal(RuleInputSchema.safeParse({ label: "x", tone: "up", symbol: null, conditions: [{ kind: "belowMa", window: 75 }] }).success, false);
  assert.equal(RuleInputSchema.safeParse({ label: "x", tone: "up", symbol: "DROP TABLE", conditions: [{ kind: "vixAbove", value: 25 }] }).success, false);
});

test("hazır kalıplar şemadan geçer", () => {
  for (const preset of RULE_PRESETS) {
    assert.ok(RuleInputSchema.safeParse({ label: "x", tone: "hold", symbol: null, conditions: preset.conditions }).success, preset.key);
    assert.ok(preset.key in riskDeskTr.rules.presetNames, preset.key);
  }
});

test("kural metni ve dil", () => {
  const tr = riskDeskTr.conditions as ConditionLabels;
  const en = riskDeskEn.conditions as ConditionLabels;
  assert.equal(describeCondition({ kind: "betaAbove", value: 1.3 }, tr, "tr"), "Pozisyon Betası > 1,3");
  assert.equal(describeCondition({ kind: "betaAbove", value: 1.3 }, en, "en"), "Position Beta > 1.3");
  assert.equal(describeCondition({ kind: "crossBelowMa", window: 200 }, tr, "tr"), "Pozisyon 200 GO'yu Aşağı Kesti");
  assert.equal(
    describeRule({ symbol: null, conditions: [{ kind: "vixAbove", value: 25 }] }, tr, { and: "ve", all: "Her Pozisyon" }, "tr"),
    "VIX > 25",
    "piyasa kuralında pozisyon künyesi yok",
  );
});

/* Yalnız CÜMLELER (dört kelime ve üstü): denetimin cümle başı emir kalıbı
   tek kelimelik sütun başlığını ("Fund") da emir sanıyor; o kalıp Claude
   metni için kuruldu, tablo başlığı için değil. */
test("masanın kendi cümleleri öneri kalıbı taşımaz", () => {
  const walk = (value: unknown, out: string[]) => {
    if (typeof value === "string") out.push(value);
    else if (value && typeof value === "object") for (const v of Object.values(value)) walk(v, out);
    return out;
  };
  for (const [dict, locale] of [[riskDeskTr, "tr"], [riskDeskEn, "en"]] as const) {
    for (const text of walk(dict, [])) {
      if (text === dict.footer.disclaimer || text.split(/\s+/).length < 4) continue; // "al, sat, ekle ya da çıkar demez" sınırın kendisini anlatır
      assert.deepEqual(adviceMatches(text, locale), [], text);
    }
  }
});
