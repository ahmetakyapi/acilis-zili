/**
 * RİSK MASASI — KULLANICININ KURALLARI (25 Ekim; sınama tests/risk-rules.test.ts).
 *
 * Kural en çok üç koşulun VE'si ve kullanıcının kendi ETİKETİ ("Sat
 * Uyarısı", "İzle", "Al Fırsatı" — ne yazarsa). KARAR MANTIĞI DA ETİKET DE
 * KULLANICININ: sistem koşulun doğru olup olmadığını ölçer ve "kuralın
 * tetiklendi" der; etiketi kendisi seçmez, önermez, değiştirmez. Etiketin
 * rengi yön ya da görüş üçlüsünden seçilir (yeni renk icat edilmez).
 *
 * İKİ TÜR KOŞUL. Piyasa koşulu (rejim, VIX, vade eğrisi, genişlik, kredi,
 * SPY'ın ortalamaları) bir kez değerlendirilir. Pozisyon koşulu (beta,
 * ATR%, oynaklık dilimi, ortalamalar) her pozisyonda ayrı; kuraldaki BÜTÜN
 * pozisyon koşullarını AYNI pozisyon sağlamalı ("betası > 1,3 VE 200 GO
 * altında" iki ayrı hisseyle doğrulanmaz). Kural bir sembole bağlanabilir;
 * bağlı değilse portföydeki her pozisyona bakılır.
 *
 * OKUNAMAYAN ÖLÇÜ TETİKLEMEZ. Değeri bilinmeyen koşul yanlış sayılır:
 * eksik veri alarm üretmez (veri dürüstlüğü 1).
 */

import { z } from "zod";
import type { Regime } from "./regime";
import type { CrossKind } from "./math";

export const RULE_TONES = ["up", "down", "buy", "hold", "sell"] as const;
export type RuleTone = (typeof RULE_TONES)[number];
export const MAX_CONDITIONS = 3;
export const MAX_RULES = 30;
export const LABEL_MAX = 32;

const value = z.number().finite();
const ma = z.union([z.literal(50), z.literal(100), z.literal(200)]);
const crossMa = z.union([z.literal(100), z.literal(200)]);
const cross = z.enum(["golden", "death"]);

export const ConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("regime"), regime: z.enum(["cautious", "riskOff"]) }),
  z.object({ kind: z.literal("vixAbove"), value: value.min(5).max(100) }),
  z.object({ kind: z.literal("vxnAbove"), value: value.min(5).max(120) }),
  z.object({ kind: z.literal("termAbove"), value: value.min(0.5).max(2) }),
  z.object({ kind: z.literal("breadthBelow"), value: value.min(1).max(99) }),
  z.object({ kind: z.literal("creditChangeAbove"), value: value.min(0.05).max(5) }),
  z.object({ kind: z.literal("spyBelowMa"), window: ma }),
  z.object({ kind: z.literal("spyCrossBelowMa"), window: crossMa }),
  z.object({ kind: z.literal("spyCross"), cross }),
  z.object({ kind: z.literal("betaAbove"), value: value.min(0).max(5) }),
  z.object({ kind: z.literal("atrPctAbove"), value: value.min(0.1).max(50) }),
  z.object({ kind: z.literal("volPctileAbove"), value: value.min(1).max(99) }),
  z.object({ kind: z.literal("belowMa"), window: ma }),
  z.object({ kind: z.literal("crossBelowMa"), window: crossMa }),
  z.object({ kind: z.literal("positionCross"), cross }),
]);
export type Condition = z.infer<typeof ConditionSchema>;
export type ConditionKind = Condition["kind"];

export const POSITION_KINDS = new Set<ConditionKind>(["betaAbove", "atrPctAbove", "volPctileAbove", "belowMa", "crossBelowMa", "positionCross"]);
export const isPositionCondition = (c: Condition) => POSITION_KINDS.has(c.kind);

export const RuleInputSchema = z.object({
  label: z.string().trim().min(1).max(LABEL_MAX),
  tone: z.enum(RULE_TONES),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/)
    .nullable(),
  conditions: z.array(ConditionSchema).min(1).max(MAX_CONDITIONS),
});
export type RuleInput = z.infer<typeof RuleInputSchema>;

export type MaFlags = { 50: boolean | null; 100: boolean | null; 200: boolean | null };

/** Kural değerlendirmesinin piyasa girdisi — masanın bugünkü ölçüleri. */
export type MarketFacts = {
  regime: Regime | null;
  vix: number | null;
  vxn: number | null;
  termRatio: number | null;
  breadth: number | null;
  creditChange: number | null;
  spyBelow: MaFlags;
  spyCrossedBelow: { 100: boolean; 200: boolean };
  spyCross: CrossKind | null;
};

export type PositionFacts = {
  symbol: string;
  beta: number | null;
  atrPct: number | null;
  volPctile: number | null;
  below: MaFlags;
  crossedBelow: { 100: boolean; 200: boolean };
  cross: CrossKind | null;
};

const above = (actual: number | null, threshold: number) => actual !== null && actual > threshold;

