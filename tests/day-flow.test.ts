import test from "node:test";
import assert from "node:assert/strict";
import { displayFlowStatus, earningsStatus, flowResultSignature, groupStatus, preserveConfirmedResults, hasActual, isNewObservation, type DayFlowSnapshot, type FlowEvent, type FlowMember } from "../lib/day-flow";

test("a scheduled time passing does not confirm publication", () => {
  const event = { status: "scheduled" as const, scheduledAt: "2026-09-08T12:30:00Z" };
  assert.equal(displayFlowStatus(event, Date.parse("2026-09-08T12:29:00Z")), "scheduled");
  assert.equal(displayFlowStatus(event, Date.parse("2026-09-08T13:30:00Z")), "awaiting");
  assert.equal(displayFlowStatus({ ...event, scheduledAt: null }, Date.now()), "scheduled");
});
test("zero and negative results are real, placeholders and missing data are not", () => {
  for (const value of [0, "0", -1.25, "-1.25"]) assert.equal(hasActual(value), true);
  for (const value of [null, undefined, "", " ", "—", "N/A", "NaN", NaN, Infinity]) assert.equal(hasActual(value), false);
  assert.equal(earningsStatus(0, null, false), "released");
  assert.equal(earningsStatus(null, null, false), "scheduled");
  assert.equal(earningsStatus(null, null, true), "analyzed");
});
test("one report cannot mark an entire earnings group as complete", () => {
  assert.equal(groupStatus([{ status: "analyzed" }, { status: "scheduled" }]), "partial");
  assert.equal(groupStatus([{ status: "analyzed" }, { status: "released" }]), "released");
  assert.equal(groupStatus([{ status: "analyzed" }, { status: "analyzed" }]), "analyzed");
  assert.equal(groupStatus([]), "scheduled");
});
test("FRED needs a new observation, not just a revision or missing historical vintage", () => {
  assert.equal(isNewObservation("2026-08-01", "2026-07-01"), true);
  assert.equal(isNewObservation("2026-07-01", "2026-07-01"), false);
  assert.equal(isNewObservation("2026-06-01", "2026-07-01"), false);
  assert.equal(isNewObservation("2026-08-01", undefined), false);
});
test("check timestamps do not create false result notifications", () => {
  const event: FlowEvent = { id: "test", timeEt: "08:30", scheduledAt: null, title: "Release", kind: "event", importance: "high", status: "released", actual: "0", href: "/takvim", source: "FRED", updatedAt: "a" };
  assert.equal(flowResultSignature([event]), flowResultSignature([{ ...event, updatedAt: "b" }]));
  assert.notEqual(flowResultSignature([event]), flowResultSignature([{ ...event, actual: "1" }]));
});

test("provider gaps retain numeric results, but cannot retain withdrawn analysis links", () => {
  const base: DayFlowSnapshot = { dateEt: "2026-09-08", asOf: "2026-09-08T17:00:00Z", events: [], initialNowMinutes: 780, tradingDay: true, closeMinutes: 960, offsets: { primary: 420, secondary: 0 }, tags: { primary: "TR", secondary: "NY" }, pollAfterMs: 30000, sourceDelayed: false, hiddenEarnings: 0, today: "2026-09-08", prevDate: null, nextDate: null };
  const event: FlowEvent = { id: "earnings", timeEt: "08:00", scheduledAt: null, title: "AAPL", kind: "earnings", importance: "medium", status: "analyzed", href: "/bilancolar", source: "Finnhub", updatedAt: "a", members: [{ symbol: "AAPL", logoUrl: null, watched: false, status: "analyzed", eps: "0.00", href: "/bilancolar/aapl/report" }] };
  const fresh: FlowEvent = { ...event, status: "scheduled", members: [{ ...event.members![0], eps: undefined, status: "scheduled", href: "/hisse/AAPL" }] };
  const result = preserveConfirmedResults({ ...base, events: [event] }, { ...base, events: [fresh] });
  assert.equal(result.events[0].members![0].eps, "0.00");
  assert.equal(result.events[0].members![0].status, "released");
  assert.equal(result.events[0].members![0].href, "/hisse/AAPL");
  assert.equal(result.sourceDelayed, true);
  const tomorrow = { ...base, dateEt: "2026-09-09", events: [fresh] };
  assert.equal(preserveConfirmedResults({ ...base, events: [event] }, tomorrow), tomorrow);
});

function earningsSnapshot(member: Partial<FlowMember>, groupId = "earnings-amc"): DayFlowSnapshot {
  const fullMember: FlowMember = {
    symbol: "AAPL", logoUrl: null, watched: false, status: "released",
    href: "/hisse/AAPL", eps: "1.20", revenue: "10B", ...member,
  };
  return {
    dateEt: "2026-09-08", asOf: "2026-09-08T20:05:00Z",
    initialNowMinutes: 965, tradingDay: true, closeMinutes: 960,
    offsets: { primary: 420, secondary: 0 }, tags: { primary: "TR", secondary: "NY" },
    pollAfterMs: 30000, sourceDelayed: false, hiddenEarnings: 0, today: "2026-09-08", prevDate: null, nextDate: null,
    events: [{
      id: groupId, timeEt: groupId === "earnings-unknown" ? null : "16:00",
      scheduledAt: null, title: fullMember.symbol, kind: "earnings", importance: "medium",
      status: fullMember.status, href: "/bilancolar", source: "Finnhub",
      updatedAt: "2026-09-08T20:05:00Z", members: [fullMember],
    }],
  };
}

