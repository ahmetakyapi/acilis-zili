import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { etDateOf } from "../lib/fx";
import { spyAnchorDay } from "../lib/return-timeline";
import type { Bar } from "../lib/providers/types";

/**
 * Profil vitrini — SPY tabanını seçen `closeOnOrAfter` (saf).
 *
 * MODÜL NASIL YÜKLENİYOR. `lib/profile-showcase.ts` zincirinde
 * `lib/company-sector.ts` `server-only` içe aktarıyor; o paket düz Node'da
 * (koşul `react-server` değilken) yükleme anında fırlatıyor ve `npm test`
 * modülü hiç açamıyor. Burada YALNIZ o koruma paketi boş bir modülle
 * önbelleğe konuyor: `lib/` kodu olduğu gibi çalışıyor, ağ ve veritabanı
 * çağrılmıyor (`closeOnOrAfter` saf). Kalıcı çözüm testin değil kodun işi:
 * fonksiyon `lib/return-timeline.ts` gibi saf bir modüle taşınırsa bu
 * hazırlık silinir.
 */
const req = createRequire(__filename);
const guard = req.resolve("server-only");
req.cache[guard] = { id: guard, filename: guard, loaded: true, exports: {} } as unknown as NodeJS.Module;
const { closeOnOrAfter } = req("../lib/profile-showcase") as typeof import("../lib/profile-showcase");

