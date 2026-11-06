import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionsIndexPercent } from "../lib/brief-ledger";

test("dipnot: metin bir endeksin yüzdesini aynı cümlede anarsa", () => {
  assert.equal(mentionsIndexPercent("Perşembe ne olmuştu: S&P 500 %4,36, Nasdaq Bileşik %5,52 düştü."), true);
  assert.equal(mentionsIndexPercent("The S&P 500 fell 4.36% on Thursday."), true);
  assert.equal(mentionsIndexPercent("**S&P 500** %1,2 yükseldi."), true);
});

test("dipnot: yüzde başka cümlede ya da endeks anılmıyorsa basılmaz", () => {
  assert.equal(mentionsIndexPercent("S&P 500 güçlü kapandı. İşsizlik %4,1'e indi."), false);
  assert.equal(mentionsIndexPercent("Micron %17,5 değer kaybetti."), false);
  assert.equal(mentionsIndexPercent("Stocks went down 3% today."), false);
});
