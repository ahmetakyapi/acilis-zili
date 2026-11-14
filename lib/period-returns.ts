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

/**
 * YBB sütununun ÇİZGİSİ (10 Kasım 2026, emtia panosu): yılbaşından bugüne
 * günlük kapanışlar, tabanıyla birlikte. Kural `periodReturns`ın YBB'siyle
 * AYNI — taban önceki yılın son kapanışı ve çizgi o noktadan başlar; taban
 * bar yoksa (seri yıl içinde başlıyorsa) yüzde gibi çizgi de `null`. Aynı
 * hücrede duran sayı ile çizgi böylece aynı iki ucu anlatır.
 */
/**
 * Mini çizginin noktalarını ÇİZİM GENİŞLİĞİNE göre seyreltir (14 Kasım 2026,
 * performans denetimi). `/piyasalar`daki emtia ETF'lerinin YBB çizgisi ~220
 * günlük kapanış taşıyordu ve 120 birimlik kutuda (ekranda 72–185 piksel)
 * çiziliyordu: noktalar piksel altıydı, her biri üç kez (çizgi + iki dolgu
 * poligonu) HTML'e ve RSC'ye yazılıyordu — on beş çizgi 68 KB işaretleme +
 * 100 KB RSC.
 *
 * Kova başına EN DÜŞÜK ve EN YÜKSEK nokta kalır (`width / 2` kova), iki uç
 * her zaman kalır: tepe ve dip (yılın zirvesi/dibi) asla düşmez, son nokta
 * başlıktaki YBB yüzdesiyle aynı kapanış olarak kalır. Noktalar özgün
 * SIRALARIYLA döner: çizimin x ekseni sıraya göre kurulduğu için
 * (`Sparkline`, `domain` = [0, n − 1]) kalan her nokta eski yerinde durur,
 * yalnız aralarındaki piksel altı kırıklar düşer. Kısa seri olduğu gibi
 * döner. Ölçüm (sahte sağlayıcı, 220 nokta, 60 kova → ~122 nokta): kalan
 * çizginin özgün noktalara uzaklığı ortalama 0,16, en kötü 2,2 piksel
 * (en geniş çizimde, 185 piksel; 1440'ta 88 piksel).
 */
export function thinSeries<T extends { value: number }>(
  points: readonly T[],
  width: number,
): { points: (T & { index: number })[]; domain: [number, number] } {
  const n = points.length;
  const buckets = Math.max(1, Math.floor(width / 2));
  const all = () => points.map((point, index) => ({ ...point, index }));
  if (n <= buckets * 2 + 2) return { points: all(), domain: [0, Math.max(1, n - 1)] };
  const keep = new Set([0, n - 1]);
  const span = (n - 2) / buckets;
  for (let b = 0; b < buckets; b++) {
    const lo = 1 + Math.floor(b * span);
    const hi = Math.min(n - 1, 1 + Math.floor((b + 1) * span));
    if (hi <= lo) continue;
    let low = lo;
    let high = lo;
    for (let i = lo; i < hi; i++) {
      if (points[i].value < points[low].value) low = i;
      if (points[i].value > points[high].value) high = i;
    }
    keep.add(low);
    keep.add(high);
  }
  return {
    points: [...keep].sort((a, b) => a - b).map((index) => ({ ...points[index], index })),
    domain: [0, n - 1],
  };
}

export function ytdSeries(bars: readonly Bar[]): { base: number; points: { time: number; value: number }[] } | null {
  const last = bars.at(-1);
  if (!last) return null;
  const yearStart = `${barDate(last).slice(0, 4)}-01-01`;
  for (let index = bars.length - 1; index >= 0; index--) {
    if (barDate(bars[index]) < yearStart) {
      const points = bars.slice(index).map((bar) => ({ time: bar.time, value: bar.close }));
      return points.length > 1 && bars[index].close > 0 ? { base: bars[index].close, points } : null;
    }
  }
  return null;
}
