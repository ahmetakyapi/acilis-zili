import test from "node:test";
import assert from "node:assert/strict";
import {
  closeToClose,
  enoughCoverage,
  formatPoints,
  gapToMarket,
  rankMovers,
  watchlistFingerprint,
} from "../lib/watchlist-today-core";

/**
 * Takip Listem Bugün'ün saf hesapları (lib/watchlist-today-core.ts).
 * Claude hesap yapmıyor; buradaki her sayı modele biçimlenmiş gidiyor ve
 * çıktıdaki her sayı girdide geçmek zorunda.
 */

test("parmak izi listenin sırasından ve harf büyüklüğünden bağımsız", () => {
  assert.equal(watchlistFingerprint(["NVDA", "aapl", "MSFT"]), watchlistFingerprint(["MSFT", "NVDA", "AAPL", "AAPL"]));
  assert.notEqual(watchlistFingerprint(["NVDA", "AAPL"]), watchlistFingerprint(["NVDA", "AAPL", "TSLA"]));
});

test("kapanıştan kapanışa değişim; taban yoksa null", () => {
  assert.equal(closeToClose([100, 110], 1), 10);
  assert.equal(closeToClose([100, 105, 110, 120, 130, 150], 5), 50);
  assert.equal(closeToClose([100], 1), null);
  assert.equal(closeToClose([0, 10], 1), null);
});

test("en büyük mutlak hareket önce, eşitlikte sembol sırası", () => {
  const ranked = rankMovers(
    [
      { symbol: "AAA", dayPct: 1.2, fivePct: null },
      { symbol: "BBB", dayPct: -3.4, fivePct: null },
      { symbol: "CCC", dayPct: 3.4, fivePct: null },
      { symbol: "DDD", dayPct: 0.1, fivePct: null },
    ],
    3,
  );
  assert.deepEqual(ranked.map((m) => m.symbol), ["BBB", "CCC", "AAA"]);
});

test("not en az iki hisse ve listenin yarısı okunabiliyorsa yazılır", () => {
  assert.equal(enoughCoverage(1, 1), false);
  assert.equal(enoughCoverage(2, 4), true);
  assert.equal(enoughCoverage(2, 5), false);
  assert.equal(enoughCoverage(5, 6), true);
});

test("S&P 500'e göre fark puan olarak; seri yoksa null", () => {
  assert.ok(Math.abs(gapToMarket(2.5, 0.8)! - 1.7) < 1e-9);
  assert.equal(gapToMarket(2.5, null), null);
});

test("puan metni iki dilde, tipografik eksiyle, işaretli", () => {
  assert.equal(formatPoints(1.234, "tr"), "+1,2 puan");
  assert.equal(formatPoints(-0.96, "en"), "−1.0 pts");
  assert.equal(formatPoints(0.01, "tr"), "0,0 puan");
  assert.equal(formatPoints(2, "tr", "Puan"), "+2,0 Puan");
});
