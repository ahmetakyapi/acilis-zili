import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SESSION_BOUNDS, etParts, type MarketStatus } from "@/lib/market-hours";
import type { Bar, Quote } from "@/lib/providers/types";
import { displayZone, formatInZone, zoneTag } from "@/lib/session-clock";
import { hareketliOrtalama } from "@/lib/utils";

/**
 * Teknik analiz — on iki hissenin günde iki kez yazılan görüşü ve seviyeleri.
 *
 * İŞ BÖLÜMÜ KESİN. Sayılar SİTEDEN, yorum RUTİNDEN geliyor. Ortalamalar, RSI,
 * MACD, ATR, hacim, pivot ve grafikteki tepe/dipler bu dosyada, sitenin kendi
 * günlük barlarından hesaplanıyor; rutin (docs/claude-rutinler.md § 5) onları
 * bağlam ucundan okuyup üstüne görüş, alım bölgesi, hedef, stop ve senaryo
 * yazıyor. Tersi — göstergeyi de modelin yazması — aynı sayının sayfada iki
 * kaynaktan gelmesi demekti: rutinin "RSI 71" dediği yerin yanında sitenin
 * hesapladığı 68 duracaktı. Bilanço analizindeki "oran değil bölen" kuralının
 * aynı gerekçesi.
 *
 * Bu dosya SAF: veritabanına ve sağlayıcıya dokunmuyor, yalnızca bar ve
 * kotasyon alıyor. Okuma ve yazma `lib/technical-data.ts`te.
 */

/**
 * Takip edilen semboller — sayfanın ve rutinin TEK listesi.
 *
 * Sıra kullanıcının verdiği sıra; sayfa kartları bu sırayla basıyor. Liste
 * kısa ve adla seçilmiş: yarısı eşiğin çok üstünde (NVDA, GOOGL, META), yarısı
 * `lib/spotlight.ts`teki inşa katmanı adları (NBIS, BE, RKLB, ONDS). Yazma
 * ucu listede olmayan sembolü REDDEDİYOR — rutin bir adı kendiliğinden
 * ekleyemesin, liste burada büyüsün.
 *
 * GOOGL (A sınıfı) seçildi, GOOG değil: ikisi de kayıtlı ama yaygın olan bu.
 * SPCX 12 Haziran 2026'da halka arz oldu; 100 ve 200 günlük ortalaması bir
 * süre "—" kalacak (bkz. `hareketliOrtalama`).
 */
export const TECHNICAL_SYMBOLS = [
  "MU",
  "SNDK",
  "NVDA",
  "SPCX",
  "TSLA",
  "GOOGL",
  "META",
  "NBIS",
  "BE",
  "RKLB",
  "MRVL",
  "ONDS",
] as const;

export type TechnicalSymbol = (typeof TECHNICAL_SYMBOLS)[number];

const SYMBOL_SET: ReadonlySet<string> = new Set(TECHNICAL_SYMBOLS);

export function isTechnicalSymbol(value: string): value is TechnicalSymbol {
  return SYMBOL_SET.has(value);
}

/**
 * Günün iki analizi.
 *
 * `premarket` açılıştan ÖNCE yazılıyor: okuyucu seviyeleri zil çalmadan
 * görsün. `midsession` açılış oynaklığı durulduktan sonra: günün yönü
 * belirmiş, kapanışa hâlâ saatler var. Tam açılışta koşmak bilinçli olarak
 * seçilmedi — ilk dakikalar günün en gürültülü dakikaları ve fiyat 15
 * dakika gecikmeli geliyor, yani 16:30'da koşan bir rutin açılış öncesinin
 * fiyatını görürdü.
 */
export const TECHNICAL_SLOTS = ["premarket", "midsession"] as const;

export type TechnicalSlot = (typeof TECHNICAL_SLOTS)[number];

export function isTechnicalSlot(value: string | null | undefined): value is TechnicalSlot {
  return value === "premarket" || value === "midsession";
}

/**
 * Aynı gün içindeki sıra. SIRALAMA ALFABEYLE YAPILAMAZ: "midsession"
 * alfabede "premarket"ten önce geliyor, yani `order by slot desc` günün
 * İLK analizini son analiz diye verirdi.
 */
export const SLOT_RANK: Record<TechnicalSlot, number> = {
  premarket: 0,
  midsession: 1,
};

