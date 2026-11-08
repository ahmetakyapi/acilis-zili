import test from "node:test";
import assert from "node:assert/strict";
import {
  arcPoint,
  balancedColumns,
  rsiFraction,
  spreadLabels,
  trendScale,
  volumeScale,
  ATLAS_DOMAIN,
  atlasGeometry,
  atlasSentence,
  atlasSummary,
  domainFraction,
  figuresIn,
  scenarioPath,
  type AtlasSentenceCopy,
} from "../lib/technical-visuals";

/* Sayılar 25 Ekim'deki canlı kayıttan (MU, BE, AAPL). */
const MU = {
  verdict: "hold" as const,
  price: 879.9,
  entryLow: 858,
  entryHigh: 871.35,
  stop: 832,
  targets: [930.88, 984.17],
  supports: [871.35, 858, 834.39, 804],
  resistances: [893.44, 930.88, 984.17],
};

test("plan ölçeği: stop 0, ilk hedef 1; bölge ve ikinci hedef aynı ölçekte", () => {
  const g = atlasGeometry(MU)!;
  assert.equal(g.scale, "plan");
  assert.ok(Math.abs(g.norm - (879.9 - 832) / (930.88 - 832)) < 1e-9);
  assert.equal(g.clamped, 0);
  assert.ok(g.zone && g.zone.from < g.zone.to && g.zone.to < g.at);
  const kinds = g.ticks.map((tick) => tick.kind);
  assert.ok(kinds.includes("stop") && kinds.includes("target") && kinds.includes("target2"));
  /* Bölgenin uçlarıyla çakışan destekler ikinci kez çentik olmuyor; 834,39 ve
     893,44 oluyor, 804 eksenin dışında kalıyor. */
  assert.equal(kinds.filter((kind) => kind === "level").length, 2);
  assert.equal(domainFraction(0), (0 - ATLAS_DOMAIN.min) / (ATLAS_DOMAIN.max - ATLAS_DOMAIN.min));
});

test("SAT: plan yok, ölçek en yakın destek → en yakın satış seviyesi", () => {
  const g = atlasGeometry({
    verdict: "sell",
    price: 192.65,
    entryLow: null,
    entryHigh: null,
    stop: null,
    targets: [200.3, 209.04, 218.86],
    supports: [185.93, 157.33],
    resistances: [200.3, 209.04, 218.86, 227.99],
  })!;
  assert.equal(g.scale, "levels");
  assert.equal(g.base, 185.93);
  assert.equal(g.unit, 200.3);
  assert.equal(g.zone, null);
  assert.ok(g.ticks.some((tick) => tick.kind === "sell"));
});

test("iki uçtan biri yoksa çizim yok, fiyat yoksa çizim yok", () => {
  assert.equal(atlasGeometry({ ...MU, price: null }), null);
  assert.equal(
    atlasGeometry({ ...MU, verdict: "sell", entryLow: null, entryHigh: null, stop: null, supports: [], targets: [900] }),
    null,
  );
});

test("eksen dışındaki fiyat kenara oturur ve işaretlenir", () => {
  const g = atlasGeometry({ ...MU, price: 800 })!;
  assert.equal(g.at, 0);
  assert.equal(g.clamped, -1);
});

const copy: AtlasSentenceCopy = {
  zoneSome: "{total} alım planının {n} tanesinde fiyat bölgede",
  zoneNone: "{total} alım planının hiçbirinde fiyat bölgede değil",
  nearOne: "{n} tanesi bölgeye %1'den yakın",
  nearMany: "{n} tanesi bölgeye %1'den yakın",
  stopOne: "{n} tanesi stopa %3'ten yakın",
  stopMany: "{n} tanesi stopa %3'ten yakın",
  stopNone: "hiçbiri stopa %3'ten yakın değil",
  belowOne: "{n} tanesi stopun altında",
  belowMany: "{n} tanesi stopun altında",
};

test("özet: bölgede, yakın (yuvarlanmış yüzdeyle), stopa yakın, stop altı", () => {
  const plan = { entryLow: 100, entryHigh: 102, stop: 95 };
  const summary = atlasSummary([
    { ...plan, price: 101 }, // bölgede, stopa %5,9
    { ...plan, price: 103.03 }, // %1,0 üstte: rozet "%1,0" yazar → yakın DEĞİL
    { ...plan, price: 103 }, // %0,98 → yuvarlanınca %1,0 → yakın değil
    { ...plan, price: 102.9 }, // %0,9 → yakın
    { ...plan, price: 97 }, // bölgenin altında %3, stopa %2,1 → stopa yakın
    { ...plan, price: 90 }, // stop altı
    { entryLow: null, entryHigh: null, stop: null, price: 50 }, // plansız: sayılmaz
  ]);
  assert.deepEqual(summary, { plans: 6, inZone: 1, near: 1, nearStop: 1, belowStop: 1 });
});

test("cümle: sıfırlar doğru kalıba düşer, plan yoksa cümle yok", () => {
  assert.equal(
    atlasSentence({ plans: 13, inZone: 0, near: 4, nearStop: 0, belowStop: 0 }, copy),
    "13 alım planının hiçbirinde fiyat bölgede değil; 4 tanesi bölgeye %1'den yakın, hiçbiri stopa %3'ten yakın değil.",
  );
  assert.equal(
    atlasSentence({ plans: 16, inZone: 5, near: 0, nearStop: 2, belowStop: 1 }, copy),
    "16 alım planının 5 tanesinde fiyat bölgede; 1 tanesi stopun altında, 2 tanesi stopa %3'ten yakın.",
  );
  assert.equal(atlasSentence({ plans: 0, inZone: 0, near: 0, nearStop: 0, belowStop: 0 }, copy), null);
});

