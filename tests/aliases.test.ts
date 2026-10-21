import test from "node:test";
import assert from "node:assert/strict";
import { aliasSymbols } from "../db/seed/aliases";

test("alias lookup finds brands by exact key and prefix", () => {
  assert.deepEqual(aliasSymbols("SpaceX"), ["SPCX"]);
  assert.ok(aliasSymbols("spac").includes("SPCX"));
});

test("prototype names are not aliases", () => {
  /* 20 Ekim: "constructor" `Object` fonksiyonunu dönüyordu ve
     /sirketler?q=constructor `new Set(...)`te çöküyordu. */
  for (const query of ["constructor", "Constructor", "__proto__", "toString", "hasOwnProperty"]) {
    const result = aliasSymbols(query);
    assert.ok(Array.isArray(result), query);
    assert.doesNotThrow(() => new Set(result), query);
    assert.deepEqual(result, [], query);
  }
});
