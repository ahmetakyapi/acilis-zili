import test from "node:test";
import assert from "node:assert/strict";
import { alertPayload, findHits, findPercentHits, percentPayload, type PendingAlert, type PendingPercentAlert } from "../lib/alert-sweep";
import { thresholdDigits } from "../lib/percent-alerts";
import { getMarketStatus } from "../lib/market-hours";
import { sessionReadings } from "../lib/price-alerts";
import tr from "../lib/i18n/dictionaries/tr";
import en from "../lib/i18n/dictionaries/en";

/** Sunucudaki alarm taramasının saf kısmı (lib/alert-sweep.ts). */

const alerts: PendingAlert[] = [
  { id: "a", userId: "u1", symbol: "NVDA", direction: "above", target: 200 },
  { id: "b", userId: "u1", symbol: "NVDA", direction: "below", target: 150 },
  { id: "c", userId: "u2", symbol: "AAPL", direction: "below", target: 180 },
  { id: "d", userId: "u2", symbol: "MSFT", direction: "above", target: 400 },
];

test("yalnızca hedefi geçenler; fiyatı olmayan ya da sıfır fiyatlı atlanır", () => {
  const hits = findHits(alerts, { NVDA: 201.5, AAPL: 0, MSFT: undefined });
  assert.deepEqual(
    hits.map((hit) => [hit.id, hit.price]),
    [["a", 201.5]],
  );
});

test("eşitlik geçmiş sayılır (sayfadaki kuralla aynı)", () => {
  assert.equal(findHits(alerts, { AAPL: 180 }).length, 1);
});

test("bildirim metni dile göre, adres dil önekli, etiket alarm başına", () => {
  const [hit] = findHits(alerts, { NVDA: 201.5 });
  const trPayload = alertPayload(hit, "tr", tr.notifications);
  assert.equal(trPayload.title, "NVDA Alarmı");
  assert.match(trPayload.body, /^NVDA .*200,00.* üstüne çıktı · Şimdi .*201,50/);
  assert.equal(trPayload.url, "/hisse/NVDA");
  assert.equal(trPayload.tag, "alert-a");

  const enPayload = alertPayload(hit, "en", en.notifications);
  assert.equal(enPayload.title, "NVDA Alert");
  assert.match(enPayload.body, /rose above .*200\.00.* Now .*201\.50/);
  assert.equal(enPayload.url, "/en/hisse/NVDA");
});

test("altına inen alarm kendi kalıbını kullanır", () => {
  const [hit] = findHits(alerts, { AAPL: 175 });
  assert.match(alertPayload(hit, "tr", tr.notifications).body, /altına indi/);
});

/* SEMBOL BAŞINA SEANS KAPISI (16 Ekim) — lib/price-alerts.ts → sessionReadings.
   Ön seansın ilk dakikalarında paketteki bir hisse bugün işlem görmüşken
   ötekisi hâlâ dünün kotasyonunu ve dünün yüzdesini taşıyor. */
test("dünün işlemini taşıyan sembol değerlendirmeye girmez (yüzde alarmı dünkü düşüşle tetiklenmez)", () => {
  // Cuma 16 Ekim 2026, 04:20 ET (ön seans): NVDA bugün işlem gördü, XYZ görmedi.
  const status = getMarketStatus(new Date("2026-10-16T08:20:00Z"), []);
  assert.equal(status.session, "pre-market");
  assert.equal(status.sessionDate, "2026-10-16");
  const quotes = {
    NVDA: { price: 201.5, changePct: 0.8, tradedAt: new Date("2026-10-16T08:18:00Z") },
    XYZ: { price: 94, changePct: -6.1, tradedAt: new Date("2026-10-15T19:59:00Z") },
    NOTRADE: { price: 10, changePct: -9, tradedAt: null },
  };
  const { prices, changes } = sessionReadings(quotes, status);
  assert.deepEqual(Object.keys(prices), ["NVDA"]);
  assert.deepEqual(Object.keys(changes), ["NVDA"]);

  const pending: PendingPercentAlert[] = [
    { id: "p1", userId: "u1", symbol: "XYZ", direction: "down", thresholdPct: 5 },
    { id: "p2", userId: "u1", symbol: "NOTRADE", direction: "down", thresholdPct: 5 },
  ];
  assert.equal(findPercentHits(pending, changes).length, 0);
  /* Kapı olmasaydı ikisi de tetiklenirdi — test gerçekten kapıyı ölçüyor. */
  assert.equal(findPercentHits(pending, { XYZ: -6.1, NOTRADE: -9 }).length, 2);
});

test("bugünün işlemini taşıyan sembol değerlendirilir", () => {
  const status = getMarketStatus(new Date("2026-10-16T14:00:00Z"), []); // 10:00 ET, normal seans
  const { prices, changes } = sessionReadings(
    { XYZ: { price: 94, changePct: -6.1, tradedAt: new Date("2026-10-16T13:59:00Z") } },
    status,
  );
  assert.equal(prices.XYZ, 94);
  assert.equal(findPercentHits([{ id: "p1", userId: "u1", symbol: "XYZ", direction: "down", thresholdPct: 5 }], changes).length, 1);
});

test("eşik kayıtlı hassasiyetle yazılır: 2,25 eşiği 2,3 diye basılmaz", () => {
  assert.equal(thresholdDigits(5), 0);
  assert.equal(thresholdDigits(2.5), 1);
  assert.equal(thresholdDigits(2.25), 2);
  assert.equal(thresholdDigits(1.1), 1, "kayan nokta 1.1*10 = 11.000000000000002");
  const [hit] = findPercentHits([{ id: "p", userId: "u", symbol: "NVDA", direction: "down", thresholdPct: 2.25 }], { NVDA: -2.26 });
  const body = percentPayload(hit, "tr", tr.notifications).body;
  assert.match(body, /2,25/);
  assert.doesNotMatch(body, /2,3(?!\d)/);
});