test("metindeki sayılar dilin biçimiyle okunur", () => {
  assert.deepEqual(figuresIn("1.231,91 ile 338,57–340,21 bandı, %1,5", "tr"), [1231.91, 338.57, 340.21, 1.5]);
  assert.deepEqual(figuresIn("above 1,231.91 opens 352.37.", "en"), [1231.91, 352.37]);
});

test("senaryo yolu: tetik metnin ilk bilinen seviyesi, uydurma sayı girmez", () => {
  const known = [338.57, 340.21, 327.9, 350.29, 352.37, 344.21, 348.36, 328.62];
  const bull = scenarioPath(
    "348,36 zirvesinin üstünde kapanış 350,29 ve 352,37'yi açar. Teyit, yeni zirvenin ikinci günde de korunması olur.",
    "tr",
    known,
    "up",
    347.61,
    [348.15],
  );
  assert.deepEqual(bull, { trigger: 348.36, source: "text", path: [350.29, 352.37] });
  const bear = scenarioPath(
    "344,21'deki S1 kırılırsa fiyat 338,57–340,21 bandına iner. Stop 327,90'da, 328,62'deki 50 günlüğün hemen altında.",
    "tr",
    known,
    "down",
    347.61,
    [344.21],
  );
  assert.deepEqual(bear, { trigger: 344.21, source: "text", path: [340.21, 338.57, 328.62, 327.9] });
  /* Metinde bilinen seviye yoksa en yakın seviye, kaynağı adıyla. */
  assert.deepEqual(scenarioPath("Kırılım beklenir.", "tr", known, "down", 347.61, [344.21, 340.21]), {
    trigger: 344.21,
    source: "nearest",
    path: [],
  });
});

/* ---- Kapak çizimlerinin geometrisi (8 Kasım) ---- */

test("balancedColumns: satırlar eşit dolar, tek logo sarkmaz", () => {
  assert.equal(balancedColumns(5), 5);
  assert.equal(balancedColumns(8), 8);
  assert.equal(balancedColumns(11), 6); // 6 + 5 — eskiden 10 + 1
  assert.equal(balancedColumns(16), 8);
  assert.equal(balancedColumns(17), 6); // 6 + 6 + 5
  assert.equal(balancedColumns(0), 1);
  for (let n = 2; n <= 40; n++) {
    const cols = balancedColumns(n);
    const rows = Math.ceil(n / cols);
    const last = n - (rows - 1) * cols;
    assert.ok(cols <= 8, `n=${n} sütun ${cols}`);
    // Son satır en çok (satır sayısı − 1) eksik: dengeli, tek logo sarkmıyor.
    assert.ok(cols - last < rows, `n=${n} son satır ${last}/${cols}`);
    if (rows > 1) assert.ok(last >= 2, `n=${n} son satırda tek logo`);
  }
});

test("rsiFraction ve arcPoint: 0 sol uç, 50 tepe, 100 sağ uç", () => {
  assert.equal(rsiFraction(27.6), 0.276);
  assert.equal(rsiFraction(140), 1);
  const left = arcPoint(0, 50, 50, 40);
  const top = arcPoint(0.5, 50, 50, 40);
  const right = arcPoint(1, 50, 50, 40);
  assert.ok(Math.abs(left.x - 10) < 1e-9 && Math.abs(left.y - 50) < 1e-9);
  assert.ok(Math.abs(top.x - 50) < 1e-9 && Math.abs(top.y - 10) < 1e-9);
  assert.ok(Math.abs(right.x - 90) < 1e-9 && Math.abs(right.y - 50) < 1e-9);
});

test("volumeScale: en az 3×, büyük oranda bir üst tam sayı", () => {
  assert.deepEqual(volumeScale(2.7), { max: 3, fill: 0.9, average: 1 / 3 });
  const big = volumeScale(4.2);
  assert.equal(big.max, 5);
  assert.ok(Math.abs(big.fill - 0.84) < 1e-9);
  assert.equal(volumeScale(0).fill, 0);
});

test("trendScale: fiyat ve iki ortalama aynı eksende, eksik ortalama çizilmez", () => {
  const s = trendScale(694.79, 731.9, 755.26)!;
  assert.equal(s.price, 0.1);
  assert.ok(Math.abs(s.sma200! - 0.9) < 1e-9);
  assert.ok(s.sma50! > s.price && s.sma50! < s.sma200!);
  const ipo = trendScale(10, 12, null)!;
  assert.equal(ipo.sma200, null);
  assert.equal(trendScale(10, null, null), null);
  assert.equal(trendScale(null, 1, 2), null);
});

test("spreadLabels: çakışan etiketler aralanır, uzaktakiler yerinde kalır", () => {
  const out = spreadLabels([0.5, 0.52, 0.9], 0.1, 0.05, 0.95);
  assert.ok(Math.abs(out[1]! - out[0]! - 0.1) < 1e-9);
  assert.ok(Math.abs((out[0]! + out[1]!) / 2 - 0.51) < 1e-9); // küme hedeflerinin ortasında
  assert.equal(out[2], 0.9);
  // Sıra korunur, kenara taşmaz.
  const edge = spreadLabels([0.01, 0.02, 0.03], 0.1, 0.05, 0.95);
  assert.deepEqual(edge.map((v) => Math.round(v * 100) / 100), [0.05, 0.15, 0.25]);
  const unsorted = spreadLabels([0.9, 0.1, 0.11], 0.1, 0, 1);
  assert.equal(unsorted[0], 0.9);
  assert.ok(unsorted[2]! - unsorted[1]! >= 0.1 - 1e-9);
});
