import { test } from "node:test";
import assert from "node:assert/strict";
import { SIGN_GAP, formatEventValue } from "../lib/utils";

/** Ekonomik olay değeri: eksi işareti U+2212, yüzdenin ÖNÜNDE (lib/utils.ts → formatEventValue, 20 Ekim). */
test("eksi değer sitenin yüzde imlasıyla yazılır", () => {
  assert.equal(formatEventValue("-0.3", "%", "tr"), `−${SIGN_GAP}%0,3`);
  assert.equal(formatEventValue("-0.3", "%", "en"), `−${SIGN_GAP}0.3%`);
  assert.equal(formatEventValue("-23", "bin", "tr"), `−${SIGN_GAP}23 bin`);
  assert.equal(formatEventValue("-23", "bin", "en"), `−${SIGN_GAP}23 K`);
  assert.equal(formatEventValue("-1.5", null, "tr"), `−${SIGN_GAP}1,5`);
  assert.equal(formatEventValue("-0", "%", "tr"), "%0");
});

test("artı değer ve sayı olmayan dize değişmez", () => {
  assert.equal(formatEventValue("2.7", "%", "tr"), "%2,7");
  assert.equal(formatEventValue("3.46353", "%", "en"), "3.46%");
  assert.equal(formatEventValue("129", "bin", "tr"), "129 bin");
  assert.equal(formatEventValue("250K", "bin", "tr"), "250K");
  assert.equal(formatEventValue("  ", "%", "tr"), null);
});