/**
 * Rutinin koştuğu an — UTC olarak.
 *
 * TÜRKİYE YAZ SAATİ UYGULAMIYOR, bu yüzden 15:45 ve 19:45 TR yıl boyu aynı
 * UTC anına denk geliyor ve cron sabit yazılabiliyor. Değişen New York
 * karşılığı: 15:45 TR yazın 08:45, kışın 07:45 NY. Ekrana yazılan saat bu UTC
 * anından o günün tarihiyle türetiliyor (`slotInstant`), sabit bir "08:45"
 * hiçbir yerde yok.
 *
 * İKİ YAYIN AYNI DAKİKADA: ikisi de :45. Böylece claude.ai'de iki ayrı görev
 * değil tek görev kuruluyor (`45 12,16 * * 1-5`) — mercek görevinin günde iki
 * koşusu da böyle. Seans içi yayın bu yüzden 19:45'te; açılış oynaklığı çoktan
 * durulmuş, kapanışa hâlâ saatler var (NY yazın 12:45, kışın 11:45).
 */
export const TECHNICAL_CRON = "45 12,16 * * 1-5";

export const SLOT_UTC: Record<TechnicalSlot, { hour: number; minute: number }> = {
  premarket: { hour: 12, minute: 45 },
  midsession: { hour: 16, minute: 45 },
};

/** O işlem gününde rutinin koştuğu an. */
export function slotInstant(sessionDate: string, slot: TechnicalSlot): Date {
  const [year, month, day] = sessionDate.split("-").map(Number);
  const { hour, minute } = SLOT_UTC[slot];
  return new Date(Date.UTC(year!, month! - 1, day!, hour, minute));
}

/**
 * Şu an hangi analizin sırası? Seans yoksa `null`.
 *
 * Ana seans açılmadıysa açılış öncesi, açıksa seans içi. Kapanıştan sonra
 * ikisi de değil: o saatte yazılan bir "seans içi" analizi olmayan bir
 * seansı anlatırdı. Tatil ve hafta sonu da `null`.
 */
export function currentSlot(status: MarketStatus): TechnicalSlot | null {
  if (!status.tradingToday) return null;
  if (status.session === "regular") return "midsession";
  if (status.session === "pre-market") return "premarket";
  // Gece yarısından ön seansa kadar durum "closed" ama gün henüz başlamadı.
  if (status.session === "closed" && status.etMinutes < SESSION_BOUNDS.preMarketOpen) {
    return "premarket";
  }
  return null;
}

/**
 * Rutinin dile göre yazdığı metin.
 *
 * Sayılar (görüş, seviyeler) dilden bağımsız ve satırda BİR KEZ duruyor;
 * yalnızca bu blok iki dilde. Gerekçesi `lib/schema.ts` → `technicalAnalyses`.
 */
export type TechnicalCopy = {
  /** Kartta ve kapakta duran 1-2 cümle. */
  headline: string;
  /** Değerlendirme paragrafı. */
  summary: string;
  /** Yükseliş senaryosu: hangi seviye aşılırsa ne olur. */
  bull: string;
  /** Düşüş senaryosu: hangi seviye kırılırsa ne olur. */
  bear: string;
  /** Hacmin ne söylediği. */
  volume: string;
  /** Dikkat edilecekler — tarih, veri, risk. */
  watch: string[];
  /** Seviyelerin nereden geldiği: "50 günlük ortalama ile önceki dip". */
  entryNote?: string | null;
  stopNote?: string | null;
  targetsNote?: string | null;
};

/* --------------------------------------------------------------------------
   Göstergeler
   -------------------------------------------------------------------------- */

export type Pivots = { p: number; r1: number; r2: number; s1: number; s2: number };

export type MacdReading = {
  macd: number;
  signal: number;
  histogram: number;
  /** Histogramın işaret değiştirdiği seanstan bu yana; son seans 0. */
  crossSessions: number | null;
};

export type MaCross = { kind: "golden" | "death"; sessions: number };

