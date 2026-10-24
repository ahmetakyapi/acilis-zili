import { parseBlocks, type Block } from "@/components/article/parse-blocks";
import { barDay } from "@/lib/brief-indices";
import {
  AFTER_HOURS_MINUTES,
  FEED_DELAY_MINUTES,
  closeMinutesFor,
  etParts,
  isTradingDay,
  prevTradingDay,
  type MarketHoliday,
} from "@/lib/market-hours";
import type { Bar } from "@/lib/providers/types";

/* ==========================================================================
   Günün Grafiği — saf mantık (24 Ekim)

   React'siz, veritabanısız: birim testleri (`tests/daily-chart.test.ts`)
   bunu doğrudan yüklüyor. Yazma yolu `lib/content-write.ts` → `saveDailyChart`,
   okuma `lib/daily-chart-data.ts`, rutinin bağlamı
   `lib/daily-chart-context.ts`.
   ========================================================================== */

/** Kalıcı adres — sayfa, site haritası, OG ve bülten bağlantısı aynı yerden. */
export function dailyChartHref(date: string): string {
  return `/gunun-grafigi/${date}`;
}

/** Paylaşım görselinin adresi — `boyut=yatay` 1200×630, `dikey` 1080×1350. */
export function dailyChartImageHref(date: string, kind: "yatay" | "dikey"): string {
  return `${dailyChartHref(date)}/gorsel?boyut=${kind}`;
}

/** Sürüm geçmişi anahtarı — gerekçe `lib/schema.ts` → `dailyCharts`. */
export function dailyChartRevisionKey(date: string): string {
  return `grafik:${date}`;
}

/* --------------------------------------------------------------------------
   Grafik bloğu

   GRAFİK YENİ BİR BLOK DEĞİL. Mercek'in var olan üç çizim bloğu yetiyor:
   `bar` (sıralı karşılaştırma, işaretli), `pay` (bütünün dağılımı) ve
   `oncesi` (tek büyüklüğün iki hâli). Yeni blok açmak beş dosyaya dokunmak
   demek (CLAUDE.md "Yeni blok = BEŞ yer") ve bu paket o yükü almıyor.

   `grafik` (canlı fiyat serisi) BİLEREK DIŞARIDA: o blok okuyucu her
   açtığında BUGÜNE kadar çiziyor. Arşivdeki 23 Ekim grafiği bir ay sonra
   başka bir şekil gösterirdi; günün grafiği o günün fotoğrafı olmalı ve
   paylaşım görseli de aynı resmi çizmeli. `sayilar`, `zaman`, `akis` çizim
   değil liste. Metin kutuları (`ozet` vb.) zaten grafik değil.
   -------------------------------------------------------------------------- */

export type DailyChartBlock = Extract<Block, { kind: "bars" | "share" | "shift" }>;

/** Rutinin yazdığı anahtar kelime → ayrıştırılmış tür. */
export const DAILY_CHART_KINDS = { bar: "bars", pay: "share", oncesi: "shift" } as const;

/** Çubuk sayısı: ikiden az karşılaştırma değil; on ikiden fazlası telefonda okunmuyor. */
export const BAR_LIMITS = { min: 2, max: 12 } as const;
/** Pay: ayrıştırıcı zaten altıda kesiyor (`parse-blocks.ts`). */
export const SHARE_LIMITS = { min: 2, max: 6 } as const;

export type ChartBlockCheck =
  | { ok: true; block: DailyChartBlock }
  | { ok: false; reason: string };

/** Sayı mı — "-1,23", "%4,5", "+0.8" kabul; "yok", "—" değil. */
function numericDisplay(display: string): boolean {
  return /^[-+−]?%?[-+−]?\d+(?:[.,]\d+)?%?$/.test(display.replace(/\s/g, ""));
}

/**
 * `chart_md` tam olarak TEK bir izinli blok mu?
 *
 * Neden bu kadar sıkı: kayıt bir GRAFİK vaat ediyor ve paylaşım görseli onu
 * çiziyor. İki blok gönderilirse hangisinin görsele gireceği belirsiz,
 * blok dışı metin ise açıklamanın yerine geçmiş olur. Değeri sayıya
 * çevrilemeyen satır sessizce sıfır çubuk çiziyordu (`parse-blocks.ts` →
 * `bar`): grafikte olmayan bir "0" basmak uydurma kesinlik.
 */
