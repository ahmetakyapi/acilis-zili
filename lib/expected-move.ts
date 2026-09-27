/**
 * Bilanço etrafındaki fiyat hareketi — geçmişte ne oldu, opsiyonlar ne
 * fiyatlıyor. Saf hesaplar; veri katmanı `lib/expected-move-data.ts`.
 *
 * İKİ AYRI SAYI, İKİ AYRI KAYNAK ve ikisi de yan yana durunca karışmamalı:
 *
 *   Geçmiş hareket — şirketin önceki raporlarının ertesinde hissenin
 *   GERÇEKTEN ne kadar oynadığı. Günlük kapanışlardan ölçülüyor.
 *
 *   Beklenen hareket — opsiyon piyasasının bir sonraki rapor için
 *   FİYATLADIĞI hareket: rapor gününü kapsayan en yakın vadede başa baş
 *   alım ve satım opsiyonlarının orta fiyatları toplamı (straddle) bölü
 *   hisse fiyatı. Piyasada yaygın kullanılan kaba ölçü; vadeye kadar olan
 *   TÜM hareketi fiyatlıyor, yalnızca bilançoyu değil, ekranda bu da yazılı.
 */

/** Sonraki rapor bu kadar gün içindeyse panel açılıyor. */
export const EXPECTED_MOVE_HORIZON_DAYS = 21;

/** Geçmiş tabloda en fazla kaç rapor — iki yıl. */
export const HISTORY_LIMIT = 8;

/**
 * Ortalama için gereken en az ölçüm. Tek raporun "ortalaması" o raporun
 * kendisi; ortalama diye yazmak bir örneği kurala çevirirdi.
 */
export const MIN_MOVES_FOR_AVERAGE = 2;

/**
 * Bir bacağın alış-satış aralığı orta fiyatın en fazla bu oranı olabilir.
 *
 * Gösterge besleme (indicative) OPRA değil, türetilmiş bir kotasyon; likit
 * olmayan kontratta aralık orta fiyatın yarısını aşabiliyor ve "orta fiyat"
 * o zaman bir tahmin bile değil. Ölçüldü (25 Eylül kapanışı): NVDA'nın
 * 20 Kasım vadesinde başa baş kontratlarda aralık %0,3–4,3. %15 likit
 * isimleri rahat geçiriyor, aralığı fiyatın yarısı olan kontratı eliyor.
 */
export const MAX_LEG_SPREAD = 0.15;

/**
 * Kotasyonun en fazla yaşı. Opsiyonlar yalnızca ana seansta işlem görüyor:
 * pazartesi sabahı elimizdeki kotasyon cuma kapanışınındır (~62 saat) ve
 * doğru olan da o. Uzun bir hafta sonu + tatil 96 saate sığıyor; daha
 * eskisi başka bir haftanın fiyatı.
 */
export const MAX_QUOTE_AGE_MS = 96 * 60 * 60 * 1000;

/**
 * Başa baş sayılabilecek en uzak kullanım fiyatı (spot'a oranla). Zincirde
 * spota yakın kontrat yoksa uzak bir kontratın straddle'ı başka bir şeyi
 * ölçer; o zaman sayı hiç yazılmıyor.
 */
export const ATM_MAX_DISTANCE = 0.05;

export type ReportTiming = "bmo" | "amc" | "dmh" | null;

export type ReportEvent = { date: string; timing: ReportTiming };

/** ET günü + o günün kapanışı, eskiden yeniye. */
export type DailyClose = { date: string; close: number };

export type HistoricalMove = {
  date: string;
  timing: ReportTiming;
  /** Yüzde; ölçülemediyse null ve sebebi `reason`da. */
  movePct: number | null;
  reason: "timing-unknown" | "bars-missing" | null;
};

export function normalizeTiming(value: string | null | undefined): ReportTiming {
  const v = value?.trim().toLowerCase();
  return v === "bmo" || v === "amc" || v === "dmh" ? v : null;
}

/**
 * Rapor başına hareket.
 *
 * Açılış öncesi (bmo): önceki kapanıştan rapor gününün kapanışına — haber
 * açılıştan önce geldi, ilk fiyatlandığı seans rapor günü.
 * Kapanış sonrası (amc): rapor gününün kapanışından ertesi seansın
 * kapanışına — haber kapanıştan sonra geldi, ilk tam seans ertesi gün.
 * Seans içi ya da saat bilinmiyor: hangi iki kapanışın arasına düştüğünü
 * bilmiyoruz; iki kapanış seçip "bilanço hareketi" demek uydurma kesinlik
 * olurdu. Satır kalıyor ama sayısız ve ortalamaya girmiyor.
 *
 * Rapor günü bir işlem günü değilse (takvim hatası, hafta sonu) ölçülmez.
 */
