import test from "node:test";
import assert from "node:assert/strict";
import {
  COOLDOWN_MS, DATA_BUDGET_MS, JOB_BUDGET_MS, LOCK_MS, MIN_MODEL_MS, MODEL_TIMEOUT_MS, MODEL_WORST_MS,
  RETRY_DELAY_MS, RETRY_WINDOW_MS, SAVE_MARGIN_MS, accessPhase, budgetLeft, cooldownUntil, withinBudget,
} from "../lib/ai-analysis-lock";

const NOW = new Date("2026-11-08T15:00:00Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const JOB = "00000000-0000-4000-8000-000000000001";

test("accessPhase: satırın dört hâli tek tabloda", () => {
  const cases: [string, { lockId: string | null; lockUntil: Date | null } | null, string][] = [
    ["satır yok", null, "idle"],
    ["kilit hiç yok", { lockId: null, lockUntil: null }, "idle"],
    ["soğuma geçmiş", { lockId: null, lockUntil: at(-1) }, "idle"],
    ["soğuma sürüyor", { lockId: null, lockUntil: at(30_000) }, "cooldown"],
    ["iş sürüyor", { lockId: JOB, lockUntil: at(60_000) }, "running"],
    ["iş kilidi dolmuş: kurtarma bekliyor", { lockId: JOB, lockUntil: at(-1) }, "expired"],
    // SQL'de üretilmez; rezervasyon `lock_until IS NULL` satırı boş sayar.
    ["iş kimliği var, süre yok", { lockId: JOB, lockUntil: null }, "idle"],
  ];
  for (const [name, row, phase] of cases) assert.equal(accessPhase(row, NOW), phase, name);
});

test("accessPhase: sınır SQL'le aynı — lock_until = now süren iş değil", () => {
  assert.equal(accessPhase({ lockId: JOB, lockUntil: NOW }, NOW), "expired");
  assert.equal(accessPhase({ lockId: null, lockUntil: NOW }, NOW), "idle");
  assert.equal(accessPhase({ lockId: JOB, lockUntil: at(1) }, NOW.getTime()), "running");
});

test("cooldownUntil yalnız soğumada dolu", () => {
  assert.equal(cooldownUntil({ lockId: null, lockUntil: at(45_000) }, NOW), at(45_000).toISOString());
  assert.equal(cooldownUntil({ lockId: JOB, lockUntil: at(45_000) }, NOW), null);
  assert.equal(cooldownUntil({ lockId: null, lockUntil: at(-5) }, NOW), null);
  assert.equal(cooldownUntil(null, NOW), null);
});

test("iş bütçesi kilitten türer: veri turu + modelin en kötü yolu + kayıt payı kilidi aşmaz", () => {
  assert.equal(JOB_BUDGET_MS, LOCK_MS - SAVE_MARGIN_MS);
  assert.equal(MODEL_WORST_MS, RETRY_WINDOW_MS + RETRY_DELAY_MS + MODEL_TIMEOUT_MS);
  assert.ok(DATA_BUDGET_MS >= 30_000, "veri turuna en az 30 sn kalmalı");
  assert.ok(DATA_BUDGET_MS + MODEL_WORST_MS + SAVE_MARGIN_MS <= LOCK_MS);
  // Veri turu bütçesini sonuna dek kullansa da ilk model denemesi tam süre alır.
  assert.ok(JOB_BUDGET_MS - DATA_BUDGET_MS >= MODEL_TIMEOUT_MS);
  assert.ok(MIN_MODEL_MS < MODEL_TIMEOUT_MS);
  assert.ok(COOLDOWN_MS > 0 && COOLDOWN_MS < LOCK_MS);
  // SQL aralığı ondalıksız saniye yazılır (lib/ai-analysis-quota.ts).
  assert.equal(LOCK_MS % 1000, 0);
  assert.equal(COOLDOWN_MS % 1000, 0);
});

test("budgetLeft eksiye düşmez", () => {
  assert.equal(budgetLeft(1_000, 400), 600);
  assert.equal(budgetLeft(1_000, 2_000), 0);
});

test("withinBudget: süresinde biten işin değeri ve hatası olduğu gibi geçer", async () => {
  assert.equal(await withinBudget(Promise.resolve(7), 1_000, "data-timeout"), 7);
  await assert.rejects(withinBudget(Promise.reject(new Error("data-unavailable")), 1_000, "data-timeout"), /data-unavailable/);
});

test("withinBudget: süre dolunca kodla düşer, geç gelen ret işlenmemiş kalmaz", async () => {
  let lateReject!: (e: Error) => void;
  const slow = new Promise<number>((_, reject) => { lateReject = reject; });
  await assert.rejects(withinBudget(slow, 10, "data-timeout"), /data-timeout/);
  lateReject(new Error("late"));
  await assert.rejects(withinBudget(new Promise<number>(() => {}), 0, "data-timeout"), /data-timeout/);
  const late = Promise.reject(new Error("late"));
  await assert.rejects(withinBudget(late, -5, "data-timeout"), /data-timeout/);
});
