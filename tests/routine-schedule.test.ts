import test from "node:test";
import assert from "node:assert/strict";
import type { MarketHoliday } from "../lib/market-hours";
import {
  cronState,
  dailyBriefState,
  expectedDailyBrief,
  expectedSlots,
  expectedWeeklyAnchor,
  lastCronDue,
  technicalDue,
  technicalState,
  weeklyBriefState,
} from "../lib/routine-schedule";

/**
 * Rutin takvimi — "şu an ne yazılmış olmalıydı" sorusunun testi.
 *
 * Üç hata üç ayrı ekranda yaşıyordu (23 Eylül denetimi): kaçırılan günlük
 * bülten gece yarısından sonra yeniden "bekleniyor"du, haftalık kontrol
 * yanlış pazartesiyi bekliyordu ve teknik rutin hiç sorulmuyordu. Saat her
 * testte elle veriliyor; Türkiye yaz saati uygulamıyor, ABD uyguluyor —
 * iki mevsimin ikisi de burada.
 */

const HOLIDAYS: MarketHoliday[] = [
  { date: "2026-11-26", nameTr: "Şükran Günü", nameEn: "Thanksgiving", earlyCloseEt: null },
  { date: "2026-11-27", nameTr: "Yarım Gün", nameEn: "Half Day", earlyCloseEt: "13:00" },
];

/* ---- Günlük bülten ---- */

test("gece yarısından sonra kaçırılan günlük bülten GECİKMİŞ, beklemede değil", () => {
  /* 25 Eylül 01:00 TR — New York hâlâ 24 Eylül 18:00. Eski kod "bugün"ü
     24 sayıp "01:00 < 16:10" diye bekliyordu. */
  const now = new Date("2026-09-24T22:00:00Z");
  assert.equal(expectedDailyBrief(now), "2026-09-24");
  assert.equal(dailyBriefState("2026-09-23", now).state, "late");
});

test("16:10 TR'den önce dünkü bülten yeterli", () => {
  const now = new Date("2026-09-23T09:00:00Z"); // 12:00 TR
  assert.equal(expectedDailyBrief(now), "2026-09-22");
  assert.equal(dailyBriefState("2026-09-22", now).state, "ok");
});

test("16:10 ile 16:40 TR arası pay: dünkü varken bekleniyor, sonra gecikti", () => {
  assert.equal(dailyBriefState("2026-09-22", new Date("2026-09-23T13:20:00Z")).state, "waiting");
  assert.equal(dailyBriefState("2026-09-22", new Date("2026-09-23T13:45:00Z")).state, "late");
  assert.equal(dailyBriefState("2026-09-23", new Date("2026-09-23T13:45:00Z")).state, "ok");
});

test("hafta sonu da bekleniyor — rutin her gün yazıyor", () => {
  const saturday = new Date("2026-09-26T15:00:00Z"); // 18:00 TR cumartesi
  assert.equal(expectedDailyBrief(saturday), "2026-09-26");
  assert.equal(dailyBriefState("2026-09-25", saturday).state, "late");
});

test("kayıt hiç yoksa gecikmiş", () => {
  assert.equal(dailyBriefState(null, new Date("2026-09-23T09:00:00Z")).state, "late");
});

/* ---- Haftalık bülten ---- */

test("haftalık kayıt KAPSADIĞI haftaya çapalı: çarşamba 14 Eylül yeterli", () => {
  const now = new Date("2026-09-23T09:00:00Z");
  assert.equal(expectedWeeklyAnchor(now), "2026-09-14");
  assert.equal(weeklyBriefState("2026-09-14", now).state, "ok");
});

test("pazartesi 09:30 TR'den önce geçen haftanınki bekleniyor, sonra gecikiyor", () => {
  const before = new Date("2026-09-28T05:00:00Z"); // 08:00 TR pazartesi
  assert.equal(weeklyBriefState("2026-09-14", before).state, "ok");
  const within = new Date("2026-09-28T06:45:00Z"); // 09:45 TR — pay içinde
  assert.equal(weeklyBriefState("2026-09-14", within).state, "waiting");
  const after = new Date("2026-09-28T07:30:00Z"); // 10:30 TR
  assert.equal(expectedWeeklyAnchor(after), "2026-09-21");
  assert.equal(weeklyBriefState("2026-09-14", after).state, "late");
  assert.equal(weeklyBriefState("2026-09-21", after).state, "ok");
});

