import assert from "node:assert/strict";
import test from "node:test";
import { mergeErrorGroups, summarizeError } from "../lib/error-summary";

/* Hata satırının okunur adı ve birleştirme (lib/error-summary.ts). */

const AFTER =
  "Route /karsilastir used `headers()` inside `after()` while rendering. This is not supported. If you need this data inside an `after()` callback, use `headers()` outside of the callback. See more info here: https://nextjs.org/docs/app/api-reference/functions/after";

test("bilinen kalıplar kısa ada iner", () => {
  assert.equal(summarizeError(AFTER).title, "Bağlantı Kopunca headers() Okundu");
  assert.deepEqual(summarizeError("Failed to load chunk /_next/static/chunks/0jnm2cdhe_lcp.css from module 73493"), {
    title: "Eski Sürüm Parçası Yüklenemedi",
    detail: "0jnm2cdhe_lcp.css",
  });
  assert.deepEqual(
    summarizeError('Failed query: select "id", "headline" from "news" where "news"."id" = $1 limit $2 params: [gizlendi]'),
    { title: "Veritabanı Sorgusu Düştü", detail: "SELECT · news" },
  );
  assert.equal(summarizeError("Load failed").title, "Ağ İsteği Tamamlanmadı");
});

test("bilinmeyen mesaj ilk satırıyla, uzunsa kısaltılarak", () => {
  assert.deepEqual(summarizeError("TypeError: x is undefined\n  at foo"), { title: "TypeError: x is undefined", detail: null });
  const long = summarizeError("E".repeat(200)).title;
  assert.equal(long.length, 90);
  assert.ok(long.endsWith("…"));
});

test("aynı rota ve ada düşen gruplar birleşir", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 28, h));
  const base = { kind: "server", route: "/karsilastir", message: AFTER, days: 1 };
  const merged = mergeErrorGroups([
    { ...base, digest: "1", count: 74, lastAt: at(4) },
    { ...base, digest: "2", count: 75, lastAt: at(5) },
    { ...base, digest: "3", count: 75, lastAt: at(3), days: 2 },
    { ...base, route: "/piyasalar/[endeks]", digest: "4", count: 1, lastAt: at(2) },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].count, 224);
  assert.equal(merged[0].days, 2);
  assert.deepEqual(merged[0].digests, ["1", "2", "3"]);
  assert.equal(merged[0].lastAt.getTime(), at(5).getTime());
  assert.equal(merged[1].route, "/piyasalar/[endeks]");
});
