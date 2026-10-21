import { test } from "node:test";
import assert from "node:assert/strict";
import { headlineMentions } from "../lib/utils";

/** Haber logosu yalnız şirket gerçekten geçiyorsa (lib/utils.ts → headlineMentions, 20 Ekim). */
test("sembol: büyük harf, tek başına; tek harf ve kısaltma listesi çıplak sayılmaz", () => {
  assert.equal(headlineMentions("Stocks rally on Fed cut hopes", "ON", "ON Semiconductor Corp"), false);
  assert.equal(headlineMentions("Why it matters now", "NOW", "ServiceNow Inc."), false);
  assert.equal(headlineMentions("Investors don't panic", "T", "AT&T Inc"), false);
  assert.equal(headlineMentions("Is Nvidia A Buy?", "A", "Agilent Technologies Inc"), false);
  assert.equal(headlineMentions("AI chip demand lifts suppliers", "AI", "C3.ai Inc"), false);
  assert.equal(headlineMentions("NVDA's guidance tops estimates", "NVDA", "NVIDIA Corporation"), true);
  assert.equal(headlineMentions("Chipmaker (MU) jumps", "MU", "Micron Technology"), true);
  assert.equal(headlineMentions("GE Aerospace raises outlook", "GE", "GE Aerospace"), true);
  assert.equal(headlineMentions("Why $A could rally", "A", "Agilent Technologies Inc"), true);
  assert.equal(headlineMentions("$AI earnings preview", "AI", "C3.ai Inc"), true);
});

test("ad: kelime sınırı, baştaki The atlanır, genel ilk kelimede iki kelime", () => {
  assert.equal(headlineMentions("Precious metals rally", "META", "Meta Platforms Inc."), false);
  assert.equal(headlineMentions("Meta'nın reklam geliri arttı", "META", "Meta Platforms Inc."), true);
  assert.equal(headlineMentions("Analysts believe the Fed will deliver relief", "LLY", "Eli Lilly and Company"), false);
  assert.equal(headlineMentions("Eli Lilly obesity drug wins approval", "LLY", "Eli Lilly and Company"), true);
  assert.equal(headlineMentions("Fed signals the end of hikes", "GS", "The Goldman Sachs Group"), false);
  assert.equal(headlineMentions("Goldman Sachs beats on trading", "GS", "The Goldman Sachs Group"), true);
  assert.equal(headlineMentions("Texas heat wave strains grid", "TXN", "Texas Instruments"), false);
  assert.equal(headlineMentions("Texas Instruments guides higher", "TXN", "Texas Instruments"), true);
  assert.equal(headlineMentions("Bank of Japan holds rates", "BAC", "Bank of America Corporation"), false);
  assert.equal(headlineMentions("Bank of America profit rises", "BAC", "Bank of America Corporation"), true);
  assert.equal(headlineMentions("AT&T raises dividend", "T", "AT&T Inc"), true);
  assert.equal(headlineMentions("Palantir, AMD, Coherent, SpaceX rally", "MU", "Micron Technology"), false);
  assert.equal(headlineMentions("Micron surges on HBM demand", "MU", "Micron Technology"), true);
  assert.equal(headlineMentions("Markets wait for data", "SKHY", null), false);
});

