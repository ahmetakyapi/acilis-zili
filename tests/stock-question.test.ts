import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTION_DAILY_LIMIT,
  QUESTION_DAILY_MISSES,
  citedNews,
  createQuestionQuota,
  decideAnswer,
  normalizeQuestion,
  questionKey,
  usedSources,
  type AskSource,
} from "../lib/stock-question-core";
import { CACHE_ONLY, ClaudeBudgetError, takeCall } from "../lib/claude-budget";

/**
 * "Bu Hisseye Sor"un saf parçaları (lib/stock-question-core.ts): soru
 * temizliği, okur kotası, kaynak künyesi ve yanıtın sayı denetimi.
 */

const GROUNDING = JSON.stringify({
  session: { close: "182,40 $", sessionChange: "+%1,25" },
  earnings: [{ fiscalPeriod: "Q3 2026", eps: { actual: "1,05 $", estimate: "0,98 $" } }],
  news: [{ headline: "Nvidia unveils new chip, shares up 3.1%" }],
});

test("veriyle yazılmış yanıt geçer ve hak düşer", () => {
  const decision = decideAnswer({ verdict: "answered", answer: "Son bilançoda (Q3 2026) hisse başına kâr 1,05 $ oldu, beklenti 0,98 $ idi." }, GROUNDING, "tr");
  assert.deepEqual(decision, { kind: "answered", text: "Son bilançoda (Q3 2026) hisse başına kâr 1,05 $ oldu, beklenti 0,98 $ idi.", charge: true });
});

test("girdide olmayan tek sayı yanıtı düşürür; hak düşmez", () => {
  const decision = decideAnswer({ verdict: "answered", answer: "Hisse 200 $ seviyesine yaklaştı." }, GROUNDING, "tr");
  assert.equal(decision.kind, "unanswerable");
  assert.equal(decision.charge, false);
  assert.deepEqual(decision.kind === "unanswerable" ? decision.missing : null, ["200"]);
});

test("İngilizce haberdeki sayı Türkçe ayraçla yazılınca da tanınır", () => {
  const decision = decideAnswer({ verdict: "answered", answer: "Haberlere göre hisseler %3,1 yükseldi." }, GROUNDING, "tr");
  assert.equal(decision.kind, "answered");
});

test("tavsiye isteği geri çevrilir ama veri anlatımı yine denetlenir", () => {
  assert.equal(decideAnswer({ verdict: "advice", answer: "Tavsiye veremem; son seansta hisse +%1,25 değişti." }, GROUNDING, "tr").kind, "advice");
  assert.equal(decideAnswer({ verdict: "advice", answer: "Tavsiye veremem ama hedef 250 $." }, GROUNDING, "tr").kind, "unanswerable");
});

test("veri yetmiyorsa dürüst ret; model yanıtı denediği için hak düşer", () => {
  assert.deepEqual(decideAnswer({ verdict: "not_in_data", answer: "" }, GROUNDING, "tr"), { kind: "unanswerable", reason: "not-in-data", charge: true });
  assert.deepEqual(decideAnswer({ verdict: "answered", answer: "   " }, GROUNDING, "tr"), { kind: "unanswerable", reason: "empty", charge: false });
});

test("soru metni temizlenir; çok kısa ya da uzunsa reddedilir", () => {
  assert.equal(normalizeQuestion("  Temettü\n\tödüyor   mu?  "), "Temettü ödüyor mu?");
  assert.equal(normalizeQuestion("ab"), null);
  assert.equal(normalizeQuestion("x".repeat(301)), null);
  assert.equal(normalizeQuestion(42), null);
});

test("soru anahtarı büyük/küçük harf ve sondaki noktalamadan bağımsız (Türkçe İ)", () => {
  assert.equal(questionKey("İLK ÇEYREK NASILDI?", "tr"), questionKey("ilk çeyrek nasıldı", "tr"));
  assert.notEqual(questionKey("ilk çeyrek nasıldı", "tr"), questionKey("son çeyrek nasıldı", "tr"));
});

test("günlük kota: sınırda durur, ertesi gün (İstanbul) yenilenir, okurlar ayrı", () => {
  let now = new Date("2026-10-24T10:00:00Z");
  const quota = createQuestionQuota(new Map(), 3, () => now);
  assert.equal(quota.left("a"), 3);
  assert.ok(quota.charge("a") && quota.charge("a") && quota.charge("a"));
  assert.equal(quota.charge("a"), false);
  assert.equal(quota.left("a"), 0);
  assert.equal(quota.left("b"), 3);
  /* İstanbul gece yarısı UTC 21:00 — 20:59 hâlâ aynı gün, 21:00 yeni gün. */
  now = new Date("2026-10-24T20:59:00Z");
  assert.equal(quota.left("a"), 0);
  now = new Date("2026-10-24T21:00:00Z");
  assert.equal(quota.left("a"), 3);
  assert.equal(QUESTION_DAILY_LIMIT, 10);
});

test("künyeye yalnız girdide olan kaynaklar, sayfa sırasıyla girer", () => {
  const available = new Set<AskSource>(["session", "earnings", "news"]);
  assert.deepEqual(usedSources(["news", "valuation", "session", "news", "made-up"], available), ["session", "news"]);
});

test("haber atıfları geçerli, tekrarsız ve en çok üç", () => {
  assert.deepEqual(citedNews([2, 2, -1, 9, 0, 1, 3], 4), [2, 0, 1]);
});

test("yalnız önbellek kimliği hak almadan reddedilir (var olan notlar yazdırılmaz)", () => {
  assert.throws(() => takeCall(CACHE_ONLY), ClaudeBudgetError);
});

test("tavsiye kalıbı taşıyan yanıt basılmaz; hak düşmez", () => {
  const tr = decideAnswer({ verdict: "answered", answer: "Son seansta +%1,25 yükseldi; bence almalısın." }, GROUNDING, "tr");
  assert.equal(tr.kind, "unanswerable");
  assert.equal(tr.charge, false);
  assert.equal(tr.kind === "unanswerable" ? tr.reason : null, "advice-pattern");
  const en = decideAnswer({ verdict: "advice", answer: "I can't give advice, but I would buy more shares here." }, GROUNDING, "en");
  assert.equal(en.kind, "unanswerable");
  /* Kısa ret cümlesi denetimden geçer. */
  assert.equal(decideAnswer({ verdict: "advice", answer: "Tavsiye veremem; son seansta hisse +%1,25 değişti." }, GROUNDING, "tr").kind, "advice");
  assert.equal(decideAnswer({ verdict: "advice", answer: "I can't give advice; the stock moved +%1,25 in the last session." }, GROUNDING, "en").kind, "advice");
});

test("boşa giden denemeler ayrı sayılır; tavan dolunca o gün hak kalmaz", () => {
  let now = new Date("2026-10-24T10:00:00Z");
  const quota = createQuestionQuota(new Map(), 10, () => now, 3);
  quota.miss("a");
  quota.miss("a");
  /* Boşa giden deneme haktan yemez. */
  assert.equal(quota.left("a"), 10);
  quota.miss("a");
  assert.equal(quota.left("a"), 0);
  assert.equal(quota.charge("a"), false);
  assert.equal(quota.left("b"), 10);
  now = new Date("2026-10-24T21:00:00Z");
  assert.equal(quota.left("a"), 10);
  assert.equal(QUESTION_DAILY_MISSES, 5);
});
