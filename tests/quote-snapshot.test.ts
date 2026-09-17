import test from "node:test";
import assert from "node:assert/strict";
import { getSnapshots } from "../lib/providers/alpaca";

/**
 * Anlık görüntünün gün barı — bildirilen hatanın testi.
 *
 * Alpaca gün barını yeni seansa ancak seans ilerleyince çeviriyor. Açılış
 * öncesinde `dailyBar` DÜNKÜ seans oluyor ve bu bir kez yakalanmıştı: DEĞİŞİM
 * hesabı düzeltildi (gerekçesi `referenceClose` üzerinde). Aynı bardan gelen
 * açılış, en yüksek, en düşük ve HACİM düzeltilmeden kalmıştı — sabah
 * 05:41'de bu sabahın fiyatının yanında dünün gün hacmi "Hacim" diye
 * duruyordu.
 */

async function withFetch<T>(handler: typeof fetch, run: () => Promise<T>) {
  const previousFetch = globalThis.fetch;
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  globalThis.fetch = handler;
  process.env.ALPACA_API_KEY_ID = "fixture-key";
  process.env.ALPACA_API_SECRET_KEY = "fixture-secret";
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (key === undefined) delete process.env.ALPACA_API_KEY_ID;
    else process.env.ALPACA_API_KEY_ID = key;
    if (secret === undefined) delete process.env.ALPACA_API_SECRET_KEY;
    else process.env.ALPACA_API_SECRET_KEY = secret;
  }
}

/**
 * Fikstür tarihleri BUGÜNE GÖRE kuruluyor, sabit değil.
 *
 * `snapshotToQuote` son işlemin üstünden beş günden fazla geçmişse sembolü
 * "ölü" sayıp değişimi boşaltıyor. Sabit bir ağustos tarihi yazılınca bütün
 * senaryolar o dala düşüyor ve test aslında hiçbir şey ölçmüyordu.
 *
 * Saat 14:00Z seçildi: yazın 10:00, kışın 09:00 ET — ikisinde de aynı takvim
 * günü. Alpaca gün barlarını gece yarısı civarına damgalıyor ve o damga yaz
 * saatinde bir gün, kış saatinde başka bir gün okunabiliyor; testin ölçtüğü
 * şey DST değil.
 */
const etDay = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));

const at = (offsetDays: number) => `${etDay(offsetDays)}T14:00:00Z`;

const bar = (t: string, o: number, h: number, l: number, c: number, v: number) => ({
  t, o, h, l, c, v,
});

const snapshot = (payload: unknown) =>
  withFetch(
    async () => Response.json(payload),
    () => getSnapshots(["MRNA"], 15),
  );

test("açılış öncesinde gün barı DÜNÜN — alanları da dünün, o yüzden boş", async () => {
  /* Karar kaydındaki ölçümün şekli: fiyat bu sabahın ön seansından,
     gün barı DÜNKÜ seanstan, önceki gün barı ondan bir önceki gün. */
  const result = await snapshot({
    snapshots: {
      MRNA: {
        latestTrade: { p: 154.65, t: at(0) },
        dailyBar: bar(at(-1), 170.1, 176.4, 168.2, 174.38, 199_300_000),
        prevDailyBar: bar(at(-2), 61.2, 63.9, 60.8, 62.96, 88_000_000),
      },
    },
  });

  assert.ok(result.ok);
  const quote = result.data.MRNA;
  assert.equal(quote.price, 154.65);
  // Referans kapanış DÜNÜN kapanışı (174,38), önceki günün 62,96'sı değil.
  assert.equal(quote.prevClose, 174.38);
  assert.ok(quote.changePct !== null && quote.changePct < 0);
  assert.ok(Math.abs(quote.changePct! + 11.31) < 0.05);
  // Dünün gün barından gelen alanlar bu sabahı anlatmıyor.
  assert.equal(quote.open, null);
  assert.equal(quote.high, null);
  assert.equal(quote.low, null);
  assert.equal(quote.volume, null);
});

test("seans içinde gün barı bugünün — alanlar dolu", async () => {
  const result = await snapshot({
    snapshots: {
      MRNA: {
        latestTrade: { p: 158.4, t: at(0) },
        dailyBar: bar(at(0), 155.0, 159.2, 154.1, 158.4, 42_000_000),
        prevDailyBar: bar(at(-1), 170.1, 176.4, 168.2, 174.38, 199_300_000),
      },
    },
  });

  assert.ok(result.ok);
  const quote = result.data.MRNA;
  assert.equal(quote.prevClose, 174.38);
  assert.equal(quote.open, 155.0);
  assert.equal(quote.high, 159.2);
  assert.equal(quote.low, 154.1);
  assert.equal(quote.volume, 42_000_000);
});

test("ölü sembolün değişimi bilinmiyor, fiyatı duruyor", async () => {
  const result = await snapshot({
    snapshots: {
      MRNA: {
        latestTrade: { p: 0.42, t: "2021-03-04T15:41:00Z" },
        dailyBar: bar("2021-03-04T05:00:00Z", 0.5, 0.55, 0.4, 0.42, 12_000),
        prevDailyBar: bar("2021-03-03T05:00:00Z", 0.6, 0.62, 0.55, 0.58, 20_000),
      },
    },
  });

  assert.ok(result.ok);
  const quote = result.data.MRNA;
  assert.equal(quote.price, 0.42);
  assert.equal(quote.change, null);
  assert.equal(quote.changePct, null);
});
