import test from "node:test";
import assert from "node:assert/strict";
import { getMarketStatus, type MarketHoliday } from "../lib/market-hours";
import { SLOT_RANK, TECHNICAL_CRON, currentSlot } from "../lib/technical";

/**
 * Teknik analiz nöbetleri — üçüncü nöbetin testi.
 *
 * Rutin 18 Eylül 2026'da günde üç koşuya çıktı (`45 12,16,18 * * 1-5`) ama
 * kod iki slot biliyordu: 18:45 UTC'de `currentSlot` "seans açık" diye
 * `midsession` döndürüyordu, yani üçüncü koşu öğlenki yayının ÜSTÜNE
 * yazacaktı ve künyesinde de onun saati ("19:45 TR") görünecekti.
 *
 * Sınır ABD'nin iki saat diliminde de doğru olmak zorunda: cron UTC'ye
 * çakılı, New York karşılığı mevsimle bir saat kayıyor.
 */

const HOLIDAYS: MarketHoliday[] = [
  /* Şükran Günü ertesi — yarım gün, 13:00 ET kapanış. */
  { date: "2026-11-27", nameTr: "Yarım Gün", nameEn: "Half Day", earlyCloseEt: "13:00" },
];

/** Cron'un UTC anını o günün gerçek anına çevirir. */
const utc = (dateStr: string, hour: number, minute: number) =>
  new Date(`${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);

const slotAt = (dateStr: string, hour: number, minute: number) =>
  currentSlot(getMarketStatus(utc(dateStr, hour, minute), HOLIDAYS));

test("cron üç koşuyu taşıyor", () => {
  assert.equal(TECHNICAL_CRON, "45 12,16,18 * * 1-5");
});

test("yaz saatinde üç nöbet üç ayrı slota düşüyor", () => {
  // 18 Eylül 2026 cuma · EDT (UTC-4): 08:45 · 12:45 · 14:45 NY
  assert.equal(slotAt("2026-09-18", 12, 45), "premarket");
  assert.equal(slotAt("2026-09-18", 16, 45), "midsession");
  assert.equal(slotAt("2026-09-18", 18, 45), "lateday");
});

test("kış saatinde de üç ayrı slot — sınır 13:00 ET bu yüzden", () => {
  // 4 Aralık 2026 cuma · EST (UTC-5): 07:45 · 11:45 · 13:45 NY
  assert.equal(slotAt("2026-12-04", 12, 45), "premarket");
  assert.equal(slotAt("2026-12-04", 16, 45), "midsession");
  /* 13:45 ET — sınır 14:00 seçilseydi burası `midsession` olur ve üstüne
     yazma sorunu kışın geri gelirdi. */
  assert.equal(slotAt("2026-12-04", 18, 45), "lateday");
});

test("sıralama günün akışını veriyor", () => {
  assert.ok(SLOT_RANK.premarket < SLOT_RANK.midsession);
  assert.ok(SLOT_RANK.midsession < SLOT_RANK.lateday);
});

test("yarım günde üçüncü nöbet kapanıştan sonraya düşer, slot yok", () => {
  // 27 Kasım 2026 · 13:00 ET kapanış. 18:45 UTC = 13:45 ET, seans bitmiş.
  assert.equal(slotAt("2026-11-27", 16, 45), "midsession"); // 11:45 ET, seans açık
  assert.equal(slotAt("2026-11-27", 18, 45), null);
});

test("hafta sonu hiçbir nöbet yok", () => {
  assert.equal(slotAt("2026-09-19", 16, 45), null);
});
