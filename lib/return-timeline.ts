/**
 * "ALIŞTAN BUGÜNE" — portföyün ve aynı günlerde SPY'ın zaman içindeki
 * getirisi (25 Ekim). SAF çekirdek: veritabanı ve sağlayıcı yok, test
 * `tests/personal-visuals.test.ts` ("Alıştan Bugüne" bölümü); veriyi
 * `lib/return-timeline-data.ts` toplar.
 *
 * HESAP, VİTRİNİN "Doğrulanmış Getiri"siyle AYNI FORMÜL
 * (`lib/profile-showcase.ts`): bir gün için portföy getirisi =
 *   Σ (o güne kadar alınmış partilerin adedi × o günün kapanışı)
 *   ÷ Σ (aynı partilerin maliyeti) − 1.
 * SPY: her parti alış AYININ ilk SPY kapanışından aynı tutarla alınmış
 * sayılır (taban `spyBase`, gün `spyAnchorDay`, vitrinle aynı
 * `closeOnOrAfter`; gerekçe `spyAnchorDay`ta). Son nokta
 * GRAFİKTEN değil KOTASYONDAN: başlıktaki sayı ile çizginin ucu aynı
 * kaynaktan (CLAUDE.md veri dürüstlüğü 3), yani çizgi tam o sayıda biter.
 *
 * Ne YOK: tutar. Çıktı yalnız yüzde ve gün; profilde gün de aya iner
 * (`profilePoints`).
 */

export type DayClose = { day: string; close: number };

export type TimelineLot = {
  symbol: string;
  quantity: number;
  /** Hisse başı alış fiyatı, dolar. */
  costUsd: number;
  /** "YYYY-MM-DD" */
  boughtAt: string;
  /** Alış ayının ilk SPY kapanışı (`spyAnchorDay`); bulunamadıysa null (parti SPY kıyasına girmez). */
  spyBase: number | null;
};

export type TimelinePoint = {
  /** "YYYY-MM-DD"; son nokta bugünün günü. */
  day: string;
  /** Portföyün maliyete göre getirisi, yüzde. */
  portfolio: number;
  /** Aynı partiler SPY'a yatırılsaydı, yüzde; o gün kıyasa giren parti yoksa null. */
  spy: number | null;
};

export type Timeline = {
  points: TimelinePoint[];
  /** Fiyatı ya da geçmişi olmadığı için grafiğe hiç girmeyen parti sayısı. */
  missing: number;
};

/** Seride `day` gününe kadarki (dahil) son kapanış — sıralı seride ileri giden imleçle. */
function cursorOf(series: readonly DayClose[]) {
  let i = -1;
  return (day: string): number | null => {
    while (i + 1 < series.length && series[i + 1].day <= day) i += 1;
    return i >= 0 ? series[i].close : null;
  };
}

