import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTS, openingTimes } from "../lib/ink/analysis-film";

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

test("perdeler ölçü başında (120 BPM, ölçü 4 vuruş)", async () => {
  const { BEAT } = await import("../lib/ink/analysis-film");
  for (const at of ACTS) assert.equal((at / (4 * BEAT)) % 1, 0, `perde ${at} sn ölçüde değil`);
});

test("III'te en uzun başlık da okunacak kadar durur (kelime başına 0,3 + 0,5 sn)", async () => {
  const { HEADLINE_AT, HEADLINE_STEP, holdFor } = await import("../lib/ink/analysis-film");
  // Sekiz kelimelik başlık: filmin `fit`i satırı kesse de okuma süresi kelime sayısıyla.
  const longest = "Analistler bellek talebindeki artış nedeniyle hedef fiyatı yükseltti";
  const lastStart = ACTS[2] + HEADLINE_AT + 4 * HEADLINE_STEP;
  const typed = lastStart + 1.0; // daktilo en fazla 1 sn
  const floodOut = ACTS[3] - 1.0;
  assert.ok(floodOut - typed >= holdFor(longest), `bekleme ${floodOut - typed} < ${holdFor(longest)}`);
});

test("açılış olayları yarım vuruş ızgarasında", () => {
  for (const origin of [false, true]) for (const len of [1, 4, 10]) {
    const T = openingTimes(len, origin);
    for (const v of [T.SYM_IN, T.DOT_AT, T.SYM_OUT, T.PEN_A]) assert.equal((v / 0.25) % 1, 0, `${v} ızgarada değil`);
  }
});
