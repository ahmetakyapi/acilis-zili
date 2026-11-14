import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { planFifoSale } from "../lib/portfolio-sales";
import {
  insertOutcome,
  insertPositionsSql,
  isSaleGuardError,
  positionLockSql,
  rowsOf,
  saleGuardSql,
  saleStatements,
  saleStepSql,
  saleSteps,
} from "../lib/portfolio-write";

/**
 * Portföy yazımlarının yarışa dayanıklı deyimleri ve kararları
 * (lib/portfolio-write.ts). Bağlantı yok: deyim kurulur, metni ve
 * parametreleri sınanır. Koruma deyimin BİÇİMİNDE: koşul güncellemenin
 * `where`inden ya da eklemenin `select`inden çıkarsa yarış geri gelir.
 */

const dialect = new PgDialect();
const built = (statement: SQL) => {
  const query = dialect.sqlToQuery(statement);
  return { sql: query.sql.replace(/\s+/g, " ").trim(), params: query.params };
};

const USER = "11111111-1111-4111-8111-111111111111";
const SALE = "22222222-2222-4222-8222-222222222222";
const LOT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const context = { userId: USER, saleId: SALE, symbol: "NVDA", priceUsd: "150", soldAt: "2026-06-01" };

test("ekleme sonucu: satır döndüyse yazıldı, dönmediyse neden sayımdan", () => {
  assert.deepEqual(insertOutcome(["x"], 199, 1, 200), { kind: "saved", ids: ["x"] });
  assert.deepEqual(insertOutcome([], 200, 1, 200), { kind: "limit" });
  /* Toplu ekleme ya hep ya hiç: 198 + 3 sığmaz. */
  assert.deepEqual(insertOutcome([], 198, 3, 200), { kind: "limit" });
  assert.deepEqual(insertOutcome(["a", "b"], 198, 2, 200), { kind: "saved", ids: ["a", "b"] });
  /* Yer varken satır dönmedi: geri almada kimlik çakışması. */
  assert.deepEqual(insertOutcome([], 10, 1, 200), { kind: "conflict" });
});

