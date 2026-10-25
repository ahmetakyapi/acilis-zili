"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { createRiskRule, type RuleActionState } from "@/app/(app)/risk/actions";
import { Button } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import {
  LABEL_MAX,
  MAX_CONDITIONS,
  RULE_PRESETS,
  RULE_TONES,
  type Condition,
  type ConditionKind,
  type RuleTone,
} from "@/lib/risk/rules";
import styles from "./RiskDesk.module.css";

/**
 * Kural kurucu (25 Ekim). Etiketi ve rengi KULLANICI seçer; hazır kalıplar
 * yalnız koşulları doldurur, etiket alanına bir şey yazmaz (sistem bir
 * kurala "Sat Uyarısı" adı vermez). Gönderim tek bir JSON alanı: sunucu
 * eylemi onu zod ile yeniden doğrular (lib/risk/rules.ts → RuleInputSchema).
 */

type T = Dictionary["riskDesk"];

const KINDS: readonly ConditionKind[] = [
  "regime",
  "vixAbove",
  "vxnAbove",
  "termAbove",
  "breadthBelow",
  "creditChangeAbove",
  "spyBelowMa",
  "spyCrossBelowMa",
  "spyCross",
  "betaAbove",
  "atrPctAbove",
  "volPctileAbove",
  "belowMa",
  "crossBelowMa",
  "positionCross",
];

/** Koşul türü seçilince başlangıç değeri — hazır kalıplarla aynı eşikler. */
function defaultOf(kind: ConditionKind): Condition {
  switch (kind) {
    case "regime":
      return { kind, regime: "riskOff" };
    case "vixAbove":
      return { kind, value: 25 };
    case "vxnAbove":
      return { kind, value: 30 };
    case "termAbove":
      return { kind, value: 1 };
    case "breadthBelow":
      return { kind, value: 40 };
    case "creditChangeAbove":
      return { kind, value: 0.5 };
    case "spyBelowMa":
    case "belowMa":
      return { kind, window: 200 };
    case "spyCrossBelowMa":
    case "crossBelowMa":
      return { kind, window: 200 };
    case "spyCross":
    case "positionCross":
      return { kind, cross: "death" };
    case "betaAbove":
      return { kind, value: 1.3 };
    case "atrPctAbove":
      return { kind, value: 4 };
    case "volPctileAbove":
      return { kind, value: 90 };
  }
}

/** Seçenek adı: şablonun yer tutucuları sade işaretle. */
const kindName = (template: string) => template.replace("{v}", "…").replace("{w}", "…").replace("{x}", "…");

export function RuleBuilder({ t }: { t: T }) {
  const r = t.rules;
  const [label, setLabel] = useState("");
  const [tone, setTone] = useState<RuleTone>("hold");
  const [symbol, setSymbol] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([defaultOf("vixAbove")]);
  /* Kayıt başarılıysa form boşalır; başarısızsa girilen kalır. */
  const [state, action, pending] = useActionState<RuleActionState, FormData>(async (previous, form) => {
    const result = await createRiskRule(previous, form);
    if (result.ok) {
      setLabel("");
      setSymbol("");
      setConditions([defaultOf("vixAbove")]);
    }
    return result;
  }, { ok: false, message: "" });

  const update = (index: number, next: Condition) => setConditions((list) => list.map((c, i) => (i === index ? next : c)));
  const payload = JSON.stringify({ label, tone, symbol: symbol.trim() ? symbol.trim().toUpperCase() : null, conditions });

  return (
    <form action={action} className={styles.builder}>
      <h3 className={styles.builderTitle}>{r.builderTitle}</h3>
      <div>
        <p className={styles.ruleMeta}>{r.presets}</p>
        <div className={`${styles.presets} mt-1.5`}>
          {RULE_PRESETS.map((preset) => (
            <button key={preset.key} type="button" onClick={() => setConditions(preset.conditions.map((c) => ({ ...c })))}>
              {r.presetNames[preset.key as keyof typeof r.presetNames]}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.fields}>
        <label className={styles.field}>
          {r.label}
          <input className={styles.input} value={label} maxLength={LABEL_MAX} onChange={(e) => setLabel(e.target.value)} placeholder={r.labelPlaceholder} required />
        </label>
        <label className={styles.field}>
          {r.tone}
          <select className={styles.input} value={tone} onChange={(e) => setTone(e.target.value as RuleTone)}>
            {RULE_TONES.map((key) => (
              <option key={key} value={key}>
                {r.tones[key]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          {r.symbol}
          <input className={styles.input} value={symbol} maxLength={10} onChange={(e) => setSymbol(e.target.value)} placeholder={r.symbolPlaceholder} autoCapitalize="characters" />
        </label>
      </div>
      {conditions.map((c, index) => (
        <div key={index} className={styles.condRow}>
          <label className={styles.field}>
            {r.condition}
            <select className={styles.input} value={c.kind} onChange={(e) => update(index, defaultOf(e.target.value as ConditionKind))}>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kindName(t.conditions[kind])}
                </option>
              ))}
            </select>
          </label>
          <ConditionParam condition={c} t={t} onChange={(next) => update(index, next)} />
          <button
            type="button"
            className={styles.iconButton}
            aria-label={r.removeCondition}
            disabled={conditions.length === 1}
            onClick={() => setConditions((list) => list.filter((_, i) => i !== index))}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
      <input type="hidden" name="rule" value={payload} />
      <div className={styles.builderActions}>
        {conditions.length < MAX_CONDITIONS && (
          <button type="button" className={styles.chip} onClick={() => setConditions((list) => [...list, defaultOf("betaAbove")])}>
            <Plus size={14} aria-hidden className="mr-1 inline" />
            {r.addCondition}
          </button>
        )}
        <Button type="submit" size="sm" disabled={pending || !label.trim()}>
          {pending ? r.saving : r.submit}
        </Button>
        {state.message && (
          <p role={state.ok ? "status" : "alert"} className={styles.message}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function ConditionParam({ condition: c, t, onChange }: { condition: Condition; t: T; onChange: (next: Condition) => void }) {
  const r = t.rules;
  if ("value" in c) {
    return (
      <label className={styles.field}>
        {r.value}
        <input
          className={styles.input}
          type="number"
          inputMode="decimal"
          step="any"
          value={Number.isFinite(c.value) ? c.value : ""}
          onChange={(e) => onChange({ ...c, value: Number(e.target.value) })}
        />
      </label>
    );
  }
  if ("window" in c) {
    const windows = c.kind === "spyCrossBelowMa" || c.kind === "crossBelowMa" ? [100, 200] : [50, 100, 200];
    return (
      <label className={styles.field}>
        {r.window}
        <select className={styles.input} value={c.window} onChange={(e) => onChange({ ...c, window: Number(e.target.value) } as Condition)}>
          {windows.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if ("regime" in c) {
    return (
      <label className={styles.field}>
        {r.regimeValue}
        <select className={styles.input} value={c.regime} onChange={(e) => onChange({ ...c, regime: e.target.value as "cautious" | "riskOff" })}>
          <option value="riskOff">{t.conditions.regimeRiskOff}</option>
          <option value="cautious">{t.conditions.regimeCautious}</option>
        </select>
      </label>
    );
  }
  return (
    <label className={styles.field}>
      {r.crossValue}
      <select className={styles.input} value={c.cross} onChange={(e) => onChange({ ...c, cross: e.target.value as "golden" | "death" })}>
        <option value="death">{t.conditions.death}</option>
        <option value="golden">{t.conditions.golden}</option>
      </select>
    </label>
  );
}
