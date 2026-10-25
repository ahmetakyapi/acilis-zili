import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERDICT_INK, VERDICT_INK_SOFT, verdictPillClass, verdictStroke, verdictTextClass, type VerdictKey } from "../lib/analysis";
import { BUCKET_INK } from "../app/(app)/hisse/[symbol]/_panels/analyst-tones";

/* Site geneli renk kararı (25 Ekim): görüş üçlüsü AL yeşil, TUT pirinç, SAT
   kırmızı; mavi (etkileşim rengi) hiçbir görüşte yok. */
const VERDICTS: VerdictKey[] = ["buy", "hold", "sell"];

test("hiçbir görüş mavi değil", () => {
  for (const v of VERDICTS) {
    for (const value of [verdictTextClass(v), verdictPillClass(v), verdictStroke(v), VERDICT_INK[v]]) {
      assert.doesNotMatch(value, /primary/, `${v}: ${value}`);
    }
  }
});

test("üçlü: AL yeşil ailesi, TUT pirinç, SAT kırmızı ailesi", () => {
  assert.match(verdictPillClass("buy"), /up/);
  assert.match(verdictPillClass("hold"), /brass/);
  assert.match(verdictPillClass("sell"), /down/);
  assert.equal(verdictStroke("hold"), "var(--verdict-hold)");
});

/* TEK KAYNAK (25 Ekim son düzeltme): çizim tonu `--verdict-*` token'ı, oranı
   yalnız globals.css'te. Analist kovaları aynı değişkenleri okur. */
test("çizim tonu globals.css'teki --verdict-* token'ından", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--verdict-buy:\s*color-mix\(in srgb, var\(--up\)/);
  assert.match(css, /--verdict-hold:\s*color-mix\(in srgb, var\(--brass\)/);
  assert.match(css, /--verdict-sell:\s*color-mix\(in srgb, var\(--down\)/);
  for (const v of VERDICTS) assert.equal(VERDICT_INK[v], `var(--verdict-${v})`);
});

test("analist kovaları görüş tonunu çağırıyor", () => {
  assert.equal(BUCKET_INK.strongBuy, VERDICT_INK.buy);
  assert.equal(BUCKET_INK.hold, VERDICT_INK.hold);
  assert.equal(BUCKET_INK.strongSell, VERDICT_INK.sell);
  assert.equal(BUCKET_INK.buy, VERDICT_INK_SOFT.buy);
  assert.equal(BUCKET_INK.sell, VERDICT_INK_SOFT.sell);
});

test("halka ve çizim aynı tonu paylaşıyor", () => {
  for (const v of VERDICTS) assert.equal(verdictStroke(v), VERDICT_INK[v]);
});
