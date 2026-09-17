import test from "node:test";
import assert from "node:assert/strict";
import {
  expectsSessionData,
  getMarketStatus,
  isSessionTrade,
  type MarketHoliday,
} from "../lib/market-hours";

/**
 * "Bu yüzde hangi seansı anlatıyor" — bildirilen hatanın testi.
 *
 * Şikâyet: ana sayfanın "Günün Hareketleri" paneli seans AÇIKKEN bir önceki
 * günün sıralamasını "seans içi" künyesiyle basıyordu (17 Eylül 11:51 ET'de
 * GNRC %+20,66 · SMCI %+10,35 — hepsi 16 Eylül kapanışının sayıları).
 * Sağlayıcı taze veri döndürdüğü sürece kimse farkı göremiyordu; paket
 * önbellekten geldiğinde ise hiçbir katman itiraz etmiyordu.
 *
 * Kural tek bir alanda toplandı (`status.sessionDate`) ve buradaki testler
 * onun takvimdeki her köşeyi doğru geçtiğini tutuyor: gece yarısı, hafta
 * sonu, tam tatil, yarım gün ve ön seansın besleme gecikmesine denk gelen
 * ilk çeyreği.
 */

/** 2026 — Şükran Günü (tam tatil) ve ertesi günü (yarım gün). */
const HOLIDAYS: MarketHoliday[] = [
  {
    date: "2026-11-26",
    nameTr: "Şükran Günü",
    nameEn: "Thanksgiving",
    earlyCloseEt: null,
  },
  {
    date: "2026-11-27",
    nameTr: "Şükran Günü Ertesi",
    nameEn: "Day After Thanksgiving",
    earlyCloseEt: "13:00",
  },
];

/** ET yerel saatini UTC anına çevirir — eylülde EDT, kasımda EST. */
function et(dateStr: string, time: string, offsetHours: number): Date {
  return new Date(`${dateStr}T${time}:00${offsetHours < 0 ? "-" : "+"}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`);
}
const edt = (dateStr: string, time: string) => et(dateStr, time, -4);
const est = (dateStr: string, time: string) => et(dateStr, time, -5);

const statusAt = (at: Date) => getMarketStatus(at, HOLIDAYS);

test("seans günü — işlem gününde 04:00'ten sonra bugün", () => {
  // 17 Eylül 2026, perşembe. Şikâyetin saati.
  const status = statusAt(edt("2026-09-17", "11:51"));
  assert.equal(status.session, "regular");
  assert.equal(status.sessionDate, "2026-09-17");

  // Bildirilen hata: bir önceki günün kapanışı bu seansa AİT DEĞİL.
  assert.equal(isSessionTrade(edt("2026-09-16", "16:00"), status), false);
  assert.equal(isSessionTrade(edt("2026-09-17", "11:36"), status), true);
  // İşlem anı olmayan kayıt iddiasızdır; seansa ait sayılmaz.
  assert.equal(isSessionTrade(null, status), false);
});

test("seans günü — gece yarısı ile ön seans arası önceki seansı anlatır", () => {
  // Perşembe 02:00 ET: takvim günü perşembe, ekranda anlatılan seans çarşamba.
  const status = statusAt(edt("2026-09-17", "02:00"));
  assert.equal(status.session, "closed");
  assert.equal(status.etDate, "2026-09-17");
  assert.equal(status.sessionDate, "2026-09-16");
  assert.equal(isSessionTrade(edt("2026-09-16", "16:00"), status), true);
});

test("seans günü — hafta sonu cuma kapanışını anlatır", () => {
  // Cumartesi 10:00 ET.
  const cumartesi = statusAt(edt("2026-09-19", "10:00"));
  assert.equal(cumartesi.sessionDate, "2026-09-18");
  // Cumartesi 00:05 — gece yarısını yeni geçmiş; hâlâ cuma seansı.
  assert.equal(statusAt(edt("2026-09-19", "00:05")).sessionDate, "2026-09-18");
  // Pazar akşamı da cuma.
  assert.equal(statusAt(edt("2026-09-20", "21:00")).sessionDate, "2026-09-18");
});

test("seans günü — tam tatil ve yarım gün", () => {
  // Şükran Günü (tam tatil): anlatılan seans çarşamba.
  const tatil = statusAt(est("2026-11-26", "12:00"));
  assert.equal(tatil.tradingToday, false);
  assert.equal(tatil.sessionDate, "2026-11-25");

  // Ertesi gün yarım gün — İŞLEM VAR, yani seans günü kendisi.
  const yarimGun = statusAt(est("2026-11-27", "12:00"));
  assert.equal(yarimGun.tradingToday, true);
  assert.equal(yarimGun.session, "regular");
  assert.equal(yarimGun.sessionDate, "2026-11-27");

  // 13:00 kapanışından sonra uzatılmış seans; gün değişmiyor.
  assert.equal(statusAt(est("2026-11-27", "14:00")).sessionDate, "2026-11-27");

  // Cumartesi: yarım gün de bir seanstır, en son kapanan o.
  assert.equal(statusAt(est("2026-11-28", "10:00")).sessionDate, "2026-11-27");
});

test("gecikmeli beslemeden seans verisi beklenen an", () => {
  // Ön seans 04:00'te açılıyor, besleme 15 dakika geriden geliyor: 04:05'te
  // beslemenin verebildiği en yeni an 03:50 ve o dakikada işlem yok. Eski
  // paket burada BEKLENEN hâl — sağlayıcıya taze istek atmak boşuna.
  const acilis = statusAt(edt("2026-09-17", "04:05"));
  assert.equal(acilis.sessionDate, "2026-09-17");
  assert.equal(expectsSessionData(acilis, edt("2026-09-17", "04:05")), false);

  // 04:20'de gecikmeli an 04:05; artık bu seansa ait işlem beklenir.
  const sonra = statusAt(edt("2026-09-17", "04:20"));
  assert.equal(expectsSessionData(sonra, edt("2026-09-17", "04:20")), true);

  // Seans içinde her zaman beklenir.
  const seans = statusAt(edt("2026-09-17", "11:51"));
  assert.equal(expectsSessionData(seans, edt("2026-09-17", "11:51")), true);

  // Hafta sonunda beklenmez: elde cuma kapanışı olması doğru olan.
  const cumartesi = statusAt(edt("2026-09-19", "10:00"));
  assert.equal(expectsSessionData(cumartesi, edt("2026-09-19", "10:00")), false);

  // Cuma 23:50: gecikmeli an 23:35, seans günü hâlâ cuma → beklenir.
  const gece = statusAt(edt("2026-09-18", "23:50"));
  assert.equal(gece.sessionDate, "2026-09-18");
  assert.equal(expectsSessionData(gece, edt("2026-09-18", "23:50")), true);

  // Cumartesi 00:05: gecikmeli an cuma 23:50 — gün sınırını doğru geçiyor.
  const gecetesi = statusAt(edt("2026-09-19", "00:05"));
  assert.equal(gecetesi.sessionDate, "2026-09-18");
  assert.equal(expectsSessionData(gecetesi, edt("2026-09-19", "00:05")), true);
});
