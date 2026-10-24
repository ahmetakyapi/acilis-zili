import test from "node:test";
import assert from "node:assert/strict";
import { parseBlocks } from "../components/article/parse-blocks";
import {
  chartSignatureSeries,
  pickSignature,
  signaturePattern,
  storyOgFigure,
} from "../lib/story-signature";

/* Mercek arşiv kartının imza bloğu (lib/story-signature.ts) ve paylaşım
   kartının rakam seçimi. */

const md = [
  "Giriş paragrafı.",
  "::: sayilar Rakamlarla",
  "4,2 Mr $ | Toplam",
  ":::",
  "::: bar Değişim",
  "A | 0",
  ":::",
  "::: bar Gerçek",
  "A | -3",
  "B | 2",
  ":::",
  "::: oncesi Değer",
  "10 | önce",
  "5 | sonra",
  ":::",
  "::: akis Zincir",
  "X | 1",
  "Y | 2",
  ":::",
].join("\n");

test("imza: öncelik akis > oncesi > bar > sayilar, gövde sırası değil", () => {
  const blocks = parseBlocks(md, "tr");
  assert.equal(pickSignature(blocks)?.kind, "flow");
  assert.equal(pickSignature(blocks.filter((b) => b.kind !== "flow"))?.kind, "shift");
  const noShift = blocks.filter((b) => b.kind !== "flow" && b.kind !== "shift");
  /* Tümü sıfır olan ilk bar çizilemez; ikinci bar seçilir. */
  const bars = pickSignature(noShift);
  assert.equal(bars?.kind, "bars");
  assert.equal(bars?.kind === "bars" && bars.label, "Gerçek");
  assert.equal(pickSignature(noShift.filter((b) => b.kind !== "bars"))?.kind, "stats");
  assert.equal(pickSignature(parseBlocks("Yalnız metin.", "tr")), null);
});

test("imza: grafik en sonda ve seri bir yıllık günlük barlardan kesilir", () => {
  const blocks = parseBlocks("::: grafik MU | 1M | Micron\n:::", "tr");
  assert.equal(pickSignature(blocks)?.kind, "chart");
  const day = 86_400;
  const bars = Array.from({ length: 250 }, (_, i) => ({ time: Date.UTC(2026, 0, 2) / 1000 + i * day, close: i }));
  assert.equal(chartSignatureSeries(bars, "1M")?.length, 22);
  assert.equal(chartSignatureSeries(bars, "1Y")?.length, 250);
  assert.equal(chartSignatureSeries(bars, "1D"), null);
  assert.equal(chartSignatureSeries(bars, "5Y"), null);
  assert.equal(chartSignatureSeries(undefined, "1M"), null);
});

test("imza kalıbı: satır başı, tür sözcüğü sınırı ve kapanış", () => {
  /* Postgres ARE kalıbı JS'te birebir koşmuyor (`(?i)` ön eki); burada
     yalnız gövdesi JS RegExp ile sınanıyor. Gerçek doğrulama canlı arşivde
     yapıldı (322/322, bkz. signaturePattern). */
  const body = signaturePattern("bars").replace("(?i)", "");
  const re = new RegExp(body, "i");
  assert.equal(re.exec("metin ::: bar X\nA | 1\n:::")?.[1], undefined);
  assert.equal(re.exec("p\n::: bar X\nA | 1\n:::\n")?.[1], "::: bar X\nA | 1\n:::");
  assert.equal(re.exec("p\n::: barlar X\nA | 1\n:::\n"), null);
  assert.equal(re.exec("p\n  ::: BAR\nA | 1\n\nB | 2\n  :::")?.[1], "::: BAR\nA | 1\n\nB | 2\n  :::");
});

test("paylaşım kartı: ilk sayilar, yoksa ilk çizilebilir bar", () => {
  const blocks = parseBlocks(md, "tr");
  assert.equal(storyOgFigure(blocks)?.kind, "stats");
  const fallback = storyOgFigure(blocks.filter((b) => b.kind !== "stats"));
  assert.equal(fallback?.kind === "bars" && fallback.label, "Gerçek");
  assert.equal(storyOgFigure(parseBlocks("::: akis Z\nA | 1\n:::", "tr")), null);
});
