import test from "node:test";
import assert from "node:assert/strict";
import type { MarketHoliday } from "../lib/market-hours";
import { outsideQuietHours, portfolioPushDue, portfolioPushKey, portfolioPushText, portfolioPushWeek } from "../lib/portfolio-week-push";
import type { PortfolioWeek, PortfolioWeekMover } from "../lib/portfolio-weekly";
import { pushPrefsEn, pushPrefsTr } from "../lib/i18n/dictionaries/push-prefs";

/** Cuma portföy özeti — zamanlama ve metin (lib/portfolio-week-push.ts). */

const plain = (value: string) => value.replace(/[   ]/g, " ");
const utc = (iso: string) => new Date(iso);
const holiday = (date: string, earlyCloseEt: string | null = null): MarketHoliday => ({ date, nameTr: "T", nameEn: "H", earlyCloseEt });

test("gece sessizliği: 23:00–08:00 TR arası sabah 08:00 TR'ye kayar, gündüz dokunulmaz", () => {
  // TR = UTC+3
  assert.equal(outsideQuietHours(utc("2026-11-13T19:59:00Z")).toISOString(), "2026-11-13T19:59:00.000Z"); // 22:59 TR
  assert.equal(outsideQuietHours(utc("2026-11-13T20:00:00Z")).toISOString(), "2026-11-14T05:00:00.000Z"); // 23:00 TR → ertesi 08:00
  assert.equal(outsideQuietHours(utc("2026-11-13T21:20:00Z")).toISOString(), "2026-11-14T05:00:00.000Z"); // 00:20 TR → aynı sabah 08:00
  assert.equal(outsideQuietHours(utc("2026-11-14T04:59:00Z")).toISOString(), "2026-11-14T05:00:00.000Z"); // 07:59 TR
  assert.equal(outsideQuietHours(utc("2026-11-14T05:00:00Z")).toISOString(), "2026-11-14T05:00:00.000Z"); // 08:00 TR
});

test("kışın normal cuma: kapanış 00:20 TR'de kesinleşir, özet cumartesi 08:00 TR", () => {
  const week = portfolioPushWeek(utc("2026-11-13T15:00:00Z"), [])!;
  assert.equal(week.monday, "2026-11-09");
  assert.equal(week.friday, "2026-11-13");
  assert.equal(week.lastSession, "2026-11-13");
  assert.equal(week.dueAt.toISOString(), "2026-11-14T05:00:00.000Z");
  assert.equal(portfolioPushDue(utc("2026-11-13T21:40:00Z"), []), null); // kapanıştan sonra ama TR'de gece
  assert.equal(portfolioPushDue(utc("2026-11-14T05:07:00Z"), [])?.monday, "2026-11-09"); // cron: 7 5 * * 6
  assert.equal(portfolioPushDue(utc("2026-11-12T05:07:00Z"), []), null); // perşembe sabahı erken
});

test("yazın normal cuma: 23:20 TR'de kesinleşir, yine cumartesi 08:00 TR", () => {
  const week = portfolioPushWeek(utc("2026-07-10T12:00:00Z"), [])!;
  assert.equal(week.lastSession, "2026-07-10");
  assert.equal(week.dueAt.toISOString(), "2026-07-11T05:00:00.000Z");
});

test("cuma tatilse (Good Friday) son işlem günü perşembe, özet cuma 08:00 TR", () => {
  const holidays = [holiday("2026-04-03")];
  const week = portfolioPushWeek(utc("2026-04-03T05:07:00Z"), holidays)!;
  assert.equal(week.monday, "2026-03-30");
  assert.equal(week.lastSession, "2026-04-02");
  assert.equal(week.dueAt.toISOString(), "2026-04-03T05:00:00.000Z");
  assert.ok(portfolioPushDue(utc("2026-04-03T05:07:00Z"), holidays));
});

test("yarım gün cuması (13:00 ET): aynı akşam 21:20 TR — 18:37 UTC koşusu yakalar", () => {
  const holidays = [holiday("2026-11-26"), holiday("2026-11-27", "13:00")];
  const week = portfolioPushWeek(utc("2026-11-27T12:00:00Z"), holidays)!;
  assert.equal(week.lastSession, "2026-11-27");
  assert.equal(week.dueAt.toISOString(), "2026-11-27T18:20:00.000Z");
  assert.equal(portfolioPushDue(utc("2026-11-27T18:10:00Z"), holidays), null);
  assert.ok(portfolioPushDue(utc("2026-11-27T18:37:00Z"), holidays));
});

test("hafta sonu biten haftaya sayılır; pazartesi yeni hafta henüz değil", () => {
  // Cumartesi 01:07 ET ve pazar — aynı hafta
  assert.equal(portfolioPushWeek(utc("2026-11-14T05:07:00Z"), [])!.monday, "2026-11-09");
  assert.equal(portfolioPushWeek(utc("2026-11-15T15:00:00Z"), [])!.monday, "2026-11-09");
  assert.equal(portfolioPushDue(utc("2026-11-16T15:00:00Z"), []), null);
});

test("hiç işlem günü olmayan hafta: özet yok", () => {
  const holidays = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"].map((d) => holiday(d));
  assert.equal(portfolioPushWeek(utc("2026-11-14T10:00:00Z"), holidays), null);
});

test("tekrar anahtarı haftanın pazartesisi", () => {
  assert.equal(portfolioPushKey("2026-11-09"), "portfolio-week:2026-11-09");
});

const mover = (symbol: string, contribution: number): PortfolioWeekMover => ({ symbol, changePct: contribution * 2, contribution, weight: 50 });
const week = (changePct: number, movers: PortfolioWeekMover[]): PortfolioWeek => ({
  changePct,
  covered: movers.length,
  total: movers.length,
  skippedLots: 0,
  movers,
  best: null,
  worst: null,
  ahead: [],
});

test("metin: artı katkıda 'taşıdı', eksi katkıda 'geriletti', yalnız oran", () => {
  const up = portfolioPushText(week(2.34, [mover("MU", 1.8), mover("NVDA", -0.4)]), "tr", pushPrefsTr);
  assert.equal(up.title, "Haftalık Portföy Özeti");
  assert.equal(plain(up.body), "Portföyün bu hafta +%2,3; en çok MU taşıdı.");
  const down = portfolioPushText(week(-1.42, [mover("TSLA", -1.1)]), "tr", pushPrefsTr);
  assert.equal(plain(down.body), "Portföyün bu hafta −%1,4; en çok TSLA geriletti.");
  const en = portfolioPushText(week(2.34, [mover("MU", 1.8)]), "en", pushPrefsEn);
  assert.equal(en.title, "Weekly Portfolio Summary");
  assert.equal(plain(en.body), "Your portfolio this week: +2.3%. MU did the most lifting.");
  assert.doesNotMatch(up.body + down.body + en.body, /\$|USD|adet|shares/);
});

test("metin: görünmez katkıda pozisyon anılmaz", () => {
  const flat = portfolioPushText(week(0.01, [mover("KO", 0.01)]), "tr", pushPrefsTr);
  assert.doesNotMatch(flat.body, /KO/);
  assert.match(plain(flat.body), /^Portföyün bu hafta .+\.$/);
  const empty = portfolioPushText(week(0.5, []), "en", pushPrefsEn);
  assert.equal(plain(empty.body), "Your portfolio this week: +0.5%.");
});
