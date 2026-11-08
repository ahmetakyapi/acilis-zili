import test from "node:test";
import assert from "node:assert/strict";
import {
  getMarketStatus,
  lastSettledSession,
  sessionEndOf,
  sessionPhase,
  settledAt,
  settledSessionOf,
  type MarketHoliday,
} from "../lib/market-hours";
import type { Bar } from "../lib/providers/types";
import { completedBars, computeSnapshot } from "../lib/technical";

/**
 * "Tamamlanmış seans" TEK KAYNAK (8 Kasım, örtük durum makinesi denetimi
 * 1. bulgu): kapanış + besleme gecikmesi (15 dk) + pay (5 dk). 16:00–16:20
 * ET arasında bugünün gün barı YARIM — yazma katmanı (hisse notu, teknik
 * fotoğraf, Claude analizi) onu tamam saymamalı.
 */

const HOLIDAYS: MarketHoliday[] = [
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Yarım Gün", nameEn: "Half Day", earlyCloseEt: "13:00" },
];

const at = (iso: string) => new Date(iso);
const phaseAt = (iso: string) => sessionPhase(getMarketStatus(at(iso), HOLIDAYS));
const settledAtIso = (iso: string) => lastSettledSession(at(iso), HOLIDAYS);

test("normal gün (yaz saati): 15:59 seans, 16:05 ve 16:19 settling, 16:21 kesin", () => {
  // Salı 20 Ekim 2026, EDT (UTC-4): 16:00 ET = 20:00Z.
  assert.equal(phaseAt("2026-10-20T19:59:00Z"), "regular");
  assert.equal(settledAtIso("2026-10-20T19:59:00Z"), "2026-10-19");
  assert.equal(phaseAt("2026-10-20T20:05:00Z"), "settling");
  assert.equal(settledAtIso("2026-10-20T20:05:00Z"), "2026-10-19");
  assert.equal(phaseAt("2026-10-20T20:19:00Z"), "settling");
  assert.equal(settledAtIso("2026-10-20T20:19:00Z"), "2026-10-19");
  // Sınır tam 16:20: kapanış + 15 + 5.
  assert.equal(phaseAt("2026-10-20T20:20:00Z"), "settled");
  assert.equal(phaseAt("2026-10-20T20:21:00Z"), "settled");
  assert.equal(settledAtIso("2026-10-20T20:21:00Z"), "2026-10-20");
  // Akşam seansı bitince de, gece yarısına kadar bugün.
  assert.equal(settledAtIso("2026-10-21T03:59:00Z"), "2026-10-20");
});

test("açılış öncesi ve gece: önceki işlem günü", () => {
  // Salı 03:00 ET — gün başlamadı.
  assert.equal(phaseAt("2026-10-20T07:00:00Z"), "closed");
  assert.equal(settledAtIso("2026-10-20T07:00:00Z"), "2026-10-19");
  // Salı 08:45 ET — ön seans.
  assert.equal(phaseAt("2026-10-20T12:45:00Z"), "pre-market");
  assert.equal(settledAtIso("2026-10-20T12:45:00Z"), "2026-10-19");
  // Pazartesi sabahı ön seans: cuma.
  assert.equal(settledAtIso("2026-10-19T12:45:00Z"), "2026-10-16");
});

test("yarım gün: 13:05 settling, 13:21 kesin; tatilden önceki gün atlanmaz", () => {
  // 27 Kasım 2026 cuma, EST (UTC-5), 13:00 ET kapanış = 18:00Z. 26 Kasım tam tatil.
  assert.equal(phaseAt("2026-11-27T17:59:00Z"), "regular");
  assert.equal(phaseAt("2026-11-27T18:05:00Z"), "settling");
  assert.equal(settledAtIso("2026-11-27T18:05:00Z"), "2026-11-25");
  assert.equal(phaseAt("2026-11-27T18:21:00Z"), "settled");
  assert.equal(settledAtIso("2026-11-27T18:21:00Z"), "2026-11-27");
  assert.equal(settledAt("2026-11-27", HOLIDAYS).toISOString(), "2026-11-27T18:20:00.000Z");
});

test("hafta sonu ve tam tatil: evre closed, son işlem günü", () => {
  assert.equal(phaseAt("2026-10-24T15:00:00Z"), "closed");
  assert.equal(settledAtIso("2026-10-24T15:00:00Z"), "2026-10-23");
  assert.equal(settledAtIso("2026-10-25T22:00:00Z"), "2026-10-23");
  // Şükran Günü öğlen ve akşam: çarşamba.
  assert.equal(phaseAt("2026-11-26T17:00:00Z"), "closed");
  assert.equal(settledAtIso("2026-11-26T17:00:00Z"), "2026-11-25");
  assert.equal(settledAtIso("2026-11-26T23:00:00Z"), "2026-11-25");
});

