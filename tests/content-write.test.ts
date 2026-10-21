import assert from "node:assert/strict";
import test from "node:test";
import { briefInputSchema, briefSurumu, storyInputSchema } from "../lib/content-write";
import { isIsoDay } from "../lib/date-input";

/** İçeriğin yazma yolu — dil ve gün doğrulaması, bülten sürüm imi (20 Ekim). */

const story = {
  slug: "fed-faiz-karari",
  title: "Fed Faiz Kararı",
  dek: "Tek cümlelik giriş.",
  body_md: "Gövde ".repeat(60),
};
const brief = { headline: "Manşet", body_md: "Gövde" };

test("locale is validated, not coerced to tr", () => {
  assert.equal(storyInputSchema.parse({ ...story, locale: "EN" }).locale, "en");
  assert.equal(briefInputSchema.parse({ ...brief, locale: " tr " }).locale, "tr");
  for (const locale of ["en-US", "english", "de", ""]) {
    assert.equal(storyInputSchema.safeParse({ ...story, locale }).success, false, locale);
    assert.equal(briefInputSchema.safeParse({ ...brief, locale }).success, false, locale);
  }
  /* Varsayılan yalnız alan YOKKEN — yazma yolu `?? "tr"` diyor. */
  assert.equal(storyInputSchema.parse(story).locale, undefined);
});

test("impossible calendar days are rejected before they reach Postgres", () => {
  for (const day of ["2026-09-31", "2026-02-29", "2026-13-01", "2026-00-10", "2026-9-01", "0000-01-01"]) {
    assert.equal(storyInputSchema.safeParse({ ...story, event_date: day }).success, false, day);
    assert.equal(briefInputSchema.safeParse({ ...brief, date: day }).success, false, day);
  }
  assert.equal(storyInputSchema.parse({ ...story, event_date: "2028-02-29" }).event_date, "2028-02-29");
  assert.equal(briefInputSchema.parse({ ...brief, date: "2026-09-30" }).date, "2026-09-30");
});

test("isIsoDay matches the schema for query parameters", () => {
  for (const day of ["2026-09-31", "2026-02-30", "2026-13-01", "2026-00-10", "2026-9-01", "dün", "0000-01-01"]) {
    assert.equal(isIsoDay(day), false, day);
    assert.equal(briefInputSchema.safeParse({ ...brief, date: day }).success, false, day);
  }
  for (const day of ["2026-09-30", "2028-02-29", "2026-12-31"]) {
    assert.equal(isIsoDay(day), true, day);
    assert.equal(briefInputSchema.safeParse({ ...brief, date: day }).success, true, day);
  }
});

test("a bad format reports one issue, not a second year message", () => {
  const result = briefInputSchema.safeParse({ ...brief, date: "2026-09-31" });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((issue) => issue.code), ["invalid_format"]);
});

test("brief version token tracks headline and body", () => {
  const base = briefSurumu("Manşet", "Gövde");
  assert.equal(briefSurumu("Manşet", "Gövde"), base);
  assert.notEqual(briefSurumu("Manşet!", "Gövde"), base);
  assert.notEqual(briefSurumu("Manşet", "Gövde."), base);
  /* Ayraç: alanlar arasında kayan metin aynı imi vermez. */
  assert.notEqual(briefSurumu("ab", "c"), briefSurumu("a", "bc"));
});
