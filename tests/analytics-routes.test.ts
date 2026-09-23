import test from "node:test";
import assert from "node:assert/strict";
import { normalizePath, routeTemplate, shouldRecord } from "../lib/analytics";

/**
 * Sayfa ölçümünün yazma kuralları — rota şablonu, yolun yazımı ve kimin
 * sayıldığı.
 *
 * 23 Eylül denetiminde panelin "Bölümler" listesi `/teknik/mu` ile
 * `/teknik/sndk`yi ayrı satır basıyordu (şablon eksikti), aynı sayfa büyük ve
 * küçük harfle iki satır oluyordu ve yöneticinin kendi gezintisi 30 günlük
 * trafiğin %29'unu tutuyordu.
 */

test("teknik detay şablonda toplanıyor, dil öneki korunuyor", () => {
  assert.equal(routeTemplate("/teknik/MU"), "/teknik/[symbol]");
  assert.equal(routeTemplate("/en/teknik/mu"), "/en/teknik/[symbol]");
});

test("bilanço rotaları: sabit sayfalar sabit, analiz detayı şablonda", () => {
  assert.equal(routeTemplate("/bilancolar/analizler"), "/bilancolar/analizler");
  assert.equal(routeTemplate("/bilancolar/takip"), "/bilancolar/takip");
  assert.equal(routeTemplate("/bilancolar/nvda/4c-fy2026"), "/bilancolar/[symbol]/[period]");
  /* Tek parçalı `/bilancolar/[symbol]` diye bir sayfa YOK (app/(app)/bilancolar
     altında yalnızca [symbol]/[period] var) — desen de yok. */
  assert.equal(routeTemplate("/bilancolar/NVDA"), "/bilancolar/NVDA");
});

test("sembollü yol sitenin kendi yazımına iniyor", () => {
  assert.equal(normalizePath("/hisse/mu"), "/hisse/MU");
  assert.equal(normalizePath("/en/hisse/brk.b"), "/en/hisse/BRK.B");
  assert.equal(normalizePath("/teknik/MU"), "/teknik/mu");
  assert.equal(normalizePath("/en/bilancolar/NVDA/4c-fy2026"), "/en/bilancolar/nvda/4c-fy2026");
  assert.equal(normalizePath("/bilancolar/analizler"), "/bilancolar/analizler");
  assert.equal(normalizePath("/hisse/MU/?sekme=haber#ust"), "/hisse/MU");
  assert.equal(normalizePath("//baska.site/x"), null);
});

test("yönetici ve üretim dışı ortam sayılmıyor", () => {
  assert.equal(shouldRecord({ user: { role: "admin" } }, "production"), false);
  assert.equal(shouldRecord({ user: { role: "user" } }, "production"), true);
  assert.equal(shouldRecord(null, "production"), true);
  assert.equal(shouldRecord(null, "development"), false);
  assert.equal(shouldRecord({ user: { role: "user" } }, undefined), false);
});
