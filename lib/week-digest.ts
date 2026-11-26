/**
 * HAFTANIN OKUMASI — "Bu Hafta Neden Hareket Etti" kartının Claude'suz,
 * deterministik özeti (26 Kasım 2026, sahibinin sözü: "sağ sol dengesine
 * dikkat ederek bu tasarımı iyileştirelim").
 *
 * Sorun: Claude notu gelmeyince (anahtar yok, not yazılamadı, pencere
 * tutmadı) kart tek cümleye düşüyor, hisse sayfasındaki Sor + Hafta
 * panelinde sağ kolonun altı ~250 piksel boş kalıyordu (canlı MU, 1440;
 * sol kolon karşılama + dört açılış kartıyla ~650). Bu modül aynı beş
 * seanstan (components/stock/week-move.ts → `WeekMove`; sunucunun
 * `completedDailyBars`ı) üç okuma çıkarır, yeni veri ya da sağlayıcı
 * çağrısı YOK:
 *
 *  - `loudest`: haftanın en sert seansı (mutlak değişimi en büyük) ve
 *    S&P 500'ün aynı günkü değişimi (seriler hizalıysa).
 *  - `volume`: hacmi 20 seans ortalamasının `LOUD_VOLUME_RATIO` katını
 *    aşan seans sayısı ve haftanın en yüksek hacim katı. Oran hiç yoksa
 *    (hacim tabanı boş) null: "0/5" yazmak hacmin düşük olduğunu iddia eder.
 *  - `market`: hissenin S&P 500'den iyi kapattığı seans sayısı ve en geniş
 *    günlük fark (puan, işaretli). Seriler hizalı değilse null.
 *  - `range`: beş kapanışın birikimli yolunun dibi ve zirvesi (başlangıç
 *    kapanışı 0 dahil) ve haftanın o aralığın neresinde kapandığı. Yol
 *    düzse (dip = zirve) null.
 *
 * Eksik okuma kartta yer bırakmaz (kutu hiç basılmaz); "–" duvarı yok.
 */

/** Hacmi 20 seans ortalamasının bu katını aşan seans "yüksek hacimli" (notla ve gün satırlarıyla aynı eşik). */
export const LOUD_VOLUME_RATIO = 1.5;
/** Kapanış aralığın alt/üst bu payındaysa "dibine/zirvesine yakın". */
const NEAR_EDGE = 0.2;

type Session = { date: string; changePct: number; volumeRatio: number | null };
type MarketSession = { date: string; changePct: number };

export type DigestInput = {
  sessions: readonly Session[];
  marketSessions: readonly MarketSession[] | null;
};

export type RangePoint = { /** Yolun bu noktası hangi seansın kapanışı; null = başlangıç kapanışı. */ date: string | null; pct: number };

export type WeekDigest = {
  loudest: { date: string; changePct: number; marketPct: number | null } | null;
  volume: { loud: number; total: number; peak: { date: string; ratio: number } } | null;
  market: { ahead: number; total: number; widest: { date: string; gapPts: number } } | null;
  range: { low: RangePoint; high: RangePoint; close: number; near: "low" | "mid" | "high" } | null;
};

/** Seriler aynı günleri anlatıyorsa S&P 500 adımları, değilse null. */
function alignedMarket(input: DigestInput): readonly MarketSession[] | null {
  const market = input.marketSessions;
  if (!market || market.length !== input.sessions.length) return null;
  return market.every((m, i) => m.date === input.sessions[i]!.date) ? market : null;
}

export function weekDigest(input: DigestInput): WeekDigest {
  const { sessions } = input;
  const market = alignedMarket(input);
  const valid = sessions.filter((s) => Number.isFinite(s.changePct));
  if (valid.length === 0 || valid.length !== sessions.length) return { loudest: null, volume: null, market: null, range: null };

  let loudestIndex = 0;
  sessions.forEach((s, i) => {
    if (Math.abs(s.changePct) > Math.abs(sessions[loudestIndex]!.changePct)) loudestIndex = i;
  });
  const loudestSession = sessions[loudestIndex]!;
  const loudest = { date: loudestSession.date, changePct: loudestSession.changePct, marketPct: market ? market[loudestIndex]!.changePct : null };

  const ratios = sessions.flatMap((s) => (s.volumeRatio !== null && Number.isFinite(s.volumeRatio) && s.volumeRatio > 0 ? [{ date: s.date, ratio: s.volumeRatio }] : []));
  const volume =
    ratios.length > 0
      ? {
          loud: ratios.filter((r) => r.ratio >= LOUD_VOLUME_RATIO).length,
          total: ratios.length,
          peak: ratios.reduce((best, r) => (r.ratio > best.ratio ? r : best)),
        }
      : null;

  let marketRead: WeekDigest["market"] = null;
  if (market) {
    const gaps = sessions.map((s, i) => ({ date: s.date, gapPts: s.changePct - market[i]!.changePct }));
    marketRead = {
      ahead: gaps.filter((g) => g.gapPts > 0).length,
      total: gaps.length,
      widest: gaps.reduce((best, g) => (Math.abs(g.gapPts) > Math.abs(best.gapPts) ? g : best)),
    };
  }

  /* Birikimli yol bileşik (week-move.ts → cumulativePath ile aynı hesap):
     +10 ve −10 sıfıra değil −1'e iner. */
  const path: RangePoint[] = [{ date: null, pct: 0 }];
  let level = 1;
  for (const s of sessions) {
    level *= 1 + s.changePct / 100;
    path.push({ date: s.date, pct: (level - 1) * 100 });
  }
  const low = path.reduce((best, p) => (p.pct < best.pct ? p : best));
  const high = path.reduce((best, p) => (p.pct > best.pct ? p : best));
  const close = path[path.length - 1]!.pct;
  const span = high.pct - low.pct;
  const range =
    span > 1e-9
      ? { low, high, close, near: (close - low.pct) / span <= NEAR_EDGE ? ("low" as const) : (high.pct - close) / span <= NEAR_EDGE ? ("high" as const) : ("mid" as const) }
      : null;

  return { loudest, volume, market: marketRead, range };
}

/** Aralık kulvarında bir değerin yeri (0–100, soldan): dip solda, zirve sağda. */
export function rangePosition(value: number, low: number, high: number): number {
  if (!(high > low)) return 50;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}
