import test from "node:test";
import assert from "node:assert/strict";
import { cardMoves, parseCardDate, pickKeyEvents } from "../lib/day-card";
import { embedThemeFromParam, isEmbedPath } from "../lib/embed";
import { etDateTimeToUtc, getMarketStatus } from "../lib/market-hours";

/**
 * Açılış Kartı'nın saf kararları — hangi tarih kabul edilir, hangi üç olay
 * seçilir ve endeks yüzdesi HANGİ SEANSI anlatıyor. Sonuncusu kartın
 * dürüstlük sözü: kanıtlanamayan yüzde basılmaz.
 */

const MONDAY = "2026-09-28";
const FRIDAY = "2026-09-25";

test("tarih: takma ad, biçim ve pencere", () => {
  assert.equal(parseCardDate("bugun", MONDAY), MONDAY);
  assert.equal(parseCardDate("2026-09-29", MONDAY), "2026-09-29");
  assert.equal(parseCardDate("2026-02-30", MONDAY), null);
  assert.equal(parseCardDate("28-09-2026", MONDAY), null);
  assert.equal(parseCardDate("1900-01-01", MONDAY), null);
  assert.equal(parseCardDate("2027-06-01", MONDAY), null);
});

test("olaylar: en fazla iki makro, kalan yer büyük bilançolar, zaman sırası", () => {
  const events = pickKeyEvents(
    [
      { title: "Haftalık Petrol Stokları", timeEt: "10:30", importance: "low" },
      { title: "Tüketici Güveni", timeEt: "10:00", importance: "medium" },
      { title: "TÜFE", timeEt: "08:30", importance: "high" },
      { title: "FOMC Faiz Kararı", timeEt: "14:00", importance: "high" },
    ],
    [
      { symbol: "SMALL", name: "Small Co", hour: "bmo", marketCap: 1e9 },
      { symbol: "NVDA", name: "NVIDIA", hour: "amc", marketCap: 4e12 },
    ],
  );
  assert.deepEqual(
    events.map((event) => (event.kind === "economic" ? event.title : event.symbol)),
    ["TÜFE", "FOMC Faiz Kararı", "NVDA"],
  );
});

test("olaylar: makro yoksa üç yer de bilançoya", () => {
  const events = pickKeyEvents(
    [],
    [
      { symbol: "A", name: null, hour: "amc", marketCap: 3 },
      { symbol: "B", name: null, hour: "bmo", marketCap: 2 },
      { symbol: "C", name: null, hour: null, marketCap: 1 },
      { symbol: "D", name: null, hour: "bmo", marketCap: 0.5 },
    ],
  );
  // B açılış öncesi → önce; A kapanış sonrası; saati bilinmeyen C en sonda.
  assert.deepEqual(
    events.map((event) => (event.kind === "earnings" ? event.symbol : "")),
    ["B", "A", "C"],
  );
});

test("hareket: seans içinde seans yüzdesi, künye `session`", () => {
  const status = getMarketStatus(etDateTimeToUtc(MONDAY, "11:00"), []);
  const moves = cardMoves(
    MONDAY,
    status,
    [
      { symbol: "QQQ", changePct: 0.8, tradedAt: etDateTimeToUtc(MONDAY, "10:44") },
      // Bu sembolde bugün işlem yok: önceki günü anlatıyor, karttan düşer.
      { symbol: "SPY", changePct: -0.2, tradedAt: etDateTimeToUtc(FRIDAY, "15:59") },
    ],
    false,
  );
  assert.equal(moves?.basis, "session");
  assert.deepEqual(moves?.items.map((item) => item.symbol), ["QQQ"]);
});

test("hareket: açılış öncesi (seans günü dün) önceki kapanış, tarihiyle", () => {
  // Pazartesi 02:00 ET: seans günü hâlâ cuma.
  const status = getMarketStatus(etDateTimeToUtc(MONDAY, "02:00"), []);
  assert.equal(status.sessionDate, FRIDAY);
  const moves = cardMoves(
    MONDAY,
    status,
    [{ symbol: "SPY", changePct: 1.1, tradedAt: etDateTimeToUtc(FRIDAY, "15:59") }],
    false,
  );
  assert.equal(moves?.basis, "lastClose");
  assert.equal(moves?.sessionDay, FRIDAY);
});

test("hareket: geçmiş ya da gelecek günün kartına yüzde yazılmaz", () => {
  const status = getMarketStatus(etDateTimeToUtc(MONDAY, "11:00"), []);
  const quotes = [{ symbol: "SPY", changePct: 0.4, tradedAt: etDateTimeToUtc(MONDAY, "10:40") }];
  assert.equal(cardMoves(FRIDAY, status, quotes, false), null);
  assert.equal(cardMoves("2026-09-29", status, quotes, false), null);
});

test("hareket: bayat paket hiç basılmaz", () => {
  const status = getMarketStatus(etDateTimeToUtc(MONDAY, "11:00"), []);
  const quotes = [{ symbol: "SPY", changePct: 0.4, tradedAt: etDateTimeToUtc(MONDAY, "10:40") }];
  assert.equal(cardMoves(MONDAY, status, quotes, true), null);
});

test("gömülü parça: tema parametresi ve yol", () => {
  assert.equal(embedThemeFromParam("koyu"), "dark");
  assert.equal(embedThemeFromParam("acik"), "light");
  assert.equal(embedThemeFromParam("dark"), null);
  assert.equal(embedThemeFromParam(null), null);
  assert.equal(isEmbedPath("/gomulu/geri-sayim"), true);
  assert.equal(isEmbedPath("/gomuluX"), false);
  assert.equal(isEmbedPath("/hakkinda"), false);
});
