import assert from "node:assert/strict";
import { test } from "node:test";
import { AnalysisInput, AnalysisOutput, istanbulDay, remainingAnalyses, safeSourceUrl } from "../lib/ai-analysis-core";
test("daily quota resets at Istanbul midnight rather than UTC midnight", () => {
  assert.equal(istanbulDay(new Date("2026-10-10T20:59:59Z")),"2026-10-10");
  assert.equal(istanbulDay(new Date("2026-10-10T21:00:00Z")),"2026-10-11");
  assert.equal(remainingAnalyses(5,5,"2026-10-10",new Date("2026-10-10T20:59:59Z")),0);
  assert.equal(remainingAnalyses(5,5,"2026-10-10",new Date("2026-10-10T21:00:00Z")),5);
  assert.equal(remainingAnalyses(null,10000,"2026-10-10"),null);
});
test("reject invalid symbols, horizons, scores and unsafe source URLs", () => {
  assert.equal(AnalysisInput.safeParse({requestId:"00000000-0000-4000-8000-000000000001",symbol:"../api",horizon:"short"}).success,false);
  assert.equal(AnalysisInput.safeParse({requestId:"00000000-0000-4000-8000-000000000001",symbol:"NVDA",horizon:"forever"}).success,false);
  assert.equal(AnalysisInput.parse({requestId:"00000000-0000-4000-8000-000000000001",symbol:" nvda ",horizon:"short"}).symbol,"NVDA");
  const output = {verdict:"hold",overallScore:50,technicalScore:101,newsScore:null,summary:"s",reasons:["r"],risks:["r"],bullScenario:"b",bearScenario:"b",invalidation:"i",news:[]};
  assert.equal(AnalysisOutput.safeParse(output).success,false);
  assert.equal(safeSourceUrl("javascript:alert(1)"),false);
  assert.equal(safeSourceUrl("https://www.sec.gov/"),true);
});

test("news selection excludes unrelated provider stories before picking newest items", async () => {
  const { companyNewsRelevant } = await import("../lib/ai-analysis-core");
  assert.equal(companyNewsRelevant("NVDA", "NVIDIA Corp", "Is it time to buy Bitcoin?", null), false);
  assert.equal(companyNewsRelevant("NVDA", "NVIDIA Corp", "Nvidia expands chip production", null), true);
  assert.equal(companyNewsRelevant("NVDA", "NVIDIA Corp", "Market earnings update", "NVDA reports this week."), true);
  assert.equal(companyNewsRelevant("GOOGL", "Alphabet Inc", "Google announces new model", null), true);
  assert.equal(companyNewsRelevant("AMZN", "Amazon.com Inc", "Amazon expands delivery services", null), true);
  assert.equal(companyNewsRelevant("F", "Ford Motor Co", "Series F funding round", null), false);
  assert.equal(companyNewsRelevant("BRK.B", "Berkshire Hathaway Inc", "BRKxB unrelated ticker", null), false);
});

test("invalid news citations are dropped instead of failing a paid report", async () => {
  const { repairNewsCitations } = await import("../lib/ai-analysis-core");
  const base = {verdict:"hold" as const,overallScore:50,technicalScore:50,newsScore:70,summary:"s",reasons:["r"],risks:["r"],bullScenario:"b",bearScenario:"b",invalidation:"i"};
  const repaired = repairNewsCitations({...base,news:[{sourceIndex:0,impact:"a"},{sourceIndex:0,impact:"dup"},{sourceIndex:3,impact:"missing"}]}, 2);
  assert.deepEqual(repaired.news, [{sourceIndex:0,impact:"a"}]);
  assert.equal(repaired.newsScore, 70);
  assert.equal(repairNewsCitations({...base,news:[{sourceIndex:0,impact:"a"}]}, 0).newsScore, null);
});

test("price path reports returns, the 3-month band and recent sessions from completed bars", async () => {
  const { pricePath } = await import("../lib/ai-analysis-core");
  const day = 86_400;
  const bars = Array.from({ length: 130 }, (_, i) => ({ time: 1_767_330_000 + i * day, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1000 + i }));
  const path = pricePath(bars)!;
  assert.equal(path.returnsPct.w1, Math.round((229 / 224 - 1) * 10000) / 100);
  assert.equal(path.returnsPct.m6, Math.round((229 / 103 - 1) * 10000) / 100);
  assert.equal(path.range3m.high, 230);
  assert.equal(path.range3m.low, 166);
  assert.equal(path.recentSessions.length, 10);
  assert.equal(path.recentSessions.at(-1)!.close, 229);
  assert.equal(path.recentSessions[0].changePct, Math.round((220 / 219 - 1) * 10000) / 100);
  assert.equal(pricePath(bars.slice(0, 3))!.returnsPct.w1, null);
  assert.equal(pricePath([]), null);
});

test("news selection spreads across days, drops near duplicates and caps summary-only mentions", async () => {
  const { selectNews } = await import("../lib/ai-analysis-core");
  const at = (day: number, hour: number) => new Date(Date.UTC(2026, 9, day, hour));
  const item = (headline: string, publishedAt: Date, summary: string | null = null) => ({ headline, summary, url: `https://x.test/${encodeURIComponent(headline)}`, publishedAt });
  const items = [
    ...Array.from({ length: 12 }, (_, i) => item(`Nvidia story number ${i} about chips ${"abcdefghijkl"[i]}${i}x`, at(10, 20 - i))),
    item("Super Micro Contractor Pleads Guilty in $2.5 Billion Nvidia AI Chip Smuggling Case", at(9, 15)),
    item("Super Micro Contractor Pleads Guilty in $2.5 Billion AI Server Smuggling Case Nvidia", at(9, 14)),
    item("Nvidia supplier update", at(6, 15)),
    ...["One", "Two", "Three", "Four"].map((n, i) => item(`Agency ${n} launches marketing tool`, at(8, 10 + i), "Built on Nvidia GPUs.")),
    item("Bitcoin rallies", at(7, 12)),
  ];
  const picked = selectNews(items, "NVDA", "NVIDIA Corp", 12);
  const days = new Set(picked.map(p => p.publishedAt.getUTCDate()));
  assert.ok(days.has(9) && days.has(6), "older days are not crowded out by one busy day");
  assert.equal(picked.filter(p => p.headline.startsWith("Super Micro")).length, 1);
  assert.ok(picked.filter(p => p.headline.startsWith("Agency")).length <= 3);
  assert.ok(!picked.some(p => p.headline === "Bitcoin rallies"));
  assert.ok(picked.every((p, i) => i === 0 || picked[i - 1].publishedAt >= p.publishedAt));
});

test("model trigger levels must match a supplied level", async () => {
  const { snapLevel } = await import("../lib/ai-analysis-core");
  const levels = [227.62, 232.43, 202.15];
  assert.equal(snapLevel(232.4, levels), 232.43);
  assert.equal(snapLevel(240, levels), null);
  assert.equal(snapLevel(null, levels), null);
  assert.equal(snapLevel(-1, levels), null);
});
