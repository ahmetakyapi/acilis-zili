import test from "node:test";
import assert from "node:assert/strict";
import {
  computeScenario,
  decidePortfolioAnswer,
  formatScenario,
  measureCatalog,
  mentionedSymbols,
  parseScenario,
  pickMeasures,
  scenarioKey,
  unavailableScenario,
  type QuestionContext,
  type ScenarioPosition,
} from "@/lib/portfolio-question-core";
import { portfolioAskTr } from "@/lib/i18n/dictionaries/portfolio-ask";

/* Ağırlık sırasıyla: SNDK 40, NVDA 30, MU 15, AAPL 10, KO 5 (toplam 1000). */
const HELD = ["SNDK", "NVDA", "MU", "AAPL", "KO"];
const POSITIONS: ScenarioPosition[] = [
  { symbol: "SNDK", value: 400, sector: "Teknoloji" },
  { symbol: "NVDA", value: 300, sector: "Teknoloji" },
  { symbol: "MU", value: 150, sector: "Teknoloji" },
  { symbol: "AAPL", value: 100, sector: "Teknoloji" },
  { symbol: "KO", value: 50, sector: "Temel Tüketim" },
];

const parsed = (q: string) => parseScenario(q, HELD);

test("senaryo değil: varsayım kipi ya da eylem yoksa none", () => {
  assert.deepEqual(parsed("Portföyümde en ağır pozisyon hangisi?"), { status: "none" });
  assert.deepEqual(parsed("SNDK düşse ne olur?"), { status: "none" });
  assert.deepEqual(parsed("SNDK'yi satmalı mıyım?"), { status: "none" });
  assert.deepEqual(parsed("En büyük hissem hangisi?"), { status: "none" });
  /* "what if NVDA dropped" fiyat sorusu, satış değil. */
  assert.deepEqual(parsed("What if NVDA dropped 20%?"), { status: "none" });
});

test("satış: Türkçe ekler ve İngilizce", () => {
  for (const q of ["SNDK'yi satsam yoğunlaşmam ne olur?", "sndk'yı satarsam ne değişir", "SNDK'yi portföyden çıkarsam", "If I sell SNDK, what happens to my concentration?"]) {
    assert.deepEqual(parsed(q), { status: "parsed", action: { kind: "remove", symbol: "SNDK" } }, q);
  }
});

test("yarı ve iki kat", () => {
  assert.deepEqual(parsed("NVDA'nın yarısını satsam?"), { status: "parsed", action: { kind: "scale", symbol: "NVDA", factor: 0.5 } });
  assert.deepEqual(parsed("What if I sell half of NVDA"), { status: "parsed", action: { kind: "scale", symbol: "NVDA", factor: 0.5 } });
  assert.deepEqual(parsed("MU'yu ikiye katlasam"), { status: "parsed", action: { kind: "scale", symbol: "MU", factor: 2 } });
});

test("hedef ağırlık: yönelme eki ya da 'to N%'", () => {
  assert.deepEqual(parsed("MU'yu %10'a indirsem"), { status: "parsed", action: { kind: "setWeight", symbol: "MU", weight: 10 } });
  assert.deepEqual(parsed("SNDK'yi %20'ye çıkarsam"), { status: "parsed", action: { kind: "setWeight", symbol: "SNDK", weight: 20 } });
  assert.deepEqual(parsed("What if I bring NVDA to 12.5%?"), { status: "parsed", action: { kind: "setWeight", symbol: "NVDA", weight: 12.5 } });
  /* %0 = satış */
  assert.deepEqual(parsed("KO'yu %0'a indirsem"), { status: "parsed", action: { kind: "remove", symbol: "KO" } });
  assert.deepEqual(parsed("KO'yu %150'ye çıkarsam"), { status: "unparsed", reason: "range" });
});

test("ekleme: tutar şart; portföy dışı sembol yalnız büyük yazılınca", () => {
  assert.deepEqual(parsed("%5 AAPL eklesem"), { status: "parsed", action: { kind: "addAmount", symbol: "AAPL", share: 5 } });
  assert.deepEqual(parsed("Portföyün %10'u kadar TSLA alsam"), { status: "parsed", action: { kind: "addAmount", symbol: "TSLA", share: 10 } });
  assert.deepEqual(parsed("If I add 10% MSFT"), { status: "parsed", action: { kind: "addAmount", symbol: "MSFT", share: 10 } });
  assert.deepEqual(parsed("TSLA eklesem ne olur"), { status: "unparsed", reason: "amount" });
  assert.deepEqual(parsed("tsla eklesem %5"), { status: "unparsed", reason: "symbol" });
});

test("belirsiz: iki sembol, sembolsüz satış", () => {
  assert.deepEqual(parsed("SNDK'yi satıp NVDA alsam"), { status: "unparsed", reason: "multiple" });
  assert.deepEqual(parsed("SNDK ve MU'yu satsam"), { status: "unparsed", reason: "multiple" });
  assert.deepEqual(parsed("Bir hissemi satsam ne olur?"), { status: "unparsed", reason: "symbol" });
});