test("pazar günü biten haftanın çapası hâlâ bir önceki pazartesi", () => {
  /* weekAnchor pazarı biten haftaya sayıyor: 27 Eylül → 21 Eylül; o
     haftanın bülteni ertesi gün yazılacak. */
  const sunday = new Date("2026-09-27T12:00:00Z");
  assert.equal(expectedWeeklyAnchor(sunday), "2026-09-14");
});

/* ---- Teknik analiz ---- */

test("teknik: öğleden sonra iki nöbet yazılmışsa sağlıklı, yalnız sabahki varsa gecikti", () => {
  const now = new Date("2026-09-22T17:30:00Z"); // seans içi nöbeti 16:45 + 30 dk geçti
  assert.deepEqual(technicalDue(now, HOLIDAYS), { sessionDate: "2026-09-22", slot: "midsession" });
  assert.equal(
    technicalState({ sessionDate: "2026-09-22", slots: ["premarket", "midsession"] }, now, HOLIDAYS).state,
    "ok",
  );
  assert.equal(
    technicalState({ sessionDate: "2026-09-22", slots: ["premarket"] }, now, HOLIDAYS).state,
    "late",
  );
});

test("teknik: bugünün ilk nöbeti dolmadan dünkü son nöbet borç", () => {
  const now = new Date("2026-09-22T10:00:00Z");
  assert.deepEqual(technicalDue(now, HOLIDAYS), { sessionDate: "2026-09-21", slot: "lateday" });
  assert.equal(
    technicalState({ sessionDate: "2026-09-21", slots: ["premarket", "midsession", "lateday"] }, now, HOLIDAYS).state,
    "ok",
  );
});

test("cumartesi teknik de senkron da planlı değil", () => {
  const saturday = new Date("2026-09-26T12:00:00Z");
  assert.equal(technicalState(null, saturday, HOLIDAYS).state, "notScheduled");
  assert.equal(cronState(null, saturday).state, "notScheduled");
});

test("tam tatilde teknik planlı değil, yarım günde kapanış öncesi beklenmiyor", () => {
  assert.equal(technicalState(null, new Date("2026-11-26T20:00:00Z"), HOLIDAYS).state, "notScheduled");
  assert.deepEqual(expectedSlots("2026-11-27", HOLIDAYS), ["premarket", "midsession"]);
  assert.deepEqual(expectedSlots("2026-11-25", HOLIDAYS), ["premarket", "midsession", "lateday"]);
  /* Yarım günün akşamında borç öğlen nöbeti. */
  assert.deepEqual(technicalDue(new Date("2026-11-27T20:00:00Z"), HOLIDAYS), {
    sessionDate: "2026-11-27",
    slot: "midsession",
  });
});

/* ---- Günlük senkron ---- */

test("senkron: 13:30 TR'den önce dünkü koşum varsa bekleniyor", () => {
  const now = new Date("2026-09-23T09:14:00Z"); // 12:14 TR çarşamba
  const tuesday = new Date("2026-09-22T10:31:40Z");
  assert.deepEqual(cronState(tuesday, now), { state: "waiting", dueTr: "13:30" });
});

test("senkron: dünkü koşum da yoksa bekleyen koşum eksiği örtmez", () => {
  const now = new Date("2026-09-23T09:14:00Z");
  const monday = new Date("2026-09-21T10:31:00Z");
  assert.equal(cronState(monday, now).state, "missed");
});

test("senkron: koşum saatinden sonra bugünün damgası koştu, yoksa kaçtı", () => {
  const now = new Date("2026-09-23T11:00:00Z");
  assert.equal(cronState(new Date("2026-09-23T10:31:10Z"), now).state, "ran");
  assert.equal(cronState(new Date("2026-09-22T10:31:10Z"), now).state, "missed");
});

test("senkron: pazartesi sabahı son borç cuma koşumu", () => {
  const mondayMorning = new Date("2026-09-28T06:00:00Z");
  assert.equal(lastCronDue(mondayMorning).toISOString(), "2026-09-25T10:30:00.000Z");
  assert.equal(cronState(new Date("2026-09-25T10:32:00Z"), mondayMorning).state, "waiting");
});
