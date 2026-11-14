import test from "node:test";
import assert from "node:assert/strict";

import { releaseDue } from "../lib/calendar-sync";

/**
 * `releaseDue` — "açıklama saati + 30 dakika pay geçti mi" (saf; veritabanı
 * ve FRED çağrılmaz).
 *
 * Saat ET olarak saklanıyor, karşılaştırma UTC anıyla. 08:30 ET yazın
 * 12:30 UTC, kışın 13:30 UTC: sınır bir saat yanlış okunursa değer ya bir
 * saat geç yazılır ya da (daha kötüsü) yayından ÖNCE FRED'e sorulup önceki
 * ayın gözlemi "gerçekleşen" diye satıra yapışabilir.
 *
 * ABD yaz saati: 8 Mart 2026 – 1 Kasım 2026, 14 Mart 2027 – 7 Kasım 2027.
 */

const at = (iso: string) => new Date(iso);
const event = (eventDate: string, eventTimeEt: string | null) => ({ eventDate, eventTimeEt });

/** Sınırın iki yanı: `iso` anında vadesi gelmiş, bir milisaniye önce gelmemiş. */
function assertDueExactlyAt(eventDate: string, timeEt: string, iso: string) {
  const edge = at(iso).getTime();
  const row = event(eventDate, timeEt);
  assert.equal(releaseDue(row, new Date(edge)), true, `${eventDate} ${timeEt} ET → ${iso} anında vadesi gelmeli`);
  assert.equal(releaseDue(row, new Date(edge - 1)), false, `${eventDate} ${timeEt} ET → ${iso} öncesinde gelmemeli`);
}

test("yaz saati (EDT, UTC-4): 08:30 ET + 30 dk = 13:00 UTC", () => {
  assertDueExactlyAt("2026-07-14", "08:30", "2026-07-14T13:00:00.000Z");
});

test("kış saati (EST, UTC-5): 08:30 ET + 30 dk = 14:00 UTC", () => {
  assertDueExactlyAt("2026-01-13", "08:30", "2026-01-13T14:00:00.000Z");
});

test("pay tam 30 dakika: açıklama anında ve 29. dakikada henüz değil", () => {
  const row = event("2026-07-14", "08:30");
  assert.equal(releaseDue(row, at("2026-07-14T12:30:00Z")), false, "açıklama anı");
  assert.equal(releaseDue(row, at("2026-07-14T12:59:59.999Z")), false);
  assert.equal(releaseDue(row, at("2026-07-14T13:00:00Z")), true);
});

test("ilkbahar geçişi 2026: cuma kış saatiyle, pazartesi yaz saatiyle", () => {
  assertDueExactlyAt("2026-03-06", "08:30", "2026-03-06T14:00:00.000Z");
  assertDueExactlyAt("2026-03-09", "08:30", "2026-03-09T13:00:00.000Z");
});

test("ilkbahar geçiş günü (8 Mart 2026): sabah 08:30 artık yaz saatinde", () => {
  assertDueExactlyAt("2026-03-08", "08:30", "2026-03-08T13:00:00.000Z");
});

test("ilkbahar geçiş günü: 02:00 öncesi hâlâ kış saati, 03:00 sonrası yaz saati", () => {
  assertDueExactlyAt("2026-03-08", "00:30", "2026-03-08T06:00:00.000Z");
  assertDueExactlyAt("2026-03-08", "03:30", "2026-03-08T08:00:00.000Z");
});

test("sonbahar geçişi 2026: cuma yaz saatiyle, pazartesi kış saatiyle", () => {
  assertDueExactlyAt("2026-10-30", "08:30", "2026-10-30T13:00:00.000Z");
  assertDueExactlyAt("2026-11-02", "08:30", "2026-11-02T14:00:00.000Z");
});

test("sonbahar geçiş günü (1 Kasım 2026): sabah 08:30 artık kış saatinde", () => {
  assertDueExactlyAt("2026-11-01", "08:30", "2026-11-01T14:00:00.000Z");
});

test("sonbahar geçiş günü: 01:00 öncesi hâlâ yaz saati, 02:00 sonrası kış saati", () => {
  assertDueExactlyAt("2026-11-01", "00:30", "2026-11-01T05:00:00.000Z");
  assertDueExactlyAt("2026-11-01", "03:30", "2026-11-01T09:00:00.000Z");
});

test("2027 geçişleri: kural yıla gömülü değil", () => {
  assertDueExactlyAt("2027-03-12", "08:30", "2027-03-12T14:00:00.000Z");
  assertDueExactlyAt("2027-03-15", "08:30", "2027-03-15T13:00:00.000Z");
  assertDueExactlyAt("2027-11-05", "08:30", "2027-11-05T13:00:00.000Z");
  assertDueExactlyAt("2027-11-08", "08:30", "2027-11-08T14:00:00.000Z");
});

test("öğleden sonra açıklaması (FOMC 14:00 ET): yazın 18:30, kışın 19:30 UTC", () => {
  assertDueExactlyAt("2026-07-29", "14:00", "2026-07-29T18:30:00.000Z");
  assertDueExactlyAt("2026-12-09", "14:00", "2026-12-09T19:30:00.000Z");
});

test("gece yarısına yakın saat: pay UTC'de ertesi güne taşar", () => {
  assertDueExactlyAt("2026-07-14", "23:45", "2026-07-15T04:15:00.000Z");
  assertDueExactlyAt("2026-01-13", "23:45", "2026-01-14T05:15:00.000Z");
});

test("yılbaşı: 31 Aralık ve 1 Ocak kış saatiyle", () => {
  assertDueExactlyAt("2026-12-31", "08:30", "2026-12-31T14:00:00.000Z");
  assertDueExactlyAt("2027-01-01", "08:30", "2027-01-01T14:00:00.000Z");
});

test("saati olmayan olay hiçbir zaman 'geçti' sayılmaz", () => {
  const farFuture = at("2099-01-01T00:00:00Z");
  assert.equal(releaseDue(event("2026-07-14", null), farFuture), false);
  assert.equal(releaseDue(event("2026-07-14", ""), farFuture), false);
});

test("gelecekteki olay geçmedi, günler öncesinin olayı geçti", () => {
  const now = at("2026-07-14T16:00:00Z");
  assert.equal(releaseDue(event("2026-07-15", "08:30"), now), false);
  assert.equal(releaseDue(event("2026-08-12", "08:30"), now), false);
  assert.equal(releaseDue(event("2026-07-13", "08:30"), now), true);
  assert.equal(releaseDue(event("2025-07-15", "08:30"), now), true);
});

test("İstanbul'da ertesi güne geçilmiş olması ET olayını erkene çekmez", () => {
  /* 14 Temmuz 00:30 İstanbul = 13 Temmuz 21:30 UTC: 14 Temmuz'un 08:30 ET
     açıklamasına daha 15 saat var. */
  assert.equal(releaseDue(event("2026-07-14", "08:30"), at("2026-07-13T21:30:00Z")), false);
});
