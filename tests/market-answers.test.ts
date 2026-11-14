import test from "node:test";
import assert from "node:assert/strict";
import { MARKET_HOLIDAYS } from "../db/seed/holidays";
import { ET_ZONE } from "../lib/market-hours";
import { TR_ZONE } from "../lib/session-clock";
import {
  clockShifts,
  coveredYears,
  dayAnswer,
  holidayName,
  holidayRows,
  holidayYearGroups,
  isObservedHoliday,
  nextClosure,
  nextEarlyClose,
  regularHours,
  seasonHours,
  shiftRows,
  trLeadHours,
  trLocative,
} from "../lib/market-answers";

/**
 * `/abd-borsasi-saatleri` ve `/abd-borsasi-tatil-gunleri` sayfalarının saf
 * hesapları. Beklenen saatler ELLE doğrulanmış gerçek günlerdir (kış: TR =
 * ET + 8, yaz: ET + 7); kod tarafında sabit saat yok, testte var — kural
 * bozulursa burası düşer.
 */

const H = MARKET_HOLIDAYS;
/** Türkiye duvar saatinden an (TR yıl boyu UTC+3). */
const tr = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);

test("sıradaki tatil ve yarım gün: 14 Kasım 2026'dan bakınca Şükran Günü ve ertesi", () => {
  assert.equal(nextClosure(H, "2026-11-14")?.date, "2026-11-26");
  assert.equal(nextEarlyClose(H, "2026-11-14")?.date, "2026-11-27");
  /* Bugün tatilse sıradaki tatil bugündür. */
  assert.equal(nextClosure(H, "2026-11-26")?.date, "2026-11-26");
  /* Yarım gün tam tatil sayılmaz: 27 Kasım'dan bakınca sıradaki Noel. */
  assert.equal(nextClosure(H, "2026-11-27")?.date, "2026-12-25");
  /* Veri bittiğinde uydurma yok. */
  assert.equal(nextClosure(H, "2028-01-01"), null);
  assert.equal(nextEarlyClose([], "2026-01-01"), null);
});

test("yarım günün kapanışı Türkiye saatiyle o günün farkından: kışın 21:00, yazın 20:00", () => {
  const rows = holidayRows(H, "2026-11-14");
  const friday = rows.find((r) => r.holiday.date === "2026-11-27");
  assert.deepEqual(friday?.close, { tr: "21:00", ny: "13:00" });
  assert.equal(friday?.kind, "early");
  /* Yaz günü aynı 13:00 ET bir saat erken düşer. */
  const summer = holidayRows(
    [{ date: "2026-07-02", nameTr: "Deneme (yarım gün)", nameEn: "Test (early close)", earlyCloseEt: "13:00" }],
    "2026-01-01",
  )[0];
  assert.deepEqual(summer?.close, { tr: "20:00", ny: "13:00" });
  /* Tam tatilde kapanış saati yok. */
  assert.equal(rows.find((r) => r.holiday.date === "2026-11-26")?.close, null);
});

test("geçmiş günler işaretli, satırlar tarihe göre, yıllar veriden", () => {
  const rows = holidayRows([...H].reverse(), "2026-11-14");
  assert.equal(rows[0]?.holiday.date, "2026-01-01");
  assert.equal(rows.find((r) => r.holiday.date === "2026-09-07")?.past, true);
  assert.equal(rows.find((r) => r.holiday.date === "2026-11-26")?.past, false);
  const groups = holidayYearGroups(rows);
  assert.deepEqual(groups.map((g) => g.year), [2026, 2027]);
  assert.equal(groups[0]?.rows.length, 12);
  assert.deepEqual(coveredYears(H, "2026-11-14"), [2026, 2027]);
  /* Yıl dönünce başlık kayar; veri yoksa yıl uydurulmaz. */
  assert.deepEqual(coveredYears(H, "2027-01-02"), [2027]);
  assert.deepEqual(coveredYears([], "2026-11-14"), []);
});