/**
 * Bir sembolün analiz anındaki teknik fotoğrafı.
 *
 * YAZMA ANINDA KAYDA GİRİYOR. Sayfa göstergeleri canlı hesaplasaydı ertesi
 * sabah, yeni analiz gelmeden önce, dünkü metin bugünün RSI'ının yanında
 * duracaktı — "RSI 71'e çıktı" diyen paragrafın yanında 64. Fotoğraf metnin
 * yazıldığı anın sayıları; canlı olan yalnızca fiyat ve o da "Şu An" diye
 * ayrıca yazılıyor.
 *
 * GÖSTERGELER TAMAMLANMIŞ SEANSLARDAN. Seans içinde günün barı henüz
 * kapanmamış; yarım bir günün kapanışıyla hesaplanan 50 günlük ortalama her
 * dakika oynar ve iki analiz arasında aynı ortalama iki farklı sayı olurdu.
 * Ortalamalar, RSI, MACD ve ATR son KAPANMIŞ seansta sabit; fiyata uzaklık
 * canlı fiyatla ölçülüyor.
 */
export type TechnicalSnapshot = {
  /** Fotoğrafın çekildiği an (ISO). */
  asOf: string;
  /** Hesabın dayandığı son tamamlanmış seans (ET), yoksa null. */
  lastSession: string | null;
  /** Kaç tamamlanmış seans var — ortalama penceresi dolmadıysa sebebi bu. */
  sessions: number;
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: MacdReading | null;
  atr14: number | null;
  avgVolume20: number | null;
  /** Son tamamlanmış seansın hacmi. */
  lastVolume: number | null;
  /** Ana seans açıkken bugünün şu ana kadarki hacmi; değilse null. */
  todayVolume: number | null;
  high52: number | null;
  low52: number | null;
  pivots: Pivots | null;
  /** Son 30 seansta 50 ile 200 günlük ortalamanın kesişmesi. */
  cross: MaCross | null;
  /** Fiyatın üstündeki en yakın grafik tepeleri (yakından uzağa). */
  swingHighs: number[];
  /** Fiyatın altındaki en yakın grafik dipleri (yakından uzağa). */
  swingLows: number[];
};

