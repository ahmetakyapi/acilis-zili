import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIP_IN,
  DWELL,
  HOLD,
  HOME,
  LAMP_GAP,
  START,
  TRAVEL,
  finalPose,
  lastStop,
  loopLength,
  readoutOf,
  tourAt,
  type BenchData,
} from "../components/figures/rule-bench/model";

/* Kural Tezgâhı figürünün saf modeli (components/figures/rule-bench). Figür
   hesaplamaz; burada sabitlenen şey zaman çizelgesi ve künyenin raporla aynı
   sayıyı söylemesi. */

const text = {
  passed: "Geçen {n}",
  warned: "Dikkat {n}",
  failed: "Kalan {n}",
  missing: "Veri Yok {n}",
  score: "Puan {n}",
  gatePass: "Geçti",
  gateFail: "Elendi",
};

const data = (eliminated = false): BenchData => ({
  symbol: "MU",
  score: eliminated ? 45 : 82,
  eliminated,
  stations: [
    { id: "gate", name: "Eleme", score: null, statuses: eliminated ? ["fail", "pass", "pass"] : ["pass", "pass", "pass"] },
    { id: "growth", name: "Büyüme", score: 75, statuses: ["pass", "pass", "warn", "fail"] },
    { id: "profitability", name: "Kârlılık", score: 100, statuses: ["pass", "pass"] },
    { id: "health", name: "Finansal Sağlık", score: 100, statuses: ["pass", "pass", "na"] },
    { id: "strength", name: "Fiyat Gücü", score: 88, statuses: ["pass", "pass", "pass", "warn"] },
    { id: "ownership", name: "Sahiplik", score: null, statuses: ["na", "na", "na"] },
    { id: "catalyst", name: "Katalizör", score: 50, statuses: ["pass", "fail", "na"] },
  ],
});

test("son poz: bütün lambalar yanık, kızak son istasyonda, kol kalkık", () => {
  const pose = finalPose(data());
  assert.equal(pose.carriage, 6);
  assert.deepEqual(pose.lit, [3, 4, 2, 3, 4, 3, 3]);
  assert.equal(pose.armDown, false);
});

test("elenen hisse: kızak kapıda durur, kol iner, sonraki istasyonlar sönük", () => {
  const pose = finalPose(data(true));
  assert.equal(lastStop(data(true)), 0);
  assert.equal(pose.carriage, 0);
  assert.deepEqual(pose.lit, [3, 0, 0, 0, 0, 0, 0]);
  assert.equal(pose.armDown, true);
});

test("tur başında kızak evde, lambalar sönük", () => {
  const pose = tourAt(0.1, data());
  assert.equal(pose.carriage, HOME);
  assert.ok(pose.lit.every((n) => n === 0));
});

test("istasyonda: yoklayıcı iner, lambalar 90 ms arayla birer birer yanar", () => {
  const atGrowth = START + (TRAVEL + DWELL) + TRAVEL; // 2. istasyona varış
  assert.equal(tourAt(atGrowth + DIP_IN / 2, data()).lit[1], 0);
  assert.equal(tourAt(atGrowth + DIP_IN + 0.01, data()).lit[1], 1);
  assert.equal(tourAt(atGrowth + DIP_IN + LAMP_GAP + 0.01, data()).lit[1], 2);
  const full = tourAt(atGrowth + DIP_IN + 4 * LAMP_GAP, data());
  assert.equal(full.lit[1], 4);
  assert.equal(full.dips[1], 1);
  assert.equal(full.lit[0], 3, "geçilen istasyon yanık kalır");
});

test("elenen turda kol, kapının lambaları yandıktan sonra iner", () => {
  const atGate = START + TRAVEL;
  assert.equal(tourAt(atGate + DIP_IN + 0.01, data(true)).armDown, false);
  assert.equal(tourAt(atGate + DIP_IN + 3 * LAMP_GAP, data(true)).armDown, true);
});

test("tur son pozda bekler, sonra baştan alır (döngü)", () => {
  const runEnd = START + 7 * (TRAVEL + DWELL);
  assert.deepEqual(tourAt(runEnd + HOLD / 2, data()), finalPose(data()));
  assert.deepEqual(tourAt(loopLength(data()) + 0.1, data()), tourAt(0.1, data()));
});

test("kızak hiçbir anda rayın dışına çıkmaz", () => {
  for (let t = 0; t < loopLength(data()); t += 0.05) {
    const { carriage } = tourAt(t, data());
    assert.ok(carriage >= HOME - 1e-9 && carriage <= 6 + 1e-9, `t=${t}: ${carriage}`);
  }
});

test("künye: raporun sayıları, sıfır sayaç yazılmaz", () => {
  assert.equal(readoutOf(data(), 1, text), "Büyüme · Puan 75 · Geçen 2 · Dikkat 1 · Kalan 1");
  assert.equal(readoutOf(data(), 5, text), "Sahiplik · Veri Yok 3");
  assert.equal(readoutOf(data(), 0, text), "Eleme · Geçti");
  assert.equal(readoutOf(data(), null, text), "Puan 82 · Geçen 13 · Dikkat 2 · Kalan 2 · Veri Yok 5");
});

test("künye: elenen hissede bütün tezgâhın sayımı değil kapının hükmü", () => {
  assert.equal(readoutOf(data(true), null, text), "Puan 45 · Eleme · Elendi");
  assert.equal(readoutOf(data(true), 0, text), "Eleme · Elendi");
});
