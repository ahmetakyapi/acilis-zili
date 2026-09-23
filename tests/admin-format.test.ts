import test from "node:test";
import assert from "node:assert/strict";
import {
  adminDay,
  adminDayIn,
  adminDayYear,
  adminStamp,
  adminWeekRange,
  agoLabel,
  deltaOf,
} from "../lib/admin-format";
import { dayBoundaryNote, etDayRolloverTr, zoneWallTime } from "../lib/session-clock";

/**
 * Yönetim panelinin sözlüğü — tarih, damga, göreli zaman.
 *
 * 23 Eylül denetiminde panelde dört tarih biçimi, iki saat dilimi ve
 * "0 Saat Önce" gibi künyeler vardı; damgalar sunucunun (UTC) saatiyle
 * basılıyordu. Buradaki testler tek sözlüğü ve İstanbul gününü tutuyor.
 */

const NOW = new Date("2026-09-23T08:00:00Z"); // 11:00 TR

test("damga İstanbul saatiyle ve İstanbul gününe göre", () => {
  assert.equal(adminStamp(new Date("2026-09-22T19:39:00Z"), NOW), "Dün 22:39");
  /* UTC'de hâlâ 22 Eylül ama İstanbul'da 23'ü — "Bugün". */
  assert.equal(adminStamp(new Date("2026-09-22T23:30:00Z"), NOW), "Bugün 02:30");
  assert.equal(adminStamp(new Date("2026-09-21T08:42:00Z"), NOW), "21 Eyl 11:42");
  assert.equal(adminStamp(new Date("2025-09-21T08:42:00Z"), NOW), "21 Eyl 2025 11:42");
});

test("okunur gün ve hafta aralığı", () => {
  assert.equal(adminDay("2026-09-22"), "22 Eyl");
  assert.equal(adminDayYear("2026-08-13"), "13 Ağu 2026");
  assert.equal(adminDayIn("2026-10-22", "2026-09-23"), "22 Eki");
  assert.equal(adminDayIn("2027-01-05", "2026-12-20"), "5 Oca 2027");
  assert.equal(adminWeekRange("2026-09-14"), "14–18 Eyl Haftası");
  assert.equal(adminWeekRange("2026-09-28"), "28 Eyl–2 Eki Haftası");
});

test("göreli zaman: sıfır yazılmaz, 24–48 saat Dün", () => {
  assert.equal(agoLabel(new Date(NOW.getTime() - 20_000), NOW), "Az Önce");
  assert.equal(agoLabel(new Date(NOW.getTime() - 5 * 60_000), NOW), "5 Dakika Önce");
  assert.equal(agoLabel(new Date(NOW.getTime() - 3 * 3_600_000), NOW), "3 Saat Önce");
  assert.equal(agoLabel(new Date(NOW.getTime() - 30 * 3_600_000), NOW), "Dün");
  assert.equal(agoLabel(new Date(NOW.getTime() - 50 * 3_600_000), NOW), "2 Gün Önce");
  assert.equal(agoLabel(null, NOW), "Hiç");
});

test("değişim: eksik ölçülmüş önceki dönemle kıyas yok", () => {
  assert.equal(
    deltaOf(2436, 756, { trackingFrom: "2026-08-13", previousFrom: "2026-07-25" }),
    null,
  );
  const full = deltaOf(2436, 756, { trackingFrom: "2026-08-13", previousFrom: "2026-08-14" });
  assert.equal(full?.text, "+%222");
  assert.equal(full?.srLabel, "yüzde 222 arttı");
  assert.equal(deltaOf(88, 100)?.srLabel, "yüzde 12 azaldı");
  assert.equal(deltaOf(5, 0), null);
});

test("ET günü TR saatiyle yazın 07:00, kışın 08:00'de döner", () => {
  assert.equal(etDayRolloverTr(new Date("2026-09-23T09:00:00Z")), "07:00");
  assert.equal(etDayRolloverTr(new Date("2026-12-01T09:00:00Z")), "08:00");
  assert.equal(
    dayBoundaryNote(new Date("2026-09-23T09:00:00Z")),
    "Gün 07:00 TR'de Döner (New York Gece Yarısı)",
  );
});

test("duvar saati → an, sabit fark yazmadan", () => {
  assert.equal(zoneWallTime("2026-09-23", "16:10", "Europe/Istanbul").toISOString(), "2026-09-23T13:10:00.000Z");
  assert.equal(zoneWallTime("2026-12-01", "09:30", "America/New_York").toISOString(), "2026-12-01T14:30:00.000Z");
  assert.equal(zoneWallTime("2026-07-01", "09:30", "America/New_York").toISOString(), "2026-07-01T13:30:00.000Z");
});