export function buildReturnTimeline({
  lots,
  series,
  spy,
  prices,
  spyPrice,
  today,
}: {
  lots: readonly TimelineLot[];
  /** Sembol başına günlük (ya da haftalık) kapanış, artan gün sırasıyla. */
  series: Readonly<Record<string, readonly DayClose[]>>;
  spy: readonly DayClose[];
  /** Bugünün kotasyonu — son nokta. */
  prices: Readonly<Record<string, number | null | undefined>>;
  spyPrice: number | null;
  /** Bugünün ET günü; bu güne ait (yarım) bar atılır, yerine kotasyon gelir. */
  today: string;
}): Timeline {
  const included = lots.filter((lot) => {
    const price = prices[lot.symbol];
    return (
      typeof price === "number" &&
      price > 0 &&
      lot.quantity > 0 &&
      lot.costUsd > 0 &&
      (series[lot.symbol]?.length ?? 0) > 0
    );
  });
  const missing = lots.length - included.length;
  if (included.length === 0) return { points: [], missing };

  const since = included.reduce((min, lot) => (lot.boughtAt < min ? lot.boughtAt : min), included[0].boughtAt);
  const daySet = new Set<string>();
  for (const bar of spy) if (bar.day >= since && bar.day < today) daySet.add(bar.day);
  for (const lot of included) {
    for (const bar of series[lot.symbol]) if (bar.day >= since && bar.day < today) daySet.add(bar.day);
  }
  const days = [...daySet].sort();

  const cursors = new Map<string, (day: string) => number | null>();
  for (const lot of included) if (!cursors.has(lot.symbol)) cursors.set(lot.symbol, cursorOf(series[lot.symbol]));
  const spyAt = cursorOf(spy);

  const points: TimelinePoint[] = [];
  for (const day of days) {
    /* İmleçler ileri gidiyor: her sembolün o günkü kapanışı tek geçişte. */
    const closes = new Map<string, number | null>();
    for (const [symbol, at] of cursors) closes.set(symbol, at(day));
    const spyClose = spyAt(day);

    let value = 0;
    let cost = 0;
    let spyValue = 0;
    let spyCost = 0;
    for (const lot of included) {
      if (lot.boughtAt > day) continue;
      const close = closes.get(lot.symbol);
      /* Seri o güne inmiyor (alış serinin başından eski): parti o gün
         hesapta yok — uydurma geçmiş üretilmez. */
      if (close === null || close === undefined) continue;
      const lotCost = lot.quantity * lot.costUsd;
      value += lot.quantity * close;
      cost += lotCost;
      if (lot.spyBase !== null && lot.spyBase > 0 && spyClose !== null) {
        spyValue += (lotCost / lot.spyBase) * spyClose;
        spyCost += lotCost;
      }
    }
    if (cost <= 0) continue;
    points.push({
      day,
      portfolio: (value / cost - 1) * 100,
      spy: spyCost > 0 ? (spyValue / spyCost - 1) * 100 : null,
    });
  }

  /* SON NOKTA: kotasyonla, bütün partiler — vitrin/Getiri paneliyle aynı. */
  let value = 0;
  let cost = 0;
  let spyValue = 0;
  let spyCost = 0;
  for (const lot of included) {
    const lotCost = lot.quantity * lot.costUsd;
    value += lot.quantity * (prices[lot.symbol] as number);
    cost += lotCost;
    if (lot.spyBase !== null && lot.spyBase > 0 && spyPrice !== null && spyPrice > 0) {
      spyValue += (lotCost / lot.spyBase) * spyPrice;
      spyCost += lotCost;
    }
  }
  points.push({
    day: today,
    portfolio: (value / cost - 1) * 100,
    spy: spyCost > 0 ? (spyValue / spyCost - 1) * 100 : null,
  });

  return { points, missing };
}

/**
 * Eksen etiketleri: ilk nokta, son nokta ve aradaki ay başları; en fazla
 * `max` etiket (dar ekranda üst üste binmesin). Ay değişimi "YYYY-MM"
 * önekinden okunur, saat dilimi hesabı yok.
 */
export function monthTicks(days: readonly string[], max = 6): number[] {
  if (days.length === 0) return [];
  const starts: number[] = [];
  for (let i = 1; i < days.length; i += 1) {
    if (days[i].slice(0, 7) !== days[i - 1].slice(0, 7)) starts.push(i);
  }
  const inner = Math.max(0, max - 2);
  const step = Math.max(1, Math.ceil(starts.length / Math.max(1, inner)));
  const picked = starts.filter((_, i) => i % step === 0).slice(0, inner);
  /* Uçlara çok yakın ay başı atılır: iki etiket üst üste biniyordu. */
  const gap = Math.max(2, Math.round(days.length * 0.08));
  const middle = picked.filter((i) => i >= gap && i <= days.length - 1 - gap);
  return [...new Set([0, ...middle, days.length - 1])];
}

/** Bir ondalıkla yazıldığında "0,0" görünen fark eşit sayılır. */
const EVEN_GAP = 0.05;

/**
 * Tepe cümlesinin yönü: A (portföy, tema medyanı) ölçütün önünde mi.
 * Ölçüt yoksa "none" — cümle kıyassız kurulur, fark uydurulmaz.
 */
