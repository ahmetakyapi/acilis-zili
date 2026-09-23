import test from "node:test";
import assert from "node:assert/strict";
import { fiscalLabel, fiscalOfSlug, fiscalSlug, isCalendarAligned, matchReports } from "../lib/fiscal";
import { getMarketStatus, quoteBasis } from "../lib/market-hours";

/**
 * Geçmiş bilançolar tablosunun 23 Eylül'deki hatası: NVDA'nın sürpriz
 * kayıtları kaydırılmış dönemlerle geliyor (2Ç FY2027 → "2026-09-30") ve
 * eski pencere 26 Ağustos raporunu bir ÖNCEKİ çeyreğe bağlıyordu.
 */
test("EPS eşleşmesi kaydırılmış dönemi doğru rapora bağlar", () => {
  const surprises = [
    { period: "2026-09-30", epsActual: 2.22, quarter: 2, year: 2027 },
    { period: "2026-06-30", epsActual: 1.87, quarter: 1, year: 2027 },
  ];
  const cal = [
    { reportDate: "2026-08-26", epsActual: 2.22, quarter: 2, year: 2027 },
    { reportDate: "2026-05-27", epsActual: 1.87, quarter: 1, year: 2027 },
  ];
  const [q2, q1] = matchReports(surprises, cal, "2026-09-23");
  assert.equal(q2?.reportDate, "2026-08-26");
  assert.equal(q1?.reportDate, "2026-05-27");
});

test("eşleşme yoksa tarih uydurulmaz ve satır iki kez verilmez", () => {
  const surprises = [
    { period: "2026-06-30", epsActual: 1.5, quarter: 3, year: 2026 },
    { period: "2026-05-31", epsActual: 1.6, quarter: 2, year: 2026 },
  ];
  const cal = [{ reportDate: "2026-07-30", epsActual: null, quarter: null, year: null }];
  const [a, b] = matchReports(surprises, cal, "2026-09-23");
  assert.equal(a?.reportDate, "2026-07-30");
  assert.equal(b, null);
});

test("bugünden sonraki takvim satırı açıklanmış çeyreğe bağlanmaz", () => {
  const [hit] = matchReports(
    [{ period: "2026-09-30", epsActual: 2.2, quarter: 3, year: 2027 }],
    [{ reportDate: "2026-11-18", epsActual: null, quarter: 3, year: 2027 }],
    "2026-09-23",
  );
  assert.equal(hit, null);
});

test("mali anahtar, yakınlıktan önce gelir", () => {
  const [hit] = matchReports(
    [{ period: "2026-06-30", epsActual: null, quarter: 2, year: 2026 }],
    [
      { reportDate: "2026-07-02", epsActual: null, quarter: 1, year: 2026 },
      { reportDate: "2026-08-05", epsActual: null, quarter: 2, year: 2026 },
    ],
  );
  assert.equal(hit?.reportDate, "2026-08-05");
});

test("etiket ve adres analiz kayıtlarıyla aynı biçimde", () => {
  assert.equal(fiscalLabel({ year: 2027, quarter: 2 }, "tr"), "2Ç FY2027");
  assert.equal(fiscalLabel({ year: 2027, quarter: 2 }, "en"), "Q2 FY2027");
  assert.equal(fiscalLabel({ year: 2026, quarter: 2 }, "tr", { fy: false }), "2Ç 2026");
  assert.equal(fiscalSlug({ year: 2027, quarter: 2 }), "2c-fy2027");
  assert.equal(fiscalSlug({ year: 2026, quarter: 2 }, { fy: false }), "2c-2026");
  assert.deepEqual(fiscalOfSlug("3c-fy2026"), { quarter: 3, year: 2026, fy: true });
  assert.deepEqual(fiscalOfSlug("2c-2026"), { quarter: 2, year: 2026, fy: false });
  assert.equal(fiscalOfSlug("ozet"), null);
  assert.equal(isCalendarAligned({ year: 2026, quarter: 2 }, "2026-06-30"), true);
  assert.equal(isCalendarAligned({ year: 2027, quarter: 2 }, "2026-09-30"), false);
});

test("yüzdenin dayanağı işlemin kendi dakikasından okunur", () => {
  // 23 Eylül 2026 çarşamba, 09:35 ET: ana seans açık ama besleme 15 dk geride.
  const status = getMarketStatus(new Date("2026-09-23T13:35:00Z"), []);
  assert.equal(quoteBasis({ tradedAt: new Date("2026-09-23T13:20:00Z") }, status), "pre-market");
  assert.equal(quoteBasis({ tradedAt: new Date("2026-09-23T13:31:00Z") }, status), "session");
  assert.equal(quoteBasis({ tradedAt: new Date("2026-09-22T19:59:00Z") }, status), "lastClose");
  assert.equal(quoteBasis({ tradedAt: null }, status), "lastClose");
  assert.equal(quoteBasis(undefined, status), "lastClose");
  // 17:10 ET: kapanış sonrası işlem.
  const evening = getMarketStatus(new Date("2026-09-23T21:10:00Z"), []);
  assert.equal(quoteBasis({ tradedAt: new Date("2026-09-23T21:05:00Z") }, evening), "after-hours");
});