test("yaz/kış saati sınırı: 16:20 ET UTC'de bir saat kayar", () => {
  // Yaz saati 1 Kasım 2026 pazar bitiyor. Cuma 30 Ekim EDT: 16:20 ET = 20:20Z.
  assert.equal(settledAt("2026-10-30", []).toISOString(), "2026-10-30T20:20:00.000Z");
  assert.equal(settledAtIso("2026-10-30T20:19:00Z"), "2026-10-29");
  assert.equal(settledAtIso("2026-10-30T20:21:00Z"), "2026-10-30");
  // Pazartesi 2 Kasım EST: 20:21Z = 15:21 ET — seans sürüyor.
  assert.equal(settledAt("2026-11-02", []).toISOString(), "2026-11-02T21:20:00.000Z");
  assert.equal(phaseAt("2026-11-02T20:21:00Z"), "regular");
  assert.equal(settledAtIso("2026-11-02T20:21:00Z"), "2026-10-30");
  assert.equal(phaseAt("2026-11-02T21:05:00Z"), "settling");
  assert.equal(settledAtIso("2026-11-02T21:21:00Z"), "2026-11-02");
  // Yaz saati 8 Mart 2026 pazar başlıyor. Cuma 6 Mart EST, pazartesi 9 Mart EDT.
  assert.equal(settledAtIso("2026-03-06T21:19:00Z"), "2026-03-05");
  assert.equal(settledAtIso("2026-03-09T20:21:00Z"), "2026-03-09");
});

test("settledSessionOf, durumdan okunan aynı cevabı verir", () => {
  for (const iso of ["2026-10-20T20:05:00Z", "2026-10-20T20:21:00Z", "2026-11-27T18:05:00Z", "2026-11-26T17:00:00Z"]) {
    assert.equal(settledSessionOf(getMarketStatus(at(iso), HOLIDAYS), HOLIDAYS), settledAtIso(iso), iso);
  }
});

test("sessionEndOf: akşam seansı sonu + gecikme; yarım günde erken, MarketStatus ile aynı", () => {
  assert.equal(sessionEndOf("2026-10-20", HOLIDAYS).toISOString(), "2026-10-21T00:15:00.000Z");
  assert.equal(sessionEndOf("2026-11-27", HOLIDAYS).toISOString(), "2026-11-27T22:15:00.000Z");
  const status = getMarketStatus(at("2026-10-24T15:00:00Z"), HOLIDAYS);
  assert.equal(status.sessionEnd.toISOString(), sessionEndOf("2026-10-23", HOLIDAYS).toISOString());
});

/* --------------------------------------------------------------------------
   completedBars / computeSnapshot — yazma katmanının gördüğü barlar
   -------------------------------------------------------------------------- */

const bar = (date: string, close: number): Bar => ({
  time: Math.floor(new Date(`${date}T14:00:00Z`).getTime() / 1000),
  open: close,
  high: close,
  low: close,
  close,
  volume: 1_000,
});

const series: Bar[] = [bar("2026-10-16", 100), bar("2026-10-19", 101), bar("2026-10-20", 102)];
const lastDayAt = (iso: string, bars: Bar[] = series) =>
  completedBars(bars, getMarketStatus(at(iso), HOLIDAYS)).at(-1)?.time;
const day = (b: Bar) => b.time;

test("completedBars: bugünün barı 16:20 ET'den önce atılır (16:05 ve 16:19 dahil)", () => {
  assert.equal(lastDayAt("2026-10-20T19:59:00Z"), day(series[1]!));
  assert.equal(lastDayAt("2026-10-20T20:05:00Z"), day(series[1]!));
  assert.equal(lastDayAt("2026-10-20T20:19:00Z"), day(series[1]!));
  assert.equal(lastDayAt("2026-10-20T20:21:00Z"), day(series[2]!));
  // Ön seans: bugünün barı (varsa) yine atılır.
  assert.equal(lastDayAt("2026-10-20T12:45:00Z"), day(series[1]!));
});

test("completedBars: yarım günde 13:05 atılır, 13:21 girer", () => {
  const half = [bar("2026-11-24", 100), bar("2026-11-25", 101), bar("2026-11-27", 102)];
  assert.equal(lastDayAt("2026-11-27T18:05:00Z", half), day(half[1]!));
  assert.equal(lastDayAt("2026-11-27T18:21:00Z", half), day(half[2]!));
});

test("completedBars: bugüne ait olmayan son bar hiç atılmaz", () => {
  // Cumartesi — son bar cuma; dokunulmaz.
  const friday = [bar("2026-10-22", 100), bar("2026-10-23", 101)];
  assert.equal(completedBars(friday, getMarketStatus(at("2026-10-24T15:00:00Z"), HOLIDAYS)).length, 2);
  // Seans içinde son bar dünse (bugünün barı henüz gelmedi) yine dokunulmaz.
  assert.equal(completedBars(series.slice(0, 2), getMarketStatus(at("2026-10-20T15:00:00Z"), HOLIDAYS)).length, 2);
  assert.deepEqual(completedBars([], getMarketStatus(at("2026-10-20T15:00:00Z"), HOLIDAYS)), []);
});

test("computeSnapshot: 16:05 ET fotoğrafı dünkü seansı anlatır, 16:21 bugünü", () => {
  const early = computeSnapshot(series, null, getMarketStatus(at("2026-10-20T20:05:00Z"), HOLIDAYS), at("2026-10-20T20:05:00Z"));
  assert.equal(early.lastSession, "2026-10-19");
  assert.equal(early.prevClose, 101);
  const late = computeSnapshot(series, null, getMarketStatus(at("2026-10-20T20:21:00Z"), HOLIDAYS), at("2026-10-20T20:21:00Z"));
  assert.equal(late.lastSession, "2026-10-20");
  assert.equal(late.prevClose, 102);
});
