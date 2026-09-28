import test from "node:test";
import assert from "node:assert/strict";

import { GLOSSARY_META } from "../content/glossary/meta";
import { glossaryMatchList, glossaryTerms } from "../content/glossary";
import { GUIDE_META } from "../content/guide/meta";
import { THEMES } from "../content/themes";
import { COMPARE_PAIRS } from "../content/compare-pairs";
import { MAX_COMPARE_SYMBOLS } from "../lib/compare";
import { createAutoLinker, lowerSameLength } from "../lib/autolink";

/**
 * Sözlük, tema ve çift dosyalarının tipin yakalayamadığı değişmezleri.
 *
 * Tip eksik çeviriyi zaten yakalıyor (`Record<GlossarySlug, …>`); burada
 * kalanlar: dizinin kendi slug'larına başvuran ilişkiler, iki terimin aynı
 * yüzey biçimini paylaşması (otomatik bağlantı hangisine gideceğini
 * bilemez) ve okuyucuya görünen metinde uzun tire.
 */

const SLUGS = new Set<string>(GLOSSARY_META.map((entry) => entry.slug));
const LOCALES = ["tr", "en"] as const;

test("slug'lar tekil ve adrese yazılabilir", () => {
  assert.equal(SLUGS.size, GLOSSARY_META.length);
  for (const slug of SLUGS) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, slug);
});

test("ilişkili terimler var olan terimlere, kendine değil", () => {
  for (const entry of GLOSSARY_META) {
    for (const related of "related" in entry ? entry.related : []) {
      assert.ok(SLUGS.has(related), `${entry.slug} → ${related}`);
      assert.notEqual(related, entry.slug);
    }
  }
});

test("rehber bağı var olan bir yazıya", () => {
  const guides = new Set<string>(GUIDE_META.map((entry) => entry.slug));
  for (const entry of GLOSSARY_META) {
    if ("guide" in entry) assert.ok(guides.has(entry.guide), `${entry.slug} → ${entry.guide}`);
    /* İkinci bağ başka dalda yazılmış olabilir: yalnızca biçim. */
    if ("guideMore" in entry) assert.match(entry.guideMore, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

for (const locale of LOCALES) {
  test(`${locale}: iki terim aynı yüzey biçimini paylaşmıyor`, () => {
    const owner = new Map<string, string>();
    for (const { slug, forms } of glossaryMatchList(locale)) {
      for (const form of forms) {
        const exact = form !== lowerSameLength(form, locale);
        const key = exact ? form : lowerSameLength(form, locale);
        const previous = owner.get(key);
        assert.ok(!previous || previous === slug, `"${form}": ${previous} ve ${slug}`);
        owner.set(key, slug);
      }
    }
  });

  test(`${locale}: her terim kendi biçimiyle kendine bağlanıyor`, () => {
    /* Bir biçim, daha uzun başka bir terimin biçiminin içinde kalıyorsa
       o uzun terime gider — bu doğru. Ama bir terimin HİÇBİR biçimi
       kendine gitmiyorsa o biçimler ölü demek. */
    const terms = glossaryMatchList(locale);
    for (const { slug, forms } of terms) {
      if (forms.length === 0) continue;
      const reached = forms.some((form) => {
        const linker = createAutoLinker({ locale, terms, symbols: new Set() });
        const pieces = linker.split(`x ${form} x`);
        return pieces.some((piece) => typeof piece !== "string" && piece.href === `/sozluk/${slug}`);
      });
      assert.ok(reached, `${slug}: ${forms.join(", ")}`);
    }
  });

  test(`${locale}: okuyucu metninde uzun tire yok, tanım boş değil`, () => {
    for (const term of glossaryTerms(locale)) {
      for (const text of [term.term, term.definition, term.example ?? ""]) {
        assert.ok(!/[—–]/.test(text), `${term.slug}: ${text.slice(0, 60)}`);
      }
      assert.ok(term.definition.length > 40, term.slug);
    }
  });
}

test("tema ve çift metinlerinde uzun tire yok; semboller biçimce geçerli", () => {
  for (const theme of THEMES) {
    for (const text of [theme.titleTr, theme.titleEn, theme.dekTr, theme.dekEn, theme.whyTr, theme.whyEn]) {
      assert.ok(!/[—–]/.test(text), `${theme.slug}: ${text.slice(0, 60)}`);
    }
    if (theme.symbols !== "katilim") {
      assert.equal(new Set(theme.symbols).size, theme.symbols.length, `${theme.slug}: tekrar`);
      for (const symbol of theme.symbols) assert.match(symbol, /^[A-Z][A-Z.]{0,5}$/);
    }
  }
  for (const pair of COMPARE_PAIRS) {
    assert.ok(pair.symbols.length >= 2 && pair.symbols.length <= MAX_COMPARE_SYMBOLS, pair.slug);
    assert.equal(pair.slug, pair.symbols.join("-").toLowerCase(), pair.slug);
    for (const text of [pair.introTr, pair.introEn]) {
      assert.ok(!/[—–]/.test(text), pair.slug);
    }
  }
});

test("terim görselindeki her sayı o terimin örneğinden geliyor", async () => {
  /* Görsel örneği ÇİZİYOR, yeni bir örnek kurmuyor (content/glossary/visuals.ts).
     Örnek metni değişip görsel eski sayıda kalırsa ikisi aynı sayfada
     çelişirdi. */
  const { GLOSSARY_VISUALS } = await import("../content/glossary/visuals");
  const numbers = (text: string) => text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  for (const locale of LOCALES) {
    const terms = new Map(glossaryTerms(locale).map((term) => [term.slug, term]));
    for (const [slug, visual] of Object.entries(GLOSSARY_VISUALS)) {
      if (!visual || visual.kind !== "blocks") continue;
      const example = terms.get(slug as never)?.example ?? "";
      assert.ok(example, `${slug} (${locale}) örneksiz`);
      const allowed = new Set(numbers(example));
      for (const value of numbers(visual[locale])) {
        assert.ok(allowed.has(value), `${slug} (${locale}): ${value} örnekte yok`);
      }
    }
  }
});
