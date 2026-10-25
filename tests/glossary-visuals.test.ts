import test from "node:test";
import assert from "node:assert/strict";

import { glossaryTerm } from "../content/glossary";
import { DIAL_THRESHOLDS, GLOSSARY_FORMULAS } from "../content/glossary/formulas";

/**
 * Sözlüğün formül ve kadran verisi (content/glossary/formulas.ts).
 *
 * Tip slug'ı denetliyor ama metni denetlemiyor: burada formülün terimin
 * KENDİ tanımıyla tutarlı olduğu (bölme diyen formülün tanımı da bir
 * bölme ya da oran), iki dilin dolu olduğu ve kadran eşiklerinin tanımda
 * yazılı olduğu sınanıyor. Uydurma bir formül ya da eşik buradan geçmez.
 */

const entries = Object.entries(GLOSSARY_FORMULAS);

const DIVIDE_WORDS = { tr: /bölün|oran/i, en: /divided|ratio|percentage|as a share/i } as const;
const MULTIPLY_WORDS = { tr: /çarpıl/i, en: /multipl/i } as const;
const SUBTRACT_WORDS = { tr: /düşül|çıkarıl/i, en: /minus|subtract/i } as const;

test("her formül sözlükte var olan bir terime ait", () => {
  assert.ok(entries.length > 0);
  for (const [slug] of entries) {
    for (const locale of ["tr", "en"] as const) {
      assert.ok(glossaryTerm(slug, locale), `${slug} (${locale}) sözlükte yok`);
    }
  }
});

test("formüllerin iki dili de dolu, Title Case ve uzun tiresiz", () => {
  for (const [slug, formula] of entries) {
    if (formula?.kind !== "formula") continue;
    for (const locale of ["tr", "en"] as const) {
      for (const side of [formula[locale].a, formula[locale].b]) {
        assert.ok(side.trim().length > 0, `${slug} ${locale}: boş kalem`);
        assert.ok(!/[—–]/.test(side), `${slug} ${locale}: uzun tire`);
        const first = side.charAt(0);
        assert.equal(first, first.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US"), `${slug} ${locale}: "${side}" büyük harfle başlamıyor`);
      }
    }
  }
});

test("formülün işlemi terimin kendi tanımında geçiyor", () => {
  for (const [slug, formula] of entries) {
    if (formula?.kind !== "formula") continue;
    const words = formula.op === "divide" ? DIVIDE_WORDS : formula.op === "multiply" ? MULTIPLY_WORDS : SUBTRACT_WORDS;
    for (const locale of ["tr", "en"] as const) {
      const definition = glossaryTerm(slug, locale)!.definition;
      assert.match(definition, words[locale], `${slug} (${locale}): tanım bir ${formula.op} anlatmıyor`);
    }
  }
});

test("yüzde işareti yalnız bölme formüllerinde", () => {
  for (const [slug, formula] of entries) {
    if (formula?.kind !== "formula" || !formula.percent) continue;
    assert.equal(formula.op, "divide", `${slug}: yüzde yalnız bölmede anlamlı`);
  }
});

test("kadran eşikleri terimin tanımında yazılı", () => {
  for (const [slug, formula] of entries) {
    if (formula?.kind !== "dial") continue;
    const definition = glossaryTerm(slug, "tr")!.definition;
    for (const cut of DIAL_THRESHOLDS[formula.scale]) {
      /* Aşırı alım tanımı yalnız 70'i, aşırı satım yalnız 30'u yazıyor:
         odaklı kadranda yalnız odaklanan eşik aranıyor. */
      const needed =
        formula.focus === "high" ? cut === Math.max(...DIAL_THRESHOLDS[formula.scale]) : formula.focus === "low" ? cut === Math.min(...DIAL_THRESHOLDS[formula.scale]) : true;
      if (!needed) continue;
      assert.ok(definition.includes(String(cut)), `${slug}: tanımda ${cut} geçmiyor`);
    }
  }
});
