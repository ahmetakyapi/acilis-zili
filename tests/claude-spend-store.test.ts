import test from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/schema";
import { addSpendQuery, isMissingTable, refundSpendQuery, takeSpendQuery } from "../lib/claude-spend-store";

/**
 * Kalıcı harcama sayacının deyimleri (lib/claude-spend-store.ts). Bağlantı
 * yok: sorgu yalnız kurulur, metni sınanır. Atomiklik deyimin BİÇİMİNDE —
 * koşul `do update`in `where`inde kalmalı; ayrı bir `select`e bölünürse iki
 * süreç yeniden yarışır.
 */

const db = drizzle.mock({ schema });

test("artış tek deyim: koşullu upsert, satır dönmezse tavan dolu", () => {
  const query = takeSpendQuery(db, "2026-11-14", 120).toSQL();
  assert.equal(
    query.sql,
    'insert into "claude_spend" ("day", "n") values ($1, $2) on conflict ("day") do update set "n" = "claude_spend"."n" + 1 where "claude_spend"."n" < $3 returning "n"',
  );
  assert.deepEqual(query.params, ["2026-11-14", 1, 120]);
});

test("iade sıfırın altına inmez", () => {
  const query = refundSpendQuery(db, "2026-11-14").toSQL();
  assert.equal(query.sql, 'update "claude_spend" set "n" = "claude_spend"."n" - 1 where ("claude_spend"."day" = $1 and "claude_spend"."n" > $2)');
  assert.deepEqual(query.params, ["2026-11-14", 0]);
});

test("bellekte sayılan haklar koşulsuz eklenir", () => {
  const query = addSpendQuery(db, "2026-11-14", 4).toSQL();
  assert.equal(query.sql, 'insert into "claude_spend" ("day", "n") values ($1, $2) on conflict ("day") do update set "n" = "claude_spend"."n" + $3');
  assert.deepEqual(query.params, ["2026-11-14", 4, 4]);
});

test("eksik tablo, sarılmış hatada da tanınır", () => {
  assert.equal(isMissingTable(Object.assign(new Error("x"), { code: "42P01" })), true);
  assert.equal(isMissingTable(Object.assign(new Error("Failed query"), { cause: { code: "42P01" } })), true);
  assert.equal(isMissingTable(new Error("fetch failed")), false);
  assert.equal(isMissingTable(null), false);
});