test("en büyük pozisyon: hazır soru çipi ilk sembole çözülür", () => {
  assert.deepEqual(parsed("En büyük pozisyonumun yarısını satsam yoğunlaşmam ne olur?"), { status: "parsed", action: { kind: "scale", symbol: "SNDK", factor: 0.5 } });
  assert.deepEqual(parsed("What if I sell half of my largest position?"), { status: "parsed", action: { kind: "scale", symbol: "SNDK", factor: 0.5 } });
});

test("sembol tanıma: kısa sözcük yalnız büyük yazılınca", () => {
  assert.deepEqual(mentionedSymbols("SNDK'yi satsam mu", HELD), { held: ["SNDK"], others: [] });
  assert.deepEqual(mentionedSymbols("MU'yu satsam mı", HELD).held, ["MU"]);
  assert.deepEqual(mentionedSymbols("nvda'yı satsam", HELD).held, ["NVDA"]);
  /* ABD, ETF, S&P sembol değil. */
  assert.deepEqual(mentionedSymbols("ABD ETF S&P 500 NVDA", HELD), { held: ["NVDA"], others: [] });
});

test("hesap: satış — ağırlıklar yeniden dağılır, para çıkar", () => {
  const r = computeScenario(POSITIONS, { kind: "remove", symbol: "SNDK" })!;
  assert.ok(Math.abs(r.before.symbolWeight - 40) < 1e-9);
  assert.equal(r.after.symbolWeight, 0);
  assert.equal(r.after.positionCount, 4);
  assert.equal(r.after.largest.symbol, "NVDA");
  assert.ok(Math.abs(r.after.largest.weight - 50) < 1e-9);
  assert.ok(Math.abs(r.before.top5Weight - 100) < 1e-9);
  assert.ok(Math.abs(r.after.top5Weight - 100) < 1e-9);
  assert.ok(Math.abs(r.after.sectorWeight! - (550 / 600) * 100) < 1e-9);
  assert.ok(Math.abs(r.movedShare - 40) < 1e-9);
  /* HHI önce 0,4²+0,3²+0,15²+0,1²+0,05² = 0,285 */
  assert.ok(Math.abs(r.before.effectivePositions - 1 / 0.285) < 1e-9);
});

test("hesap: hedef ağırlık yeni toplamın içinde tutar", () => {
  const r = computeScenario(POSITIONS, { kind: "setWeight", symbol: "MU", weight: 25 })!;
  assert.ok(Math.abs(r.after.symbolWeight - 25) < 1e-9);
  const n = computeScenario(POSITIONS, { kind: "setWeight", symbol: "TSLA", weight: 20 }, null)!;
  assert.ok(Math.abs(n.after.symbolWeight - 20) < 1e-9);
  assert.equal(n.after.positionCount, 6);
  assert.equal(n.after.sectorWeight, null);
});

test("hesap: ekleme bugünkü toplamın yüzdesi; ikiye katlama", () => {
  const r = computeScenario(POSITIONS, { kind: "addAmount", symbol: "KO", share: 10 })!;
  /* KO 50 + 100 = 150 / 1100 */
  assert.ok(Math.abs(r.after.symbolWeight - (150 / 1100) * 100) < 1e-9);
  assert.ok(Math.abs(r.movedShare - 10) < 1e-9);
  const d = computeScenario(POSITIONS, { kind: "scale", symbol: "AAPL", factor: 2 })!;
  assert.ok(Math.abs(d.after.symbolWeight - (200 / 1100) * 100) < 1e-9);
});

test("hesap: portföyde olmayanı satmak ya da boş portföy null", () => {
  assert.equal(computeScenario(POSITIONS, { kind: "remove", symbol: "TSLA" }), null);
  assert.equal(computeScenario([], { kind: "addAmount", symbol: "TSLA", share: 5 }), null);
  assert.equal(computeScenario([{ symbol: "KO", value: 10, sector: null }], { kind: "remove", symbol: "KO" }), null);
});

test("biçim ve kart kataloğu: senaryo kartı önce → sonra, değer girdide", () => {
  const sc = formatScenario(computeScenario(POSITIONS, { kind: "remove", symbol: "SNDK" })!, "tr");
  assert.equal(sc.before.symbolWeight, "%40,0");
  assert.equal(sc.after.largest.weight, "%50,0");
  const ctx: QuestionContext = {
    portfolio: { lastSession: "+%1,20", lastFiveSessions: "−%2,4", top5Weight: "%100" },
    positions: [{ symbol: "SNDK", weight: "%40", lastSession: "+%3,10", lastFiveSessions: null, last21Sessions: "−%5,0", sinceAverageCost: "+%80,0" }],
    risk: { beta: "1,32", dividendYield: null },
    scenario: sc,
  };
  const labels = { scopes: portfolioAskTr.scopes, measures: portfolioAskTr.measures, arrow: portfolioAskTr.arrow };
  const catalog = measureCatalog(ctx, labels);
  assert.equal(catalog.get("SNDK.lastSession")?.tone, "up");
  assert.equal(catalog.get("SNDK.last21Sessions")?.tone, "down");
  assert.equal(catalog.has("SNDK.lastFiveSessions"), false);
  assert.equal(catalog.has("risk.dividendYield"), false);
  assert.equal(catalog.get("scenario.symbolWeight")?.value, "%40,0 → %0,0");
  assert.equal(catalog.get("scenario.largest")?.value, "SNDK %40,0 → NVDA %50,0");
  const input = JSON.stringify(ctx);
  for (const card of catalog.values()) for (const n of card.value.match(/\d+(?:[.,]\d+)*/g) ?? []) assert.ok(input.includes(n), `${card.id}: ${n}`);

  const picked = pickMeasures(["sndk.weight", "risk.beta", "risk.beta", "TSLA.weight", "scenario.top5Weight", "made.up"], catalog);
  assert.deepEqual(picked.map((c) => c.id), ["SNDK.weight", "risk.beta", "scenario.top5Weight"]);
  assert.equal(pickMeasures(["portfolio.lastSession", "SNDK.weight", "risk.beta", "SNDK.lastSession", "SNDK.sinceAverageCost", "scenario.largest", "portfolio.top5Weight"], catalog).length, 6);
});

