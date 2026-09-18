import test from "node:test";
import assert from "node:assert/strict";
import { packCurrent } from "../lib/providers";
import { getMarketStatus, type MarketHoliday } from "../lib/market-hours";
import { ok, type Quote } from "../lib/providers/types";

/**
 * "Bu paket ŞU ANI mı anlatıyor" — bildirilen hatanın testi.
 *
 * Şikâyet: SNDK sayfasında başlıkta 1.689,93 $ ("17:02 Güncellendi") yazarken
 * aynı ekrandaki 1G grafiği 18:15'e kadar bar taşıyordu ve son barın kapanışı
 * 1.711,24 $ idi. İki fiyat yan yana, aradaki fark yüzde 1,3.
 *
 * Sebep gün kontrolünün YETMEMESİ: paket bugüne aitti, yani `isSessionTrade`
 * doğru diyordu — ama yetmiş üç dakika önce çekilmişti. Next'in veri
 * önbelleği süresi dolmuş kaydı atmıyor, isteğe eski gövdeyi verip
 * tazelemeyi arkasında yapıyor.
 */

const HOLIDAYS: MarketHoliday[] = [];

/** ET yerel saatini UTC anına çevirir — eylülde EDT (-04:00). "HH:mm" da
    "HH:mm:ss" de kabul ediliyor; saniye ekini elle eklemek bir kez geçersiz
    tarih üretti ve test sessizce yanlış tarafa düştü. */
const edt = (dateStr: string, time: string) =>
  new Date(`${dateStr}T${time.length === 5 ? `${time}:00` : time}-04:00`);

const quote = (tradedAt: Date): Record<string, Quote> => ({
  SNDK: {
    symbol: "SNDK",
    price: 1689.93,
    change: 75.54,
    changePct: 4.68,
    open: null,
    high: null,
    low: null,
    prevClose: 1614.39,
    volume: null,
    tradedAt,
  },
});

/** Seans içi paket: işlem anı ve yanıt damgası ayrı ayrı verilebiliyor. */
const pack = (tradedAt: Date, fetchedAt: Date) =>
  ok(quote(tradedAt), "alpaca", { fetchedAt });

test("seans içinde taze paket güncel sayılır", () => {
  const now = edt("2026-09-18", "10:30");
  const status = getMarketStatus(now, HOLIDAYS);
  assert.equal(status.session, "regular");
  // Gecikmeli beslemede en yeni işlem ~15 dakika geride, yanıt az önce alındı.
  const taze = pack(edt("2026-09-18", "10:15"), edt("2026-09-18", "10:29:50"));
  assert.equal(packCurrent(taze, status, 15, now), true);
});

test("seans içinde ESKİ YANITLI paket güncel değildir — bildirilen hata", () => {
  const now = edt("2026-09-18", "10:30");
  const status = getMarketStatus(now, HOLIDAYS);
  /* Paket bugüne ait — gün kontrolü bunu geçiriyordu. Ama yanıt yetmiş üç
     dakika önce üretilmiş; ekranda "şu anki fiyat" diye o duruyordu. */
  const bayat = pack(edt("2026-09-18", "09:02"), edt("2026-09-18", "09:17"));
  assert.equal(packCurrent(bayat, status, 15, now), false);
});

test("pay ömrün üstüne ekleniyor, ömürle birlikte büyüyor", () => {
  const now = edt("2026-09-18", "10:30");
  const status = getMarketStatus(now, HOLIDAYS);
  const at = (ms: number) => new Date(now.getTime() - ms);
  // 15 sn ömür + 60 sn pay = 75 saniye tolerans.
  assert.equal(packCurrent(pack(at(0), at(70_000)), status, 15, now), true);
  assert.equal(packCurrent(pack(at(0), at(80_000)), status, 15, now), false);
  // Kapalıyken ömür 900 saniye; aynı paket orada sorulmuyor bile (aşağıda).
});

test("likiditesi düşük sembol bayat sayılmaz — ölçü yanıtın yaşı", () => {
  const now = edt("2026-09-18", "10:30");
  const status = getMarketStatus(now, HOLIDAYS);
  /* Sembol bir saattir işlem görmemiş ama yanıt az önce alınmış: elimizdeki
     veri güncel, hisse sessiz. İkisi ayrı şeyler. */
  const sessiz = pack(edt("2026-09-18", "09:20"), edt("2026-09-18", "10:29:55"));
  assert.equal(packCurrent(sessiz, status, 15, now), true);
});

test("beslemeden seans verisi beklenmeyen anlarda yaş sorulmaz", () => {
  // Cumartesi: anlatılan seans cuma, elde cuma kapanışı olması doğru olan.
  const cumartesi = edt("2026-09-19", "10:00");
  const status = getMarketStatus(cumartesi, HOLIDAYS);
  const cumaKapanis = pack(edt("2026-09-18", "16:00"), edt("2026-09-18", "16:30"));
  assert.equal(packCurrent(cumaKapanis, status, 900, cumartesi), true);
});

test("önceki seansın paketi seans içinde güncel değildir", () => {
  const now = edt("2026-09-18", "10:30");
  const status = getMarketStatus(now, HOLIDAYS);
  const dun = pack(edt("2026-09-17", "16:00"), edt("2026-09-18", "10:29:50"));
  assert.equal(packCurrent(dun, status, 15, now), false);
});
