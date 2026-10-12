import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAY,
  PLUNGE_BACK,
  PLUNGE_OUT,
  RING,
  SWEEP,
  angleOf,
  minutesOfAngle,
  plungeAt,
  readoutOf,
  ringAt,
  segments,
  sessionAt,
  strikesBetween,
  sweepAt,
  type BellDay,
} from "../components/figures/session-bell/model";

/* Seans Zili figürünün saf modeli (components/figures/session-bell). Saatler
   lib/market-hours.ts'ten gelir; burada sabitlenen dakika aritmetiği, zilin
   yalnız açılış ve kapanışta çalması ve künyenin iki saati doğru yazması. */

const normal: BellDay = { tradingToday: true, preOpen: 240, open: 570, close: 960, afterClose: 1200, trOffset: 420 };
const half: BellDay = { ...normal, close: 780, afterClose: 1020 };
const closed: BellDay = { ...normal, tradingToday: false };
const text = {
  sessions: { pre: "Ön Seans", regular: "Asıl Seans", after: "Akşam Seansı", closed: "Piyasa Kapalı" },
  openBell: "Açılış Zili",
  closeBell: "Kapanış Zili",
  closedDay: "Hafta Sonu · Piyasa Kapalı",
  clock: "{tr} TR · {ny} NY",
};

test("seans yayları: ön, asıl, akşam; yarım günde kapanış ve akşam erken", () => {
  assert.deepEqual(segments(normal).map((s) => [s.kind, s.from, s.to]), [["pre", 240, 570], ["regular", 570, 960], ["after", 960, 1200]]);
  assert.deepEqual(segments(half).at(-1), { kind: "after", from: 780, to: 1020 });
  assert.deepEqual(segments(closed), []);
});

test("seans: sınırlar yarı açık; işlem olmayan gün hep kapalı", () => {
  assert.equal(sessionAt(569, normal), "pre");
  assert.equal(sessionAt(570, normal), "regular");
  assert.equal(sessionAt(960, normal), "after");
  assert.equal(sessionAt(1200, normal), "closed");
  assert.equal(sessionAt(600, closed), "closed");
});

test("açı: 00:00 arkada, 06:00 sağda, saat yönü; açıdan dakika 15'liğe oturur", () => {
  assert.equal(angleOf(0), 0);
  assert.ok(Math.abs(angleOf(360) - Math.PI / 2) < 1e-12);
  assert.equal(minutesOfAngle(angleOf(572)), 570);
  assert.equal(minutesOfAngle(-0.001), 0);
});

test("zil yalnız ileri giderken ve yalnız açılış/kapanışta çalar", () => {
  assert.deepEqual(strikesBetween(0, 1439, normal).map((s) => s.bell), ["open", "close"]);
  assert.deepEqual(strikesBetween(560, 575, normal), [{ at: 570, bell: "open" }]);
  assert.deepEqual(strikesBetween(575, 560, normal), [], "geri sarmak zil çaldırmaz");
  assert.deepEqual(strikesBetween(600, 900, normal), [], "seans içinde zil yok");
  assert.deepEqual(strikesBetween(240, 250, normal), [], "ön seansın başı zil anı değil");
  assert.deepEqual(strikesBetween(0, 1439, closed), [], "tatilde zil yok");
  assert.deepEqual(strikesBetween(770, 790, half), [{ at: 780, bell: "close" }], "yarım günde kapanış zili 13:00");
});

test("zil: gece yarısını geçen tur", () => {
  assert.deepEqual(strikesBetween(1400, DAY + 600, normal), [{ at: DAY + 570, bell: "open" }]);
});

test("vuruş zarfı: dövücü gider ve döner, çan söner, sonunda tam sıfır", () => {
  assert.equal(plungeAt(0), 0);
  assert.equal(plungeAt(PLUNGE_OUT), 1);
  assert.equal(plungeAt(PLUNGE_OUT + PLUNGE_BACK), 0);
  assert.equal(ringAt(0), 0, "temastan önce titreşim yok");
  assert.equal(ringAt(RING), 0);
  for (let t = 0; t <= RING; t += 0.01) assert.ok(Math.abs(ringAt(t)) <= 1);
});

test("günün tekrarı: gece yarısından şimdiye, SWEEP sn'de", () => {
  assert.equal(sweepAt(0, 671), 0);
  assert.equal(sweepAt(SWEEP, 671), 671);
  assert.equal(sweepAt(SWEEP * 2, 671), 671);
});

test("künye: TR ve NY saati, seans; zil anında zilin adı", () => {
  assert.equal(readoutOf(671, normal, text), "18:11 TR · 11:11 NY · Asıl Seans");
  assert.equal(readoutOf(570, normal, text), "16:30 TR · 09:30 NY · Açılış Zili");
  assert.equal(readoutOf(962, normal, text), "23:02 TR · 16:02 NY · Kapanış Zili");
  assert.equal(readoutOf(1300, normal, text), "04:40 TR · 21:40 NY · Piyasa Kapalı", "TR saati gece yarısını geçer");
  assert.equal(readoutOf(600, closed, text, "Şükran Günü · Piyasa Kapalı"), "17:00 TR · 10:00 NY · Şükran Günü · Piyasa Kapalı");
});
