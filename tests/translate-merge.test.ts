import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTranslations } from "../lib/translate";

const rows = [
  { id: "a", headlineTr: null, summaryTr: null, headline: "Nike gains" },
  { id: "b", headlineTr: "Hazır başlık", summaryTr: "Hazır özet", headline: "Ready" },
  { id: "c", headlineTr: null, summaryTr: "Eski özet", headline: "Tesla" },
];

test("gelen çeviri yalnız çevirisiz satıra işlenir", () => {
  const done = new Map([
    ["a", { headlineTr: "Nike yükseldi", summaryTr: "Özet" }],
    ["b", { headlineTr: "Üzerine yazmamalı", summaryTr: null }],
  ]);
  const merged = mergeTranslations(rows, done);
  assert.equal(merged[0].headlineTr, "Nike yükseldi");
  assert.equal(merged[0].summaryTr, "Özet");
  assert.equal(merged[1].headlineTr, "Hazır başlık");
  assert.equal(merged[2].headlineTr, null);
  assert.equal(merged[0].headline, "Nike gains");
});

test("boş özet çevirisi eldeki özet çevirisini silmez", () => {
  const merged = mergeTranslations(rows, new Map([["c", { headlineTr: "Tesla başlığı", summaryTr: null }]]));
  assert.equal(merged[2].headlineTr, "Tesla başlığı");
  assert.equal(merged[2].summaryTr, "Eski özet");
});
