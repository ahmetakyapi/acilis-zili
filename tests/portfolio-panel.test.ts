import test from "node:test";
import assert from "node:assert/strict";
import { positionView, type DayMove } from "../lib/portfolio";
import { CONCENTRATION_PCT, concentrationThreshold, panelModel } from "../lib/portfolio-panel";
import { isPrivacyOn, privacyCookieLine, PRIVACY_COOKIE } from "../lib/privacy";

/** Ana sayfanın portföy paneli — saf hesap (lib/portfolio-panel.ts) ve tutar gizleme çerezi (lib/privacy.ts). */

const view = (id: string, symbol: string, quantity: number, cost: number, price: number | null) =>
  positionView({ id, symbol, quantity, costUsd: cost, boughtAt: "2026-01-02" }, price, 30, 40);

test("aynı sembolün lotları tek satır; K/Z birleşik maliyete göre", () => {
  const views = [view("a", "MU", 10, 100, 120), view("b", "MU", 10, 140, 120), view("c", "AMD", 5, 200, 100)];
  const model = panelModel(views, new Map());
  assert.equal(model.holdings.length, 2);
  const mu = model.holdings[0];
  assert.equal(mu.symbol, "MU");
  assert.equal(mu.valueUsd, 2400);
  assert.equal(mu.pnlPct, 0); // 2400 değer, 2400 maliyet
  assert.ok(Math.abs(mu.weight - (2400 / 2900) * 100) < 1e-9);
  assert.equal(model.hasDay, false);
  assert.equal(model.mover, null);
});

test("fiyatı olmayan pozisyon panelin dışında", () => {
  const model = panelModel([view("a", "MU", 1, 10, null), view("b", "AMD", 1, 10, 12)], new Map());
  assert.deepEqual(model.holdings.map((h) => h.symbol), ["AMD"]);
  assert.equal(model.concentration, null); // tek sembolde yoğunlaşma künyesi yok
});

test("boş ya da değeri sıfır portföy boş model döner", () => {
  const model = panelModel([], new Map());
  assert.deepEqual(model, { holdings: [], slices: [], mover: null, concentration: null, hasDay: false });
});

test("dağılım: dört sembol + Diğer, Diğer kimleri kapsadığını taşır", () => {
  const views = ["A", "B", "C", "D", "E", "F"].map((s, i) => view(s, s, 1, 10, 60 - i * 10));
  const model = panelModel(views, new Map());
  assert.deepEqual(model.slices.map((s) => s.key), ["A", "B", "C", "D", "rest"]);
  assert.deepEqual(model.slices[4].members, ["E", "F"]);
  assert.equal(model.slices[4].symbol, null);
  assert.ok(Math.abs(model.slices.reduce((sum, s) => sum + s.pct, 0) - 100) < 1e-9);
});

test("bugünün en çok etkileyeni yalnız kanıtlı satırlardan, mutlak dolarla", () => {
  const views = [view("a", "MU", 10, 100, 120), view("b", "AMD", 50, 100, 100), view("c", "SHAZ", 1, 1, 2)];
  const days = new Map<string, DayMove>([
    ["a", { changeUsd: 30, changePct: 2.5 }],
    ["b", { changeUsd: -80, changePct: -1.6 }],
    ["c", { changeUsd: null, changePct: null }],
  ]);
  const model = panelModel(views, days);
  assert.equal(model.hasDay, true);
  assert.deepEqual(model.mover, { symbol: "AMD", dayUsd: -80, dayPct: -1.6 });
  assert.equal(model.holdings.find((h) => h.symbol === "SHAZ")?.dayPct, null);
});

test("tek kanıtlı satırda 'en çok etkileyen' basılmaz", () => {
  const views = [view("a", "MU", 10, 100, 120), view("b", "AMD", 1, 100, 100)];
  const model = panelModel(views, new Map([["a", { changeUsd: 30, changePct: 2.5 }]]));
  assert.equal(model.mover, null);
  assert.equal(model.hasDay, true);
});

test("lotlardan biri kanıtsızsa sembolün günlük değişimi yok sayılır", () => {
  const views = [view("a", "MU", 10, 100, 120), view("b", "MU", 10, 100, 120), view("c", "AMD", 1, 1, 1)];
  const model = panelModel(views, new Map([["a", { changeUsd: 30, changePct: 2.5 }]]));
  assert.equal(model.holdings[0].dayUsd, null);
});

test("yoğunlaşma künyesi eşikte basılır", () => {
  const heavy = panelModel([view("a", "MU", 1, 10, 47), view("b", "SNDK", 1, 10, 37), view("c", "X", 1, 10, 8), view("d", "Y", 1, 10, 4), view("e", "Z", 1, 10, 4)], new Map());
  assert.equal(heavy.concentration?.symbol, "MU");
  assert.ok(heavy.concentration!.weight >= CONCENTRATION_PCT);
  assert.ok(heavy.concentration!.effective > 2 && heavy.concentration!.effective < 3);
  const spread = panelModel(["A", "B", "C", "D", "E"].map((s) => view(s, s, 1, 10, 20)), new Map());
  assert.equal(spread.concentration, null);
  // Üç pozisyonda %37 eşit ağırlığa yakın: uyarı yok; iki pozisyonda %80 uyarı.
  const three = panelModel([view("a", "ONDS", 1, 10, 37), view("b", "AAPL", 1, 10, 35), view("c", "MU", 1, 10, 28)], new Map());
  assert.equal(three.concentration, null);
  const two = panelModel([view("a", "MU", 1, 10, 80), view("b", "AAPL", 1, 10, 20)], new Map());
  assert.equal(two.concentration?.symbol, "MU");
});

test("yoğunlaşma eşiği sembol sayısına göre", () => {
  assert.equal(concentrationThreshold(2), 75);
  assert.equal(concentrationThreshold(3), 50);
  assert.equal(concentrationThreshold(9), CONCENTRATION_PCT);
});

test("gizleme çerezi: yalnız '1' açık; satır silmeyi de yazar", () => {
  assert.equal(isPrivacyOn("1"), true);
  assert.equal(isPrivacyOn("0"), false);
  assert.equal(isPrivacyOn(undefined), false);
  assert.match(privacyCookieLine(true, true), new RegExp(`^${PRIVACY_COOKIE}=1; Max-Age=\\d+; Path=/; SameSite=Lax; Secure$`));
  assert.match(privacyCookieLine(false, false), new RegExp(`^${PRIVACY_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax$`));
});