test("ad: endeks üyelerinin genel ilk kelimeleri tek başına eşleşmez (20 Ekim)", () => {
  assert.equal(headlineMentions("US-China trade talks resume", "TTD", "The Trade Desk Inc"), false);
  assert.equal(headlineMentions("The Trade Desk beats estimates", "TTD", "The Trade Desk Inc"), true);
  assert.equal(headlineMentions("Analyst lifts price target on Nvidia", "TGT", "Target Corp"), false);
  assert.equal(headlineMentions("Analyst lifts price target on Nvidia", "TGT", "Target"), false);
  assert.equal(headlineMentions("Target Corp. cuts sales forecast", "TGT", "Target Corp"), true);
  assert.equal(headlineMentions("S&P 500 closes at record", "SPGI", "S&P Global"), false);
  assert.equal(headlineMentions("S&P Global raises outlook", "SPGI", "S&P Global"), true);
  assert.equal(headlineMentions("The best stocks to buy now", "BBY", "Best Buy"), false);
  assert.equal(headlineMentions("Best Buy beats estimates", "BBY", "Best Buy"), true);
  assert.equal(headlineMentions("Dow jumps 300 points", "DOW", "Dow Inc."), false);
  assert.equal(headlineMentions("Federal Reserve holds rates", "FRT", "Federal Realty Investment Trust"), false);
  assert.equal(headlineMentions("Charles Schwab trading volume jumps", "CRL", "Charles River Laboratories"), false);
  assert.equal(headlineMentions("Charles Schwab trading volume jumps", "SCHW", "Charles Schwab Corporation"), true);
  assert.equal(headlineMentions("Johnson & Johnson wins talc ruling", "JCI", "Johnson Controls"), false);
  assert.equal(headlineMentions("Johnson & Johnson wins talc ruling", "JNJ", "Johnson & Johnson"), true);
});

test("ad: tek kelimelik marka özel ad yazımıyla eşleşir, genel kullanımı eşleşmez (20 Ekim)", () => {
  /* Visa'nın sembolü tek harf: ad eşleşmezse yalnız "$V" kalıyordu. */
  assert.equal(headlineMentions("Visa beats fiscal fourth-quarter estimates", "V", "Visa Inc."), true);
  assert.equal(headlineMentions("Visa'nın geliri beklentiyi aştı", "V", "Visa"), true);
  assert.equal(headlineMentions("VISA RAISES OUTLOOK", "V", "Visa Inc."), true);
  assert.equal(headlineMentions("Student visa rules tightened", "V", "Visa Inc."), false);
  assert.equal(headlineMentions("Target cuts sales forecast", "TGT", "Target Corporation"), true);
  assert.equal(headlineMentions("Target's price target cut at Jefferies", "TGT", "Target Corporation"), true);
  assert.equal(headlineMentions("Analyst Lifts Price Target On Nvidia", "TGT", "Target Corporation"), false);
  assert.equal(headlineMentions("Nvidia Target Price Raised To $250", "TGT", "Target Corporation"), false);
  assert.equal(headlineMentions("Travelers tops profit estimates", "TRV", "Travelers Companies (The)"), true);
  assert.equal(headlineMentions("Holiday travelers face airport delays", "TRV", "Travelers Companies (The)"), false);
  assert.equal(headlineMentions("Progressive posts higher auto premiums", "PGR", "Progressive Corporation"), true);
  assert.equal(headlineMentions("Block shares jump on Cash App growth", "XYZ", "Block, Inc."), true);
  assert.equal(headlineMentions("Strategy buys more bitcoin", "MSTR", "Strategy (MicroStrategy)"), true);
  assert.equal(headlineMentions("Fund managers rethink their strategy", "MSTR", "Strategy (MicroStrategy)"), false);
});

test("ad: ikinci kelimesi gerçek ad olan genel ad iki kelime ister; marka olmayan tek kelime eski kuralda", () => {
  assert.equal(headlineMentions("State Street beats on fee income", "STT", "State Street Corporation"), true);
  assert.equal(headlineMentions("Street closures planned as state budget passes", "STT", "State Street Corporation"), false);
  assert.equal(headlineMentions("Main Street retailers brace for State tax hike", "STT", "State Street Corporation"), false);
  assert.equal(headlineMentions("Dow Inc. cuts dividend", "DOW", "Dow Inc."), true);
  assert.equal(headlineMentions("Dow Jumps 300 Points", "DOW", "Dow Inc."), false);
  assert.equal(headlineMentions("Target Hospitality wins contract", "TH", "Target Hospitality Corp"), true);
  assert.equal(headlineMentions("Target cuts sales forecast", "TH", "Target Hospitality Corp"), false);
});
