/**
 * TL PERSPEKTİFİ — kur yolu ve dönüşüm hesabının SAF katmanı.
 *
 * NEDEN AYRI BİR DOSYA: aynı dönüşüm dört yerden okunuyor — karşılaştırma
 * ekranı (şerit, grafik ve tablodaki dönem getirisi), hisse grafiği,
 * portföy ekranı ve vergi hesaplayıcısı. Dördü ayrı ayrı çarpsaydı aynı
 * hissenin TL getirisi iki ekranda iki ayrı sayı olabilirdi; deponun kuralı
 * "aynı sayı iki yerde duruyorsa aynı kaynaktan gelmeli".
 *
 * Dosya `"use client"` DEĞİL ve hiçbir ağ çağrısı yapmıyor: sunucu da
 * tarayıcı da aynı fonksiyonları çağırıyor ve testler (`tests/fx.test.ts`)
 * ağsız koşuyor. Ağ tarafı `lib/providers/fx-history.ts`te.
 *
 * KURUN DÜRÜSTLÜĞÜ. İki kaynak var ve çözünürlükleri farklı:
 *   · TCMB günlük bülteni — her iş günü tek bir kur, döviz ALIŞ tarafı
 *     kullanılıyor (vergi kuralının istediği taraf; bkz. /vergi). Günlük ama
 *     her gün için ayrı bir dosya: beş yıllık bir grafik bin iki yüz dosya
 *     demek, çekilmiyor.
 *   · FRED aylık ortalaması (CCUSMA02TRM618N) — uzun aralıkların ara
 *     noktaları. Aylık, ortalama ve bir ay geriden geliyor.
 * Yol şöyle kuruluyor: UÇLAR TCMB'nin günlük kuru, aradaki her ay FRED'in o
 * ayki ortalaması ayın ortasına (15'i) konuyor ve noktalar arası doğrusal.
 * Dönem getirisi yalnızca uçlardan hesaplandığı için KESİN; eğrinin
 * ortası bir yaklaşım ve ekran bunu künyesinde söylüyor.
 */

/** "YYYY-MM-DD". */
export type IsoDate = string;
/** "YYYY-MM". */
export type IsoMonth = string;

export type FxPoint = { date: IsoDate; rate: number };

/** Kur yolunun ucu: istenen gün ve o güne düşen bültenin kendi günü. */
export type FxEndpoint = FxPoint & {
  /** Ekranın sorduğu gün (barın günü). Bülten günü bundan önce olabilir:
   *  hafta sonu ve tatilde bülten yok, bir önceki iş gününe inilir. */
  requested: IsoDate;
};

export type MonthlyValue = { month: IsoMonth; value: number };

export type FxPath = {
  start: FxEndpoint;
  end: FxEndpoint;
  /** Uçların arasındaki ayların ortalama kuru (FRED). Boşsa yol iki uç
   *  arasında düz bir çizgi — künye bunu ayrıca söylüyor. */
  monthly: MonthlyValue[];
  /** TÜFE aylık endeksi (TCMB EVDS, 2025=100). Anahtar yoksa null ve Reel
   *  TL görünümü hiç açılmıyor. */
  cpi: MonthlyValue[] | null;
};

export type CurrencyMode = "usd" | "tl" | "reel";

export const CURRENCY_MODES = ["usd", "tl", "reel"] as const satisfies readonly CurrencyMode[];

export function isCurrencyMode(value: unknown): value is CurrencyMode {
  return (
    typeof value === "string" &&
    (CURRENCY_MODES as readonly string[]).includes(value)
  );
}

/**
 * TCMB arşivinin anlamlı başlangıcı.
 *
 * 2005 öncesi bültenler ESKİ LİRA cinsinden (1 USD ≈ 1.340.000 TL). O
 * tarihten önceki bir alışı bugünün kuruyla karşılaştırmak altı sıfırlık bir
 * hata üretirdi; uç bu tarihten öncesini hiç sormuyor.
 */
export const TCMB_MIN_DATE: IsoDate = "2005-01-03";

