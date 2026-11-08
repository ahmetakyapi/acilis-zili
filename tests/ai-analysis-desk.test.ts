import test from "node:test";
import assert from "node:assert/strict";
import { deskFilming, deskReducer, deskState, type DeskEvent, type DeskMachine } from "../lib/ai-analysis-desk";

const base = { errorCode: null, inProgress: false, remaining: 3, early: false };

test("boş durumda satır yok, düğme Analizi Başlat ve açık", () => {
  assert.deepEqual(deskState(base), { note: null, label: "start", disabled: false, retry: false, cooldown: false });
});

test("önerilen bekleme dolmadıysa uyarı ve Yine de Başlat; üretim engellenmez", () => {
  assert.deepEqual(deskState({ ...base, early: true }), { note: "early", label: "startAnyway", disabled: false, retry: false, cooldown: false });
});

test("hak bittiyse düğme kapalı, satır kota", () => {
  const s = deskState({ ...base, remaining: 0, early: true });
  assert.equal(s.note, "quota");
  assert.equal(s.disabled, true);
});

test("sınırsız hak (null) kapatmaz", () => {
  assert.equal(deskState({ ...base, remaining: null }).disabled, false);
});

test("hesapta analiz sürüyorsa kota ve beklemenin önüne geçer", () => {
  const s = deskState({ ...base, inProgress: true, remaining: 0, early: true });
  assert.equal(s.note, "running");
  assert.equal(s.disabled, true);
});

test("hata her şeyin önünde; yeniden denenebilen kodda düğme Tekrar Dene", () => {
  for (const code of ["busy", "data-unavailable", "analysis-failed"]) {
    const s = deskState({ ...base, errorCode: code, early: true });
    assert.equal(s.note, "error");
    assert.equal(s.label, "retry");
    assert.equal(s.retry, true);
  }
});

test("bağlantı ve kota hatası yeniden deneme önermez", () => {
  for (const code of ["", "quota"]) {
    const s = deskState({ ...base, errorCode: code, early: true });
    assert.equal(s.label, "start");
    assert.equal(s.retry, false);
  }
});

test("soğumada düğme kilitli, Tekrar Dene ve geri sayım; satır soğuma", () => {
  assert.deepEqual(deskState({ ...base, cooldownMs: 42_000, early: true }),
    { note: "cooldown", label: "retry", disabled: true, retry: false, cooldown: true });
});

test("başarısız denemenin hata satırı görünürken de soğuma düğmeyi kilitler", () => {
  for (const code of ["busy", "data-unavailable", "analysis-failed"]) {
    const s = deskState({ ...base, errorCode: code, cooldownMs: 30_000 });
    assert.equal(s.note, "error");
    assert.equal(s.label, "retry");
    assert.equal(s.disabled, true);
    assert.equal(s.cooldown, true);
  }
});

test("soğuma bitince (0 ms) düğme yeniden açılır", () => {
  const s = deskState({ ...base, errorCode: "analysis-failed", cooldownMs: 0 });
  assert.equal(s.disabled, false);
  assert.equal(s.cooldown, false);
  assert.equal(s.label, "retry");
});

test("süren iş ve biten hak soğumanın önüne geçer; geri sayım gösterilmez", () => {
  const running = deskState({ ...base, inProgress: true, cooldownMs: 30_000 });
  assert.equal(running.note, "running");
  assert.equal(running.cooldown, false);
  const quota = deskState({ ...base, remaining: 0, cooldownMs: 30_000 });
  assert.equal(quota.note, "quota");
  assert.equal(quota.cooldown, false);
  assert.equal(quota.disabled, true);
});

const idle: DeskMachine = { run: "idle", error: null, cooldownUntil: null };
const run = (events: DeskEvent[], from = idle) => events.reduce(deskReducer, from);
const err = { code: "analysis-failed", text: "x" };

test("masa durumu: başarılı yol idle → launching → filming → done", () => {
  assert.equal(run([{ type: "launch" }]).run, "launching");
  assert.equal(run([{ type: "launch" }, { type: "film" }]).run, "filming");
  assert.equal(run([{ type: "launch" }, { type: "film" }, { type: "succeed" }]).run, "done");
});

test("masa durumu: sonuç büzülmeden önce gelirse gecikmeli film olayı done'ı geri almaz", () => {
  const s = run([{ type: "launch" }, { type: "succeed" }, { type: "film" }]);
  assert.equal(s.run, "done");
  assert.equal(deskFilming(s.run), true);
});

test("masa durumu: hata masayı geri getirir, yeniden başlatma hatayı ve soğumayı temizler", () => {
  const failed = run([{ type: "launch" }, { type: "film" }, { type: "fail", error: err }, { type: "cooldown", until: 1_000 }]);
  assert.deepEqual(failed, { run: "error", error: err, cooldownUntil: 1_000 });
  assert.equal(deskFilming(failed.run), false);
  assert.deepEqual(deskReducer(failed, { type: "launch" }), { run: "launching", error: null, cooldownUntil: null });
});

test("masa durumu: süren ya da biten işte ikinci başlatma ve geç olay yok sayılır", () => {
  for (const from of ["launching", "filming", "done"] as const) {
    const s: DeskMachine = { run: from, error: null, cooldownUntil: null };
    assert.equal(deskReducer(s, { type: "launch" }), s);
  }
  const done: DeskMachine = { run: "done", error: null, cooldownUntil: null };
  assert.equal(deskReducer(done, { type: "fail", error: err }), done);
  assert.equal(deskReducer(idle, { type: "succeed" }), idle);
  assert.equal(deskReducer(idle, { type: "film" }), idle);
});
