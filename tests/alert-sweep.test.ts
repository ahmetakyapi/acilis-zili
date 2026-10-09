import test from "node:test";
import assert from "node:assert/strict";
import { alertPayload, findHits, type PendingAlert } from "../lib/alert-sweep";
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
