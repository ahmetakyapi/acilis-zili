import assert from "node:assert/strict";
import test from "node:test";
import { getMarketStatus, type MarketHoliday } from "../lib/market-hours";
import { barsCurrent, spliceRealtimeTail } from "../lib/providers";
import type { Bar } from "../lib/providers/types";

/* 1 Ekim 2026 perşembe, 12:00 ET (16:00 UTC) — ana seans açık. */
const NOON = new Date("2026-10-01T16:00:00Z");
const open = getMarketStatus(NOON);
const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const bar = (iso: string, close = 100): Bar => ({ time: sec(iso), open: close, high: close, low: close, close, volume: 1 });

const justNow = new Date(NOON.getTime() - 20_000);
const HALF_DAY: MarketHoliday[] = [{ date: "2026-11-27", nameTr: "Şükran Günü Ertesi", nameEn: "Day After Thanksgiving", earlyCloseEt: "13:00" }];

test("in session a fresh response is current — even if an illiquid symbol's last bar is old", () => {
  assert.equal(open.session, "regular");
  /* Yanıt az önce alındı: seri sağlayıcının verebildiği en yeni seri. Son
     barın eski olması az işlem gören sembolde gerçek bir durum. */
  assert.equal(barsCurrent(justNow, open, 60, NOON), true);
});

test("in session an old response is stale — the morning-cache bug", () => {
  const morning = new Date("2026-10-01T14:10:00Z");
  assert.equal(barsCurrent(morning, open, 60, NOON), false);
  // Günlük aralıklarda TTL 900 sn: iki saatlik yanıt yine eski.
  assert.equal(barsCurrent(new Date(NOON.getTime() - 2 * 3600_000), open, 900, NOON), false);
  assert.equal(barsCurrent(justNow, open, 900, NOON), true);
});

test("on Saturday only a response fetched after Friday's session end counts", () => {
  const saturday = new Date("2026-10-03T16:00:00Z");
  const closed = getMarketStatus(saturday);
  // Cuma akşam seansı 20:00 ET'de bitti, besleme 20:15'te tamamlandı.
  assert.equal(closed.sessionEnd.toISOString(), "2026-10-03T00:15:00.000Z");
  assert.equal(barsCurrent(new Date("2026-10-03T01:00:00Z"), closed, 3600, saturday), true);
  assert.equal(barsCurrent(new Date("2026-10-02T11:00:00Z"), closed, 3600, saturday), false);
});

test("half days end early: a response after the 17:00 after-hours close is current", () => {
  /* 27 Kasım 2026 yarım gün: kapanış 13:00, akşam seansı 17:00, besleme
     17:15'te tamam. Sabit 20:15 sınırı bu gün 18:30'daki doğru yanıtı eski
     sayardı. */
  /* Ertesi gün (cumartesi) anlatılan seans yarım gün; sabit 20:15 kuralı
     cuma 17:20 EST'de çekilmiş DOĞRU yanıtı eski sayıp her istekte
     önbelleksiz tekrara düşerdi. (Aynı akşam 17:15–24:00 arasında besleme
     hâlâ o günün verisini beklediği için daha sıkı olan seans içi yaş
     kuralı geçerli.) */
  const saturday = new Date("2026-11-28T15:00:00Z");
  const status = getMarketStatus(saturday, HALF_DAY);
  assert.equal(status.sessionDate, "2026-11-27");
  assert.equal(status.sessionEnd.toISOString(), "2026-11-27T22:15:00.000Z");
  assert.equal(barsCurrent(new Date("2026-11-27T22:20:00Z"), status, 3600, saturday), true);
  assert.equal(barsCurrent(new Date("2026-11-27T20:00:00Z"), status, 3600, saturday), false);
});

test("overnight the previous session's end is the floor", () => {
  const night = new Date("2026-10-02T06:00:00Z"); // cuma 02:00 ET
  const status = getMarketStatus(night);
  assert.equal(status.sessionDate, "2026-10-01");
  assert.equal(barsCurrent(new Date("2026-10-02T00:30:00Z"), status, 3600, night), true);
  assert.equal(barsCurrent(new Date("2026-10-01T19:00:00Z"), status, 3600, night), false);
});

test("the IEX tail is appended only after the last SIP bar", () => {
  const sip = [bar("2026-10-01T15:35:00Z", 100), bar("2026-10-01T15:40:00Z", 101)];
  const iex = [bar("2026-10-01T15:40:00Z", 999), bar("2026-10-01T15:45:00Z", 102), bar("2026-10-01T15:55:00Z", 103)];
  const { bars, added } = spliceRealtimeTail(sip, iex, "1D", NOON);
  assert.equal(added, 2);
  assert.deepEqual(bars.map((b) => b.close), [100, 101, 102, 103]);
});

test("bars stamped in the future are dropped", () => {
  const sip = [bar("2026-10-01T15:40:00Z")];
  const iex = [bar("2026-10-01T16:05:00Z")];
  assert.equal(spliceRealtimeTail(sip, iex, "1D", NOON).added, 0);
});

test("on 1D a tail from a new day replaces yesterday's series", () => {
  const morning = new Date("2026-10-01T12:30:00Z");
  const sip = [bar("2026-09-30T19:55:00Z", 90)];
  const iex = [bar("2026-10-01T12:00:00Z", 95), bar("2026-10-01T12:20:00Z", 96)];
  const { bars } = spliceRealtimeTail(sip, iex, "1D", morning);
  assert.deepEqual(bars.map((b) => b.close), [95, 96]);
});
