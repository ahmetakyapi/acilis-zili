import test from "node:test";
import assert from "node:assert/strict";

import { BODY_SPAN_QUANTILE, bodySpan, robustPeak } from "../components/markets/index-shared";
import { LANE_STEPS, WEEK_LANE_SPAN, laneSpan } from "../lib/market-scales";

/**
 * Piyasalar ekranının iki dayanıklı ölçeği (14 Kasım 2026, gerekçe
 * `components/markets/index-shared.ts`): haftalık kulvar listenin gövdesine
 * göre açılır, emtia sütununda tek uç değer ölçeği belirlemez.
 */

test("bodySpan sakin listede tabanda kalır", () => {
  assert.equal(bodySpan([0.4, -1.2, 2, -3.1, 0, 1.9], WEEK_LANE_SPAN), WEEK_LANE_SPAN);
  assert.equal(bodySpan([], WEEK_LANE_SPAN), WEEK_LANE_SPAN);
});

test("bodySpan uzun kuyruğu ölçmez: gövde %1-7, kuyruk %12-20", () => {
  /* 13 Kasım canlısına benzer: yüz üyenin 80'i ±%7 içinde, 20'si sert. */
  const body = Array.from({ length: 80 }, (_, i) => ((i % 14) - 7) * 0.9);
  const tail = Array.from({ length: 20 }, (_, i) => -(12 + (i % 9)));
  const values = [...body, ...tail];
  assert.equal(laneSpan(values, WEEK_LANE_SPAN), 15, "90. yüzdelik kuyruğu ölçüyor");
  assert.equal(bodySpan(values, WEEK_LANE_SPAN), WEEK_LANE_SPAN, "75. yüzdelik gövdede kalıyor");
});

test("bodySpan okunur basamağa oturur ve boşları atlar", () => {
  const values = [9, -9.5, 9.2, 9.9, null, undefined, Number.NaN, 0.1];
  const span = bodySpan(values, WEEK_LANE_SPAN);
  assert.ok((LANE_STEPS as readonly number[]).includes(span));
  assert.equal(span, 10);
  assert.ok(BODY_SPAN_QUANTILE > 0.5 && BODY_SPAN_QUANTILE < 0.9);
});

test("robustPeak en büyük ikinci mutlak değeri verir", () => {
  assert.equal(robustPeak([-10.31, -31.5, 110.5, -17.21, 4.49, 4.04, -21.57, -34.58]), 34.58);
  assert.equal(robustPeak([2.5]), 2.5);
  assert.equal(robustPeak([null, undefined]), 0);
  assert.equal(robustPeak([-3, 3]), 3);
});