/** Günlük bar: damga o günün ET öğlesi (yaz/kış saatinden bağımsız aynı ET günü). */
function bar(day: string, close: number): Bar {
  const time = Date.parse(`${day}T17:00:00Z`) / 1000;
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

const FALLBACK = 999;

/* Temmuz 2026: 3 Temmuz Cuma borsa kapalı (4 Temmuz Cumartesiye düşüyor),
   4-5 hafta sonu. Seride o günlerin barı yok. */
const JULY = [bar("2026-06-30", 600), bar("2026-07-01", 601), bar("2026-07-02", 602), bar("2026-07-06", 606), bar("2026-07-07", 607)];

test("yardımcı: bar damgası beklenen ET gününe düşüyor", () => {
  assert.equal(etDateOf(bar("2026-07-02", 1).time), "2026-07-02");
  assert.equal(etDateOf(bar("2026-01-02", 1).time), "2026-01-02");
});

test("işlem gününde alış: o günün kapanışı", () => {
  assert.equal(closeOnOrAfter(JULY, "2026-07-01", FALLBACK, 0), 601);
  assert.equal(closeOnOrAfter(JULY, "2026-06-30", FALLBACK, 0), 600, "serinin ilk günü dahil");
  assert.equal(closeOnOrAfter(JULY, "2026-07-07", FALLBACK, 0), 607, "serinin son günü dahil");
});

test("tatile düşen alış: sonraki ilk işlem gününün kapanışı", () => {
  assert.equal(closeOnOrAfter(JULY, "2026-07-03", FALLBACK, 0), 606, "tatil cuması → pazartesi");
});

test("hafta sonuna düşen alış: pazartesinin kapanışı", () => {
  assert.equal(closeOnOrAfter(JULY, "2026-07-04", FALLBACK, 0), 606);
  assert.equal(closeOnOrAfter(JULY, "2026-07-05", FALLBACK, 0), 606);
});

test("eksik bar: seride delik varsa önceki güne DÖNÜLMEZ, sonraki bar alınır", () => {
  const gap = [bar("2026-10-19", 650), bar("2026-10-21", 655), bar("2026-10-22", 656)];
  assert.equal(closeOnOrAfter(gap, "2026-10-20", FALLBACK, 0), 655);
});

test("seri boşsa null: yedek fiyat geçmiş uydurmaz", () => {
  assert.equal(closeOnOrAfter([], "2026-07-01", FALLBACK, 0), null);
  assert.equal(closeOnOrAfter([], "2026-07-01", null, 0), null);
});

test("seri o güne inmiyorsa null: ilk bardan eski alış kıyasa giremez", () => {
  assert.equal(closeOnOrAfter(JULY, "2026-06-29", FALLBACK, 0), null);
  assert.equal(closeOnOrAfter(JULY, "2021-01-04", FALLBACK, 0), null);
});

test("son bardan yeni alış: taban yedek (bugünkü) fiyat", () => {
  assert.equal(closeOnOrAfter(JULY, "2026-07-08", FALLBACK, 0), FALLBACK);
  assert.equal(closeOnOrAfter(JULY, "2026-07-08", 612.5, 0), 612.5);
});

test("son bardan yeni alış ve yedek yoksa null", () => {
  assert.equal(closeOnOrAfter(JULY, "2026-07-08", null, 0), null);
});

test("gün ET takvimiyle okunur, UTC ile değil", () => {
  /* 20 Ekim 00:00 UTC = 19 Ekim 20:00 ET: bar 19 Ekim'e aittir. */
  const evening: Bar = { ...bar("2026-10-19", 650), time: Date.parse("2026-10-20T00:00:00Z") / 1000 };
  const next = bar("2026-10-21", 655);
  assert.equal(closeOnOrAfter([evening, next], "2026-10-19", FALLBACK, 0), 650);
  assert.equal(closeOnOrAfter([evening, next], "2026-10-20", FALLBACK, 0), 655);
});

/* Haftalık barlar: damga haftanın BAŞI (pazartesi). */
const WEEKLY = [bar("2026-10-05", 640), bar("2026-10-12", 648), bar("2026-10-19", 655)];

test("haftalık: hafta içi alış KENDİ haftasının barına düşer", () => {
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-14", FALLBACK, 6), 648, "çarşamba");
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-16", FALLBACK, 6), 648, "cuma");
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-12", FALLBACK, 6), 648, "haftanın ilk günü");
});

test("haftalık: pay verilmezse aynı alış bir sonraki haftaya kayar (payın varlık nedeni)", () => {
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-14", FALLBACK, 0), 655);
});

test("haftalık: haftanın son günü (pazar) hâlâ o haftanın barı, pazartesi yenisi", () => {
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-18", FALLBACK, 6), 648);
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-19", FALLBACK, 6), 655);
});

test("haftalık: son barın haftası içinde bar, haftası bitince yedek", () => {
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-25", FALLBACK, 6), 655);
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-26", FALLBACK, 6), FALLBACK);
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-26", null, 6), null);
});

test("haftalık: ilk barın damgasından eski alış null", () => {
  assert.equal(closeOnOrAfter(WEEKLY, "2026-10-04", FALLBACK, 6), null);
});

test("vitrinin zinciri: günlük seri o aya inmiyorsa haftalığa düşülür", () => {
  const daily = [bar("2026-10-01", 640), bar("2026-10-02", 641)];
  const weekly = [bar("2026-08-31", 630), bar("2026-09-07", 634), bar("2026-09-14", 638)];
  const anchor = spyAnchorDay("2026-09-17");
  assert.equal(anchor, "2026-09-01");
  const base = closeOnOrAfter(daily, anchor, FALLBACK, 0) ?? closeOnOrAfter(weekly, anchor, FALLBACK, 6);
  assert.equal(base, 630, "1 Eylül salı, 31 Ağustos haftasının içinde");
});

test("vitrinin zinciri: ay başı tatilse (1 Ocak) taban ayın ilk İŞLEM gününün kapanışı", () => {
  const january = [bar("2025-12-31", 580), bar("2026-01-02", 584), bar("2026-01-05", 586)];
  const anchor = spyAnchorDay("2026-01-15");
  assert.equal(anchor, "2026-01-01");
  assert.equal(closeOnOrAfter(january, anchor, FALLBACK, 0), 584);
});

test("vitrinin zinciri: iki seri de o güne inmiyorsa null (parti kıyasın dışında kalır)", () => {
  const anchor = spyAnchorDay("2020-03-10");
  const base = closeOnOrAfter(JULY, anchor, FALLBACK, 0) ?? closeOnOrAfter(WEEKLY, anchor, FALLBACK, 6);
  assert.equal(base, null);
});