export function checkChartBlock(chartMd: string, locale: string): ChartBlockCheck {
  const blocks = parseBlocks(chartMd, locale);
  if (blocks.length !== 1) {
    return { ok: false, reason: `tek blok bekleniyor, ${blocks.length} blok geldi` };
  }
  const [block] = blocks;
  if (block.kind === "bars") {
    if (block.items.length < BAR_LIMITS.min || block.items.length > BAR_LIMITS.max) {
      return { ok: false, reason: `bar ${BAR_LIMITS.min}-${BAR_LIMITS.max} satır olmalı` };
    }
    const bad = block.items.find((item) => !item.name || !numericDisplay(item.display));
    if (bad) return { ok: false, reason: `sayıya çevrilemeyen satır: "${bad.name} | ${bad.display}"` };
    return { ok: true, block };
  }
  if (block.kind === "share") {
    if (block.items.length < SHARE_LIMITS.min) {
      return { ok: false, reason: `pay en az ${SHARE_LIMITS.min} dilim olmalı` };
    }
    const bad = block.items.find((item) => !item.name || !numericDisplay(item.display));
    if (bad) return { ok: false, reason: `sayıya çevrilemeyen dilim: "${bad.name} | ${bad.display}"` };
    return { ok: true, block };
  }
  if (block.kind === "shift") {
    if (block.from.value === null || block.to.value === null) {
      return { ok: false, reason: "oncesi iki satırı da sayı taşımalı" };
    }
    return { ok: true, block };
  }
  return {
    ok: false,
    reason: `izinli bloklar: ${Object.keys(DAILY_CHART_KINDS).map((k) => `::: ${k}`).join(", ")}`,
  };
}

/* --------------------------------------------------------------------------
   Açıklama
   -------------------------------------------------------------------------- */

/**
 * Açıklamanın kelime aralığı. Hedef ~100; Chartr'ın kartları 80-140 arası.
 * Alt sınır "bir cümlelik altyazı" olmasın, üst sınır mercek yazısına
 * dönüşmesin diye. Türkçe kelimeler uzun: aynı metin İngilizcede ~%20
 * daha çok kelime tutuyor, tavan bu yüzden 160.
 */