/** Aylık ortalamanın ayın içindeki yeri — ortalama ayın ortasını temsil eder. */
export const MONTHLY_ANCHOR_DAY = 15;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/** Takvimde gerçekten var olan bir gün mü — "2026-02-30" geçmez. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

export function isIsoMonth(value: unknown): value is IsoMonth {
  if (typeof value !== "string") return false;
  const match = ISO_MONTH.exec(value);
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

/** 1970-01-01'den bu yana geçen gün — tarih aritmetiği saat dilimsiz. */
export function dayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function isoFromDayNumber(days: number): IsoDate {
  return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, delta: number): IsoDate {
  return isoFromDayNumber(dayNumber(date) + delta);
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

/** "2026-03" → "2026-02". Ocak bir önceki yılın Aralık'ına iner. */
export function previousMonth(month: IsoMonth): IsoMonth {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** İki ay arasındaki ay sayısı (b − a). */
export function monthDiff(a: IsoMonth, b: IsoMonth): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/**
 * Bir gün için denenecek bülten dosyaları — o gün, sonra geriye doğru.
 *
 * HAFTA SONU ATLANMIYOR, dosya dosya soruluyor. Atlamak iki istek
 * kazandırırdı ama TCMB'nin bayram öncesi telafi cumartesilerinde bülten
 * yayımladığı günler var; atlayan bir liste o günü cumaya düşürürdü. Arşiv
 * dosyaları değişmediği için her deneme bir kez gidiyor, sonra önbellekte.
 */
export function bulletinCandidates(date: IsoDate, maxLookback: number): IsoDate[] {
  const out: IsoDate[] = [];
  for (let i = 0; i <= maxLookback; i++) out.push(addDays(date, -i));
  return out;
}

/** "2026-09-25" → "202609/25092026.xml" — TCMB arşivinin dosya yolu. */
export function tcmbArchivePath(date: IsoDate): string {
  const [y, m, d] = date.split("-");
  return `${y}${m}/${d}${m}${y}.xml`;
}

/* --------------------------------------------------------------------------
   Kur yolu
   -------------------------------------------------------------------------- */

/**
 * Yolun çapaları — gün sırasıyla.
 *
 * Aylık ortalama ancak iki ucun ARASINA düşüyorsa giriyor: uçlar günlük
 * kesin kur ve onların yerine bir ortalama konamaz. Aynı güne iki çapa
 * düşerse (çok kısa aralık) uçlar kazanır.
 */
export function fxAnchors(path: Pick<FxPath, "start" | "end" | "monthly">): FxPoint[] {
  const startDay = dayNumber(path.start.requested);
  const endDay = dayNumber(path.end.requested);
  const inner = path.monthly
    .map((entry) => ({
      date: `${entry.month}-${String(MONTHLY_ANCHOR_DAY).padStart(2, "0")}`,
      rate: entry.value,
    }))
    .filter((point) => {
      const day = dayNumber(point.date);
      return day > startDay && day < endDay && point.rate > 0;
    });
  return [
    { date: path.start.requested, rate: path.start.rate },
    ...inner,
    ...(endDay > startDay ? [{ date: path.end.requested, rate: path.end.rate }] : []),
  ];
}

/**
 * Verilen gündeki kur — çapalar arasında doğrusal, uçların dışında sabit.
 *
 * UÇLARIN DIŞINDA SABİT, UZATILMIYOR. Kısa bir seri (sonradan listelenen
 * hisse) yolun ortasında başlayabilir ama yolun DIŞINA düşen bir bar ancak
 * yuvarlama farkından olur; eğimi dışarı uzatmak olmayan bir kur uydururdu.
 */
export function rateAt(anchors: readonly FxPoint[], date: IsoDate): number | null {
  if (anchors.length === 0) return null;
  const day = dayNumber(date);
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (day <= dayNumber(first.date)) return first.rate;
  if (day >= dayNumber(last.date)) return last.rate;
  for (let i = 1; i < anchors.length; i++) {
    const right = anchors[i];
    const rightDay = dayNumber(right.date);
    if (day <= rightDay) {
      const left = anchors[i - 1];
      const leftDay = dayNumber(left.date);
      const span = rightDay - leftDay || 1;
      return left.rate + ((right.rate - left.rate) * (day - leftDay)) / span;
    }
  }
  return last.rate;
}

/**
 * Verilen günün TÜFE endeksi — o ayın değeri, yoksa ondan ÖNCEKİ son ay.
 *
 * Basamak, ara değer değil: TÜİK ayı bir sonraki ayın 3'ünde açıklıyor,
 * yani bugünün ayı hiçbir zaman elde değil. Son açıklanan ayda kalmak
 * "henüz bilinmeyen enflasyonu sıfır saymak" demek ve künye hangi aya
 * kadar ölçüldüğünü yazıyor (`cpiSpan`). İlk aydan önceki gün için null.
 */
export function cpiAt(cpi: readonly MonthlyValue[], date: IsoDate): number | null {
  const month = monthOf(date);
  let found: number | null = null;
  for (const entry of cpi) {
    if (entry.month <= month) found = entry.value;
    else break;
  }
  return found;
}

/** Reel görünümde kullanılan iki ay — künye "TÜFE Mart 2026 → Ağustos 2026" yazar. */
export function cpiSpan(
  cpi: readonly MonthlyValue[],
  from: IsoDate,
  to: IsoDate,
): { from: IsoMonth; to: IsoMonth } | null {
  const pick = (date: IsoDate) => {
    const month = monthOf(date);
    let found: IsoMonth | null = null;
    for (const entry of cpi) {
      if (entry.month <= month) found = entry.month;
      else break;
    }
    return found;
  };
  const a = pick(from);
  const b = pick(to);
  return a && b ? { from: a, to: b } : null;
}

/**
 * Bir kapanış dizisini seçilen para birimine çevirir.
 *
 * `dates` her kapanışın İŞLEM GÜNÜ (ET takvimi). Çevrilemeyen nokta
 * (kur ya da endeks yok) null döner; çağıran onu eler — sıfır yazmak
 * grafikte dibe vuran bir çizgi çizerdi.
 */
export function convertCloses(
  closes: readonly number[],
  dates: readonly IsoDate[],
  mode: CurrencyMode,
  anchors: readonly FxPoint[],
  cpi: readonly MonthlyValue[] | null,
): (number | null)[] {
  if (mode === "usd") return [...closes];
  return closes.map((close, i) => {
    const rate = rateAt(anchors, dates[i]);
    if (rate === null) return null;
    const lira = close * rate;
    if (mode === "tl") return lira;
    const index = cpi ? cpiAt(cpi, dates[i]) : null;
    return index ? lira / index : null;
  });
}

/**
 * Getirinin bileşenleri — "USD Getirisi · Kur Etkisi · TL Getirisi".
 *
 * Toplanmıyorlar, ÇARPILIYORLAR: %20 USD getirisi ve %35 kur artışı %55
 * değil, 1,20 × 1,35 − 1 = %62 TL getirisi. Ekrandaki üç sayı bu yüzden
 * alt alta toplanınca tutmuyor ve tutmaması doğru; künye bunu söylüyor.
 * Reel görünümde bir çarpan daha var: TÜFE artışı bölen olarak.
 */
export type ReturnDecomposition = {
  usdPct: number;
  fxPct: number;
  tlPct: number;
  /** Reel görünümde: dönemin TÜFE artışı ve enflasyondan arındırılmış getiri. */
  inflationPct: number | null;
  realPct: number | null;
};

export function decomposeReturn(input: {
  usdStart: number;
  usdEnd: number;
  rateStart: number;
  rateEnd: number;
  cpiStart?: number | null;
  cpiEnd?: number | null;
}): ReturnDecomposition | null {
  const { usdStart, usdEnd, rateStart, rateEnd, cpiStart, cpiEnd } = input;
  if (!(usdStart > 0) || !(rateStart > 0) || !(rateEnd > 0)) return null;
  const usd = usdEnd / usdStart;
  const fx = rateEnd / rateStart;
  const tl = usd * fx;
  const inflation = cpiStart && cpiEnd && cpiStart > 0 ? cpiEnd / cpiStart : null;
  return {
    usdPct: (usd - 1) * 100,
    fxPct: (fx - 1) * 100,
    tlPct: (tl - 1) * 100,
    inflationPct: inflation === null ? null : (inflation - 1) * 100,
    realPct: inflation === null ? null : (tl / inflation - 1) * 100,
  };
}

/* --------------------------------------------------------------------------
   Biçim
   -------------------------------------------------------------------------- */

/** Lira ile sayı arasındaki bölünmez dar boşluk — `MONEY_GAP` ile aynı karakter. */
const LIRA_GAP = " ";
/** Boş değer — `NO_VALUE` (lib/utils.ts) ile aynı yarım çizgi; uzun çizgi
 *  görünür metinde yasak. Burada tekrar tanımlı, çünkü bu dosya bağımlılıksız. */
const NO_VALUE_DASH = "–";

/**
 * TL tutarı — TR'de "1.234,56 ₺", EN'de "₺1,234.56".
 *
 * `formatPrice(…, { currency: "TRY" })` "1.234,56 TRY" basıyordu: kod
 * doğru ama sitenin geri kalanı dolar için simge yazıyor ($) ve aynı
 * satırda biri simge biri kod iki para birimi dengesiz duruyordu.
 */
export function formatLira(
  value: number | null | undefined,
  locale: string,
  digits = 2,
  /** K/Z gibi yönlü tutarlarda artı işareti de yazılır. */
  signed = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE_DASH;
  const body = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  const withSign = locale === "tr" ? `${body}${LIRA_GAP}₺` : `₺${body}`;
  if (value < 0) return `−${LIRA_GAP}${withSign}`;
  return signed && value > 0 ? `+${LIRA_GAP}${withSign}` : withSign;
}

/** Kur — dört basamak, TCMB'nin yayımladığı hassasiyet ("48,7901"). */
export function formatRate(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

/** "2026-09-25" → "25 Eyl 2026" — UTC okunur, gün kaymaz. */
export function formatIsoDate(date: IsoDate, locale: string, month: "short" | "long" = "short"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    day: "numeric",
    month,
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "2026-08" → "Ağustos 2026". */
export function formatIsoMonth(month: IsoMonth, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Bar zamanından (unix saniye) işlem günü — ET takvimiyle.
 *
 * UTC günü KULLANILAMAZ: akşam seansının 20:00 ET barı UTC'de ertesi güne
 * düşüyor ve o bar bir sonraki günün kuruyla çevrilirdi. Burada
 * `market-hours`e bağımlılık yok (dosya istemcide de koşuyor ve saf
 * kalmalı); `Intl` ile New York dilimi okunuyor, bu ET↔UTC dönüşümü değil,
 * yalnızca bir takvim günü okuması.
 */
const ET_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function etDateOf(unixSeconds: number): IsoDate {
  return ET_DAY.format(new Date(unixSeconds * 1000));
}
