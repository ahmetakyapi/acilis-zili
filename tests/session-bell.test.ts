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
  clockOf,
  countdownOf,
  durationOf,
  ringAt,
  segments,
  sessionAt,
  strikesBetween,
  sweepAt,
  dayPlan,
  legAt,
  moveLeg,
  planAt,
  planLength,
  sessionPlan,
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
  clock: "{tr} TR · {ny} NY",
  toOpen: "Açılışa {d}",
  toClose: "Kapanışa {d}",
  units: { day: "g", hour: "sa", minute: "dk" },
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

test("saat: TR ve NY, TR gece yarısını geçer", () => {
  assert.equal(clockOf(671, normal, text), "18:11 TR · 11:11 NY");
  assert.equal(clockOf(1300, normal, text), "04:40 TR · 21:40 NY");
});

test("süre: gün/saat/dakika, sıfır parça yazılmaz, yukarı yuvarlar", () => {
  const min = 60_000;
  assert.equal(durationOf(250 * min, text.units), "4 sa 10 dk");
  assert.equal(durationOf(180 * min, text.units), "3 sa");
  assert.equal(durationOf(7.2 * min, text.units), "8 dk");
  assert.equal(durationOf((24 * 60 + 14 * 60 + 5) * min, text.units), "1 g 14 sa");
  assert.equal(durationOf(-5, text.units), "0 dk");
});

test("geri sayım: asıl seansta kapanışa, değilse açılışa", () => {
  const now = 1_000_000;
  const min = 60_000;
  assert.equal(countdownOf(now, 671, normal, now + 1000 * min, now + 289 * min, text), "Kapanışa 4 sa 49 dk");
  assert.equal(countdownOf(now, 300, normal, now + 270 * min, now + 660 * min, text), "Açılışa 4 sa 30 dk");
  assert.equal(countdownOf(now, 600, closed, now + 2000 * min, now + 3000 * min, text), "Açılışa 1 g 9 sa");
});

/* ---- Oynatma (üçüncü sürüm) ---- */

/** Planı 1/30 sn adımlarla yürütür, yoldaki zilleri toplar (live.tsx'in döngüsü gibi). */
function run(legs: ReturnType<typeof sessionPlan>, day: BellDay) {
  const bells: string[] = [];
  let before = legs[0].from;
  for (let t = 1 / 30; t <= planLength(legs) + 0.05; t += 1 / 30) {
    const at = planAt(legs, t);
    if (at.ring) for (const hit of strikesBetween(before, at.minutes, day)) bells.push(hit.bell);
    before = at.minutes;
  }
  return { bells, end: planAt(legs, planLength(legs) + 1) };
}

test("legAt: bacak yumuşak başlar ve tam hedefte biter (ışınlanma yok)", () => {
  const leg = moveLeg(600, 900);
  assert.equal(legAt(leg, 0), 600);
  assert.equal(legAt(leg, leg.dur), 900);
  assert.ok(legAt(leg, leg.dur * 0.1) - 600 < 300 * 0.1, "başta yavaş");
  assert.ok(leg.dur >= 0.6 && leg.dur <= 1.4);
});

test("moveLeg: gece yarısını kısa yoldan geçer", () => {
  const leg = moveLeg(1380, 220);
  assert.equal(leg.to, 220 + DAY);
  assert.equal(leg.ring, false);
});

test("sessionPlan: asıl seansı oynatmak iki zili sırayla çaldırır", () => {
  const regular = segments(normal).find((segment) => segment.kind === "regular")!;
  const { bells, end } = run(sessionPlan(1000, regular), normal);
  assert.deepEqual(bells, ["open", "close"]);
  assert.equal(end.done, true);
  assert.equal(sessionAt(end.minutes - 1, normal), "regular");
});

test("sessionPlan: ön seans açılış ziliyle, akşam seansı kapanış ziliyle biter ya da başlar", () => {
  const [pre, , after] = segments(normal);
  assert.deepEqual(run(sessionPlan(900, pre), normal).bells, ["open"]);
  assert.deepEqual(run(sessionPlan(900, after), normal).bells, ["close"]);
});

test("sessionPlan: taşıma zilsiz (açılışın üstünden geçse bile)", () => {
  // 18:00 ET'den ön seansa kısa yol geriye, açılış ve kapanışın üstünden geçmeden; ileri yol da olsa taşıma çalmaz.
  const [pre] = segments(normal);
  const legs = sessionPlan(1080, pre);
  assert.equal(legs[0].ring, false);
  assert.deepEqual(run(legs, normal).bells, ["open"]);
});

test("dayPlan: gün iki zil çalar; işlem olmayan günde plan yok", () => {
  assert.deepEqual(run(dayPlan(700, normal), normal).bells, ["open", "close"]);
  assert.deepEqual(run(dayPlan(700, half), half).bells, ["open", "close"]);
  assert.deepEqual(dayPlan(700, closed), []);
});
