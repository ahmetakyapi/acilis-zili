import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alertCrossed, alertDistancePct, alertProgress, isDirection } from "../lib/price-alerts";

/** Fiyat alarmının saf hesapları (lib/price-alerts.ts). */

test("üstüne çıkarsa: hedefe eşit fiyat da geçmiş sayılır", () => {
  const alert = { direction: "above" as const, target: 250 };
  assert.equal(alertCrossed(alert, 249.99), false);
  assert.equal(alertCrossed(alert, 250), true);
  assert.equal(alertCrossed(alert, 260), true);
});

test("altına inerse: yön tersine işler", () => {
  const alert = { direction: "below" as const, target: 200 };
  assert.equal(alertCrossed(alert, 200.01), false);
  assert.equal(alertCrossed(alert, 200), true);
  assert.equal(alertCrossed(alert, 150), true);
});

test("hedefe kalan yol fiyata göre yüzde, geçilmişse sıfır", () => {
  assert.equal(alertDistancePct({ direction: "above", target: 110 }, 100), 10);
  assert.equal(alertDistancePct({ direction: "below", target: 90 }, 100), 10);
  assert.equal(alertDistancePct({ direction: "above", target: 90 }, 100), 0);
  assert.equal(alertDistancePct({ direction: "above", target: 90 }, 0), 0);
});

test("ilerleme kuruluş fiyatından hedefe, 0-1 aralığında", () => {
  const up = { direction: "above" as const, target: 120, refPrice: 100 };
  assert.equal(alertProgress(up, 110), 0.5);
  assert.equal(alertProgress(up, 90), 0, "ters yöne gidiş sıfır");
  assert.equal(alertProgress(up, 130), 1, "hedefi aşan bir");
  const down = { direction: "below" as const, target: 80, refPrice: 100 };
  assert.equal(alertProgress(down, 90), 0.5);
  assert.equal(alertProgress({ ...up, refPrice: null }, 110), 0, "kuruluş fiyatı yoksa çizilmez");
});

test("yön yalnızca iki değer", () => {
  assert.equal(isDirection("above"), true);
  assert.equal(isDirection("below"), true);
  assert.equal(isDirection("up"), false);
  assert.equal(isDirection(null), false);
});

/* İSTEMCİ SINIRI (20 Ekim): hisse sayfasındaki alarm düğmesi saf çekirdeği
   içe aktarır, çekirdek hiçbir modüle (db, şema, React `cache`) dokunmaz —
   yoksa Neon sürücüsü ve bütün şema tarayıcı paketine giriyordu. */
test("istemci alarm düğmesi yalnız veritabansız çekirdeği içe aktarır", () => {
  const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
  for (const core of ["lib/price-alerts-core.ts", "lib/percent-alerts-core.ts"]) {
    assert.doesNotMatch(read(core), /^\s*import\s/m, `${core} içe aktarma yapmamalı`);
  }
  assert.doesNotMatch(
    read("components/alerts/PriceAlertButton.tsx"),
    /from "@\/lib\/(price|percent)-alerts"/,
    "düğme db içe aktaran okuma modülünden değil, çekirdekten okumalı",
  );
});
