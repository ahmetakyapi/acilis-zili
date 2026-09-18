import test from "node:test";
import assert from "node:assert/strict";
import { getMarketStatus, type MarketHoliday } from "../lib/market-hours";
import {
  SLOT_RANK,
  TECHNICAL_CRON,
  currentSlot,
  nextEdition,
} from "../lib/technical";

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
  /* Şükran Günü (26 Kasım, perşembe) — TAM tatil, `earlyCloseEt` null. */
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  /* Ertesi gün — yarım gün, 13:00 ET kapanış. */
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

/* --------------------------------------------------------------------------
   Sıradaki yayın — okuyucuya "ne zaman tazelenecek" diyen satırın kaynağı.

   Takvimi hesap tutuyor, varsayım değil: tatil, hafta sonu ve yarım gün
   `currentSlot` üzerinden kendiliğinden eleniyor.
   -------------------------------------------------------------------------- */

const nextAt = (dateStr: string, hour: number, minute: number) =>
  nextEdition(utc(dateStr, hour, minute), HOLIDAYS);

test("gün içinde sıradaki nöbet bir sonraki saat", () => {
  // 18 Eylül cuma, 12:46 UTC — sabah nöbeti yeni geçti.
  const a = nextAt("2026-09-18", 12, 46);
  assert.equal(a?.slot, "midsession");
  assert.equal(a?.at.toISOString(), "2026-09-18T16:45:00.000Z");
  // Öğlen nöbetinden sonra kapanış öncesi.
  assert.equal(nextAt("2026-09-18", 16, 46)?.slot, "lateday");
});

test("günün son nöbetinden sonra sıradaki PAZARTESİ sabahı", () => {
  /* Cuma 18:46 UTC: o gün bitti, cumartesi ve pazar işlem günü değil. */
  const a = nextAt("2026-09-18", 18, 46);
  assert.equal(a?.slot, "premarket");
  assert.equal(a?.at.toISOString(), "2026-09-21T12:45:00.000Z");
});

test("hafta sonunda sıradaki pazartesi sabahı", () => {
  const a = nextAt("2026-09-19", 10, 0);
  assert.equal(a?.slot, "premarket");
  assert.equal(a?.at.toISOString(), "2026-09-21T12:45:00.000Z");
});

test("yarım günde kapanış öncesi nöbeti atlanıyor", () => {
  /* 27 Kasım 2026 · 13:00 ET kapanış. Öğlen nöbetinden (16:45 UTC) sonra
     o günün 18:45'i seans dışına düşüyor; sıradaki 30 Kasım pazartesi. */
  const a = nextAt("2026-11-27", 16, 46);
  assert.equal(a?.slot, "premarket");
  assert.equal(a?.at.toISOString(), "2026-11-30T12:45:00.000Z");
});

test("tam tatil gününün tamamı atlanıyor", () => {
  /* Şükran Günü (26 Kasım, perşembe) tam tatil: 25 Kasım çarşamba akşamı
     sorulduğunda sıradaki yayın 27 Kasım cumanın sabahı. */
  const a = nextAt("2026-11-25", 18, 46);
  assert.equal(a?.slot, "premarket");
  assert.equal(a?.at.toISOString(), "2026-11-27T12:45:00.000Z");
});
