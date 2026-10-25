import test from "node:test";
import assert from "node:assert/strict";
import {
  memberMonths,
  planColumns,
  positionExtremes,
  reportMood,
  sessionWeeks,
  spyGap,
} from "../lib/report-summary";

/** Zil Raporu — ekranın saf kararları (lib/report-summary.ts). */

test("uçlar: hepsi eksideyse üstteki 'En Az Düşen', alttaki 'En Çok Düşen'", () => {
  const { top, bottom } = positionExtremes([
    { symbol: "SHAZ", returnPct: -73.2 },
    { symbol: "AMD", returnPct: -0.8 },
  ]);
  assert.equal(top?.symbol, "AMD");
  assert.equal(top?.kind, "leastLoss");
  assert.equal(bottom?.symbol, "SHAZ");
  assert.equal(bottom?.kind, "mostLoss");
});

test("uçlar: hepsi artıdaysa alttaki 'En Az Kazandıran'", () => {
  const { top, bottom } = positionExtremes([
    { symbol: "NVDA", returnPct: 42 },
    { symbol: "MSFT", returnPct: 1.2 },
  ]);
  assert.equal(top?.kind, "mostGain");
  assert.equal(bottom?.kind, "leastGain");
});

test("uçlar: görünmeyen fark yatay sayılır; tek pozisyonda alt uç yok", () => {
  const { top, bottom } = positionExtremes([{ symbol: "SPY", returnPct: -0.04 }]);
  assert.equal(top?.kind, "flat");
  assert.equal(bottom, null);
  assert.deepEqual(positionExtremes([]), { top: null, bottom: null });
});

test("SPY farkı puan olarak ve yönüyle", () => {
  const gap = spyGap(-16, 0.7);
  assert.equal(gap?.side, "behind");
  assert.ok(Math.abs((gap?.points ?? 0) - 16.7) < 1e-9);
  assert.equal(spyGap(5, 2)?.side, "ahead");
  assert.equal(spyGap(1.01, 1.0)?.side, "level");
  assert.equal(spyGap(3, null), null);
});

test("maskot katılıma bakar, getiriye değil", () => {
  const none = { listSymbols: 0, alertsTotal: 0, posts: 0, hasShowcase: false };
  assert.equal(reportMood(none), "heroSleep");
  assert.equal(reportMood({ ...none, listSymbols: 3 }), "heroWait");
  assert.equal(reportMood({ ...none, listSymbols: 3, hasShowcase: true }), "heroRing");
});

test("seans şeridi: hafta hafta, tatil boşluk, toplam aynı sayım", () => {
  /* 2026-10-19 Pazartesi … 2026-10-25 Pazar; 21'i tatil sayalım. */
  const { total, weeks } = sessionWeeks("2026-10-19", "2026-10-25", (day) => day !== "2026-10-21");
  assert.equal(total, 4);
  assert.deepEqual(weeks, [{ sessions: 4, span: 5 }]);
  /* Çarşamba katılıp ertesi pazartesi bakan: yarım kulvarlar. */
  const half = sessionWeeks("2026-10-21", "2026-10-26", () => true);
  assert.deepEqual(half.weeks, [{ sessions: 3, span: 3 }, { sessions: 1, span: 1 }]);
  assert.equal(half.total, 4);
  /* Cumartesi katılan: boş ilk hafta atılır. */
  assert.deepEqual(sessionWeeks("2026-10-24", "2026-10-25", () => true).weeks, []);
});

test("seans şeridi tavanı son haftaları tutar", () => {
  const { weeks, total } = sessionWeeks("2026-01-05", "2026-10-25", () => true, 4);
  assert.equal(weeks.length, 4);
  assert.ok(total > 4 * 5);
});

test("üyelik ayları: ay başına pay", () => {
  const months = memberMonths("2026-08-01", "2026-10-25");
  assert.deepEqual(
    months.map((m) => m.month),
    ["2026-08", "2026-09", "2026-10"],
  );
  assert.equal(months[0].share, 1);
  assert.equal(months[2].share, 25 / 31);
  assert.equal(memberMonths("2025-01-15", "2026-10-25").length, 12);
  assert.deepEqual(memberMonths("2026-10-26", "2026-10-25"), []);
});

test("kolon planı: üç panelde takip tam genişliğe iner, portföy ile Sıradaki yan yana", () => {
  /* 1440 ölçümü (25 Ekim): portföy 375, takip 205, Sıradaki 340 piksel. */
  const plan = planColumns([
    { item: "p", weight: 6 },
    { item: "w", weight: 3.4, wide: true },
    { item: "n", weight: 5.5, wide: true },
  ]);
  assert.deepEqual(plan, { left: ["p"], right: ["n"], full: ["w"] });
});

test("kolon planı: iki kolon yetiyorsa tam genişlik yok, sıra korunur", () => {
  const plan = planColumns([
    { item: "p", weight: 6 },
    { item: "w", weight: 2, wide: true },
    { item: "a", weight: 2 },
    { item: "n", weight: 2, wide: true },
  ]);
  assert.deepEqual(plan, { left: ["p"], right: ["w", "a", "n"], full: [] });
  assert.deepEqual(planColumns([{ item: "n", weight: 1, wide: true }]), { left: ["n"], right: [], full: [] });
});