test("ekleme: tavan koşulu deyimin içinde, kilit hesaba özel", () => {
  const lock = built(positionLockSql(USER));
  assert.equal(lock.sql, "select pg_advisory_xact_lock(hashtextextended($1, 0))");
  assert.deepEqual(lock.params, [`portfolio:${USER}`]);

  const insert = built(
    insertPositionsSql(
      USER,
      [
        { symbol: "NVDA", quantity: "2", costUsd: "100", boughtAt: "2026-01-10", note: null },
        { id: LOT_A, symbol: "AAPL", quantity: "1", costUsd: "200", boughtAt: "2026-02-10", note: "not" },
      ],
      200,
    ),
  );
  assert.match(insert.sql, /^insert into portfolio_positions \(id, user_id, symbol, quantity, cost_usd, bought_at, note\) select /);
  assert.match(insert.sql, /where \(select count\(\*\) from portfolio_positions where user_id = \$\d+::uuid\) \+ \$\d+::int <= \$\d+::int on conflict \(id\) do nothing returning id$/);
  /* Kimliksiz satır kimliğini veritabanından alır; geri alınan kendi kimliğiyle döner. */
  assert.match(insert.sql, /values \(gen_random_uuid\(\), \$\d+::text, .*\), \(\$\d+::uuid, \$\d+::text, /);
  assert.deepEqual(insert.params.slice(-3), [USER, 2, 200]);
  assert.ok(insert.params.includes(LOT_A));
});

test("kısmi düşüm koşullu ve sıfıra inmez; kayıt düşümün döndürdüğü satırdan", () => {
  const step = built(saleStepSql(context, { lotId: LOT_A, take: "2.5", exhausted: false }));
  assert.match(step.sql, /^with lot as \( update portfolio_positions set quantity = quantity - \$1::numeric\(20,8\) where /);
  /* `>`: eşitlikte parti sıfıra inerdi — o durum silme adımının işi. */
  assert.match(step.sql, /id = \$\d+::uuid and user_id = \$\d+::uuid and symbol = \$\d+::text and bought_at <= \$\d+::date and quantity > \$\d+::numeric\(20,8\) returning /);
  assert.match(step.sql, /\) insert into portfolio_sales \(.*\) select .* from lot$/);
  assert.deepEqual(step.params, ["2.5", LOT_A, USER, "NVDA", "2026-06-01", "2.5", SALE, "2.5", "150", "2026-06-01"]);
});

test("tükenen parti yalnız adedi okunanla aynıysa silinir", () => {
  const step = built(saleStepSql(context, { lotId: LOT_A, take: "10.00000000", exhausted: true }));
  assert.match(step.sql, /^with lot as \( delete from portfolio_positions where /);
  assert.match(step.sql, /id = \$\d+::uuid and user_id = \$\d+::uuid and symbol = \$\d+::text and bought_at <= \$\d+::date and quantity = \$\d+::numeric\(20,8\) returning /);
  assert.match(step.sql, /\) insert into portfolio_sales \(.*\) select .* from lot$/);
  assert.deepEqual(step.params, [LOT_A, USER, "NVDA", "2026-06-01", "10.00000000", SALE, "10.00000000", "150", "2026-06-01"]);
});

test("satış batch'i: adımlar ve eksik parçada geri sardıran bekçi", () => {
  const steps = [
    { lotId: LOT_A, take: "10.00000000", exhausted: true },
    { lotId: LOT_B, take: "2", exhausted: false },
  ];
  const statements = saleStatements(context, steps).map(built);
  assert.equal(statements.length, 3);
  assert.deepEqual(statements[0], built(saleStepSql(context, steps[0]!)));
  assert.deepEqual(statements[1], built(saleStepSql(context, steps[1]!)));
  assert.deepEqual(statements[2], built(saleGuardSql(USER, SALE, 2)));
  assert.equal(
    statements[2]!.sql,
    "select 1 / (case when (select count(*) from portfolio_sales where sale_id = $1::uuid and user_id = $2::uuid) = $3::int then 1 else 0 end) as ok",
  );
  assert.deepEqual(statements[2]!.params, [SALE, USER, 2]);
});

test("tükenen partide adet satırın kendi metni, kısmi düşümde planın adedi", () => {
  /* 17 haneyi aşan adet çift duyarlıklı sayıda yuvarlanır; metin korunur. */
  const stored = "123456789.12345678";
  const plan = planFifoSale(
    [
      { id: LOT_A, quantity: Number(stored), costUsd: 100, boughtAt: "2026-01-10", note: null },
      { id: LOT_B, quantity: 5, costUsd: 120, boughtAt: "2026-03-01", note: null },
    ],
    Number(stored) + 2,
    "2026-06-01",
  );
  assert.ok(plan.ok);
  if (!plan.ok) return;
  const steps = saleSteps(
    plan.steps.map((step) => ({ lotId: step.lot.id, take: step.take, exhausted: step.exhausted })),
    new Map([
      [LOT_A, stored],
      [LOT_B, "5.00000000"],
    ]),
  );
  assert.deepEqual(steps, [
    { lotId: LOT_A, take: stored, exhausted: true },
    { lotId: LOT_B, take: "2", exhausted: false },
  ]);
  /* Metni bilinmeyen partide planın adedine düşer. */
  assert.deepEqual(saleSteps([{ lotId: "x", take: 3, exhausted: true }], new Map()), [{ lotId: "x", take: "3", exhausted: true }]);
});

test("bekçinin hatası öteki hatalardan ayrılır", () => {
  assert.equal(isSaleGuardError(Object.assign(new Error("division by zero"), { code: "22012" })), true);
  assert.equal(isSaleGuardError(Object.assign(new Error("Failed query"), { cause: Object.assign(new Error("division by zero"), { code: "22012" }) })), true);
  /* Tablo yok, bağlantı düştü, kısıt ihlali: bunlar "yetersiz adet" değil. */
  assert.equal(isSaleGuardError(Object.assign(new Error("x"), { code: "42P01" })), false);
  assert.equal(isSaleGuardError(new Error("fetch failed")), false);
  assert.equal(isSaleGuardError(null), false);
});

test("batch sonucundan satırlar okunur; beklenmeyen biçim boş döner", () => {
  assert.deepEqual(rowsOf({ rows: [{ id: "a" }], rowCount: 1 }), [{ id: "a" }]);
  assert.deepEqual(rowsOf({ rows: [] }), []);
  assert.deepEqual(rowsOf(undefined), []);
  assert.deepEqual(rowsOf([{ id: "a" }]), []);
});
