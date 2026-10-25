import test from "node:test";
import assert from "node:assert/strict";

import {
  countByKind,
  groupByDay,
  groupByHour,
  joinList,
  median,
  newsPulse,
  pulseSentence,
  sinceBins,
  sinceSplit,
  tryTarget,
  verdictMix,
} from "../lib/feed-visuals";
import { feedVisualsEn, feedVisualsTr } from "../lib/i18n/dictionaries/feed-visuals";

/**
 * Akış ve liste ekranlarının görsel turu (25 Ekim): tepe cümleleri, sayım
 * şeritleri ve gruplamalar uydurmasız mı — her sayı girdiden mi geliyor.
 */

const IST = "Europe/Istanbul";
const at = (iso: string) => new Date(iso);

test("newsPulse: haber başına şirket bir kez sayılır, tek haberlik şirket şeride girmez", () => {
  const pulse = newsPulse([
    { publishedAt: at("2026-10-25T09:00:00Z"), mentions: ["NVDA", "NVDA", "AMD"] },
    { publishedAt: at("2026-10-25T07:00:00Z"), mentions: ["NVDA"] },
    { publishedAt: at("2026-10-25T05:30:00Z"), mentions: ["TSLA", "AMD"] },
    { publishedAt: at("2026-10-25T04:00:00Z"), mentions: ["MU"] },
  ]);
  assert.equal(pulse.total, 4);
  assert.equal(pulse.spanHours, 5);
  /* Eşit sayı ve aynı en yeni haber: alfabe. */
  assert.deepEqual(pulse.top, [
    { symbol: "AMD", count: 2 },
    { symbol: "NVDA", count: 2 },
  ]);
});

test("newsPulse: eşitlikte daha yeni haberi olan önde, boş girdi sıfır", () => {
  const pulse = newsPulse([
    { publishedAt: at("2026-10-25T10:00:00Z"), mentions: ["B"] },
    { publishedAt: at("2026-10-25T09:00:00Z"), mentions: ["A"] },
    { publishedAt: at("2026-10-25T08:00:00Z"), mentions: ["A", "B"] },
  ]);
  assert.deepEqual(pulse.top.map((entry) => entry.symbol), ["B", "A"]);
  assert.deepEqual(newsPulse([]), { total: 0, spanHours: 0, top: [] });
});

test("pulseSentence: sayılar girdiden, iki dilde", () => {
  const pulse = { total: 60, spanHours: 14, top: [{ symbol: "NVDA", count: 4 }, { symbol: "NFLX", count: 4 }, { symbol: "TSLA", count: 3 }, { symbol: "VST", count: 3 }] };
  assert.equal(
    pulseSentence(pulse, feedVisualsTr.news),
    "Akış, son 14 saat içinde yayımlanan 60 haberi kapsıyor. En çok NVDA (4), NFLX (4) ve TSLA (3) konuşuluyor.",
  );
  assert.equal(
    pulseSentence(pulse, feedVisualsEn.news),
    "The feed covers 60 stories published over the last 14 hours. Most talked about: NVDA (4), NFLX (4) and TSLA (3).",
  );
  assert.equal(pulseSentence({ total: 1, spanHours: 1, top: [] }, feedVisualsTr.news), "Akışta son 1 saat içinde yayımlanan 1 haber var.");
  assert.equal(pulseSentence({ total: 9, spanHours: 50, top: [] }, feedVisualsTr.news), "Akış, son 2 gün içinde yayımlanan 9 haberi kapsıyor.");
  assert.equal(pulseSentence({ total: 0, spanHours: 0, top: [] }, feedVisualsTr.news), null);
});

test("joinList: bağlaç yalnız son ikinin arasında", () => {
  assert.equal(joinList(["A"], "ve"), "A");
  assert.equal(joinList(["A", "B"], "ve"), "A ve B");
  assert.equal(joinList(["A", "B", "C"], "and"), "A, B and C");
});

test("groupByHour: okurun diliminde saat durağı, seyrek saat komşusuyla birleşir, gün aşılmaz", () => {
  const now = at("2026-10-25T10:30:00Z"); // 13:30 İstanbul
  const items = [
    at("2026-10-25T09:50:00Z"), // 12:50
    at("2026-10-25T09:10:00Z"), // 12:10
    at("2026-10-25T07:40:00Z"), // 10:40 (tek)
    at("2026-10-25T06:20:00Z"), // 09:20 → 10:40 ile birleşir
    at("2026-10-25T06:05:00Z"), // 09:05 → aynı durak
    at("2026-10-24T20:00:00Z"), // 23:00 dün
  ].map((publishedAt) => ({ publishedAt }));
  const groups = groupByHour(items, IST, now);
  assert.deepEqual(
    groups.map((g) => [g.from, g.to, g.dayOffset, g.items.length]),
    [
      ["12:00", null, 0, 2],
      ["09:00", "11:00", 0, 3],
      ["23:00", null, -1, 1],
    ],
  );
  /* New York diliminde aynı haberler başka saat ve gün. */
  assert.equal(groupByHour(items.slice(0, 1), "America/New_York", now)[0].from, "05:00");
});

test("verdictMix: sabit sıra, tanınmayan görüş yetersize, paylar toplamı 1", () => {
  const mix = verdictMix(["hold", "hold", "buy", "sell", null, "weird"]);
  assert.deepEqual(mix.map((m) => [m.key, m.count]), [["buy", 1], ["hold", 2], ["sell", 1], ["insufficient", 2]]);
  assert.ok(Math.abs(mix.reduce((sum, m) => sum + m.share, 0) - 1) < 1e-9);
});

test("sinceBins: altı kova, sıfırın solu düşüş; uçlar açık", () => {
  const bins = sinceBins([-21.6, -10, -7.9, -0.4, 0, 0.1, 3.4, 12]);
  assert.deepEqual(bins.map((b) => b.count), [1, 2, 1, 3, 0, 1]);
  assert.deepEqual(bins.map((b) => b.side), ["down", "down", "down", "up", "up", "up"]);
  assert.equal(bins[0].from, null);
  assert.equal(bins.at(-1)!.to, null);
  assert.deepEqual(sinceSplit([-1, 0, 2, 3]), { up: 2, down: 1 });
  assert.equal(median([3, -1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test("groupByDay ve countByKind: gün başlıkları ve sıfırsız tür sayımı", () => {
  const now = at("2026-10-25T10:00:00Z");
  const items = [
    { createdAt: at("2026-10-25T08:00:00Z"), kind: "alert" as const },
    { createdAt: at("2026-10-24T22:30:00Z"), kind: "alert" as const }, // 01:30 İstanbul → bugün
    { createdAt: at("2026-10-24T09:00:00Z"), kind: "earnings" as const },
    { createdAt: at("2026-10-16T16:00:00Z"), kind: "alert" as const },
  ];
  assert.deepEqual(groupByDay(items, IST, now).map((g) => [g.dayOffset, g.items.length]), [[0, 2], [-1, 1], [-9, 1]]);
  assert.deepEqual(countByKind(items, ["alert", "percent", "earnings"] as const), [
    { kind: "alert", count: 3 },
    { kind: "earnings", count: 1 },
  ]);
});

test("tryTarget: ilk yol parçası ekranı söyler, dış adres ayrı", () => {
  assert.equal(tryTarget("/hisse/NVDA"), "/hisse");
  assert.equal(tryTarget("/bilancolar?sekme=hafta"), "/bilancolar");
  assert.equal(tryTarget("/rehber/temettu#vergi"), "/rehber");
  assert.equal(tryTarget("/"), "/");
  assert.equal(tryTarget("https://t.me/aciliszili"), "external");
});
