import test from "node:test";
import assert from "node:assert/strict";
import { clip, firstSentence, pickAlertReason, reasonLine, withReason, REASON_MAX_CHARS, type ReasonHeadline } from "../lib/alert-reason";

/** Alarm gerekçesi — saf seçim (lib/alert-reason.ts). */

const NOW = new Date("2026-11-11T16:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const headline = (text: string, h: number, extra: Partial<ReasonHeadline> = {}): ReasonHeadline => ({
  headline: text,
  headlineTr: null,
  source: "Reuters",
  publishedAt: hoursAgo(h),
  ...extra,
});
const note = (explained: "news" | "market" | "mixed" | "unclear") => ({
  explained,
  summary: {
    tr: "Hisse bilanço sonrası %8,4 yükseldi. Gelir beklentiyi aştı.",
    en: "Shares rose 8.4% after earnings. Revenue beat estimates.",
  },
});

test("ilk cümle: ondalık ve kısaltma bölünmez", () => {
  assert.equal(firstSentence("Shares rose 3.5% on Tuesday. Revenue beat."), "Shares rose 3.5% on Tuesday.");
  assert.equal(firstSentence("Apple Inc. hisseleri yükseldi. İkinci cümle."), "Apple Inc. hisseleri yükseldi.");
  assert.equal(firstSentence("Hisse %3,5 düştü"), "Hisse %3,5 düştü");
  assert.equal(firstSentence("  Çok   boşluklu.  Sonra  "), "Çok boşluklu.");
});

test("kırpma kelime sınırında, tavanın altında", () => {
  const long = "kelime ".repeat(60);
  const out = clip(long);
  assert.ok(out.length <= REASON_MAX_CHARS);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("kelim…"));
  assert.equal(clip("kısa"), "kısa");
});

test("önce not: ilk cümlesi iki dilde", () => {
  const reason = pickAlertReason({ note: note("news"), headlines: [headline("Some headline", 1)], now: NOW });
  assert.deepEqual(reason, { kind: "note", text: { tr: "Hisse bilanço sonrası %8,4 yükseldi.", en: "Shares rose 8.4% after earnings." } });
});

test("not 'unclear' ise manşete düşer", () => {
  const reason = pickAlertReason({ note: note("unclear"), headlines: [headline("Chipmaker wins contract", 2)], now: NOW });
  assert.equal(reason?.kind, "headline");
});

test("manşet: en yeni, 48 saat içinde, TR'de çevirisi, kaynağıyla", () => {
  const reason = pickAlertReason({
    note: null,
    headlines: [
      headline("Older headline", 30),
      headline("Newest headline", 3, { headlineTr: "En yeni manşet", source: "Bloomberg" }),
      headline("Too old", 49),
    ],
    now: NOW,
  })!;
  assert.deepEqual(reason, { kind: "headline", text: { tr: "En yeni manşet", en: "Newest headline" }, source: "Bloomberg" });
  assert.equal(reasonLine(reason, "tr"), "En yeni manşet (Bloomberg)");
  assert.equal(reasonLine(reason, "en"), "Newest headline (Bloomberg)");
});

test("pencere dışı ya da boş manşet: gerekçe yok", () => {
  assert.equal(pickAlertReason({ note: null, headlines: [headline("Old", 50), headline("  ", 1)], now: NOW }), null);
  assert.equal(pickAlertReason({ note: null, headlines: [], now: NOW }), null);
  /* Gelecek tarihli (saat kayması) manşet de sayılmaz. */
  assert.equal(pickAlertReason({ note: null, headlines: [headline("Future", -2)], now: NOW }), null);
});

test("kaynaksız manşet parantezsiz; gövdeye ikinci satır", () => {
  const reason = pickAlertReason({ note: null, headlines: [headline("Plain", 1, { source: " " })], now: NOW })!;
  assert.equal(reasonLine(reason, "en"), "Plain");
  assert.equal(withReason("NVDA 150 $ hedefini geçti.", reason, "tr"), "NVDA 150 $ hedefini geçti.\nPlain");
  assert.equal(withReason("Gövde", undefined, "tr"), "Gövde");
});