function marketHolds(c: Condition, m: MarketFacts): boolean {
  switch (c.kind) {
    case "regime":
      return c.regime === "riskOff" ? m.regime === "riskOff" : m.regime === "cautious" || m.regime === "riskOff";
    case "vixAbove":
      return above(m.vix, c.value);
    case "vxnAbove":
      return above(m.vxn, c.value);
    case "termAbove":
      return above(m.termRatio, c.value);
    case "breadthBelow":
      return m.breadth !== null && m.breadth < c.value;
    case "creditChangeAbove":
      return above(m.creditChange, c.value);
    case "spyBelowMa":
      return m.spyBelow[c.window] === true;
    case "spyCrossBelowMa":
      return m.spyCrossedBelow[c.window];
    case "spyCross":
      return m.spyCross === c.cross;
    default:
      return false;
  }
}

function positionHolds(c: Condition, p: PositionFacts): boolean {
  switch (c.kind) {
    case "betaAbove":
      return above(p.beta, c.value);
    case "atrPctAbove":
      return above(p.atrPct, c.value);
    case "volPctileAbove":
      return above(p.volPctile, c.value);
    case "belowMa":
      return p.below[c.window] === true;
    case "crossBelowMa":
      return p.crossedBelow[c.window];
    case "positionCross":
      return p.cross === c.cross;
    default:
      return false;
  }
}

export type RuleOutcome = {
  triggered: boolean;
  /** Pozisyon koşullarını sağlayan semboller (pozisyon koşulu yoksa boş). */
  symbols: string[];
};

export function evaluateRule(
  rule: Pick<RuleInput, "conditions" | "symbol">,
  market: MarketFacts,
  positions: readonly PositionFacts[],
): RuleOutcome {
  const marketConds = rule.conditions.filter((c) => !isPositionCondition(c));
  const positionConds = rule.conditions.filter(isPositionCondition);
  if (!marketConds.every((c) => marketHolds(c, market))) return { triggered: false, symbols: [] };
  if (positionConds.length === 0) return { triggered: true, symbols: [] };
  const pool = rule.symbol ? positions.filter((p) => p.symbol === rule.symbol) : positions;
  const symbols = pool.filter((p) => positionConds.every((c) => positionHolds(c, p))).map((p) => p.symbol);
  return { triggered: symbols.length > 0, symbols };
}

/** Kural metni için koşul şablonları — sözlükten gelir (`riskDesk.conditions`). */
export type ConditionLabels = Record<ConditionKind, string> & {
  regimeCautious: string;
  regimeRiskOff: string;
  golden: string;
  death: string;
};

export function formatRuleNumber(n: number, locale: "tr" | "en"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { maximumFractionDigits: 2 }).format(n);
}

/** "VIX > 25", "Beta > 1,3", "200 GO Altında" — şablonda {v}, {w}, {x}. */
export function describeCondition(c: Condition, labels: ConditionLabels, locale: "tr" | "en"): string {
  const template = labels[c.kind];
  switch (c.kind) {
    case "regime":
      return template.replace("{x}", c.regime === "riskOff" ? labels.regimeRiskOff : labels.regimeCautious);
    case "spyBelowMa":
    case "spyCrossBelowMa":
    case "belowMa":
    case "crossBelowMa":
      return template.replace("{w}", String(c.window));
    case "spyCross":
    case "positionCross":
      return template.replace("{x}", c.cross === "golden" ? labels.golden : labels.death);
    default:
      return template.replace("{v}", formatRuleNumber(c.value, locale));
  }
}

/** Kuralın koşulları tek satırda; pozisyon koşulu varsa hangi pozisyonlara baktığı da. */
export function describeRule(
  rule: Pick<RuleInput, "conditions" | "symbol">,
  labels: ConditionLabels,
  words: { and: string; all: string },
  locale: "tr" | "en",
): string {
  const text = rule.conditions.map((c) => describeCondition(c, labels, locale)).join(` ${words.and} `);
  return rule.conditions.some(isPositionCondition) ? `${text} · ${rule.symbol ?? words.all}` : text;
}

/** Hazır kurallar — kural kurucunun tek dokunuşla doldurduğu ön ayarlar. Etiketi kullanıcı yazar. */
export const RULE_PRESETS: readonly { key: string; conditions: Condition[] }[] = [
  { key: "riskOffBeta", conditions: [{ kind: "regime", regime: "riskOff" }, { kind: "betaAbove", value: 1.3 }] },
  { key: "vix25", conditions: [{ kind: "vixAbove", value: 25 }] },
  { key: "termInverted", conditions: [{ kind: "termAbove", value: 1 }] },
  { key: "atr4", conditions: [{ kind: "atrPctAbove", value: 4 }] },
  { key: "vol90", conditions: [{ kind: "volPctileAbove", value: 90 }] },
  { key: "spyCross200", conditions: [{ kind: "spyCrossBelowMa", window: 200 }] },
  { key: "spyCross100", conditions: [{ kind: "spyCrossBelowMa", window: 100 }] },
  { key: "spyDeath", conditions: [{ kind: "spyCross", cross: "death" }] },
  { key: "positionCross200", conditions: [{ kind: "crossBelowMa", window: 200 }] },
];
