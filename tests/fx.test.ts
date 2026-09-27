import test from "node:test";
import assert from "node:assert/strict";

import {
  bulletinCandidates,
  convertCloses,
  cpiAt,
  cpiSpan,
  decomposeReturn,
  etDateOf,
  fxAnchors,
  isIsoDate,
  previousMonth,
  rateAt,
  tcmbArchivePath,
  type FxPath,
} from "../lib/fx";
import { parseUsdBulletin } from "../lib/providers/tcmb";
import { evdsUrl, parseEvdsMonthly } from "../lib/providers/evds";

/**
 * TL perspektifinin saf katmanı. Her test ekranda görülebilecek bir hataya
 * karşılık geliyor: yanlış günün kuru, uydurulmuş bir ara değer, toplanan
 * (çarpılması gereken) getiriler, eksik ay yüzünden sıfırlanan endeks.
 */

test("takvimde olmayan gün geçmez", () => {
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-2-3"), false);
});

test("bülten adayları o günden geriye, ay ve yıl sınırından geçerek", () => {
  assert.deepEqual(bulletinCandidates("2026-01-02", 3), [
    "2026-01-02",
    "2026-01-01",
    "2025-12-31",
    "2025-12-30",
  ]);
});

test("arşiv dosya yolu TCMB biçiminde", () => {
  assert.equal(tcmbArchivePath("2026-09-25"), "202609/25092026.xml");
});

test("önceki ay Ocak'ta yıl değiştirir", () => {
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.equal(previousMonth("2026-10"), "2026-09");
});

test("TCMB bülteninden USD alış, satış ve bülten günü okunur", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="25.09.2026" Date="09/25/2026"  Bulten_No="2026/181" >
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><ForexBuying>48.7901</ForexBuying><ForexSelling>48.8780</ForexSelling>
  </Currency>
  <Currency CrossOrder="1" Kod="AUD" CurrencyCode="AUD">
    <Unit>1</Unit><ForexBuying>34.2062</ForexBuying><ForexSelling>34.4293</ForexSelling>
  </Currency>
</Tarih_Date>`;
  assert.deepEqual(parseUsdBulletin(xml), {
    buying: 48.7901,
    selling: 48.878,
    bulletinDate: "2026-09-25",
  });
  /* USD bloğu yoksa yanlış bir kur değil, hiç kur. */
  assert.equal(parseUsdBulletin(xml.replace(/Kod="USD"/, 'Kod="XXX"')), null);
});

test("EVDS yanıtı sıfırsız ay biçimini ve boş değeri kaldırır", () => {
  const values = parseEvdsMonthly(
    {
      items: [
        { Tarih: "2026-8", TP_TUFE1YI_T1: "5781.74" },
        { Tarih: "2026-7", TP_TUFE1YI_T1: "5637.14" },
        { Tarih: "2026-9", TP_TUFE1YI_T1: null },
      ],
    },
    "TP.TUFE1YI.T1",
  );
  assert.deepEqual(values, [
    { month: "2026-07", value: 5637.14 },
    { month: "2026-08", value: 5781.74 },
  ]);
  assert.match(evdsUrl("TP.TUFE1YI.T1", "2021-10", "2026-08"), /igmevdsms-dis\/series=TP\.TUFE1YI\.T1&startDate=01-10-2021&endDate=28-08-2026&type=json&frequency=5$/);
});

const PATH: FxPath = {
  start: { requested: "2026-03-02", date: "2026-03-02", rate: 40 },
  end: { requested: "2026-06-30", date: "2026-06-30", rate: 44 },
  monthly: [
    { month: "2026-02", value: 39 },
    { month: "2026-03", value: 41 },
    { month: "2026-04", value: 42 },
    { month: "2026-05", value: 43 },
    { month: "2026-06", value: 43.5 },
  ],
  cpi: [
    { month: "2026-02", value: 100 },
    { month: "2026-03", value: 103 },
    { month: "2026-04", value: 106 },
  ],
};

test("aylık çapalar yalnızca iki ucun arasına girer, uçlar günlük kurdur", () => {
  const anchors = fxAnchors(PATH);
  assert.deepEqual(
    anchors.map((point) => point.date),
    ["2026-03-02", "2026-03-15", "2026-04-15", "2026-05-15", "2026-06-15", "2026-06-30"],
  );
  assert.equal(anchors[0].rate, 40);
  assert.equal(anchors[anchors.length - 1].rate, 44);
});

test("kur çapalar arasında doğrusal, dışında sabit", () => {
  const anchors = fxAnchors(PATH);
  /* 15 Mart 41, 15 Nisan 42: 31 günün tam ortası 30,5 → ~41,5 */
  const mid = rateAt(anchors, "2026-03-30");
  assert.ok(mid !== null && mid > 41 && mid < 42);
  assert.equal(rateAt(anchors, "2026-01-01"), 40);
  assert.equal(rateAt(anchors, "2026-12-31"), 44);
});

test("TÜFE basamak: ay yoksa son açıklanan ay, ilk aydan önce null", () => {
  const cpi = PATH.cpi!;
  assert.equal(cpiAt(cpi, "2026-03-20"), 103);
  assert.equal(cpiAt(cpi, "2026-06-30"), 106);
  assert.equal(cpiAt(cpi, "2026-01-15"), null);
  assert.deepEqual(cpiSpan(cpi, "2026-03-02", "2026-06-30"), { from: "2026-03", to: "2026-04" });
});

test("getiriler çarpılır; şerit ile bileşen satırı aynı TL sayısını verir", () => {
  const parts = decomposeReturn({ usdStart: 100, usdEnd: 120, rateStart: 40, rateEnd: 54 })!;
  assert.ok(Math.abs(parts.usdPct - 20) < 1e-9);
  assert.ok(Math.abs(parts.fxPct - 35) < 1e-9);
  assert.ok(Math.abs(parts.tlPct - 62) < 1e-9);

  /* Şerit çevrilmiş seriden (convertCloses) ilk/son oranını okuyor; aynı
     yol ve aynı uçlar aynı sayıyı vermeli. */
  const anchors = fxAnchors(PATH);
  const tl = convertCloses([100, 110, 120], ["2026-03-02", "2026-04-20", "2026-06-30"], "tl", anchors, null);
  const fromSeries = (tl[2]! / tl[0]! - 1) * 100;
  const fromParts = decomposeReturn({ usdStart: 100, usdEnd: 120, rateStart: 40, rateEnd: 44 })!;
  assert.ok(Math.abs(fromSeries - fromParts.tlPct) < 1e-9);
});

test("reel getiri TL getirisini TÜFE artışına böler", () => {
  const parts = decomposeReturn({
    usdStart: 100,
    usdEnd: 100,
    rateStart: 40,
    rateEnd: 44,
    cpiStart: 100,
    cpiEnd: 106,
  })!;
  assert.ok(Math.abs(parts.tlPct - 10) < 1e-9);
  assert.ok(Math.abs(parts.inflationPct! - 6) < 1e-9);
  assert.ok(Math.abs(parts.realPct! - (110 / 106 - 1) * 100) < 1e-9);
});

test("bar günü ET takviminden okunur — akşam seansı barı ertesi güne kaymaz", () => {
  /* 2026-09-25 20:30 ET = 2026-09-26 00:30 UTC */
  const unix = Date.UTC(2026, 8, 26, 0, 30) / 1000;
  assert.equal(etDateOf(unix), "2026-09-25");
});
