import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BILINGUAL_RULE_LINES, GROUNDING, NO_ADVICE, NUMBERS, OWNER_VIEW, ruleList, UNTRUSTED_NEWS, UNTRUSTED_READER, VOICE } from "../lib/claude-prompt-rules";

/**
 * Site içi Claude istemlerinin ortak kuralları (lib/claude-prompt-rules.ts).
 * İstemler çalıştırılarak sınanamaz (anahtar ve bütçe); burada kuralların
 * BİÇİMİ ve tek kaynaktan gelmesi sabitlenir.
 */

const ALL = [GROUNDING, NUMBERS, UNTRUSTED_NEWS, UNTRUSTED_READER, NO_ADVICE, OWNER_VIEW, VOICE];

test("ortak kurallar iki dilde de dolu ve tek satır", () => {
  for (const rule of ALL) {
    for (const locale of ["tr", "en"] as const) {
      assert.ok(rule[locale].length > 40);
      assert.ok(!rule[locale].includes("\n"), "madde listesine girdiği için tek satır");
    }
  }
  assert.equal(ruleList(["a", "b"]), "- a\n- b");
});

test("ortak kurallarda rakam yok: örnekteki sayı modelin kopyalayacağı kalıba dönüşür", () => {
  for (const text of [...ALL.flatMap((rule) => [rule.tr, rule.en]), ...BILINGUAL_RULE_LINES]) {
    assert.deepEqual(text.match(/\d/g) ?? [], [], text.slice(0, 60));
  }
});

test("sayı kuralı denetimin baktığı üç şeyi söyler: aynen kopyala, hesap yok, küçük adet yazıyla", () => {
  assert.match(NUMBERS.tr, /AYNEN kopyala/);
  assert.match(NUMBERS.tr, /hesap yapma/);
  assert.match(NUMBERS.tr, /yazıyla/);
  assert.match(NUMBERS.en, /EXACTLY/);
  assert.match(NUMBERS.en, /compute nothing/);
  assert.match(NUMBERS.en, /in words/);
});

/* `callClaude` çağıran (ve SDK'yı doğrudan çağıran pazar yorumu) her modül
   ortak kuralları içe aktarır: yeni bir istem kendi "yalnız verilen veri"
   cümlesini yazmasın. Bilinçli istisnalar adıyla. */
const EXEMPT = new Map([["screen-query-ai.ts", "metin yazmaz: cümleyi süzgeç alanlarına eşler, sayı üretmez"]]);

function promptModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "i18n" || entry.name === "providers" ? [] : promptModules(path);
    if (!entry.name.endsWith(".ts")) return [];
    return /\bcallClaude\(/.test(readFileSync(path, "utf8")) ? [path] : [];
  });
}

test("her Claude istemi ortak kuralları tek kaynaktan alır", () => {
  const modules = promptModules(join(process.cwd(), "lib"));
  assert.ok(modules.length >= 12, `beklenen modüller bulunamadı (${modules.length})`);
  for (const path of [...modules, join(process.cwd(), "lib", "weekly-commentary.ts")]) {
    const name = path.split("/").pop()!;
    const source = readFileSync(path, "utf8");
    if (EXEMPT.has(name)) continue;
    assert.match(source, /from "@\/lib\/claude-prompt-rules"/, `${name}: ortak kurallar içe aktarılmalı`);
  }
});

test("istem değişen her çağrının önbellek anahtarı sürümlü", () => {
  const modules = promptModules(join(process.cwd(), "lib"));
  for (const path of modules) {
    const source = readFileSync(path, "utf8");
    if (!source.includes("unstable_cache(")) continue;
    assert.match(source, /\["[a-z-]+-v\d+"/, `${path.split("/").pop()}: sürümlü anahtar`);
  }
});