test("a published analysis retains its numeric results during a provider outage", () => {
  const published = { status: "analyzed" as const, href: "/bilancolar/aapl/3c-fy2026" };
  const previous = earningsSnapshot(published);
  const next = earningsSnapshot({ ...published, eps: undefined, revenue: undefined });
  const result = preserveConfirmedResults(previous, next);
  assert.deepEqual(result.events[0].members![0], previous.events[0].members![0]);
  assert.equal(result.events[0].status, "analyzed");
  assert.equal(result.sourceDelayed, true);
});

test("missing EPS is retained independently while a new revenue result wins", () => {
  const previous = earningsSnapshot({});
  const next = earningsSnapshot({ eps: undefined, revenue: "11B" });
  const result = preserveConfirmedResults(previous, next);
  const member = result.events[0].members![0];
  assert.equal(member.eps, "1.20");
  assert.equal(member.revenue, "11B");
  assert.equal(member.status, "released");
  assert.equal(result.sourceDelayed, true);
});

test("a company moving to an unknown window keeps results without restoring a withdrawn report", () => {
  const previous = earningsSnapshot({ status: "analyzed", href: "/bilancolar/aapl/3c-fy2026" });
  const next = earningsSnapshot({ status: "scheduled", eps: undefined, revenue: undefined }, "earnings-unknown");
  const result = preserveConfirmedResults(previous, next);
  assert.equal(result.events[0].id, "earnings-unknown");
  assert.equal(result.events[0].timeEt, null);
  assert.equal(result.events[0].members![0].eps, "1.20");
  assert.equal(result.events[0].members![0].revenue, "10B");
  assert.equal(result.events[0].members![0].href, "/hisse/AAPL");
  assert.equal(result.events[0].members![0].status, "released");
  assert.equal(result.events[0].status, "released");
  assert.equal(result.sourceDelayed, true);

  const otherCompany = earningsSnapshot({ symbol: "MSFT", status: "scheduled", eps: undefined, revenue: undefined }, "earnings-unknown");
  assert.deepEqual(preserveConfirmedResults(previous, otherCompany), otherCompany);
});

test("the flow row carries the release's deviation from the expectation, worded like the calendar card", async () => {
  const { flowDeviation } = await import("../lib/release-deviation");
  const words = { aboveForecast: "Beklentinin {diff} Üstünde", belowForecast: "Beklentinin {diff} Altında", inlineForecast: "Beklentiyle Aynı", abovePrevious: "Öncekinin {diff} Üstünde", belowPrevious: "Öncekinin {diff} Altında", inlinePrevious: "Öncekiyle Aynı", unitPoint: "Puan", unitThousand: "Bin" };
  const nfp = flowDeviation("165", "150", "254", "bin", "tr", words)!;
  assert.equal(nfp.direction, "above");
  assert.equal(nfp.base, "forecast");
  assert.equal(nfp.verdict, "Beklentinin 15 Bin Üstünde".replace(" ", nfp.verdict.includes(" ") ? " " : " "));
  assert.match(nfp.versus!, /^Öncekinin 89.Bin Altında$/);
  // Ölçek iki yana simetrik: önceki (beklentinin 104 üstü) uçta, gerçekleşen (+15) orantılı.
  assert.equal(nfp.previousAt, 0.84);
  assert.equal(nfp.actualAt, Math.round((15 / 104) * 0.84 * 10_000) / 10_000);
  const rate = flowDeviation("4.1", "4.2", null, "%", "tr", words)!;
  assert.equal(rate.direction, "below");
  assert.match(rate.verdict, /^Beklentinin 0,1.Puan Altında$/);
  assert.equal("versus" in rate, false);
  // Düz sayı olmayan (Fed aralığı) ya da kıyassız sonuçta sapma yok.
  assert.equal(flowDeviation("3.75-4.00", "4.00", null, "%", "tr", words), undefined);
  assert.equal(flowDeviation("4.1", null, null, "%", "tr", words), undefined);
});

test("a retained release keeps its deviation with it", () => {
  const base: DayFlowSnapshot = { dateEt: "2026-11-06", asOf: "2026-11-06T17:00:00Z", events: [], initialNowMinutes: 780, tradingDay: true, closeMinutes: 960, offsets: { primary: 480, secondary: 0 }, tags: { primary: "TR", secondary: "NY" }, pollAfterMs: 30000, sourceDelayed: false, hiddenEarnings: 0, today: "2026-11-06", prevDate: null, nextDate: null };
  const deviation = { base: "forecast" as const, direction: "above" as const, actualAt: 0.12, previousAt: -0.84, verdict: "Beklentinin 15 Bin Üstünde" };
  const released: FlowEvent = { id: "nfp", timeEt: "08:30", scheduledAt: null, title: "NFP", kind: "event", importance: "high", status: "released", actual: "165 bin", forecast: "150 bin", deviation, href: "/takvim", source: "FRED", updatedAt: "a" };
  const gap: FlowEvent = { ...released, status: "scheduled", actual: undefined, deviation: undefined };
  delete gap.deviation;
  const result = preserveConfirmedResults({ ...base, events: [released] }, { ...base, events: [gap] });
  assert.deepEqual(result.events[0].deviation, deviation);
  const without = preserveConfirmedResults({ ...base, events: [{ ...released, deviation: undefined }] }, { ...base, events: [gap] });
  assert.equal("deviation" in without.events[0], false);
});