export function gapVerdict(a: number, b: number | null): "ahead" | "behind" | "even" | "none" {
  if (b === null || !Number.isFinite(b) || !Number.isFinite(a)) return "none";
  const diff = a - b;
  if (Math.abs(diff) < EVEN_GAP) return "even";
  return diff > 0 ? "ahead" : "behind";
}

/**
 * SPY TABANININ GÜNÜ: alışın AYININ ilk günü (25 Ekim, gizlilik düzeltmesi).
 *
 * Taban eskiden alış GÜNÜNÜN kapanışıydı. SPY kapanışları herkese açık;
 * profildeki SPY yüzdesi (vitrin ve çizgi) bir ondalıkla bile tabanı
 * `spyClose / (1 + b)` ile geri veriyordu ve SPY'ın günlük oynaklığı o
 * kapanışı TEK bir güne bağlıyordu — KVKK metninin "gün bazında alış tarihi
 * hiçbir durumda gösterilmez" sözü yalnız etikette tutuyordu. Ayın ilk
 * kapanışı o aydaki her alış için aynı sayı: geri hesaplanan taban yalnız
 * ayı söyler, ay zaten "Başlangıç" künyesinde açık.
 *
 * TEK HESAP: vitrin (`loadShowcase`), Zil Raporu, /portfoy ve profilin
 * "Alıştan Bugüne" çizgisi aynı tabanı alır; aynı SPY sayısı iki ekranda
 * iki ayrı değer olmasın (CLAUDE.md veri dürüstlüğü 3). Bedeli: kıyas
 * "aynı günlerde" değil "aynı aylarda aynı tutar" — künyeler öyle yazar.
 */
export function spyAnchorDay(boughtAt: string): string {
  return `${boughtAt.slice(0, 7)}-01`;
}

/** Profile giden yüzdelerin ondalığı — sunucuda yuvarlanır, istemciye ham sayı inmez. */
const PROFILE_DIGITS = 1;
const roundTo = (value: number, digits: number) => {
  const scale = 10 ** digits;
  /* `+ 0`: −0,04 yuvarlanınca −0 olur ve "−%0,0" diye basılırdı. */
  return Math.round(value * scale) / scale + 0;
};

/**
 * PROFİL NOKTALARI — aylık seyreltme + yuvarlama (25 Ekim).
 *
 * Her TAMAMLANMIŞ takvim ayının son noktası kalır, son nokta (kotasyon)
 * her zaman kalır; içinde bulunulan ayın ara noktaları atılır. İlk nokta
 * böylece alış ayının sonudur. Değerler bir ondalığa yuvarlanır.
 *
 * Neden: önceki haftalık seyreltmede istemciye giden ham yüzdeler ve
 * nokta basamakları alış HAFTASINI (çok partilide her partinin haftasını)
 * veriyordu. Ay sonu noktasında o ay alınan her parti zaten içeride:
 * alışın günü ya da haftası çıktıyı değiştirmez (test:
 * tests/personal-visuals.test.ts → "profil noktaları alış gününden
 * bağımsız"). İçinde bulunulan ay da atılır, yoksa "dün mü bugün mü
 * alındı" ayrımı son ara noktadan okunurdu.
 */
export function profilePoints(points: readonly TimelinePoint[]): TimelinePoint[] {
  if (points.length === 0) return [];
  const last = points[points.length - 1];
  const currentMonth = last.day.slice(0, 7);
  const body = points.slice(0, -1).filter((point) => point.day.slice(0, 7) !== currentMonth);
  const kept = body.filter((point, i) => {
    const next = body[i + 1];
    return !next || next.day.slice(0, 7) !== point.day.slice(0, 7);
  });
  return [...kept, last].map((point) => ({
    day: point.day,
    portfolio: roundTo(point.portfolio, PROFILE_DIGITS),
    spy: point.spy === null ? null : roundTo(point.spy, PROFILE_DIGITS),
  }));
}