export const BODY_WORDS = { min: 50, max: 160 } as const;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Açıklama düz paragraf: blok, başlık, tablo yok — grafik ayrı alanda. */
export function bodyProblem(bodyMd: string): string | null {
  if (/^\s*(:::|#|\|)/m.test(bodyMd)) return "açıklama düz paragraf olmalı (:::, # ya da tablo yok)";
  const words = wordCount(bodyMd);
  if (words < BODY_WORDS.min || words > BODY_WORDS.max) {
    return `açıklama ${BODY_WORDS.min}-${BODY_WORDS.max} kelime olmalı, ${words} kelime geldi`;
  }
  return null;
}

/** Künye ve kart için ilk cümle — biçim işaretleri ayıklanmış. */
export function firstSentence(bodyMd: string, max = 220): string {
  const plain = bodyMd.replace(/\*\*?|`|\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
  const match = /^(.+?[.!?])(\s|$)/.exec(plain);
  const sentence = match ? match[1] : plain;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > max * 0.6 ? at : max).trimEnd()}…`;
}

/* --------------------------------------------------------------------------
   Seans
   -------------------------------------------------------------------------- */

/**
 * Son TAMAMLANMIŞ seansın ET günü.
 *
 * Grafiğin anlattığı gün kapanmış olmalı: seans açıkken günün barı yarım ve
 * yüzde her dakika değişiyor, yazıya geçen sayı ise kalıcı (CLAUDE.md "Veri
 * dürüstlüğü" 4 — yazma katmanı bayat ya da yarım veriyi kullanmaz).
 * Bugün işlem günüyse ve AKŞAM SEANSI + besleme gecikmesi bittiyse bugün;
 * değilse bir önceki işlem günü. Kapanış zili yetmiyor: günlük bar akşam
 * seansında hâlâ güncelleniyor olabilir ve "kapanmış" denen gün yazıdan
 * sonra bir kez daha oynardı. Bekleme ucuz — rutin zaten ertesi sabah
 * koşuyor. Yarım günde kapanış 13:00, akşam seansı yine dört saat
 * (`closeMinutesFor`, `AFTER_HOURS_MINUTES`).
 */
export function lastCompletedSession(now: Date, holidays: MarketHoliday[]): string {
  const { dateStr, minutes } = etParts(now);
  if (isTradingDay(dateStr, holidays) && minutes >= closeMinutesFor(dateStr, holidays) + AFTER_HOURS_MINUTES + FEED_DELAY_MINUTES) {
    return dateStr;
  }
  return prevTradingDay(dateStr, holidays);
}

/* --------------------------------------------------------------------------
   Hareket ve biçim — bağlam paketinin sayıları
   -------------------------------------------------------------------------- */

export type Move = {
  close: number;
  base: number;
  base_date: string;
  pct: number;
};

/**
 * `day` kapanışının `back` seans önceki kapanışa göre değişimi.
 *
 * Kapanıştan kapanışa — bültenin tanımıyla aynı (`lib/brief-indices.ts`).
 * O günün barı yoksa null: tahmin yok. Taban için yeterli geçmiş yoksa da
 * null; "5 günlük" yazan bir sayı dört günü anlatamaz.
 */
export function moveOver(bars: readonly Bar[], day: string, back: number): Move | null {
  const index = bars.findIndex((bar) => barDay(bar) === day);
  if (index < 0 || index - back < 0) return null;
  const close = bars[index].close;
  const baseBar = bars[index - back];
  if (!baseBar.close) return null;
  return {
    close,
    base: baseBar.close,
    base_date: barDay(baseBar),
    pct: (close / baseBar.close - 1) * 100,
  };
}

/** Yüzde ve fiyat iki ondalık — sitedeki endeks kartlarıyla aynı. */
export const CONTEXT_DIGITS = 2;

const NUMBER_FORMAT = {
  tr: (digits: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  en: (digits: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
};

/**
 * Bir sayının İKİ DİLDE yazılışı — modele verilen biçim.
 *
 * Sayı denetimi (`lib/ai-grounding.ts`) metindeki her sayıyı bağlamın
 * METNİNDE arıyor. Ham `1.2345` verilirse model "%1,2" yazar ve denetim onu
 * haklı olarak reddeder; biçimlenmiş dize verilince model onu olduğu gibi
 * kopyalıyor. İşaret ayrı: denetim yalnız rakam dizisine bakıyor, eksi
 * işareti U+2212 de olabilir.
 */
export function formatted(value: number, digits: number = CONTEXT_DIGITS) {
  return {
    value: Number(value.toFixed(digits)),
    tr: NUMBER_FORMAT.tr(digits).format(value),
    en: NUMBER_FORMAT.en(digits).format(value),
  };
}

/** Yüzde, işaretli: "+1,23" / "+1.23". Sıfır işaretsiz. */
export function signedPct(value: number, digits: number = CONTEXT_DIGITS) {
  const base = formatted(Math.abs(value), digits);
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return { value: rounded, tr: `${sign}${base.tr}`, en: `${sign}${base.en}` };
}

/** Hareketin paketteki yazılışı — `null` hareket yok demek, sıfır değil. */
export function moveFields(move: Move | null) {
  if (!move) return null;
  return {
    pct: signedPct(move.pct),
    close: formatted(move.close),
    base: formatted(move.base),
    base_date: move.base_date,
  };
}

export type BreadthRow = { symbol: string; pct: number | null };

/**
 * `DataStamp` kaynağı — DÜZ ETİKET, "alpaca" anahtarı DEĞİL (25 Ekim).
 * "alpaca" anahtarı damgaya "15 Dakika Gecikmeli" ekliyor; o künye canlı
 * kotasyon için. Bu sayfadaki her sayı kapanmış bir günün barından, yani
 * gecikme sözü yanlış olurdu. Etiket `PROVIDER_LABEL.alpaca` ile aynı yazı.
 */
export const DAILY_CHART_STAMP_SOURCE = "Alpaca · SIP";

/**
 * Genişlik: evrende kaçı artıda, kaçı ekside. Yüzdesi bilinmeyen sembol
 * sayılmaz ("yatay" değil, bilinmiyor) — `lib/sentiment.ts` → `breadthCounts`
 * ile aynı kural. Kapsam eşiğin altındaysa null: 500 üyenin 40'ından
 * "piyasanın %70'i yükseldi" denmez.
 */
export const BREADTH_MIN_COVERAGE = 0.8;

/**
 * Evrenin yeterince okunup okunmadığı — genişlik ve öne çıkanlar İKİSİ DE
 * bu eşiğe bağlı (25 Ekim düzeltmesi). Öne çıkanlar eşiksizdi: evrenin
 * yarısı okunmuşken "günün en çok yükselenleri" yarım listeden çıkıyordu.
 * Telegram kapanış mesajının ölçütüyle aynı (%80, `lib/telegram-data.ts` →
 * `MOVERS_MIN_SHARE`).
 */
export function universeCovered(known: number, members: number): boolean {
  return members > 0 && known / members >= BREADTH_MIN_COVERAGE;
}

export function breadthOf(rows: readonly BreadthRow[], members: number) {
  const known = rows.filter((row) => row.pct !== null) as { symbol: string; pct: number }[];
  if (!universeCovered(known.length, members)) return null;
  const advancing = known.filter((row) => Number(row.pct.toFixed(CONTEXT_DIGITS)) > 0).length;
  const declining = known.filter((row) => Number(row.pct.toFixed(CONTEXT_DIGITS)) < 0).length;
  return {
    members,
    known: known.length,
    advancing,
    declining,
    unchanged: known.length - advancing - declining,
    advancing_share: formatted((advancing / known.length) * 100, 1),
  };
}

/** En çok yükselen ve düşen `n` sembol — eşitlikte sembol sırası (kararlı). */
export function pickMovers<T extends { symbol: string; pct: number | null }>(rows: readonly T[], n: number) {
  const known = rows.filter((row): row is T & { pct: number } => row.pct !== null);
  const byPct = [...known].sort((a, b) => b.pct - a.pct || a.symbol.localeCompare(b.symbol));
  return {
    gainers: byPct.filter((row) => row.pct > 0).slice(0, n),
    losers: byPct.filter((row) => row.pct < 0).reverse().slice(0, n),
  };
}

/**
 * `last` dahil geriye doğru `n` işlem günü, yeniden eskiye — panelin
 * "hangi gün yazılmadı" sorusunun penceresi. Tatil ve hafta sonu atlanır.
 */
export function recentSessions(last: string, n: number, holidays: MarketHoliday[]): string[] {
  const days: string[] = [];
  let cursor = last;
  for (let i = 0; i < n; i++) {
    days.push(cursor);
    cursor = prevTradingDay(cursor, holidays);
  }
  return days;
}

export type ChartGap = { day: string; missing: "chart" | "en" };

/**
 * Pencerede eksik olanlar: hiç yazılmamış gün ve İngilizcesi olmayan gün.
 * Saf — panel (`components/admin/DailyChartHealth.tsx`) ve testi paylaşıyor.
 */
export function chartGaps(sessions: readonly string[], written: ReadonlyMap<string, readonly string[]>): ChartGap[] {
  const gaps: ChartGap[] = [];
  for (const day of sessions) {
    const locales = written.get(day);
    if (!locales || locales.length === 0) gaps.push({ day, missing: "chart" });
    else if (!locales.includes("en")) gaps.push({ day, missing: "en" });
  }
  return gaps;
}

/**
 * Sayı denetiminin kaynağı — paket, `recent_charts` HARİÇ (25 Ekim
 * düzeltmesi). Son grafiklerin başlıkları pakette "aynı konuyu üst üste
 * seçme" diye duruyor; denetim metnine girince dünkü başlıktaki bir sayı
 * ("%3,1") bugünün metninde "pakette geçiyor" sayılıyordu. Başlık bir veri
 * değil; denetim yalnız o günün verisine bakar.
 */
export function groundingSource(context: { recent_charts?: unknown }): string {
  return JSON.stringify({ ...context, recent_charts: undefined });
}
