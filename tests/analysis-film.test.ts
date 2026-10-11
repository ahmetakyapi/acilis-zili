import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTS, filmCues, openingTimes } from "../lib/ink/analysis-film";

test("açılış anları sıralı ve I. perdenin içinde biter", () => {
  for (const origin of [false, true]) for (const len of [1, 4, 5, 10]) {
    const T = openingTimes(len, origin);
    // Sembol, logo kayarken yükselmeye başlar (SYM_IN < SLIDE_B bilerek): sıra kayışın BAŞINA göre.
    const order = [T.O, T.SLIDE_A, T.SYM_IN, T.DOT_AT, T.SYM_OUT, T.PEN_A, T.PEN_B];
    order.slice(1).forEach((v, i) => assert.ok(v >= order[i], `${i}: ${order[i]} → ${v}`));
    // Son kapanış künyesi PEN_B + 0,5'te oturur: II başlamadan önce okunacak zaman kalmalı.
    assert.ok(T.PEN_B + 0.5 < ACTS[1], `PEN_B ${T.PEN_B}`);
    assert.ok(T.PEN_B - T.PEN_A >= 1.2, `kalem ${T.PEN_B - T.PEN_A} sn`);
  }
});

test("ses olayları aralığa bölününce kaybolmaz ve çift çalmaz", () => {
  const meta = { symbolLength: 4, hasOrigin: true, headlines: 5, doneAt: null };
  const whole = filmCues(0, 30, meta).map(c => `${c.kind}@${c.at.toFixed(3)}`).sort();
  const parts: string[] = [];
  for (let t = 0; t < 30; t += 1 / 60) parts.push(...filmCues(t, t + 1 / 60, meta).map(c => `${c.kind}@${c.at.toFixed(3)}`));
  assert.deepEqual(parts.sort(), whole);
});

test("sonuç gelince dönen damlalar susar, perde sesleri çalar", () => {
  const cues = filmCues(20, 26, { symbolLength: 4, hasOrigin: false, headlines: 5, doneAt: 21 });
  assert.ok(!cues.some(c => c.kind === "tink" && c.at > 21));
  assert.deepEqual(cues.filter(c => c.at >= 21).map(c => c.kind), ["hush", "floodIn", "bell", "seal"]);
});
