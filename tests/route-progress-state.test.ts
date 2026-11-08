import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROUTE_PROGRESS_IDLE,
  isPagePath,
  reduceRouteProgress,
  type RouteProgressEvent,
  type RouteProgressState,
} from "../components/layout/route-progress-state";

/* Gezinme göstergesinin saf durumu (components/layout/route-progress-state.ts).
   RouteProgress mağazası bu indirgeyiciyle ilerliyor. */

const run = (events: RouteProgressEvent[], from: RouteProgressState = ROUTE_PROGRESS_IDLE) =>
  events.reduce(reduceRouteProgress, from);
const page = { query: false, inline: false, scene: "intro" as const };
const filter = { query: true, inline: true, scene: "intro" as const };

test("sayfa gezinmesi yeni koşu açar; durdurma HER alanı sıfırlar, sayaç kalır", () => {
  const started = run([{ type: "start", target: filter }]);
  assert.equal(started.run, 1);
  assert.equal(started.query, true);
  const stopped = reduceRouteProgress(started, { type: "stop" });
  assert.deepEqual(stopped, { ...ROUTE_PROGRESS_IDLE, seq: 1 });
  assert.equal(run([{ type: "start", target: page }], stopped).run, 2);
});

test("boştayken durdurma ve süren koşuda hedefsiz başlatma aynı nesneyi döner", () => {
  assert.equal(reduceRouteProgress(ROUTE_PROGRESS_IDLE, { type: "stop" }), ROUTE_PROGRESS_IDLE);
  const started = run([{ type: "start", target: page }]);
  assert.equal(reduceRouteProgress(started, { type: "start", target: null }), started);
});

test("art arda filtreler aynı beklemeyi paylaşır; kip değişirse yeni koşu", () => {
  const first = run([{ type: "start", target: filter }]);
  assert.equal(reduceRouteProgress(first, { type: "start", target: filter }), first);
  const offscreen = reduceRouteProgress(first, { type: "start", target: { ...filter, inline: false } });
  assert.equal(offscreen.run, 2);
  const toPage = reduceRouteProgress(first, { type: "start", target: page });
  assert.equal(toPage.run, 2);
  assert.equal(toPage.query, false);
});

test("hedefsiz başlatma (geri tuşu, dil) açılış sahnesiyle sayfa koşusu", () => {
  const state = run([{ type: "start", target: null }]);
  assert.deepEqual(state, { run: 1, seq: 1, query: false, inline: false, scene: "intro" });
});

test("API uçları sayfa gezinmesi sayılmaz", () => {
  assert.equal(isPagePath("/api/takvim"), false);
  assert.equal(isPagePath("/api"), false);
  assert.equal(isPagePath("/apiler"), true);
  assert.equal(isPagePath("/hisse/BRK.B"), true);
  assert.equal(isPagePath("/en/takvim"), true);
});
