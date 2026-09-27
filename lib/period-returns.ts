import type { Bar } from "@/lib/providers/types";

/**
 * Dönem getirileri — günlük bar kapanışlarından, saf fonksiyon.
 *
 * Sektör ve emtia panelleri (/piyasalar) aynı soruyu soruyor: "bu fon son
 * bir haftada, ayda, üç ayda ve yılbaşından beri ne yaptı". Hesap TEK yerde,
 * çünkü iki panel yan yana duruyor ve biri 21, öteki 22 işlem günü sayarsa
 * aynı "1A" başlığı altında iki ayrı ölçü okunurdu.
 *
 * DÖNEM TAKVİM GÜNÜ DEĞİL İŞLEM GÜNÜ. "1 ay" 30 takvim günü diye
 * hesaplansaydı başlangıç bir hafta sonuna ya da tatile düşebiliyor ve bar
 * aramak gerekiyordu; işlem günü sayısı barların kendisinde. Kabuller
 * piyasa dilinin yaygın olanları: hafta 5, ay 21, çeyrek 63 işlem günü.
 *
 * YETERLİ BAR YOKSA NULL. `getPeriodChanges` (lib/providers/alpaca.ts)
 * eldeki en eski barı kullanıp "daha dar bir dönem" döndürüyor; orada
 * kolon başlığı "5 gün" iddiası taşımıyor. Burada taşıyor: "3A" başlığı
 * altındaki sayı iki aylık bir getiri olamaz.
 *
 * Getiriler FİYAT getirisi: barlar yalnızca bölünmeye göre düzeltilmiş
 * (`adjustment: "split"`), temettü dahil değil. Panelin künyesi bunu yazar.
 */

export const PERIOD_SESSIONS = { w1: 5, m1: 21, m3: 63 } as const;

export type PeriodReturns = {
  w1: number | null;
  m1: number | null;
  m3: number | null;
  ytd: number | null;
  /** Son barın ET günü — getirinin hangi kapanışa kadar hesaplandığı. */
  lastDate: string | null;
};

const MS_PER_SECOND = 1000;

/**
 * Günlük barın ET günü.
 *
 * Alpaca günlük barı gün başının UTC karşılığıyla damgalıyor (04:00Z yazın,
 * 05:00Z kışın = 00:00 ET); UTC günü de ET günü de aynı tarihi veriyor.
 * `etParts` yerine düz dilim: bu dosya saf kalsın, testte saat dilimi
 * tablosu gerekmesin.
 */
export function barDate(bar: Pick<Bar, "time">): string {
  return new Date(bar.time * MS_PER_SECOND).toISOString().slice(0, 10);
}

export function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;
  return ((to - from) / from) * 100;
}

export function periodReturns(bars: readonly Bar[]): PeriodReturns {
  const last = bars.at(-1);
  if (!last) return { w1: null, m1: null, m3: null, ytd: null, lastDate: null };
  const lastIndex = bars.length - 1;
  const back = (sessions: number) => {
    const base = bars[lastIndex - sessions];
    return lastIndex - sessions >= 0 && base ? pctChange(base.close, last.close) : null;
  };
  const lastDate = barDate(last);
  /* YBB tabanı ÖNCEKİ YILIN SON KAPANIŞI, yeni yılın ilk barı değil:
     yılın ilk seansındaki hareket de yılbaşından beri getirinin parçası. */
  const yearStart = `${lastDate.slice(0, 4)}-01-01`;
  let yearBase: Bar | undefined;
  for (let index = lastIndex; index >= 0; index--) {
    if (barDate(bars[index]) < yearStart) {
      yearBase = bars[index];
      break;
    }
  }
  return {
    w1: back(PERIOD_SESSIONS.w1),
    m1: back(PERIOD_SESSIONS.m1),
    m3: back(PERIOD_SESSIONS.m3),
    ytd: yearBase ? pctChange(yearBase.close, last.close) : null,
    lastDate,
  };
}
