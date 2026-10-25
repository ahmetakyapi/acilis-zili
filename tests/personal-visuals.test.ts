import test from "node:test";
import assert from "node:assert/strict";

import { BROKERS } from "../content/brokers";
import { costLine } from "../lib/broker-line";
import { duoDomain, duoTicks, evenTicks, gapBands } from "../lib/duo-chart";
import {
  buildReturnTimeline,
  gapVerdict,
  monthTicks,
  profilePoints,
  spyAnchorDay,
  type DayClose,
  type TimelineLot,
} from "../lib/return-timeline";
import { addMonths, buildThemeTimeline, windowStart } from "../lib/theme-timeline";
import { listPulse, yearRange } from "../lib/watchlist-visuals";

/**
 * Kişisel ekranların görsel turu (25 Ekim): favorilerin satır görselleri ve
 * tepe cümlesi, "Alıştan Bugüne", temanın zaman çizgisi, aracı kurum
 * maliyet çizgisi. Beklenen sayılar elle hesaplandı.
 */

const near = (actual: number | null, expected: number, eps = 1e-9) =>
  assert.ok(actual !== null && Math.abs(actual - expected) < eps, `${actual} ≉ ${expected}`);

/* ---------------------------------------------------------- favoriler */

test("yearRange: fiyatın 52 haftalık aralıktaki yeri", () => {
  const bars = [
    { low: 90, high: 110 },
    { low: 80, high: 120 },
  ];
  assert.deepEqual(yearRange(bars, 100), { low: 80, high: 120, position: 0.5 });
});

test("yearRange: yeni zirvede bant fiyata uzar, işaretçi rayın dışına düşmez", () => {
  const range = yearRange([{ low: 80, high: 120 }, { low: 85, high: 118 }], 130)!;
  assert.equal(range.high, 130);
  assert.equal(range.position, 1);
});

test("yearRange: bar ya da fiyat yoksa aralık yok", () => {
  assert.equal(yearRange([{ low: 1, high: 2 }], 1.5), null);
  assert.equal(yearRange([{ low: 1, high: 2 }, { low: 1, high: 2 }], null), null);
});

test("listPulse: hepsi bu seansta — bugün, çoğunluk düşüşteyse en sert düşüş", () => {
  const pulse = listPulse(["A", "B", "C", "A"], {
    A: { changePct: -1.2, session: true },
    B: { changePct: -0.4, session: true },
    C: { changePct: 2.1, session: true },
  });
  assert.equal(pulse.total, 3);
  assert.equal(pulse.scope, "today");
  assert.equal(pulse.down, 2);
  assert.equal(pulse.up, 1);
  assert.deepEqual(pulse.lead, { symbol: "A", changePct: -1.2, direction: "down" });
});

test("listPulse: hiçbiri bu seansta değil — son seans", () => {
  const pulse = listPulse(["A", "B"], {
    A: { changePct: 1, session: false },
    B: { changePct: 3, session: false },
  });
  assert.equal(pulse.scope, "last");
  assert.deepEqual(pulse.lead, { symbol: "B", changePct: 3, direction: "up" });
});

test("listPulse: karışıkta yalnız bugün işlem görenler sayılır", () => {
  const pulse = listPulse(["A", "B", "C"], {
    A: { changePct: -5, session: false },
    B: { changePct: 1, session: true },
    C: { changePct: null, session: true },
  });
  assert.equal(pulse.scope, "partial");
  assert.equal(pulse.counted, 1);
  assert.equal(pulse.down, 0);
  assert.equal(pulse.lead?.symbol, "B");
});

test("listPulse: okunacak yüzde yoksa none", () => {
  assert.equal(listPulse(["A"], { A: { changePct: null, session: true } }).scope, "none");
});

/* --------------------------------------------------------- çift çizgi */

test("gapBands: işaret değişiminde kesişmede bölünür", () => {
  const bands = gapBands([
    { a: 2, b: 0 },
    { a: -2, b: 0 },
  ]);
  assert.equal(bands.length, 2);
  assert.equal(bands[0].sign, "up");
  assert.equal(bands[1].sign, "down");
  /* Kesişme tam ortada: x = 0.5, y = 0. */
  assert.ok(bands[0].points.some(([x, y]) => x === 0.5 && y === 0));
});

test("gapBands: B'si olmayan nokta bandı keser", () => {
  const bands = gapBands([
    { a: 1, b: 0 },
    { a: 2, b: 0 },
    { a: 3, b: null },
    { a: 4, b: 0 },
  ]);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].points.length, 4);
});

