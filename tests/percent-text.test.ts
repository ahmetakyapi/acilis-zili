import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPercent, formatPercentText } from "../lib/utils";

/** Claude notlarına giden yüzde: işaret sayıya bitişik (lib/utils.ts → formatPercentText). */
test("metin yüzdesi: işaret bitişik, ekran figürü değişmez", () => {
  assert.equal(formatPercentText(38.682, "tr", 2), "+%38,68");
  assert.equal(formatPercentText(-13.82, "tr", 1), "−%13,8");
  assert.equal(formatPercentText(2.918, "en", 2), "+2.92%");
  assert.equal(formatPercentText(0, "tr", 1), "%0,0");
  assert.notEqual(formatPercent(38.682, "tr", 2), "+%38,68");
});
