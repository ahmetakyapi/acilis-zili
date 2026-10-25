import test from "node:test";
import assert from "node:assert/strict";

import { TITLE_BUDGET } from "../lib/seo-titles";
import { GUIDE_SEARCH, guideSearchCopy } from "../content/guide/search";
import { GUIDE_SLUGS, guideArticle } from "../content/guide";

/**
 * Rehberin arama künyesi (25 Ekim) — gerekçe `content/guide/search.ts`.
 * Künye yazıda olmayan bir şey vaat etmez: açıklamanın sayıları ve
 * kısaltmaları yazıda birebir, kelimelerinin en az dörtte üçü (beş harflik
 * kök) yazıda geçer. Eşik 25 Ekim'deki en düşük örtüşmeden (degerleme,
 * 0,77) seçildi; çekimli fiil ve bağlaçlar ("ödendiğini", "öteki") köke
 * inmiyor, eşik onlara pay bırakıyor.
 */

/** Google'ın açıklamayı kestiği yer (yaklaşık). */
const DESCRIPTION_BUDGET = 155;
/** Açıklama kelimelerinin yazıda geçmesi gereken en düşük oran. */
const BODY_OVERLAP_MIN = 0.75;
/** Karşılaştırmada kelimenin kökü sayılan ön ek; kısa kelimeler sayılmaz. */
const STEM = 5;

const entries = Object.entries(GUIDE_SEARCH).flatMap(([slug, entry]) =>
  (["tr", "en"] as const).flatMap((locale) => {
    const copy = entry?.[locale];
    return copy ? [{ slug, locale, copy }] : [];
  }),
);

test("her künye var olan bir yazıya ve var olan dile ait", () => {
  assert.ok(entries.length > 0);
  for (const { slug, locale } of entries) {
    assert.ok((GUIDE_SLUGS as readonly string[]).includes(slug), `bilinmeyen yazı: ${slug}`);
    assert.ok(guideArticle(slug, locale), `${slug}/${locale} yok`);
  }
});

test("başlık markasız ≤ 60, açıklama ≤ 155; uzun tire yok", () => {
  for (const { slug, copy } of entries) {
    if (copy.title) assert.ok(copy.title.length <= TITLE_BUDGET, `${slug}: ${copy.title.length}`);
    if (copy.description) {
      assert.ok(copy.description.length <= DESCRIPTION_BUDGET, `${slug}: ${copy.description.length}`);
      assert.doesNotMatch(copy.description, /—/, `${slug}: uzun tire`);
    }
    if (copy.title) assert.doesNotMatch(copy.title, /—/, `${slug}: uzun tire`);
  }
});

test("soru biçimli başlık soru işaretiyle biter", () => {
  for (const { slug, copy } of entries) {
    if (!copy.title) continue;
    /* Soru kalıbı taşıyan her parça "?" ile kapanır. İngilizcede "How a
       Company Goes Public" soru değil, konu adı; yalnız "What Is/Are". */
    for (const part of copy.title.split(/(?<=[?:])\s+/)) {
      if (/(Nedir|Nelerdir|Nasıl|Neden|What Is|What Are)/.test(part)) {
        assert.match(part, /\?$/, `${slug}: "${part}"`);
      }
    }
  }
});

test("açıklama yazının gövdesinde geçiyor", () => {
  for (const { slug, locale, copy } of entries) {
    if (!copy.description) continue;
    const article = guideArticle(slug, locale)!;
    const text = `${article.title} ${article.dek} ${article.bodyMd}`;
    const lang = locale === "tr" ? "tr-TR" : "en-US";
    const body = text.toLocaleLowerCase(lang);

    // Sayılar ve kısaltmalar birebir.
    for (const token of copy.description.match(/\d+|\b[A-Z]{2,}\b/g) ?? []) {
      assert.ok(text.includes(token), `${slug}/${locale}: "${token}" yazıda yok`);
    }
    const words = (copy.description.toLocaleLowerCase(lang).match(/[\p{L}\d]+/gu) ?? []).filter(
      (word) => word.length >= STEM,
    );
    const found = words.filter((word) => body.includes(word.slice(0, STEM)));
    assert.ok(
      found.length / words.length >= BODY_OVERLAP_MIN,
      `${slug}/${locale}: ${found.length}/${words.length}`,
    );
  }
});

test("künyesi tanımsız yazı ekrandaki başlık ve dek ile kalır", () => {
  const article = guideArticle("emir-tipleri", "tr")!;
  assert.notEqual(guideSearchCopy("emir-tipleri", "tr", article).description, article.dek);
  const other = guideArticle("hisse-senedi", "tr")!;
  assert.deepEqual(guideSearchCopy("hisse-senedi", "tr", other), {
    title: other.title,
    description: other.dek,
  });
});
