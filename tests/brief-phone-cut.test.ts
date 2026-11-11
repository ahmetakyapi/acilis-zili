import assert from "node:assert/strict";
import test from "node:test";
import { BRIEF_PHONE_LEDE_CHARS, briefPhoneCut, briefPreviewCut } from "../lib/brief";

const sentence = "A complete sentence about the market and why it moved today. ";
const para = (n: number) => sentence.repeat(n).trim();

test("phone preview keeps the lede and one more paragraph", () => {
  const lines = [para(3), para(5), para(4), para(4), para(4), para(6), para(6), para(6)];
  const desktop = briefPreviewCut(lines);
  /* Kural 400 karakterlik bütçeyle yazıldı; varsayılan 30 Eylül'de 600'e
     çıktı (lib/brief.ts → BRIEF_PHONE_PREVIEW_CHARS). Yapı testi bütçeyi
     açıkça veriyor, varsayılanın etkisi aşağıdaki testte. */
  const phone = briefPhoneCut(lines, desktop, 400);
  assert.equal(phone, 2);
  assert.ok(phone < desktop);
});

test("the 600-character default opens one more paragraph on the phone", () => {
  const lines = [para(3), para(5), para(4), para(4), para(4), para(6), para(6), para(6)];
  const desktop = briefPreviewCut(lines);
  const phone = briefPhoneCut(lines, desktop);
  assert.equal(phone, 3);
  assert.ok(phone < desktop);
});

test("a very long lede still earns one more line, never a half one", () => {
  const lines = [para(12), para(2), para(4), para(4), para(6), para(6)];
  assert.equal(briefPhoneCut(lines, briefPreviewCut(lines)), 2);
});

test("an introduction ending with a colon stays with its list; items stay whole", () => {
  const lines = [para(2), "The complete list follows:", "- First item", "- Second item", para(4), para(6), para(6), para(6)];
  const phone = briefPhoneCut(lines, briefPreviewCut(lines), 60);
  assert.ok(phone >= 3, "cut after the colon line would orphan the introduction");
  assert.ok(lines[phone - 1].trim() !== "The complete list follows:");
});

test("a heading stays with its first paragraph", () => {
  const lines = ["## Last Week", para(8), "## This Week", para(3), para(6), para(6), para(6)];
  const phone = briefPhoneCut(lines, briefPreviewCut(lines));
  assert.ok(!lines[phone - 1].startsWith("##"));
});

test("table rows are not split", () => {
  const lines = [para(8), "| a | b |", "| 1 | 2 |", "| 3 | 4 |", para(6), para(6), para(6)];
  const phone = briefPhoneCut(lines, briefPreviewCut(lines), 10);
  assert.ok(!lines[phone]?.startsWith("|") || !lines[phone - 1].startsWith("|"));
});

test("never longer than the desktop preview", () => {
  const short = ["Short lede.", "- One", "- Two"];
  assert.equal(briefPhoneCut(short, briefPreviewCut(short)), briefPreviewCut(short));
  const lines = [para(2), para(2), para(2), para(8), para(8)];
  const desktop = briefPreviewCut(lines);
  assert.ok(briefPhoneCut(lines, desktop) <= desktop);
});

/* 11 Kasım: ana sayfa kartı telefonda yalnız girişi açık tutuyor
   (`afterLede = 0`, gerekçe lib/brief.ts). */
test("lede-only cut: a full lede stands alone, bullets fold", () => {
  const lines = [para(5), "- First item " + para(2), "- Second item " + para(2), para(4), para(6), para(6)];
  const desktop = briefPreviewCut(lines);
  assert.equal(briefPhoneCut(lines, desktop, BRIEF_PHONE_LEDE_CHARS, 0), 1);
});

test("lede-only cut: a short lede borrows the next line, a heading never ends it", () => {
  const short = ["Oil fell.", para(4), para(4), para(6), para(6), para(6)];
  assert.equal(briefPhoneCut(short, briefPreviewCut(short), BRIEF_PHONE_LEDE_CHARS, 0), 2);
  const weekly = ["## Last Week", para(5), para(4), "## This Week", para(6), para(6)];
  assert.equal(briefPhoneCut(weekly, briefPreviewCut(weekly), BRIEF_PHONE_LEDE_CHARS, 0), 2);
});

test("lede-only cut: an introduction ending with a colon keeps its list", () => {
  const lines = [para(4) + " Three things matter:", "- One " + para(1), "- Two " + para(1), para(6), para(6), para(6)];
  const phone = briefPhoneCut(lines, briefPreviewCut(lines), BRIEF_PHONE_LEDE_CHARS, 0);
  assert.ok(phone >= 2);
});
