import test from "node:test";
import assert from "node:assert/strict";
import {
  fedRange,
  findFomcReleases,
  parseFedFeed,
  parseFedNumber,
  parseFomcDecision,
  previousRange,
} from "../lib/fomc-statement";

/** FOMC bülteninin ayrıştırılması (lib/fomc-statement.ts) — cümleler Fed'in kendi metinleri. */

test("Fed'in kesirli sayıları", () => {
  assert.equal(parseFedNumber("3-3/4"), 3.75);
  assert.equal(parseFedNumber("4"), 4);
  assert.equal(parseFedNumber("1/4"), 0.25);
  assert.equal(parseFedNumber("0"), 0);
  assert.equal(parseFedNumber("dört"), null);
});

test("sabit tutma kararı (28 Ekim 2026)", () => {
  const decision = parseFomcDecision(
    "The Committee decided to maintain the target range for the federal funds rate at 3-3/4 to 4 percent, in support of the Federal Reserve's dual mandate.",
  );
  assert.deepEqual(decision, { action: "maintain", lower: 3.75, upper: 4, step: 0 });
  assert.deepEqual(previousRange(decision!), { lower: 3.75, upper: 4 });
});

test("artırma kararı ve önceki aralık (16 Eylül 2026)", () => {
  const decision = parseFomcDecision(
    "The Committee decided to raise the target range for the federal funds rate by 1/4 percentage point to 3-3/4 to 4 percent, in support of the Federal Reserve's dual mandate",
  );
  assert.deepEqual(decision, { action: "raise", lower: 3.75, upper: 4, step: 0.25 });
  assert.deepEqual(previousRange(decision!), { lower: 3.5, upper: 3.75 });
});

test("muhalif üyenin cümlesi kararla karışmaz", () => {
  const text =
    "Voting against the monetary policy action were Lisa D. Cook and Beth M. Hammack, who preferred to raise the target range for the federal funds rate by 1/4 percentage point at this meeting.";
  assert.equal(parseFomcDecision(text), null);
});

test("kalıp tutmazsa sayı yok", () => {
  assert.equal(parseFomcDecision("The Committee will continue to monitor the implications of incoming information."), null);
});

test("RSS: aynı günün kararı ve projeksiyonları", () => {
  const xml = `<rss><channel>
    <item><title>Federal Reserve issues FOMC statement</title>
      <link><![CDATA[https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm]]></link>
      <pubDate><![CDATA[Wed, 28 Oct 2026 18:00:00 GMT]]></pubDate></item>
    <item><title>Federal Reserve Board and Federal Open Market Committee release economic projections from the September 15-16 FOMC meeting</title>
      <link><![CDATA[https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916b.htm]]></link>
      <pubDate><![CDATA[Wed, 16 Sep 2026 18:00:00 GMT]]></pubDate></item>
  </channel></rss>`;
  const items = parseFedFeed(xml);
  const today = findFomcReleases(items, "2026-10-28");
  assert.equal(today.statement?.publishedAt, "2026-10-28T18:00:00.000Z");
  assert.equal(today.projections, null);
  assert.ok(findFomcReleases(items, "2026-09-16").projections);
  assert.equal(findFomcReleases(items, "2026-12-09").statement, null);
});

test("aralığın biçimi", () => {
  assert.equal(fedRange({ lower: 3.75, upper: 4 }, "tr"), "%3,75–4,00");
  assert.equal(fedRange({ lower: 3.75, upper: 4 }, "en"), "3.75–4.00%");
});