export function historicalMoves(
  events: readonly ReportEvent[],
  closes: readonly DailyClose[],
  today: string,
  limit = HISTORY_LIMIT,
): HistoricalMove[] {
  const index = new Map(closes.map((bar, i) => [bar.date, i]));
  const byDate = new Map<string, ReportEvent>();
  for (const event of events) {
    if (event.date >= today) continue;
    const held = byDate.get(event.date);
    /* Aynı gün iki kaynaktan geliyorsa saati bilinen kazanır. */
    if (!held || (held.timing === null && event.timing !== null)) byDate.set(event.date, event);
  }
  return [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((event) => {
      if (event.timing !== "bmo" && event.timing !== "amc") {
        return { ...event, movePct: null, reason: "timing-unknown" as const };
      }
      const i = index.get(event.date);
      const from = i === undefined ? undefined : event.timing === "bmo" ? closes[i - 1] : closes[i];
      const to = i === undefined ? undefined : event.timing === "bmo" ? closes[i] : closes[i + 1];
      if (!from || !to || !(from.close > 0)) {
        return { ...event, movePct: null, reason: "bars-missing" as const };
      }
      return { ...event, movePct: ((to.close - from.close) / from.close) * 100, reason: null };
    });
}

/** Mutlak hareketlerin ortalaması; yeterli ölçüm yoksa null. */
export function averageAbsMove(moves: readonly HistoricalMove[]): { avg: number; count: number } | null {
  const measured = moves.map((m) => m.movePct).filter((v): v is number => v !== null);
  if (measured.length < MIN_MOVES_FOR_AVERAGE) return null;
  return {
    avg: measured.reduce((sum, v) => sum + Math.abs(v), 0) / measured.length,
    count: measured.length,
  };
}

/* --------------------------------------------------------------------------
   Opsiyonlar
   -------------------------------------------------------------------------- */

export type OccParts = { root: string; expiry: string; type: "C" | "P"; strike: number };

/** OCC sembolü: KÖK + YYMMDD + C/P + kullanım fiyatı × 1000 (8 hane). */
export function parseOcc(symbol: string): OccParts | null {
  const match = /^([A-Z.]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(symbol);
  if (!match) return null;
  const [, root, yy, mm, dd, type, strike] = match;
  return {
    root: root!,
    expiry: `20${yy}-${mm}-${dd}`,
    type: type as "C" | "P",
    strike: Number(strike) / 1000,
  };
}

export type OptionQuote = {
  expiry: string;
  type: "C" | "P";
  strike: number;
  bid: number;
  ask: number;
  /** Kotasyon anı (ISO). */
  at: string;
};

/**
 * Raporu KAPSAYAN ilk vade. Kapanış sonrası raporda rapor günü sona eren
 * vade haberi hiç görmüyor (kontrat o akşam bitiyor), o yüzden vade rapor
 * gününden SONRA olmalı. Açılış öncesinde aynı gün yetiyor. Saat
 * bilinmiyorsa temkinli taraf: sonrası.
 */
export function pickExpiry(expiries: readonly string[], reportDate: string, timing: ReportTiming): string | null {
  const sorted = [...new Set(expiries)].sort();
  return sorted.find((expiry) => (timing === "bmo" ? expiry >= reportDate : expiry > reportDate)) ?? null;
}

export type ImpliedMove =
  | {
      ok: true;
      expiry: string;
      strike: number;
      callMid: number;
      putMid: number;
      straddle: number;
      /** Straddle ÷ spot, yüzde. */
      pct: number;
      /** İki bacağın daha eski kotasyon anı. */
      quotedAt: string;
    }
  | { ok: false; reason: "no-expiry" | "no-atm" | "wide-spread" | "stale" | "bad-spot" };

const mid = (q: OptionQuote) => (q.bid + q.ask) / 2;
const spreadRatio = (q: OptionQuote) => (q.ask - q.bid) / mid(q);

/**
 * Beklenen hareket — gerekçe ve eşikler dosyanın başında.
 *
 * Başa baş kontrat TEK: spota en yakın, iki bacağı da kotasyonlu kullanım
 * fiyatı. Aralığı geniş çıkarsa başka bir kullanım fiyatı ARANMIYOR — o
 * zaman "geçen ilk kontrat" seçilmiş olur ve sayı seçimin sonucuna döner.
 * Sayı gösterilmiyor, sebebi söyleniyor.
 */
export function impliedMove({
  quotes,
  spot,
  reportDate,
  timing,
  now,
}: {
  quotes: readonly OptionQuote[];
  spot: number | null;
  reportDate: string;
  timing: ReportTiming;
  now: Date;
}): ImpliedMove {
  if (spot === null || !(spot > 0)) return { ok: false, reason: "bad-spot" };
  const usable = quotes.filter((q) => q.bid > 0 && q.ask >= q.bid);
  const expiry = pickExpiry(usable.map((q) => q.expiry), reportDate, timing);
  if (!expiry) return { ok: false, reason: "no-expiry" };

  const calls = new Map<number, OptionQuote>();
  const puts = new Map<number, OptionQuote>();
  for (const q of usable) {
    if (q.expiry !== expiry) continue;
    (q.type === "C" ? calls : puts).set(q.strike, q);
  }
  const strikes = [...calls.keys()].filter((k) => puts.has(k));
  if (strikes.length === 0) return { ok: false, reason: "no-atm" };
  const strike = strikes.reduce((best, k) =>
    Math.abs(k - spot) < Math.abs(best - spot) || (Math.abs(k - spot) === Math.abs(best - spot) && k < best) ? k : best,
  );
  if (Math.abs(strike - spot) / spot > ATM_MAX_DISTANCE) return { ok: false, reason: "no-atm" };

  const call = calls.get(strike)!;
  const put = puts.get(strike)!;
  if (spreadRatio(call) > MAX_LEG_SPREAD || spreadRatio(put) > MAX_LEG_SPREAD) {
    return { ok: false, reason: "wide-spread" };
  }
  const oldest = [call.at, put.at].sort()[0]!;
  const age = now.getTime() - Date.parse(oldest);
  if (!Number.isFinite(age) || age > MAX_QUOTE_AGE_MS) return { ok: false, reason: "stale" };

  const straddle = mid(call) + mid(put);
  return {
    ok: true,
    expiry,
    strike,
    callMid: mid(call),
    putMid: mid(put),
    straddle,
    pct: (straddle / spot) * 100,
    quotedAt: oldest,
  };
}