test("duoDomain ve duoTicks: sıfır içeride, adımlar yuvarlak", () => {
  const domain = duoDomain([{ a: 10, b: 4 }, { a: 12, b: 6 }]);
  assert.ok(domain.min < 0 && domain.max > 12);
  const ticks = duoTicks(domain);
  assert.ok(ticks.includes(0));
  for (const tick of ticks) assert.equal(tick % 2.5 === 0 || tick % 5 === 0, true);
});

test("evenTicks: uçlar her zaman içeride", () => {
  assert.deepEqual(evenTicks(10, 4), [0, 3, 6, 9]);
  assert.deepEqual(evenTicks(2, 4), [0, 1]);
});

/* ------------------------------------------------------ Alıştan Bugüne */

test("buildReturnTimeline: son nokta kotasyonla, vitrin formülüyle aynı", () => {
  const timeline = buildReturnTimeline({
    lots: [
      { symbol: "AAA", quantity: 10, costUsd: 100, boughtAt: "2026-01-05", spyBase: 500 },
      { symbol: "BBB", quantity: 5, costUsd: 200, boughtAt: "2026-01-07", spyBase: 510 },
    ],
    series: {
      AAA: [
        { day: "2026-01-05", close: 100 },
        { day: "2026-01-06", close: 110 },
        { day: "2026-01-07", close: 120 },
      ],
      BBB: [{ day: "2026-01-07", close: 180 }],
    },
    spy: [
      { day: "2026-01-05", close: 500 },
      { day: "2026-01-06", close: 505 },
      { day: "2026-01-07", close: 510 },
    ],
    prices: { AAA: 130, BBB: 220 },
    spyPrice: 520,
    today: "2026-01-08",
  });
  assert.equal(timeline.missing, 0);
  assert.deepEqual(
    timeline.points.map((p) => p.day),
    ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"],
  );
  /* 6 Ocak: yalnız AAA alınmış, 10 × 110 / 1000 − 1 = %10; SPY 505/500 − 1 = %1. */
  near(timeline.points[1].portfolio, 10);
  near(timeline.points[1].spy, 1);
  /* 7 Ocak: (1200 + 900) / 2000 − 1 = %5. */
  near(timeline.points[2].portfolio, 5);
  /* Son nokta: (1300 + 1100) / 2000 − 1 = %20; SPY (1000/500·520 + 1000/510·520)/2000 − 1. */
  near(timeline.points[3].portfolio, 20);
  near(timeline.points[3].spy, ((1000 / 500) * 520 + (1000 / 510) * 520) / 2000 * 100 - 100);
});

test("buildReturnTimeline: bugünün yarım barı atılır, geçmişi olmayan parti sayılır", () => {
  const timeline = buildReturnTimeline({
    lots: [
      { symbol: "AAA", quantity: 1, costUsd: 100, boughtAt: "2026-01-05", spyBase: null },
      { symbol: "ZZZ", quantity: 1, costUsd: 100, boughtAt: "2026-01-05", spyBase: null },
    ],
    series: {
      AAA: [
        { day: "2026-01-05", close: 100 },
        { day: "2026-01-06", close: 104 },
      ],
    },
    spy: [],
    prices: { AAA: 105, ZZZ: 50 },
    spyPrice: null,
    today: "2026-01-06",
  });
  assert.equal(timeline.missing, 1);
  assert.deepEqual(timeline.points.map((p) => p.day), ["2026-01-05", "2026-01-06"]);
  near(timeline.points[1].portfolio, 5);
  assert.equal(timeline.points[1].spy, null);
});

test("gapVerdict: bir ondalıkta sıfır görünen fark eşittir", () => {
  assert.equal(gapVerdict(-16, 0.7), "behind");
  assert.equal(gapVerdict(3, 1), "ahead");
  assert.equal(gapVerdict(1.02, 1), "even");
  assert.equal(gapVerdict(1, null), "none");
});

test("monthTicks: uçlar ve ay başları, en fazla altı", () => {
  const days = ["2026-01-29", "2026-01-30", "2026-02-02", "2026-02-03", "2026-03-02", "2026-03-03", "2026-03-04"];
  const ticks = monthTicks(days);
  assert.equal(ticks[0], 0);
  assert.equal(ticks[ticks.length - 1], days.length - 1);
  assert.ok(ticks.length <= 6);
});

