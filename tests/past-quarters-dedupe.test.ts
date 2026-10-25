import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPastQuarters } from "../components/stock/past-quarters";

test("duplicate provider periods collapse to one row, keeping the reported one", () => {
  const base = { period: "2026-06-30", year: 2027, quarter: 2, epsEstimate: 1 } as const;
  const rows = buildPastQuarters(
    [{ ...base, epsActual: null }, { ...base, epsActual: 1.2 }, { period: "2026-03-31", year: 2027, quarter: 1, epsEstimate: 0.9, epsActual: 1 }] as never,
    [], [], "tr", "2026-10-25",
  );
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((r) => r.key)).size, 2);
  assert.equal(rows.find((r) => r.key === "2026-06-30")?.epsActual, 1.2);
});