/** Fiyatlar iki, küçük fiyatlar dört ondalıkla saklanır — jsonb'de gürültü kalmasın. */
function roundPrice(value: number): number {
  const scale = Math.abs(value) >= 1 ? 100 : 10_000;
  return Math.round(value * scale) / scale;
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

const orNull = <T,>(value: T | null, map: (v: T) => number): number | null =>
  value === null ? null : map(value);

function barDate(bar: Bar): string {
  return etParts(new Date(bar.time * 1000)).dateStr;
}

/**
 * Tamamlanmış seansların barları.
 *
 * Günün barı ana seans kapanana kadar YARIM: sağlayıcı onu gün içinde
 * güncelliyor. Açılış öncesinde ve seans içinde son bar bugüne aitse
 * atılıyor; kapanıştan sonra o bar artık tam bir seans.
 */
export function completedBars(bars: readonly Bar[], status: MarketStatus): Bar[] {
  const last = bars.at(-1);
  if (!last) return [];
  const sessionRunning =
    status.tradingToday &&
    (status.session === "pre-market" || status.session === "regular");
  if (sessionRunning && barDate(last) === status.etDate) return bars.slice(0, -1);
  return [...bars];
}

/** Üssel ortalama serisi; `out[j]` ↔ `values[period - 1 + j]`. */
function emaSeries(values: readonly number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  const out = [prev];
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** MACD (12, 26, 9). 35 seanstan kısa geçmişte null. */
export function macdOf(closes: readonly number[]): MacdReading | null {
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  if (slow.length === 0) return null;
  // slow[j] ↔ closes[25 + j], fast[i] ↔ closes[11 + i] → aynı gün: i = j + 14
  const line = slow.map((value, j) => fast[j + 14]! - value);
  const signal = emaSeries(line, 9);
  if (signal.length === 0) return null;
  // signal[m] ↔ line[8 + m]
  const histogram = signal.map((value, m) => line[m + 8]! - value);

  let crossSessions: number | null = null;
  for (let i = histogram.length - 1; i > 0; i--) {
    if (Math.sign(histogram[i]!) !== Math.sign(histogram[i - 1]!)) {
      crossSessions = histogram.length - 1 - i;
      break;
    }
  }

  return {
    macd: line.at(-1)!,
    signal: signal.at(-1)!,
    histogram: histogram.at(-1)!,
    crossSessions,
  };
}

/** RSI (14), Wilder yumuşatması. 15 kapanıştan kısa geçmişte null. */
export function rsiOf(closes: readonly number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/** ATR (14), Wilder yumuşatması — günlük ortalama fiyat aralığı. */
export function atrOf(bars: readonly Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const ranges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const { high, low } = bars[i]!;
    const prevClose = bars[i - 1]!.close;
    ranges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  let atr = ranges.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < ranges.length; i++) {
    atr = (atr * (period - 1) + ranges[i]!) / period;
  }
  return atr;
}

/**
 * Klasik pivot — önceki seansın en yüksek, en düşük ve kapanışından.
 * Gün içi işlemcilerin ortak dili; seviye uydurmak değil, herkesin aynı
 * formülle aynı sayıyı bulduğu bir referans.
 */
export function pivotsOf(bar: Bar): Pivots {
  const p = (bar.high + bar.low + bar.close) / 3;
  const range = bar.high - bar.low;
  return {
    p,
    r1: 2 * p - bar.low,
    r2: p + range,
    s1: 2 * p - bar.high,
    s2: p - range,
  };
}

/**
 * 50 ile 200 günlük ortalamanın son kesişmesi — son 30 seans içinde.
 * Daha eskisi "yeni bir sinyal" değil, zaten fiyatlanmış bir durum.
 */
export function crossOf(closes: readonly number[], lookback = 30): MaCross | null {
  const n = closes.length;
  if (n < 201) return null;
  const diffAt = (end: number) => {
    const slice = closes.slice(0, end);
    const fast = hareketliOrtalama(slice, 50);
    const slow = hareketliOrtalama(slice, 200);
    return fast !== null && slow !== null ? fast - slow : null;
  };
  let later = diffAt(n);
  for (let back = 1; back <= lookback && n - back >= 200; back++) {
    const earlier = diffAt(n - back);
    if (earlier === null || later === null) return null;
    if (later !== 0 && Math.sign(earlier) !== Math.sign(later)) {
      return { kind: later > 0 ? "golden" : "death", sessions: back - 1 };
    }
    later = earlier;
  }
  return null;
}

/**
 * Grafikteki tepe ve dipler — fraktal: iki yanındaki `wing` barın hepsinden
 * yüksek (ya da düşük) olan bar. Rutine ADAY seviye olarak veriliyor;
 * birbirine %1,5'ten yakın olanlar tek seviye sayılıyor, yoksa aynı bölge
 * üç ayrı "direnç" gibi görünürdü.
 */
export function swingLevels(
  bars: readonly Bar[],
  price: number,
  { lookback = 120, wing = 3, count = 3 } = {},
): { highs: number[]; lows: number[] } {
  const slice = bars.slice(-lookback);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = wing; i < slice.length - wing; i++) {
    const bar = slice[i]!;
    let isHigh = true;
    let isLow = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j === i) continue;
      if (slice[j]!.high >= bar.high) isHigh = false;
      if (slice[j]!.low <= bar.low) isLow = false;
    }
    if (isHigh) highs.push(bar.high);
    if (isLow) lows.push(bar.low);
  }

  const cluster = (levels: number[]) => {
    const kept: number[] = [];
    for (const level of levels) {
      if (kept.every((k) => Math.abs(k - level) / k > 0.015)) kept.push(level);
      if (kept.length === count) break;
    }
    return kept.map(roundPrice);
  };

  return {
    highs: cluster(highs.filter((h) => h > price).sort((a, b) => a - b)),
    lows: cluster(lows.filter((l) => l < price).sort((a, b) => b - a)),
  };
}