/* ------------------------------------------------- temanın zaman çizgisi */

test("addMonths ve windowStart: ay sonu kırpılır, YBB yılbaşı", () => {
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(windowStart("3M", "2026-10-23"), "2026-07-23");
  assert.equal(windowStart("YTD", "2026-10-23"), "2026-01-01");
});

test("buildThemeTimeline: medyan, ölçüt ve günün en iyi/zayıf üyesi", () => {
  const days = ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-23"];
  const series = (closes: number[]) => closes.map((close, i) => ({ day: days[i], close }));
  const out = buildThemeTimeline({
    members: {
      A: series([100, 110, 121, 121]),
      B: series([50, 49, 50, 55]),
      C: series([10, 10, 11, 12]),
      /* Pencerenin başında işlem görmüyor (sonradan halka arz). */
      D: [{ day: "2026-10-02", close: 20 }, { day: "2026-10-23", close: 30 }],
    },
    bench: series([200, 202, 204, 210]),
    range: "1M",
  });
  /* Pencere 23 Eylül'den: ilk ızgara günü 30 Eylül. */
  assert.deepEqual(out.excluded, ["D"]);
  assert.equal(out.included, 3);
  assert.equal(out.points.length, 4);
  /* İlk gün herkes sıfır. */
  near(out.points[0].median, 0);
  /* 1 Ekim: A +%10, B −%2, C %0 → medyan %0. */
  near(out.points[1].median, 0);
  assert.equal(out.points[1].best?.symbol, "A");
  near(out.points[1].best?.pct ?? null, 10, 1e-6);
  assert.equal(out.points[1].worst?.symbol, "B");
  /* Son gün: A +%21, B +%10, C +%20 → medyan %20; ölçüt +%5. */
  near(out.points[3].median, 20);
  near(out.points[3].bench, 5);
});

/* ------------------------------------------------ aracı kurum çizgisi */

test("costLine: 1.000 $'da komisyona göre sıra, eşitlikte tablo sırası", () => {
  const line = costLine(BROKERS, 1_000);
  const order = line.priced.map((entry) => `${entry.id}:${entry.fee}:${entry.rank}`);
  assert.deepEqual(order, [
    "gedik:1:1",
    "interactive-brokers:1:1",
    "midas:1.5:3",
    "is-yatirim:2.5:4",
    "garanti-bbva-yatirim:3:5",
    "qnb-invest:25:6",
  ]);
  assert.deepEqual(
    line.unpriced.map((entry) => entry.id),
    ["yapi-kredi-yatirim", "info-yatirim"],
  );
  assert.equal(line.min, 1);
  assert.equal(line.max, 25);
});

test("costLine: senaryo tablosunun 10.000 $ sütunuyla aynı ücretler", () => {
  const fees = Object.fromEntries(costLine(BROKERS, 10_000).priced.map((entry) => [entry.id, entry.fee]));
  assert.deepEqual(fees, {
    midas: 1.5,
    "is-yatirim": 25,
    "garanti-bbva-yatirim": 30,
    "qnb-invest": 25,
    gedik: 5,
    "interactive-brokers": 1,
  });
});

test("profilePoints: tamamlanmış ayların son noktası, bu ayın ara noktaları atılır, bir ondalık", () => {
  const points = [
    { day: "2026-06-17", portfolio: 1.234, spy: 0.06 },
    { day: "2026-06-30", portfolio: 2.26, spy: -0.04 },
    { day: "2026-07-31", portfolio: -3.351, spy: null },
    { day: "2026-10-22", portfolio: 4.44, spy: 1.11 },
    { day: "2026-10-25", portfolio: 5.55, spy: 1.26 },
  ];
  assert.deepEqual(profilePoints(points), [
    { day: "2026-06-30", portfolio: 2.3, spy: 0 },
    { day: "2026-07-31", portfolio: -3.4, spy: null },
    { day: "2026-10-25", portfolio: 5.6, spy: 1.3 },
  ]);
  assert.equal(spyAnchorDay("2026-06-17"), "2026-06-01");
});

/* ------------------------------------------- Profil gizliliği (KVKK) */

