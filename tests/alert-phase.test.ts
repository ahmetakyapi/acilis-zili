import test from "node:test";
import assert from "node:assert/strict";
import { alertPhase, type AlertPhase } from "../lib/alert-phase";
import { pushRetryable } from "../lib/push";

/**
 * Alarmın evresi (lib/alert-phase.ts) — düğme, tarama ve sayfadaki
 * değerlendirme aynı tabloyu okur.
 */

const now = new Date("2026-11-09T15:00:00.000Z");
const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();

test("alertPhase: tablo", () => {
  const rows: [string, { createdAt: Date | string; triggeredAt: Date | string | null }, AlertPhase][] = [
    ["kurulmuş, geçmişte", { createdAt: iso(-3_600_000), triggeredAt: null }, "armed"],
    ["sınırda (createdAt = şimdi) devrede — taramanın eski lte'si", { createdAt: iso(0), triggeredAt: null }, "armed"],
    ["yeniden kurulmuş, seans sonuna ertelenmiş", { createdAt: iso(60_000), triggeredAt: null }, "sleeping"],
    ["tetiklenmiş", { createdAt: iso(-3_600_000), triggeredAt: iso(-60_000) }, "triggered"],
    ["tetik, ileri tarihli createdAt'i ezer", { createdAt: iso(60_000), triggeredAt: iso(-60_000) }, "triggered"],
    ["Date nesneleri (sunucu satırı)", { createdAt: new Date(now.getTime() + 1), triggeredAt: null }, "sleeping"],
    ["okunamayan tarih uyutmaz", { createdAt: "bozuk", triggeredAt: null }, "armed"],
  ];
  for (const [name, row, expected] of rows) {
    assert.equal(alertPhase(row, now), expected, name);
    /* İstemci saati sayı olarak verir (Date.now()) — aynı sonuç. */
    assert.equal(alertPhase(row, now.getTime()), expected, `${name} (ms)`);
  }
});

test("alertPhase: armedAt (0043) varsa createdAt'in yerine geçer, yoksa createdAt", () => {
  type Row = { createdAt: Date | string; armedAt?: Date | string | null; triggeredAt: Date | string | null };
  const rows: [string, Row, AlertPhase][] = [
    ["kuruluş geçmişte, devreye giriş ileride → uykuda", { createdAt: iso(-86_400_000), armedAt: iso(60_000), triggeredAt: null }, "sleeping"],
    ["devreye giriş geçti → devrede", { createdAt: iso(-86_400_000), armedAt: iso(-60_000), triggeredAt: null }, "armed"],
    ["sınırda (armedAt = şimdi) devrede", { createdAt: iso(-86_400_000), armedAt: iso(0), triggeredAt: null }, "armed"],
    ["armedAt null → createdAt (tablo yok / ertelenmemiş)", { createdAt: iso(60_000), armedAt: null, triggeredAt: null }, "sleeping"],
    ["armedAt yok → createdAt", { createdAt: iso(-60_000), triggeredAt: null }, "armed"],
    [
      "eski yolla ileri çekilmiş createdAt'i yeni yeniden kurma (armedAt = şimdi) geçersiz kılar",
      { createdAt: iso(3_600_000), armedAt: iso(-1_000), triggeredAt: null },
      "armed",
    ],
    ["tetik armedAt'i de ezer", { createdAt: iso(-86_400_000), armedAt: iso(60_000), triggeredAt: iso(-1_000) }, "triggered"],
    ["okunamayan armedAt uyutmaz", { createdAt: iso(-60_000), armedAt: "bozuk", triggeredAt: null }, "armed"],
  ];
  for (const [name, row, expected] of rows) {
    assert.equal(alertPhase(row, now), expected, name);
    assert.equal(alertPhase(row, now.getTime()), expected, `${name} (ms)`);
  }
});

test("push: yalnız 5xx yeniden denenir; zaman aşımı (0) ve 4xx denenmez", () => {
  for (const status of [500, 502, 503, 504]) assert.equal(pushRetryable(status), true, String(status));
  for (const status of [0, 201, 400, 404, 410, 413, 429]) assert.equal(pushRetryable(status), false, String(status));
});
