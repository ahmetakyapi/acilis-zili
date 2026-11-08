import assert from "node:assert/strict";
import { test } from "node:test";
import { BELL_LATE_MS, bellTransition } from "../components/today/bell-event";

/* Geri sayım zili bir GEÇİŞ (components/today/Countdown.tsx): önceki tikte
   kalan > 0, şimdiki tikte 0 ve sınır az önce geçildi. Gizli sekmeden,
   BFCache'ten ya da bayat HTML'den dönüşte hedef çoktan geçmişse susar. */

const target = Date.UTC(2026, 10, 9, 14, 30); // pazartesi açılışı, 09:30 ET

test("sınır iki tik arasında geçildi: çalar", () => {
  assert.equal(bellTransition(target - 985, target + 15, target), true);
  // Tam sınırda tik: kalan tam 0.
  assert.equal(bellTransition(target - 1000, target, target), true);
});

test("gecikmeli tik: pencere içinde çalar, sınırında susar", () => {
  assert.equal(bellTransition(target - 1000, target + BELL_LATE_MS - 1, target), true);
  assert.equal(bellTransition(target - 1000, target + BELL_LATE_MS, target), false);
});

test("gizli sekme: cuma bırakılıp pazartesi öğlen öne alınan sekme susar", () => {
  const friday = Date.UTC(2026, 10, 6, 14, 0);
  const mondayNoon = Date.UTC(2026, 10, 9, 19, 0);
  assert.equal(bellTransition(friday, mondayNoon, target), false);
});

test("BFCache ya da bayat HTML: ilk tik hedef çoktan geçmişken susar", () => {
  assert.equal(bellTransition(target - 60_000, target + 30_000, target), false);
});

test("hedef geçmişken sonraki tikler ve henüz gelmemiş hedef susar", () => {
  assert.equal(bellTransition(target + 15, target + 1015, target), false);
  assert.equal(bellTransition(target - 2000, target - 1000, target), false);
  // İlk önceki tik sunucu damgası sınırdaysa (kalan zaten 0) çalmaz.
  assert.equal(bellTransition(target, target + 500, target), false);
});

test("geçersiz hedef (bozuk ISO → NaN) hiç çalmaz", () => {
  assert.equal(bellTransition(target - 1000, target, Number.NaN), false);
});
