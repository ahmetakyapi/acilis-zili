import test from "node:test";
import assert from "node:assert/strict";

import { addIsoMonths, formatDateInput, isIsoDay, maskDateInput, nextDateDraft, parseDateInput } from "../lib/date-input";

test("tarih yazımı: TR gün önce, EN ay önce, ISO iki dilde", () => {
  assert.equal(parseDateInput("14.03.2019", "tr"), "2019-03-14");
  assert.equal(parseDateInput("14/3/19", "tr"), "2019-03-14");
  assert.equal(parseDateInput("14032019", "tr"), "2019-03-14");
  assert.equal(parseDateInput("03/14/2019", "en"), "2019-03-14");
  assert.equal(parseDateInput("2019-03-14", "tr"), "2019-03-14");
  assert.equal(parseDateInput("2019-03-14", "en"), "2019-03-14");
});

test("tarih yazımı: takvimde olmayan gün ve bozuk metin null, uydurulmaz", () => {
  assert.equal(parseDateInput("31.02.2024", "tr"), null);
  assert.equal(parseDateInput("29.02.2023", "tr"), null);
  assert.equal(parseDateInput("29.02.2024", "tr"), "2024-02-29");
  assert.equal(parseDateInput("14.13.2019", "tr"), null);
  assert.equal(parseDateInput("dün", "tr"), null);
  assert.equal(parseDateInput("", "tr"), null);
  assert.equal(isIsoDay("2024-02-30"), false);
});

test("biçim ve maske", () => {
  assert.equal(formatDateInput("2019-03-14", "tr"), "14.03.2019");
  assert.equal(formatDateInput("2019-03-14", "en"), "03/14/2019");
  assert.equal(maskDateInput("1403", "tr"), "14.03");
  assert.equal(maskDateInput("14032019", "en"), "14/03/2019");
  /* Rakam yazana ayraç gelir, ayracı kendi yazana dokunulmaz, silme maskelenmez. */
  assert.equal(nextDateDraft("14.03", "14.032", "tr"), "14.03.2");
  assert.equal(nextDateDraft("14", "140", "tr"), "14.0");
  assert.equal(nextDateDraft("", "2019-03-14", "tr"), "2019-03-14");
  assert.equal(nextDateDraft("1.", "1.3", "tr"), "1.3");
  assert.equal(nextDateDraft("14.03", "14.0", "tr"), "14.0");
});

test("ay ekleme: ay sonu taşmaz", () => {
  assert.equal(addIsoMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addIsoMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(addIsoMonths("2024-12-15", 1), "2025-01-15");
});
