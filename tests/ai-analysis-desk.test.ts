import test from "node:test";
import assert from "node:assert/strict";
import { deskState } from "../lib/ai-analysis-desk";

const base = { errorCode: null, inProgress: false, remaining: 3, early: false };

test("boş durumda satır yok, düğme Analizi Başlat ve açık", () => {
  assert.deepEqual(deskState(base), { note: null, label: "start", disabled: false, retry: false });
});

test("önerilen bekleme dolmadıysa uyarı ve Yine de Başlat; üretim engellenmez", () => {
  assert.deepEqual(deskState({ ...base, early: true }), { note: "early", label: "startAnyway", disabled: false, retry: false });
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
