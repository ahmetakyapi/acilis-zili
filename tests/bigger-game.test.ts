import test from "node:test";
import assert from "node:assert/strict";
import { biggerShareText, isRight, parseBest, pickChallenger, pickStarter, ratioWindow, type BiggerCompany } from "../lib/bigger-game";

/** "Hangisi Büyük?" kuralları (lib/bigger-game.ts). */

const co = (symbol: string, marketCap: number): BiggerCompany => ({ symbol, name: symbol, logoUrl: null, sector: null, marketCap });
const pool = [co("AAPL", 4e12), co("MSFT", 3.8e12), co("JPM", 7e11), co("KO", 3e11), co("XOM", 4.5e11), co("TRGP", 6.3e10), co("ADBE", 1.5e11)];

/** Tohumlu sayı — testler aynı sırayı görsün. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2 ** 31;
    return value / 2 ** 31;
  };
}

test("window narrows as the score grows", () => {
  assert.equal(ratioWindow(0).min, 3);
  assert.ok(ratioWindow(10).max < ratioWindow(4).max);
  assert.ok(ratioWindow(12).min < ratioWindow(1).min);
});

test("easy start: the first challenger is far apart", () => {
  const known = co("AAPL", 4e12);
  for (let seed = 1; seed < 30; seed++) {
    const next = pickChallenger(pool, known, 0, new Set(), seeded(seed));
    assert.ok(next);
    assert.ok(Math.max(next.marketCap, known.marketCap) / Math.min(next.marketCap, known.marketCap) >= 3, next.symbol);
  }
});

test("never the same company or an equal value; widens when the window is empty", () => {
  const known = co("AAPL", 4e12);
  const next = pickChallenger([known, co("TWIN", 4e12), co("MSFT", 3.8e12)], known, 12, new Set(), seeded(3));
  /* Pencere (1,05-1,6) içinde MSFT var; eşit değerli TWIN asla. */
  assert.equal(next?.symbol, "MSFT");
  assert.equal(pickChallenger([known], known, 0, new Set()), null);
  /* Yalnız yakın aday varken kolay pencere bile bir rakip bulur. */
  assert.equal(pickChallenger([known, co("MSFT", 3.8e12)], known, 0, new Set())?.symbol, "MSFT");
});

test("seen companies are avoided while others remain", () => {
  const known = co("AAPL", 4e12);
  const seen = new Set(["KO", "XOM", "JPM", "ADBE"]);
  assert.equal(pickChallenger(pool, known, 0, seen, seeded(5))?.symbol, "TRGP");
});

test("answers, starter, share text and stored best", () => {
  assert.equal(isRight(co("A", 10), co("B", 20), "bigger"), true);
  assert.equal(isRight(co("A", 10), co("B", 20), "smaller"), false);
  const starter = pickStarter(pool, seeded(2));
  assert.ok(starter && starter.marketCap >= 4.5e11);
  assert.equal(biggerShareText({ title: "Hangisi Büyük?", score: 3, best: 7, url: "u" }), "Hangisi Büyük? 3\n🟩🟩🟩\n🏆 7\nu");
  assert.equal(parseBest("12"), 12);
  assert.equal(parseBest("x"), 0);
  assert.equal(parseBest(null), 0);
});
