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
