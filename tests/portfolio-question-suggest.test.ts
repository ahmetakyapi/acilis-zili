import test from "node:test";
import assert from "node:assert/strict";
import { adviceMatches } from "../lib/advice-guard";
import { portfolioAskEn, portfolioAskTr } from "../lib/i18n/dictionaries/portfolio-ask";
import { portfolioAdvisorEn as advisorEn, portfolioAdvisorTr as advisorTr } from "../lib/i18n/dictionaries/portfolio-advisor";
import { computeScenario, parseScenario } from "../lib/portfolio-question-core";
import {
  HEAVY_WEIGHT_PCT,
  PORTFOLIO_STARTER_COUNT,
  portfolioStarters,
  type PortfolioStarterCopy,
  type PortfolioStarterFacts,
} from "../lib/portfolio-question-suggest";

/**
 * "Portföyüne Sor"un hazır soruları (lib/portfolio-question-suggest.ts):
 * hangi portföyde hangi sorular basılıyor ve sözlükteki soru metinleri
 * sunucunun yanıtlayabildiği kalıpta mı.
 */

const COPY = Object.fromEntries(Object.keys(portfolioAskTr.starters).map((key) => [key, key])) as PortfolioStarterCopy;
const BASE: PortfolioStarterFacts = { positionCount: 6, largestWeightPct: 18, sectorCount: 3, earningsSoonCount: 0, owner: false };
const topics = (facts: Partial<PortfolioStarterFacts>) => portfolioStarters({ ...BASE, ...facts }, COPY).map((item) => item.topic);

test("boş portföyde hazır soru yok", () => {
  assert.deepEqual(topics({ positionCount: 0, largestWeightPct: null, sectorCount: 0 }), []);
});

test("tek pozisyon: kıyas, dağılım ve senaryo sorusu basılmaz", () => {
  assert.deepEqual(topics({ positionCount: 1, largestWeightPct: 100, sectorCount: 1 }), ["position", "costOne"]);
  /* Bilançosu yaklaşıyorsa o soru başta. */
  assert.deepEqual(topics({ positionCount: 1, largestWeightPct: 100, sectorCount: 1, earningsSoonCount: 1 }), ["earnings", "position", "costOne"]);
  /* Sahipte de "hangi pozisyona bakmalıyım" tek pozisyonda anlamsız. */
  assert.deepEqual(topics({ positionCount: 1, largestWeightPct: 100, sectorCount: 1, owner: true }), ["position", "costOne"]);
});

test("dengeli portföy: hareket, yoğunlaşma, sektör ve maliyet", () => {
  assert.deepEqual(topics({}), ["movers", "concentration", "sectors", "cost"]);
});

test("ağır basan pozisyon: yoğunlaşma ve 'yarısını satsam' senaryosu öne geçer", () => {
  assert.deepEqual(topics({ largestWeightPct: HEAVY_WEIGHT_PCT }), ["concentration", "scenarioHalf", "movers", "sectors"]);
  assert.deepEqual(topics({ largestWeightPct: HEAVY_WEIGHT_PCT - 0.1 }), ["movers", "concentration", "sectors", "cost"]);
});

test("bilanço haftası: bilanço sorusu başta; yaklaşan yoksa hiç basılmaz", () => {
  assert.deepEqual(topics({ earningsSoonCount: 2 }), ["earnings", "movers", "concentration", "sectors"]);
  assert.ok(!topics({ earningsSoonCount: 0 }).includes("earnings"));
});

test("tek sektörlü portföyde sektör dağılımı sorulmaz; iki pozisyonda risk sorusu yok", () => {
  assert.deepEqual(topics({ positionCount: 2, sectorCount: 1 }), ["movers", "concentration", "cost", "scenarioHalf"]);
  assert.deepEqual(topics({ positionCount: 3, sectorCount: 1 }), ["movers", "concentration", "cost", "risk"]);
});

test("görüş isteyen soru yalnız site sahibinde", () => {
  assert.equal(topics({ owner: true })[0], "ownerView");
  assert.ok(!topics({ owner: false }).includes("ownerView"));
});

test("en çok dört hazır soru", () => {
  assert.equal(portfolioStarters({ ...BASE, earningsSoonCount: 1, largestWeightPct: 40, owner: true }, COPY).length, PORTFOLIO_STARTER_COUNT);
});

const HELD = ["NVDA", "MU", "SNDK", "AAPL"];
const POSITIONS = [
  { symbol: "NVDA", value: 400, sector: "Technology" },
  { symbol: "MU", value: 300, sector: "Technology" },
  { symbol: "SNDK", value: 200, sector: "Technology" },
  { symbol: "AAPL", value: 100, sector: "Technology" },
];

test("sözlük: senaryo sorusu ayrıştırıcının tanıdığı kalıpta ve hesaplanabiliyor", () => {
  for (const copy of [portfolioAskTr.starters, portfolioAskEn.starters]) {
    const parsed = parseScenario(copy.scenarioHalf, HELD);
    assert.deepEqual(parsed, { status: "parsed", action: { kind: "scale", symbol: "NVDA", factor: 0.5 } });
    assert.ok(parsed.status === "parsed" && computeScenario(POSITIONS, parsed.action));
  }
});

test("sözlük: senaryo olmayan hazır soru yanlışlıkla senaryo sayılmıyor", () => {
  for (const copy of [portfolioAskTr.starters, portfolioAskEn.starters]) {
    for (const [key, text] of Object.entries(copy)) {
      if (key === "scenarioHalf") continue;
      assert.deepEqual(parseScenario(text, HELD), { status: "none" }, text);
    }
  }
});

test("sözlük: sorular tek şey sorar; üyeye sunulanlar tavsiye kalıbı taşımaz", () => {
  for (const [locale, copy] of [["tr", portfolioAskTr.starters], ["en", portfolioAskEn.starters]] as const) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(COPY).sort());
    for (const [key, text] of Object.entries(copy)) {
      assert.equal(text.split("?").length - 1, 1, `${locale}.${key}: tek soru`);
      assert.ok(text.endsWith("?"), `${locale}.${key}`);
      /* Küçük sayı yazıyla: sorudaki rakam yanıta taşınırsa girdide karşılığı olmayabilir ("500" kıyasın adı, girdide var). */
      assert.deepEqual((text.match(/\d+/g) ?? []).filter((n) => n !== "500"), [], `${locale}.${key}: rakam`);
      if (key !== "ownerView") assert.deepEqual(adviceMatches(text, locale), [], `${locale}.${key}: tavsiye kalıbı`);
    }
  }
});

test("danışman sohbetinin varsayılan soruları: senaryo olan hesaplanabiliyor", () => {
  for (const defaults of [advisorTr.chat.defaults, advisorEn.chat.defaults]) {
    assert.equal(defaults.length, 3);
    const scenarios = defaults.map((text) => parseScenario(text, HELD)).filter((parsed) => parsed.status !== "none");
    assert.equal(scenarios.length, 1);
    const [parsed] = scenarios;
    assert.ok(parsed && parsed.status === "parsed" && computeScenario(POSITIONS, parsed.action));
    /* "…%25'e indirsem" en büyük pozisyon %25'in altındayken ARTIRMA senaryosuna dönüyordu; kalıp artık ağırlıktan bağımsız. */
    assert.ok(parsed.status === "parsed" && parsed.action.kind === "scale");
  }
});