/** Deterministik iş günü serisi: hafta sonu yok, kapanış sözde rastgele yürür. */
function walk(from: string, to: string, start: number, seed: number): DayClose[] {
  const out: DayClose[] = [];
  let value = start;
  let state = seed;
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    state = (state * 1103515245 + 12345) % 2147483648;
    value *= 1 + ((state / 2147483648) - 0.5) * 0.03; /* günde ±%1,5 */
    out.push({ day: d.toISOString().slice(0, 10), close: Math.round(value * 100) / 100 });
  }
  return out;
}
const SPY = walk("2026-06-01", "2026-10-23", 600, 7);
const AAA = walk("2026-06-01", "2026-10-23", 100, 11);
const BBB = walk("2026-06-01", "2026-10-23", 40, 23);
const TODAY = "2026-10-26";
/** Veri katmanının tabanı (`return-timeline-data.ts`): gün `spyAnchorDay`, kural closeOnOrAfter. */
const baseFor = (anchor: string) => SPY.find((bar) => bar.day >= anchor)?.close ?? null;

/** Profil istemcisine inen veri: ay etiketi ve yuvarlı iki yüzde — gün yok. */
function clientData(lots: Omit<TimelineLot, "spyBase">[], anchor: (day: string) => string = spyAnchorDay) {
  const timeline = buildReturnTimeline({
    lots: lots.map((lot) => ({ ...lot, spyBase: baseFor(anchor(lot.boughtAt)) })),
    series: { AAA, BBB },
    spy: SPY,
    prices: { AAA: 105, BBB: 38 },
    spyPrice: 610,
    today: TODAY,
  });
  return profilePoints(timeline.points).map((p, i, all) => ({
    label: i === all.length - 1 ? "now" : p.day.slice(0, 7),
    a: p.portfolio,
    b: p.spy,
  }));
}

test("profil gizliliği: istemci verisi alışın GÜNÜNDEN bağımsız (tek parti)", () => {
  const june = AAA.filter((bar) => bar.day.startsWith("2026-06"));
  const outputs = june.map((bar) =>
    JSON.stringify(clientData([{ symbol: "AAA", quantity: 10, costUsd: 100, boughtAt: bar.day }])),
  );
  /* Haziranın her işlem gününde alınan aynı maliyetli parti AYNI veriyi üretir:
     istemci verisinden alış günü seçilemez. */
  assert.equal(new Set(outputs).size, 1);
  const first = JSON.parse(outputs[0]) as { label: string; a: number; b: number | null }[];
  /* İlk nokta alış ayının sonu, etiket ay. */
  assert.equal(first[0].label, "2026-06");
  /* SPY'dan geri hesaplanan taban ayın ilk kapanışıdır, alış gününün değil. */
  const juneEnd = SPY.filter((bar) => bar.day.startsWith("2026-06")).at(-1)!.close;
  const recovered = juneEnd / (1 + (first[0].b as number) / 100);
  const anchor = SPY[0].close;
  assert.ok(Math.abs(recovered / anchor - 1) < 0.001, `taban ${recovered} ≠ ay başı ${anchor}`);
  /* Bir ondalık: istemciye ham sayı inmiyor. */
  for (const point of first) {
    assert.equal(point.a, Math.round(point.a * 10) / 10);
    if (point.b !== null) assert.equal(point.b, Math.round(point.b * 10) / 10);
  }
});

test("profil gizliliği: çok partide her partinin günü de haftası da okunmaz", () => {
  const days = (month: string) => AAA.filter((bar) => bar.day.startsWith(month)).map((bar) => bar.day);
  const outputs = new Set<string>();
  for (const a of days("2026-06").filter((_, i) => i % 4 === 0)) {
    for (const b of days("2026-08").filter((_, i) => i % 5 === 0)) {
      outputs.add(
        JSON.stringify(
          clientData([
            { symbol: "AAA", quantity: 10, costUsd: 100, boughtAt: a },
            { symbol: "BBB", quantity: 20, costUsd: 40, boughtAt: b },
          ]),
        ),
      );
    }
  }
  assert.equal(outputs.size, 1);
});

test("profil gizliliği: gün tabanı (eski kural) alış gününü sızdırıyordu", () => {
  /* Karşı örnek — testin gerçekten bir şeyi ölçtüğünün kanıtı: taban alış
     gününün kapanışı olunca aynı ayın farklı günleri farklı veri üretir. */
  const june = AAA.filter((bar) => bar.day.startsWith("2026-06")).slice(0, 8);
  const outputs = june.map((bar) =>
    JSON.stringify(
      clientData([{ symbol: "AAA", quantity: 10, costUsd: 100, boughtAt: bar.day }], (day) => day),
    ),
  );
  assert.ok(new Set(outputs).size > 1);
});