test("hesaplanamayan senaryo bloğu", () => {
  assert.deepEqual(Object.keys(unavailableScenario("amount", "tr")), ["computable", "reason"]);
  assert.equal(unavailableScenario("multiple", "en").computable, false);
});

test("kabul kararı: sayı denetimi, tavsiye denetimi, sahip istisnası", () => {
  const grounding = JSON.stringify({ portfolio: { lastSession: "+%1,20" }, positions: [{ symbol: "SNDK", weight: "%40" }] });
  const ok = decidePortfolioAnswer({ verdict: "answered", paragraphs: ["SNDK portföyün %40'ı.", " "], measures: [], partial: false, followUps: [] }, grounding, "tr");
  assert.deepEqual(ok, { kind: "answered", paragraphs: ["SNDK portföyün %40'ı."], partial: false, charge: true });

  const made = decidePortfolioAnswer({ verdict: "answered", paragraphs: ["SNDK %55 ağırlıkta."], measures: [], partial: false, followUps: [] }, grounding, "tr");
  assert.equal(made.kind, "rejected");
  assert.equal(made.charge, false);

  const advice = decidePortfolioAnswer({ verdict: "answered", paragraphs: ["SNDK %40 ağırlıkta; bir kısmını satmalısın."], measures: [], partial: false, followUps: [] }, grounding, "tr");
  assert.equal(advice.kind, "rejected");
  /* Sahip: görüş serbest, sayı denetimi yine açık. */
  const owner = decidePortfolioAnswer({ verdict: "advice", paragraphs: ["SNDK %40 ağırlıkta; bir kısmını satmalısın."], measures: [], partial: true, followUps: [] }, grounding, "tr", { adviceAllowed: true });
  assert.deepEqual(owner, { kind: "answered", paragraphs: ["SNDK %40 ağırlıkta; bir kısmını satmalısın."], partial: true, charge: true });
  const ownerMade = decidePortfolioAnswer({ verdict: "answered", paragraphs: ["Hedef 120 dolar."], measures: [], partial: false, followUps: [] }, grounding, "tr", { adviceAllowed: true });
  assert.equal(ownerMade.kind, "rejected");

  assert.equal(decidePortfolioAnswer({ verdict: "not_in_data", paragraphs: [], measures: [], partial: false, followUps: [] }, grounding, "tr").kind, "unanswerable");
  assert.equal(decidePortfolioAnswer({ verdict: "scenario_unavailable", paragraphs: ["x"], measures: [], partial: false, followUps: [] }, grounding, "tr").kind, "scenario-unavailable");
  assert.equal(decidePortfolioAnswer({ verdict: "answered", paragraphs: [], measures: [], partial: false, followUps: [] }, grounding, "tr").kind, "rejected");
});

test("senaryo anahtarı ayrıştırmayı ayırt eder", () => {
  assert.equal(scenarioKey({ status: "none" }), "none");
  assert.equal(scenarioKey(parsed("MU'yu %10'a indirsem")), "setWeight:MU:10");
  assert.notEqual(scenarioKey(parsed("SNDK'yi satsam")), scenarioKey(parsed("NVDA'yı satsam")));
});

test("takip soruları: girdide olmayan sayı, tekrar ve üyede tavsiye kalıbı düşer; en çok 3", async () => {
  const { pickFollowUps } = await import("../lib/portfolio-question-core");
  const grounding = JSON.stringify({ weight: "%25" });
  const items = ["MU'yu %25'e indirsem ne olur?", "MU'yu %23'e indirsem?", "mu'yu %25'e indirsem ne olur?", "SNDK'yi satmalısın", "Sektör dağılımım nasıl?", "Bilanço riski hangisinde?", "Fazla soru?"];
  assert.deepEqual(pickFollowUps(items, grounding, "tr", false), ["MU'yu %25'e indirsem ne olur?", "Sektör dağılımım nasıl?", "Bilanço riski hangisinde?"]);
  assert.ok(pickFollowUps(["SNDK'yi satmalısın"], grounding, "tr", true).length === 1, "sahipte görüş kalıbı serbest");
});
