import test from "node:test";
import assert from "node:assert/strict";
import { sessionAgeLabel, sessionTitle } from "../lib/session-age";
import tr from "../lib/i18n/dictionaries/tr";
import en from "../lib/i18n/dictionaries/en";

/** Geçmiş seansın göreli adı — okuyucunun takvim gününden (lib/session-age.ts). */

const at = (iso: string) => Date.parse(iso);

test("seans açıkken önceki gün 'Dünkü Seans'", () => {
  // 28 Ekim 22:29 TR — sahibinin ekranı.
  assert.equal(sessionAgeLabel("2026-10-27", "tr", tr, at("2026-10-28T19:29:00Z")), "Dünkü Seans");
});

test("kapanıştan sonra aynı gün 'Bugünkü Seans'", () => {
  assert.equal(sessionAgeLabel("2026-10-28", "tr", tr, at("2026-10-28T20:30:00Z")), "Bugünkü Seans");
});

test("kışın TR gece yarısı kapanışı ertesi gün 'Dünkü Seans'", () => {
  // 27 Kasım 16:00 ET = 28 Kasım 00:00 TR; okuyucu 28'inde.
  assert.equal(sessionAgeLabel("2026-11-27", "tr", tr, at("2026-11-28T08:00:00Z")), "Dünkü Seans");
});

test("hafta sonundan sonra hafta günüyle", () => {
  assert.equal(sessionAgeLabel("2026-10-23", "tr", tr, at("2026-10-26T08:00:00Z")), "Cuma Seansı");
  assert.equal(sessionAgeLabel("2026-10-23", "en", en, at("2026-10-26T08:00:00Z")), "Friday's Session");
});

test("bir haftadan eskisi 'Önceki Seans'", () => {
  assert.equal(sessionAgeLabel("2026-10-16", "tr", tr, at("2026-10-26T08:00:00Z")), "Önceki Seans");
});

test("panel başlığı grafiğin gününü söylüyor: bugün, dün, hafta günü (iyelik ekiyle)", () => {
  const T = tr.dailyChart.homeTitles;
  // 31 Ekim cumartesi 13:34 TR — cuma grafiği "Günün" değil "Dünün".
  assert.equal(sessionTitle("2026-10-30", "tr", T, at("2026-10-31T10:34:00Z")), "Dünün Grafiği");
  // 2 Kasım pazartesi sabahı — cuma grafiği.
  assert.equal(sessionTitle("2026-10-30", "tr", T, at("2026-11-02T07:00:00Z")), "Cuma'nın Grafiği");
  assert.equal(sessionTitle("2026-10-29", "tr", T, at("2026-11-02T07:00:00Z")), "Perşembe'nin Grafiği");
  assert.equal(sessionTitle("2026-10-30", "en", en.dailyChart.homeTitles, at("2026-11-02T12:00:00Z")), "Friday's Chart");
  assert.equal(sessionTitle("2026-10-30", "tr", T, at("2026-10-30T20:30:00Z")), "Günün Grafiği");
  assert.equal(sessionTitle("2026-10-01", "tr", T, at("2026-11-02T07:00:00Z")), "Son Seansın Grafiği");
});
