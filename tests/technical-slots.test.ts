import test from "node:test";
import assert from "node:assert/strict";
import { getMarketStatus, type MarketHoliday } from "../lib/market-hours";
import {
  SLOT_RANK,
  TECHNICAL_CRON,
  currentSlot,
  nextEdition,
  slotInstant,
} from "../lib/technical";

/**
 * Teknik analiz nöbetleri — üçüncü nöbetin testi.
 *
 * Rutin 18 Eylül 2026'da günde üç koşuya çıktı (`45 12,16,18 * * 1-5`) ama
 * kod iki slot biliyordu: 18:45 UTC'de `currentSlot` "seans açık" diye
 * `midsession` döndürüyordu, yani üçüncü koşu öğlenki yayının ÜSTÜNE
 * yazacaktı ve künyesinde de onun saati ("19:45 TR") görünecekti.
 *
 * Cron artık New York dilimli (5 Kasım 2026); UTC karşılığı mevsimle bir
 * saat kayıyor ve iki mevsim de burada.
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

test("cron üç koşuyu New York saatiyle taşıyor", () => {
  /* 5 Kasım 2026: canlı görev ABD'ye bağlı; UTC cron kışın bir saat
     şaşıyordu (lib/technical.ts → TECHNICAL_CRON). */
  assert.equal(TECHNICAL_CRON, "CRON_TZ=America/New_York 45 8,12,14 * * 1-5");
});

test("nöbet anı mevsimle kayıyor: 08:45 ET yazın 12:45, kışın 13:45 UTC", () => {
  assert.equal(slotInstant("2026-09-18", "premarket").toISOString(), "2026-09-18T12:45:00.000Z");
  assert.equal(slotInstant("2026-11-04", "premarket").toISOString(), "2026-11-04T13:45:00.000Z");
  assert.equal(slotInstant("2026-11-04", "midsession").toISOString(), "2026-11-04T17:45:00.000Z");
  assert.equal(slotInstant("2026-11-04", "lateday").toISOString(), "2026-11-04T19:45:00.000Z");
});

test("yaz saatinde üç nöbet üç ayrı slota düşüyor", () => {
  // 18 Eylül 2026 cuma · EDT (UTC-4): 08:45 · 12:45 · 14:45 NY
  assert.equal(slotAt("2026-09-18", 12, 45), "premarket");
  assert.equal(slotAt("2026-09-18", 16, 45), "midsession");
  assert.equal(slotAt("2026-09-18", 18, 45), "lateday");
});

test("kış saatinde de üç ayrı slot", () => {
  // 4 Aralık 2026 cuma · EST (UTC-5): 08:45 · 12:45 · 14:45 NY = 13:45 · 17:45 · 19:45 UTC
  assert.equal(slotAt("2026-12-04", 13, 45), "premarket");
  assert.equal(slotAt("2026-12-04", 17, 45), "midsession");
  assert.equal(slotAt("2026-12-04", 19, 45), "lateday");
  /* Eski UTC cron'unun kış anları da (07:45 · 11:45 · 13:45 ET) doğru slota
     düşüyor — sınır 13:00 ET; geri dönülürse üstüne yazma olmaz. */
  assert.equal(slotAt("2026-12-04", 16, 45), "midsession");
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
  /* 27 Kasım 2026 · 13:00 ET kapanış. Öğlen nöbetinden (17:45 UTC) sonra
     o günün 19:45'i (14:45 ET) seans dışına düşüyor; sıradaki 30 Kasım
     pazartesi, kış saatiyle 13:45 UTC. */
  const a = nextAt("2026-11-27", 17, 46);
  assert.equal(a?.slot, "premarket");
  assert.equal(a?.at.toISOString(), "2026-11-30T13:45:00.000Z");
});

test("tam tatil gününün tamamı atlanıyor", () => {
  /* Şükran Günü (26 Kasım, perşembe) tam tatil: 25 Kasım çarşamba akşamı
     sorulduğunda sıradaki yayın 27 Kasım cumanın sabahı. */
  const a = nextAt("2026-11-25", 19, 46);
  assert.equal(a?.slot, "premarket");
  assert.equal(a?.at.toISOString(), "2026-11-27T13:45:00.000Z");
});
