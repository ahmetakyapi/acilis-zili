import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_FILTERS,
  VAGUE_THRESHOLDS,
  matchesScreenFilters,
  normalizeQuery,
  parseScreenParams,
  sanitizeModelOutput,
  translationQuery,
  valueInSentence,
  withoutFilter,
  writeScreenParams,
  type ScreenSubject,
} from "../lib/screen-query";

/**
 * Düz cümleyle tarama çekirdeği (lib/screen-query.ts). Claude yalnız
 * süzgeç modelini doldurur; burada denetlenen her kural modelin
 * yapamayacağı şeyi kodun garanti etmesi: belirsiz sözcüğün eşiği tablodan,
 * cümlede olmayan sayı atılır, bilinmeyen alan okunmaz, adres kendi
 * aralığıyla doğrulanır.
 */

test("normalizeQuery: boşluk, büyük harf ve sondaki noktalama", () => {
  assert.equal(normalizeQuery("  Borcu  AZ,   kârlı yarı İLETKENLER.  "), "borcu az, kârlı yarı iletkenler");
  /* Türkçe harf yoksa İngilizce küçültme: "IT" "ıt" olmaz. */
  assert.equal(normalizeQuery("Cheap IT stocks!"), "cheap it stocks");
  assert.equal(normalizeQuery("ab"), "");
  assert.equal(normalizeQuery("x".repeat(300)).length, 200);
});

test("valueInSentence: sayı cümlede geçmeli; piyasa değerinde ölçek sözcüğü", () => {
  assert.ok(valueInSentence(15, "f/k'sı 15'in altında"));
  assert.ok(valueInSentence(0.5, "borç/özkaynak 0,5'ten az"));
  assert.ok(valueInSentence(20, "geliri %20'den hızlı büyüyen"));
  assert.ok(!valueInSentence(20, "geliri hızlı büyüyen"));
  assert.ok(valueInSentence(1000, "1 trilyon dolardan büyük", "marketCap"));
  assert.ok(valueInSentence(0.5, "500 milyon dolardan küçük", "marketCap"));
  assert.ok(!valueInSentence(1000, "1 trilyon dolardan büyük", "pe"));
});

test("sanitizeModelOutput: belirsiz sözcük tablodan, uydurma sayı atılır, bilinmeyen alan okunmaz", () => {
  const sentence = "temettü veren, borcu az, f/k 25 altı ve son çeyrekte geliri büyüyen yarı iletkenler";
  const out = sanitizeModelOutput(
    {
      sector: "Information Technology",
      industry: "yari-iletken",
      profitable: null,
      conditions: [
        { field: "debtToEquity", op: "max", degree: "some", value: null },
        { field: "revenueGrowth", op: "min", degree: "some", value: null },
        { field: "pe", op: "max", degree: "some", value: 25 },
        /* Cümlede 12 yok: model bir eşik uydurdu → atılır. */
        { field: "netMargin", op: "min", degree: "some", value: 12 },
        /* Şemada olmayan alan → okunmaz. */
        { field: "dividendYield", op: "min", degree: "some", value: null },
      ],
      sort: "nope",
      direction: "asc",
      unsupported: ["temettü veren", "son çeyrekte", "temettü veren", "  "],
      hisseler: ["NVDA"],
    },
    sentence,
  );
  assert.equal(out.filters.sector, "information-technology");
  assert.equal(out.filters.group, "yari-iletken");
  assert.equal(out.filters.profitable, false);
  assert.deepEqual(out.filters.conditions, [
    { field: "pe", op: "max", value: 25 },
    { field: "revenueGrowth", op: "min", value: VAGUE_THRESHOLDS.revenueGrowth.min.some },
    { field: "debtToEquity", op: "max", value: VAGUE_THRESHOLDS.debtToEquity.max.some },
  ]);
  assert.deepEqual(out.dropped, ["netMargin"]);
  assert.equal(out.sort, null);
  assert.equal(out.dir, "asc");
  assert.deepEqual(out.unsupported, ["temettü veren", "son çeyrekte"]);
  assert.ok(!("hisseler" in out));
});

