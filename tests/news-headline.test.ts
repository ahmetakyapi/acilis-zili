import assert from "node:assert/strict";
import test from "node:test";
import { newsHeadlineKey } from "../lib/news-headline";

const base = "Nvidia shares slide after earnings guidance";

test("update prefixes collapse onto the original headline", () => {
  const key = newsHeadlineKey(base);
  for (const variant of [
    `Update: ${base}`,
    `UPDATE 2-${base}`,
    `UPDATE 1 - ${base}`,
    `Updated: ${base}`,
    `Güncelleme: ${base}`,
    `GÜNCELLEME 2: ${base}`,
    `UPDATE 1-UPDATE 2-${base}`,
  ]) {
    assert.equal(newsHeadlineKey(variant), key, variant);
  }
});

test("a trailing parenthesis and punctuation are ignored", () => {
  const key = newsHeadlineKey(base);
  assert.equal(newsHeadlineKey(`${base} (Reuters)`), key);
  assert.equal(newsHeadlineKey(`${base} (updated)`), key);
  assert.equal(newsHeadlineKey(`${base} (2)`), key);
  assert.equal(newsHeadlineKey(`${base} (Reuters) (updated)`), key);
  assert.equal(newsHeadlineKey(`${base}.`), key);
  assert.equal(newsHeadlineKey(`  ${base.replace(/ /g, "  ")}  `), key);
});

test("case folds the Turkish way and stays consistent", () => {
  assert.equal(newsHeadlineKey("İNTEL HİSSESİ YÜKSELDİ"), newsHeadlineKey("İntel hissesi yükseldi"));
});

test("different stories stay different", () => {
  assert.notEqual(newsHeadlineKey(base), newsHeadlineKey("Nvidia shares rise after earnings guidance"));
  /* Parantez manşetin ORTASINDAYSA anlam taşıyor (sembol): dokunulmuyor. */
  assert.notEqual(newsHeadlineKey("Solventum (SOLV) shares jump"), newsHeadlineKey("Solventum shares jump"));
  /* "Update" kelimesi ön ek değilse kalıyor. */
  assert.notEqual(newsHeadlineKey("Updates to the Fed calendar"), newsHeadlineKey("to the Fed calendar"));
});

test("a headline that is only a parenthesis keeps a non-empty key", () => {
  assert.ok(newsHeadlineKey("(Reuters)").length > 0);
  assert.notEqual(newsHeadlineKey("(Reuters)"), newsHeadlineKey(""));
});