/** Barlar + kotasyon → fotoğraf. Bar yoksa çağıran null kullanır. */
export function computeSnapshot(
  bars: readonly Bar[],
  quote: Quote | null,
  status: MarketStatus,
  now: Date = new Date(),
): TechnicalSnapshot {
  const done = completedBars(bars, status);
  const closes = done.map((bar) => bar.close);
  const last = done.at(-1) ?? null;
  /* FİYAT YALNIZCA CANLI KOTASYONDAN. Kotasyonda sembol yoksa fiyat sessizce
     dünkü kapanış oluyordu ve fotoğraf "analiz anında" diye onu taşıyordu:
     bağlam `data_ok: true` dönüyor, rutin eski bir fiyatın üstüne seviye
     yazıyordu. Fiyat yoksa null; bağlam o sembolü `data_ok: false` ile
     işaretliyor, prompt onu atlıyor, yazma ucu da reddediyor. */
  const price = quote?.price ?? null;
  const year = done.slice(-252);
  const volumes = done.slice(-20).map((bar) => bar.volume);
  const macd = macdOf(closes);
  const swings =
    price !== null ? swingLevels(done, price) : { highs: [], lows: [] };
  const pivots = last ? pivotsOf(last) : null;

  return {
    asOf: now.toISOString(),
    lastSession: last ? barDate(last) : null,
    sessions: closes.length,
    price: orNull(price, roundPrice),
    prevClose: orNull(quote?.prevClose ?? last?.close ?? null, roundPrice),
    changePct: orNull(quote?.changePct ?? null, (v) => roundTo(v, 2)),
    sma20: orNull(hareketliOrtalama(closes, 20), roundPrice),
    sma50: orNull(hareketliOrtalama(closes, 50), roundPrice),
    sma100: orNull(hareketliOrtalama(closes, 100), roundPrice),
    sma200: orNull(hareketliOrtalama(closes, 200), roundPrice),
    rsi14: orNull(rsiOf(closes), (v) => roundTo(v, 1)),
    macd: macd && {
      macd: roundTo(macd.macd, 3),
      signal: roundTo(macd.signal, 3),
      histogram: roundTo(macd.histogram, 3),
      crossSessions: macd.crossSessions,
    },
    atr14: orNull(atrOf(done), roundPrice),
    avgVolume20:
      volumes.length === 20
        ? Math.round(volumes.reduce((sum, v) => sum + v, 0) / 20)
        : null,
    lastVolume: last?.volume ?? null,
    todayVolume:
      status.tradingToday && status.session === "regular"
        ? (quote?.volume ?? null)
        : null,
    high52: year.length > 0 ? roundPrice(Math.max(...year.map((bar) => bar.high))) : null,
    low52: year.length > 0 ? roundPrice(Math.min(...year.map((bar) => bar.low))) : null,
    pivots: pivots && {
      p: roundPrice(pivots.p),
      r1: roundPrice(pivots.r1),
      r2: roundPrice(pivots.r2),
      s1: roundPrice(pivots.s1),
      s2: roundPrice(pivots.s2),
    },
    cross: crossOf(closes),
    swingHighs: swings.highs,
    swingLows: swings.lows,
  };
}

/* --------------------------------------------------------------------------
   Sunum yardımcıları — sayfa ve bağlam ucu aynı kuralı okusun
   -------------------------------------------------------------------------- */

/**
 * Panodaki en yeni yayın — tarih, sonra gün içi sıra (`SLOT_RANK`).
 *
 * Sıra alfabeyle yapılamaz: "midsession" alfabede "premarket"ten önce
 * geliyor. Liste sayfası ve ana sayfa paneli aynı künyeyi basıyor, hesap
 * tek yerde.
 */
export function newestEdition(
  entries: readonly { row: { sessionDate: string; slot: string } }[],
): { sessionDate: string; slot: string } | null {
  const rank = (row: { sessionDate: string; slot: string }) =>
    `${row.sessionDate}:${SLOT_RANK[row.slot as TechnicalSlot] ?? 0}`;
  let best: { sessionDate: string; slot: string } | null = null;
  for (const { row } of entries) {
    if (!best || rank(row) > rank(best)) best = row;
  }
  return best;
}

/** Detay sayfasının adresi — küçük harf, `analysisHref` ile aynı gerekçe. */
export function technicalHref(symbol: string): string {
  return `/teknik/${symbol.toLowerCase()}`;
}

export function slotLabel(slot: string, t: Dictionary): string {
  return slot === "midsession" ? t.technical.slotMidsession : t.technical.slotPremarket;
}

/**
 * Yayının saati, okuyucunun saatiyle ve künyesiyle: "19:45 TR" / "12:45 NY".
 * Kayıttan değil takvimden: rutin birkaç dakika geç koşsa da yayının adı
 * o saattir; gerçek yazılma anı `published_at`te duruyor.
 */
export function editionTime(sessionDate: string, slot: string, locale: Locale): string {
  const instant = slotInstant(sessionDate, isTechnicalSlot(slot) ? slot : "premarket");
  return `${formatInZone(instant, displayZone(locale))} ${zoneTag(locale).primary}`;
}