test("sanitizeModelOutput: bozuk girdi boş çeviriye düşer, aralık dışı değer atılır", () => {
  const empty = sanitizeModelOutput("çöp", "x");
  assert.deepEqual(empty.filters, EMPTY_FILTERS);
  const wild = sanitizeModelOutput(
    { conditions: [{ field: "netMargin", op: "min", degree: "some", value: 500 }], industry: "diger" },
    "net marjı 500 üstü",
  );
  assert.deepEqual(wild.filters.conditions, []);
  assert.deepEqual(wild.dropped, ["netMargin"]);
  assert.equal(wild.filters.group, null);
});

test("adres gidiş-dönüşü: aynı süzgeç aynı adres, bozuk parametre yok sayılır", () => {
  const translation = sanitizeModelOutput(
    {
      industry: "yari-iletken",
      profitable: true,
      conditions: [{ field: "marketCap", op: "min", degree: "strong", value: null }],
      sort: "fk",
      direction: "asc",
      unsupported: [],
    },
    "dev kârlı yarı iletkenler en ucuzdan",
  );
  const query = translationQuery(translation, "Dev  kârlı yarı iletkenler en ucuzdan ");
  assert.equal(query, "sirala=fk&yon=asc&grup=yari-iletken&karli=1&degermin=200&cumle=Dev+k%C3%A2rl%C4%B1+yar%C4%B1+iletkenler+en+ucuzdan");
  const parsed = parseScreenParams(Object.fromEntries(new URLSearchParams(query)));
  assert.deepEqual(parsed, { ...translation.filters, sector: null });

  const junk = parseScreenParams({ fkmax: "abc", borcmax: "-3", marjmin: "15", grup: "olmayan", karli: "evet" });
  assert.deepEqual(junk, { sector: null, group: null, profitable: false, conditions: [{ field: "netMargin", op: "min", value: 15 }] });
});

test("withoutFilter: çip tek süzgeci kaldırır", () => {
  const filters = parseScreenParams({ grup: "finans", fkmax: "15", fkmin: "5", karli: "1" });
  const noMax = withoutFilter(filters, { kind: "condition", field: "pe", op: "max" });
  assert.deepEqual(noMax.conditions, [{ field: "pe", op: "min", value: 5 }]);
  assert.equal(withoutFilter(filters, { kind: "group" }).group, null);
  assert.equal(writeScreenParams(new URLSearchParams(), withoutFilter(filters, { kind: "profitable" })).toString(), "grup=finans&fkmin=5&fkmax=15");
});

test("matchesScreenFilters: bilinmeyen ölçü eşiği karşılamaz, negatif özkaynak borç sayılmaz", () => {
  const row: ScreenSubject = {
    sector: "Information Technology",
    group: "yari-iletken",
    fk: 18,
    cap: 120e9,
    metrics: {
      epsTTM: 3.2,
      revenueGrowthTTMYoy: 12,
      epsGrowthTTMYoy: null,
      netProfitMarginTTM: 22,
      roeTTM: 30,
      debtToEquity: 0.4,
      currentRatio: 2.1,
    },
  };
  const f = (search: Record<string, string>) => parseScreenParams(search);
  assert.ok(matchesScreenFilters(row, f({ grup: "yari-iletken", karli: "1", borcmax: "1", buyumemin: "0", degermin: "100" })));
  assert.ok(!matchesScreenFilters(row, f({ grup: "finans" })));
  assert.ok(!matchesScreenFilters(row, f({ karbuyumemin: "0" })), "kâr büyümesi bilinmiyor");
  assert.ok(!matchesScreenFilters(row, f({ fkmax: "15" })));
  assert.ok(!matchesScreenFilters({ ...row, metrics: { ...row.metrics, debtToEquity: -2 } }, f({ borcmax: "1" })));
  assert.ok(!matchesScreenFilters({ ...row, metrics: { ...row.metrics, epsTTM: -1 } }, f({ karli: "1" })));
});