test("tatil adı: yarım gün eki düşer, gözlem izi kalır ve tanınır", () => {
  const eve = H.find((h) => h.date === "2026-12-24")!;
  assert.equal(holidayName(eve, "tr"), "Noel arifesi");
  assert.equal(holidayName(eve, "en"), "Christmas Eve");
  const observed = H.find((h) => h.date === "2026-07-03")!;
  assert.equal(holidayName(observed, "tr"), "Bağımsızlık Günü (gözlem)");
  assert.equal(isObservedHoliday(observed), true);
  assert.equal(isObservedHoliday(eve), false);
});

test("yaz saati geçişleri hesaplanır: ABD 2026 ve 2027, Türkiye'de yok", () => {
  assert.deepEqual(clockShifts(2026, ET_ZONE), [
    { date: "2026-03-08", kind: "start" },
    { date: "2026-11-01", kind: "end" },
  ]);
  assert.deepEqual(clockShifts(2027, ET_ZONE), [
    { date: "2027-03-14", kind: "start" },
    { date: "2027-11-07", kind: "end" },
  ]);
  assert.deepEqual(clockShifts(2026, TR_ZONE), []);
  /* Türkiye 2016'da kalıcı yaz saatine geçti; o yılın tek değişikliği mart. */
  assert.deepEqual(clockShifts(2016, TR_ZONE).map((s) => s.kind), ["start"]);
});

test("geçişten sonra açılış ve kapanış: yazın 16:30–23:00, kışın 17:30–00:00 TR", () => {
  const rows = shiftRows([2026, 2027], "2026-11-14");
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0]?.open, { tr: "16:30", ny: "09:30" });
  assert.deepEqual(rows[0]?.close, { tr: "23:00", ny: "16:00" });
  assert.equal(rows[0]?.leadHours, 7);
  assert.deepEqual(rows[1]?.open, { tr: "17:30", ny: "09:30" });
  assert.deepEqual(rows[1]?.close, { tr: "00:00", ny: "16:00" });
  assert.equal(rows[1]?.leadHours, 8);
  assert.deepEqual(rows.map((r) => r.past), [true, true, false, false]);
  assert.equal(trLeadHours("2026-07-15"), 7);
  assert.equal(trLeadHours("2026-12-15"), 8);

  const season = seasonHours(2026);
  assert.equal(season?.summer.open.tr, "16:30");
  assert.equal(season?.winter.close.tr, "00:00");
});

test("olağan gün ve yarım gün seans saatleri", () => {
  assert.deepEqual(regularHours("2026-11-16", H), {
    open: { tr: "17:30", ny: "09:30" },
    close: { tr: "00:00", ny: "16:00" },
    halfDay: false,
  });
  assert.deepEqual(regularHours("2026-11-27", H).close, { tr: "21:00", ny: "13:00" });
  assert.equal(regularHours("2026-11-27", H).halfDay, true);
});

test("günün cevabı: hafta sonu sıradaki açılışı pazartesiye verir", () => {
  const answer = dayAnswer(tr("2026-11-14", "12:00"), H, "tr");
  assert.equal(answer.kind, "weekend");
  assert.equal(answer.today, null);
  assert.equal(answer.next.date, "2026-11-16");
  assert.equal(answer.next.dayOffset, 2);
  assert.equal(answer.next.open.tr, "17:30");
});

test("günün cevabı: tam tatil nedeniyle kapalı, sıradaki gün yarım gün", () => {
  const answer = dayAnswer(tr("2026-11-26", "15:00"), H, "tr");
  assert.equal(answer.kind, "holiday");
  assert.equal(answer.holiday?.nameEn, "Thanksgiving Day");
  assert.equal(answer.next.date, "2026-11-27");
  assert.equal(answer.next.dayOffset, 1);
  assert.equal(answer.next.halfDay, true);
  assert.equal(answer.next.close.tr, "21:00");
});