/** Görüş bir öncekinden farklıysa rozet metni, aynıysa null. */
export function stanceChangeLabel(
  current: VerdictKey,
  previous: VerdictKey | null,
  t: Dictionary,
): string | null {
  if (previous === null || previous === current) return null;
  return current === "buy"
    ? t.technical.changedToBuy
    : current === "sell"
      ? t.technical.changedToSell
      : t.technical.changedToHold;
}

/** Fiyatın bir seviyeye uzaklığı, yüzde; biri yoksa null. */
export function distancePct(price: number | null, level: number | null): number | null {
  if (price === null || level === null || level <= 0) return null;
  return ((price - level) / level) * 100;
}

export type PlanPosition =
  | { kind: "inZone" }
  | { kind: "above" | "below"; pct: number }
  | { kind: "belowStop" };

/**
 * Fiyatın plana göre yeri — kartın "şimdi nerede" okuması.
 *
 * Yalnızca alım bölgesi varken anlamlı: SAT'ta ve bölgesiz TUT'ta okunacak
 * bir alım planı yok, orada null. Uzaklık bölgenin YAKIN ucuna ölçülür:
 * fiyat üstteyse üst uca, alttaysa alt uca, çünkü okuyucunun sorusu "bölgeye
 * ne kadar var". Stopun altındaki fiyat "bölgenin altında" değil, planın
 * bozulduğu yer; ayrı söylenir.
 */
export function planPosition(
  price: number | null,
  entryLow: number | null,
  entryHigh: number | null,
  stop: number | null,
): PlanPosition | null {
  if (price === null || entryLow === null || entryHigh === null) return null;
  if (stop !== null && price < stop) return { kind: "belowStop" };
  if (price > entryHigh) return { kind: "above", pct: ((price - entryHigh) / entryHigh) * 100 };
  if (price < entryLow) return { kind: "below", pct: ((entryLow - price) / entryLow) * 100 };
  return { kind: "inZone" };
}

export type RsiZone = "overbought" | "oversold" | "neutral";

/** 70 ve 30 — göstergenin kendi tanımındaki eşikler, burada seçilmedi. */
export function rsiZone(rsi: number | null): RsiZone | null {
  if (rsi === null) return null;
  if (rsi >= 70) return "overbought";
  if (rsi <= 30) return "oversold";
  return "neutral";
}

export type LevelKind = "target" | "resistance" | "entry" | "support" | "stop";

export type Level = {
  kind: LevelKind;
  /** Bölgenin alt ucu ya da tek seviye. */
  price: number;
  /** Yalnızca alım bölgesinde: üst uç. */
  high?: number;
  /** Hedeflerde 1'den başlayan sıra. */
  order?: number;
};

type LevelSource = {
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[] | null;
  supports: readonly number[];
  resistances: readonly number[];
};

/** İki seviye aynı yer mi — %0,25'ten yakınsa tek satır basılır. */
const same = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) < 0.0025;

/**
 * Seviye merdiveni — yüksekten düşüğe.
 *
 * TEKRAR YOK. Rutin hedefi çoğu zaman bir dirence, stopu bir desteğin hemen
 * altına koyuyor; ikisi ayrı satır olarak basılınca merdivende aynı fiyat
 * iki kez duruyordu. Hedef ve stop ANLAMI taşıyan satır, o yüzden çakışan
 * direnç ve destek düşüyor; alım bölgesinin İÇİNE düşen destek de öyle.
 */
export function ladderOf(source: LevelSource): Level[] {
  const levels: Level[] = [];
  const targets = [...(source.targets ?? [])].sort((a, b) => a - b);
  targets.forEach((price, i) => levels.push({ kind: "target", price, order: i + 1 }));

  if (source.entryLow !== null && source.entryHigh !== null) {
    levels.push({ kind: "entry", price: source.entryLow, high: source.entryHigh });
  }
  if (source.stop !== null) levels.push({ kind: "stop", price: source.stop });

  const inEntry = (price: number) =>
    source.entryLow !== null &&
    source.entryHigh !== null &&
    price >= source.entryLow * 0.9975 &&
    price <= source.entryHigh * 1.0025;

  for (const price of source.resistances) {
    if (targets.some((t) => same(t, price))) continue;
    levels.push({ kind: "resistance", price });
  }
  for (const price of source.supports) {
    if (inEntry(price)) continue;
    if (source.stop !== null && same(source.stop, price)) continue;
    levels.push({ kind: "support", price });
  }

  return levels.sort((a, b) => (b.high ?? b.price) - (a.high ?? a.price));
}
