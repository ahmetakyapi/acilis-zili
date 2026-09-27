import test from "node:test";
import assert from "node:assert/strict";
import type { MarketHoliday } from "../lib/market-hours";
import {
  dailyBriefOverdueSince,
  minutesLate,
  routineReports,
  weeklyBriefOverdueSince,
} from "../lib/routine-schedule";
import { lateLabel } from "../lib/admin-format";

/**
 * Gecikmenin BÜYÜKLÜĞÜ (28 Eylül). Durum üçlüsü "geç mi"yi söylüyordu;
 * panelin değeri ve /api/health "ne kadar"ı istiyor. Saatler elle veriliyor
 * (Türkiye yaz saati uygulamıyor: 16:10 TR = 13:10 UTC yıl boyu).
 */

const HOLIDAYS: MarketHoliday[] = [];

test("dakika tabana yuvarlanıyor, gelecek an sıfır", () => {
  const due = new Date("2026-09-23T13:10:00Z");
  assert.equal(minutesLate(due, new Date("2026-09-23T13:55:30Z")), 45);
  assert.equal(minutesLate(due, new Date("2026-09-23T13:00:00Z")), 0);
});

test("günlük bültende gecikme EN ESKİ eksik günden sayılıyor", () => {
  const now = new Date("2026-09-25T14:00:00Z"); // 25 Eylül 17:00 TR
  // Son kayıt 22 Eylül: 23'ün 16:10'undan beri eksik.
  assert.equal(dailyBriefOverdueSince("2026-09-22", now).toISOString(), "2026-09-23T13:10:00.000Z");
  // Kayıt hiç yoksa beklenen gün.
  assert.equal(dailyBriefOverdueSince(null, now).toISOString(), "2026-09-25T13:10:00.000Z");
});

test("haftalık bültende en eski eksik haftanın pazartesisi 09:30 TR", () => {
  const now = new Date("2026-09-28T08:00:00Z"); // 28 Eylül pazartesi 11:00 TR
  // Beklenen çapa 21 Eylül; son kayıt 14 Eylül çapalı → 21 Eylül haftası, 28'inde yazılmalıydı.
  assert.equal(weeklyBriefOverdueSince("2026-09-14", now).toISOString(), "2026-09-28T06:30:00.000Z");
});

test("rapor: geciken günlük bülten sayısıyla, koşullu rutinler yargısız", () => {
  const now = new Date("2026-09-23T14:00:00Z"); // çarşamba 17:00 TR
  const reports = routineReports(
    {
      dailyLatest: "2026-09-22",
      weeklyLatest: "2026-09-14",
      technicalLatest: { sessionDate: "2026-09-23", slots: ["premarket"] },
      storyLatest: new Date("2026-09-22T20:30:00Z"),
      analysisLatest: null,
    },
    now,
    HOLIDAYS,
  );
  const byKey = new Map(reports.map((r) => [r.key, r]));
  assert.equal(byKey.get("dailyBrief")?.state, "late");
  assert.equal(byKey.get("dailyBrief")?.lateMinutes, 50);
  assert.equal(byKey.get("weeklyBrief")?.state, "ok");
  assert.equal(byKey.get("weeklyBrief")?.lateMinutes, null);
  assert.equal(byKey.get("technical")?.state, "ok");
  assert.equal(byKey.get("story")?.state, "conditional");
  assert.equal(byKey.get("analysis")?.latest, null);
});

test("hafta sonu teknik rutin planlı değil, gecikme yok", () => {
  const saturday = new Date("2026-09-26T15:00:00Z");
  const [, , technical] = routineReports(
    { dailyLatest: "2026-09-26", weeklyLatest: "2026-09-14", technicalLatest: null, storyLatest: null, analysisLatest: null },
    saturday,
    HOLIDAYS,
  );
  assert.equal(technical.state, "notScheduled");
  assert.equal(technical.lateMinutes, null);
});

test("gecikme etiketi en kaba tam birimde", () => {
  assert.equal(lateLabel(45), "45 Dakika Gecikti");
  assert.equal(lateLabel(61), "1 Saat Gecikti");
  assert.equal(lateLabel(60 * 24 * 3 + 5), "3 Gün Gecikti");
  assert.equal(lateLabel(0), "Gecikti");
});