test("günün cevabı: işlem gününün dalları (kış günü, TR saatiyle)", () => {
  const at = (time: string) => dayAnswer(tr("2026-11-16", time), H, "tr");
  /* 04:00 ET = 12:00 TR, 09:30 ET = 17:30 TR. */
  assert.equal(at("09:00").kind, "beforeOpen");
  assert.equal(at("12:00").kind, "preMarket");
  assert.equal(at("17:29").kind, "preMarket");
  assert.equal(at("17:30").kind, "open");
  assert.equal(at("23:59").kind, "open");
  /* Zil çalmadıysa sıradaki açılış BUGÜN; çaldıysa sıradaki işlem günü. */
  assert.equal(at("12:00").next.dayOffset, 0);
  assert.equal(at("18:00").next.date, "2026-11-17");
  assert.deepEqual(at("18:00").today, {
    open: { tr: "17:30", ny: "09:30" },
    close: { tr: "00:00", ny: "16:00" },
  });
});

test("günün cevabı: kışın TR gece yarısı yeni günü anlatır, dünü değil", () => {
  /* Salı 00:30 TR = pazartesi 16:30 ET (akşam seansı sürüyor). Okuyucunun
     günü salı: cümle salı seansını "bugün" diye anlatmalı. */
  const answer = dayAnswer(tr("2026-11-17", "00:30"), H, "tr");
  assert.equal(answer.dayDate, "2026-11-17");
  assert.equal(answer.kind, "beforeOpen");
  assert.equal(answer.next.dayOffset, 0);
});

test("günün cevabı: yazın TR'de kapanış sonrası dallar görülür", () => {
  /* 15 Temmuz 2026 çarşamba: kapanış 23:00 TR, akşam seansı 03:00'e dek. */
  const answer = dayAnswer(tr("2026-07-15", "23:30"), H, "tr");
  assert.equal(answer.kind, "afterHours");
  assert.equal(answer.today?.close.tr, "23:00");
  assert.equal(answer.next.date, "2026-07-16");
  assert.equal(answer.next.dayOffset, 1);
});

test("günün cevabı: yarım günde erken kapanış; EN okurun günü New York", () => {
  const half = dayAnswer(tr("2026-11-27", "19:00"), H, "tr");
  assert.equal(half.kind, "open");
  assert.equal(half.halfDay, true);
  assert.equal(half.today?.close.tr, "21:00");
  const afterBell = dayAnswer(tr("2026-11-27", "21:30"), H, "tr");
  assert.equal(afterBell.kind, "afterHours");
  /* Salı 03:00 TR = pazartesi 19:00 ET: EN okur için gün hâlâ pazartesi ve
     akşam seansı sürüyor; TR okur için salı, zil henüz çalmadı. */
  const moment = tr("2026-11-17", "03:00");
  assert.equal(dayAnswer(moment, H, "en").dayDate, "2026-11-16");
  assert.equal(dayAnswer(moment, H, "en").kind, "afterHours");
  assert.equal(dayAnswer(moment, H, "tr").kind, "beforeOpen");
  /* 20:00 ET'den sonra EN okur için gün kapanmıştır. */
  assert.equal(dayAnswer(tr("2026-11-17", "05:30"), H, "en").kind, "closed");
});

test("yılın bulunma eki okunuşa göre", () => {
  assert.equal(trLocative(2026), "da");
  assert.equal(trLocative(2027), "de");
  assert.equal(trLocative(2028), "de");
  assert.equal(trLocative(2029), "da");
  assert.equal(trLocative(2030), "da");
  assert.equal(trLocative(2033), "te");
  assert.equal(trLocative(2040), "ta");
  assert.equal(trLocative(2070), "te");
  assert.equal(trLocative(2100), "de");
  assert.equal(trLocative(3000), "de");
});
