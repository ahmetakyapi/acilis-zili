import test from "node:test";
import assert from "node:assert/strict";
import { alanlarDegisti } from "../lib/content-write";

const kayit = { title: "A", bodyMd: "metin", symbols: ["NVDA"], sources: [{ label: "X", url: "https://x.test" }], eventDate: "2026-11-06" };

test("yalnız kaynak değişince de damga ilerler (panel sürüm denetimi)", () => {
  const yeni = { ...kayit, sources: [{ label: "X", url: "https://web.archive.org/x" }] };
  assert.equal(alanlarDegisti(kayit, yeni, ["title", "bodyMd", "symbols", "sources", "eventDate"]), true);
});

test("aynı içerik yeniden gelince damga yerinde kalır", () => {
  const yeni = { ...kayit, symbols: ["NVDA"], sources: [{ label: "X", url: "https://x.test" }] };
  assert.equal(alanlarDegisti(kayit, yeni, ["title", "bodyMd", "symbols", "sources", "eventDate"]), false);
});

test("boş sütun: undefined ile null aynı, listede olmayan alan sayılmaz", () => {
  assert.equal(alanlarDegisti({ sources: null }, { sources: undefined }, ["sources"]), false);
  assert.equal(alanlarDegisti(kayit, { ...kayit, title: "B" }, ["bodyMd"]), false);
  assert.equal(alanlarDegisti(kayit, { ...kayit, eventDate: "2026-11-07" }, ["eventDate"]), true);
});
