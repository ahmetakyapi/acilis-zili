import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedTtl,
  candleTtlSeconds,
  quoteTtlSeconds,
  type MarketSession,
  type MarketStatus,
} from "../lib/market-hours";

/**
 * Önbellek ömürleri — bildirilen hatanın testi.
 *
 * Şikâyet: şirket sayfası bazen dünün verisiyle açılıyor, bir-iki yenilemeden
 * sonra bugünkü geliyor. Sebeplerden biri ölçülebilir ve buradadır: hiçbir
 * kaydın ömrü ekrandaki seans anlatısının değiştiği anı (`nextTransition`)
 * aşmamalı. Aşarsa gece yazılan bir kayıt ertesi sabahki sayfada duruyor.
 */
function statusAt(session: MarketSession, secondsToTransition: number): MarketStatus {
  const now = Date.parse("2026-09-16T12:00:00Z");
  return {
    session,
    isRegularOpen: session === "regular",
    etDate: "2026-09-16",
    sessionDate: "2026-09-16",
    etTime: "08:00",
    etMinutes: 480,
    isWeekend: false,
    holiday: null,
    tradingToday: true,
    closeMinutes: 960,
    nextOpen: new Date(now + secondsToTransition * 1000),
    nextClose: new Date(now + secondsToTransition * 1000),
    nextTransition: new Date(now + secondsToTransition * 1000),
  };
}

const NOW = new Date("2026-09-16T12:00:00Z");

test("hiçbir ömür seans sınırını aşmaz", () => {
  // Kapanıştan sonra taban 900 saniye; sınıra 120 saniye kalmışsa 120.
  assert.equal(quoteTtlSeconds(statusAt("closed", 120), NOW), 120);
  // Sınır uzaktaysa taban korunur.
  assert.equal(quoteTtlSeconds(statusAt("closed", 7200), NOW), 900);
  // Grafik barları da aynı kırpmadan geçer.
  assert.equal(candleTtlSeconds("1Y", statusAt("closed", 300), NOW), 300);
});

test("sınırın son saniyelerinde ömür sıfıra inmez", () => {
  assert.equal(boundedTtl(900, statusAt("closed", 3), NOW), 15);
  // Sınır geçmişte kalmışsa (durum nesnesi belleklenmişse) kısa ömürle devam.
  assert.equal(boundedTtl(900, statusAt("closed", -60), NOW), 60);
  assert.equal(boundedTtl(10, statusAt("closed", -60), NOW), 15);
});

test("uzun aralıklı grafikler artık 12 saat yaşamıyor", () => {
  // Eski kural 1D ve 1W dışındaki her aralığa 43200 saniye veriyordu; oysa
  // her aralık BUGÜNDE bitiyor ve bugünün barı seans boyunca değişiyor.
  for (const range of ["1M", "3M", "6M", "YTD", "1Y", "5Y"]) {
    assert.ok(candleTtlSeconds(range, statusAt("regular", 86400), NOW) <= 900, range);
    assert.ok(candleTtlSeconds(range, statusAt("closed", 86400), NOW) <= 3600, range);
  }
});

test("gün içi aralıklar seans açıkken en sık tazelenen", () => {
  const open = statusAt("regular", 86400);
  assert.ok(candleTtlSeconds("1D", open, NOW) < candleTtlSeconds("1Y", open, NOW));
  assert.equal(quoteTtlSeconds(open, NOW), 15);
});
