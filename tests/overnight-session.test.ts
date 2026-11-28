import assert from "node:assert/strict";
import test from "node:test";
import { getMarketStatus, hasOvernightSession, type MarketHoliday } from "../lib/market-hours";

/* 23x5 gece seansı — gösterim aşaması (lib/market-hours.ts → OVERNIGHT_FIRST_SESSION). Kış saati: ET = UTC−5. */

const at = (iso: string, holidays: MarketHoliday[] = []) => getMarketStatus(new Date(iso), holidays);
const XMAS: MarketHoliday[] = [{ date: "2026-12-25", nameTr: "Noel", nameEn: "Christmas", earlyCloseEt: null }];

test("ilk gece seansı 6 Aralık Pazar 21:00 ET'de (TR 7 Aralık 05:00) açılır", () => {
  const before = at("2026-12-07T01:59:00Z");
  assert.equal(before.overnightOpen, false);
  assert.equal(before.nextTransition.toISOString(), "2026-12-07T02:00:00.000Z");
  const open = at("2026-12-07T02:30:00Z");
  assert.equal(open.overnightOpen, true);
  assert.equal(open.overnightSessionDate, "2026-12-07");
});

test("gösterim aşaması: gece boyunca seans ve anlatılan gün değişmez", () => {
  const sunday = at("2026-12-07T02:30:00Z");
  assert.equal(sunday.session, "closed");
  assert.equal(sunday.sessionDate, "2026-12-04");
  const monday0300 = at("2026-12-07T08:00:00Z");
  assert.equal(monday0300.overnightOpen, true);
  assert.equal(monday0300.session, "closed");
  assert.equal(monday0300.nextTransition.toISOString(), "2026-12-07T09:00:00.000Z");
  const monday0400 = at("2026-12-07T09:00:00Z");
  assert.equal(monday0400.overnightOpen, false);
  assert.equal(monday0400.session, "pre-market");
});

test("20:00–21:00 borsa arası; 21:00 bir geçiş", () => {
  const pause = at("2026-12-08T01:30:00Z");
  assert.equal(pause.overnightOpen, false);
  assert.equal(pause.nextTransition.toISOString(), "2026-12-08T02:00:00.000Z");
  assert.equal(at("2026-12-08T02:00:00Z").overnightSessionDate, "2026-12-08");
});

test("başlangıçtan önce, cuma gecesi ve tatil öncesi gece seansı yok", () => {
  assert.equal(at("2026-12-04T03:00:00Z").overnightOpen, false);
  assert.equal(at("2026-12-12T02:30:00Z").overnightOpen, false);
  assert.equal(at("2026-12-25T02:30:00Z", XMAS).overnightOpen, false);
  assert.equal(hasOvernightSession("2026-12-25", XMAS), false);
  /* Tatilden sonraki işlem günü yine gece seansıyla başlar. */
  assert.equal(at("2026-12-26T02:30:00Z", XMAS).overnightOpen, false);
  assert.equal(at("2026-12-29T02:30:00Z", XMAS).overnightSessionDate, "2026-12-29");
});

test("pazar akşamı sıradaki geçiş gece seansının açılışı", () => {
  assert.equal(at("2026-12-14T01:00:00Z").nextTransition.toISOString(), "2026-12-14T02:00:00.000Z");
});

test("seans pencereleri: 7 Aralık'tan itibaren TR 05:00 gece seansıyla başlar, 04:00–05:00 borsa arası", async () => {
  const { sessionWindows } = await import("../lib/session-clock");
  const rows = (d: string) => sessionWindows(d, "tr").map((w) => `${w.key} ${w.primary} ${w.traded ? "işlem" : "yok"}`);
  assert.deepEqual(rows("2026-12-07"), [
    "overnight 05:00–12:00 işlem",
    "pre 12:00–17:30 işlem",
    "regular 17:30–00:00 işlem",
    "after 00:00–04:00 işlem",
    "pause 04:00–05:00 yok",
  ]);
  /* Öncesi: üç seans ve işlem görmeyen gece. */
  assert.deepEqual(rows("2026-12-04"), [
    "pre 12:00–17:30 işlem",
    "regular 17:30–00:00 işlem",
    "after 00:00–04:00 işlem",
    "overnight 04:00–12:00 yok",
  ]);
  /* Yaz saatinde bir saat erken. */
  assert.equal(sessionWindows("2027-06-07", "tr")[0].primary, "04:00–11:00");
});
