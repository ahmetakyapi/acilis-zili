import { etParts } from "./market-hours";
import type { Bar } from "./providers/types";
import type { AnalysisResult } from "./ai-analysis-schema";

/**
 * İki ayrı rapor: vade alanı ODAĞI da taşır (veritabanında `horizon`, yeni sütun yok).
 * `short` = Teknik Odak (1–2 hafta, 5–10 seans: fiyat, yakın seviyeler,
 * momentum; 11 Ekim'e kadar 1–4 hafta idi, sahibi "çok uzun" dedi),
 * `medium` = Hisse Seçimi Odağı (3–6 ay: iş kalitesi, büyüme, değerleme; teknik yalnız zamanlama).
 */
export const FOCUS_OF = { short: "technical", medium: "selection" } as const;
export const HORIZON_OF = { technical: "short", selection: "medium" } as const;
export type AnalysisFocus = (typeof FOCUS_OF)[keyof typeof FOCUS_OF];
/* Giriş/çıkış şemaları `./ai-analysis-schema`da (20 Ekim): bu modül istemci
   bileşenlerine de iniyor ve tepedeki `z.object(...)` zod'u pakete taşıyordu.
   Oradan yalnız TİP alınır; değer aktarılırsa zod geri döner. */
/** Kayıtlı rapor: 11 Ekim 2026 öncesi raporlarda güven, tetik seviyeleri ve izleme listesi yok. */
export type StoredAnalysisResult = Omit<AnalysisResult, "confidence" | "bullLevel" | "bearLevel" | "watch" | "takeaways" | "news">
  & Partial<Pick<AnalysisResult, "confidence" | "bullLevel" | "bearLevel" | "watch" | "takeaways">>
  & { news: { sourceIndex: number; impact: string; title?: string }[] };
/** Modelin seviyesi sağlanan seviyelerden birine %0,5 içinde oturmuyorsa uydurmadır, atılır. */
const LEVEL_TOLERANCE = 0.005;
export function snapLevel(value: number | null, levels: readonly number[]): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  let best: number | null = null;
  for (const level of levels) {
    if (Math.abs(level - value) / value <= LEVEL_TOLERANCE && (best === null || Math.abs(level - value) < Math.abs(best - value))) best = level;
  }
  return best;
}
/** Var olmayan ya da tekrarlanan haber atfını atar; haber yoksa haber puanı da yoktur. */
export function repairNewsCitations<T extends { news: { sourceIndex: number }[]; newsScore: number | null }>(output: T, newsCount: number): T {
  const cited = new Set<number>();
  const news = output.news.filter(n => {
    if (n.sourceIndex >= newsCount || cited.has(n.sourceIndex)) return false;
    cited.add(n.sourceIndex);
    return true;
  });
  return { ...output, news, newsScore: newsCount === 0 ? null : output.newsScore };
}
/** Şirket uçları da genel piyasa haberi döndürebilir; yeni olması ilgililik değildir. */
export function companyNewsRelevant(symbol: string, company: string, headline: string, summary: string | null) {
  const brand = company.replace(/\.com\b/gi, "").replace(/\b(incorporated|inc|corporation|corp|ltd|limited|plc|holdings|company|co)\b\.?/gi, "").replace(/\s+/g, " ").trim();
  const first = brand.split(" ")[0];
  const generic = /^(the|bank|american|united|international|first|new|general|applied|advanced)$/i;
  const aliases: Record<string, string[]> = { GOOG: ["Google"], GOOGL: ["Google"], META: ["Facebook", "Instagram"], BRK: ["Berkshire Hathaway"] };
  const names = [...(symbol.length >= 2 ? [symbol] : []), brand, ...(first?.length >= 4 && !generic.test(first) ? [first] : []), ...(aliases[symbol] ?? [])].filter(n => n.length >= 2);
  const text = `${headline} ${summary ?? ""}`;
  return names.some(name => new RegExp(`(^|[^A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`, "i").test(text));
}
export function istanbulDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function remainingAnalyses(limit: number | null, used: number, usedDay: string | null, now = new Date()) {
  return limit === null ? null : Math.max(0, limit - (usedDay === istanbulDay(now) ? used : 0));
}
export function safeSourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

const RECENT_SESSIONS = 10;
const CHART_SESSIONS = 63;
const RETURN_WINDOWS = { w1: 5, m1: 21, m3: 63, m6: 126 } as const;
const round2 = (value: number) => Math.round(value * 100) / 100;
const pct = (to: number, from: number) => round2((to / from - 1) * 100);
/** Tek anlık fotoğraf yönü göstermez: son seanslar, dönem getirileri ve 3 aylık bant. Yalnız tamamlanmış barlar. */
export function pricePath(done: readonly Bar[]) {
  const last = done.at(-1);
  if (!last) return null;
  const back = (sessions: number) => done.length > sessions ? pct(last.close, done[done.length - 1 - sessions].close) : null;
  const band = done.slice(-RETURN_WINDOWS.m3);
  const high = Math.max(...band.map(b => b.high));
  const low = Math.min(...band.map(b => b.low));
  return {
    returnsPct: Object.fromEntries(Object.entries(RETURN_WINDOWS).map(([key, n]) => [key, back(n)])) as Record<keyof typeof RETURN_WINDOWS, number | null>,
    range3m: { high: round2(high), low: round2(low), fromHighPct: pct(last.close, high), fromLowPct: pct(last.close, low) },
    /** Ekrandaki grafik için; modele gitmez (girdi token'ı). */
    chart: done.slice(-CHART_SESSIONS).map(bar => ({ date: etParts(new Date(bar.time * 1000)).dateStr, close: round2(bar.close) })),
    recentSessions: done.slice(-RECENT_SESSIONS).map((bar, i, list) => {
      const prev = i > 0 ? list[i - 1].close : done[done.length - RECENT_SESSIONS - 1]?.close;
      return { date: etParts(new Date(bar.time * 1000)).dateStr, close: round2(bar.close), changePct: prev ? pct(bar.close, prev) : null, volume: bar.volume };
    }),
  };
}

export type NewsCandidate = { headline: string; summary: string | null; url: string; publishedAt: Date };
/** Rapor başına en çok bu kadar "yalnız özette geçen" haber: başlıkta adı geçmeyen çoğu zaman yan konu. */
const SUMMARY_ONLY_LIMIT = 3;
const SIMILAR_HEADLINE = 0.6;
const headlineWords = (headline: string) => new Set(headline.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length >= 3));
function similar(a: Set<string>, b: Set<string>) {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / (a.size + b.size - shared || 1) >= SIMILAR_HEADLINE;
}
/**
 * Haberi seçen tek yer. Eskiden en yeni 12 alınıyordu: yoğun bir günde yedi
 * günlük pencerenin tamamı tek güne düşüyor, aynı olayın iki ajans metni iki
 * kez sayılıyor, başlığında şirket geçmeyen bir pazarlama duyurusu da giriyordu
 * (NVDA, 11 Ekim canlı rapor). Şimdi: ilgisiz ve yakın kopya elenir, başlığında
 * şirket geçen haber önce gelir, günler sırayla dolaşılır.
 */
export function selectNews<T extends NewsCandidate>(items: readonly T[], symbol: string, company: string, limit: number): T[] {
  const kept: { item: T; words: Set<string>; headline: boolean }[] = [];
  const urls = new Set<string>();
  for (const item of [...items].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
    if (urls.has(item.url) || !companyNewsRelevant(symbol, company, item.headline, item.summary)) continue;
    const words = headlineWords(item.headline);
    if (kept.some(k => similar(k.words, words))) continue;
    urls.add(item.url);
    kept.push({ item, words, headline: companyNewsRelevant(symbol, company, item.headline, null) });
  }
  const byDay = (group: typeof kept) => {
    const days = new Map<string, T[]>();
    for (const { item } of group) {
      const day = etParts(item.publishedAt).dateStr;
      days.set(day, [...(days.get(day) ?? []), item]);
    }
    const queues = [...days.values()];
    const out: T[] = [];
    while (queues.some(q => q.length)) for (const q of queues) { const next = q.shift(); if (next) out.push(next); }
    return out;
  };
  const picked = [...byDay(kept.filter(k => k.headline)), ...byDay(kept.filter(k => !k.headline)).slice(0, SUMMARY_ONLY_LIMIT)].slice(0, limit);
  return picked.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
export type PricePath = NonNullable<ReturnType<typeof pricePath>>;

export type ScenarioStatus = "aboveBull" | "between" | "belowBear";
/** Şu anki fiyat tetiklere göre nerede. Gün içi fiyattır; senaryo günlük KAPANIŞLA teyit edilir (ekran bunu yazar). */
export function scenarioStatus(price: number, bull: number | null | undefined, bear: number | null | undefined): ScenarioStatus | null {
  if (typeof bull === "number" && price > bull) return "aboveBull";
  if (typeof bear === "number" && price < bear) return "belowBear";
  return typeof bull === "number" || typeof bear === "number" ? "between" : null;
}

/** Vadenin gün karşılığı: bilanço bu pencereye düşüyorsa olay riski. */
export const HORIZON_DAYS = { short: 28, medium: 182 } as const;
const DAY_MS = 86_400_000;
export const daysSince = (iso: string, now = new Date()) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));

/** Tetiklere uzaklık, ATR katı ve oran: "seviyeler ne kadar aralıklı" sorusu, tavsiye değil. */
export function triggerMath(price: number, bull: number | null | undefined, bear: number | null | undefined, atr: number | null) {
  if (typeof bull !== "number" || typeof bear !== "number" || price <= 0) return null;
  const up = bull - price, down = price - bear;
  return {
    upPct: (up / price) * 100, downPct: (-down / price) * 100,
    upAtr: atr ? up / atr : null, downAtr: atr ? down / atr : null,
    ratio: down > 0 && up > 0 ? up / down : null,
  };
}

/**
 * YENİ RAPOR İÇİN ÖNERİLEN BEKLEME (dk, 11 Ekim). Engel değil, öneri: düğme
 * her zaman çalışır, adı "Yine de…" olur.
 * - Teknik odak (1–2 hafta) fiyatın yönünü okur; seans içinde fiyat saat
 *   saat değişir, bir saatten kısa arayla iki rapor aynı veriyi yazar.
 * - Hisse seçimi (3–6 ay) bilanço, oranlar ve 7 günlük haberle çalışır; bu
 *   veri gün gün değişir.
 */
export const RECOMMENDED_GAP_MINUTES = { technical: 60, selection: 24 * 60 } as const;

export type NextReport = { lastAt: string; at: string; gapMinutes: number; reason: "gap" | "market-closed" };

/**
 * Bu odakta bir sonraki raporun önerilen anı — saf, test edilebilir.
 * Piyasa veri üretmiyorsa (gece, hafta sonu, tatil) ve son rapor anlatılan
 * seansın verisi tamamlandıktan SONRA yazıldıysa fiyat o rapordan beri hiç
 * değişmemiştir: öneri bir sonraki açılış ziline kayar.
 */
export function nextReportAt(lastAt: Date, focus: AnalysisFocus, market: { flowing: boolean; sessionEnd: Date; nextOpen: Date }): NextReport {
  const gapMinutes = RECOMMENDED_GAP_MINUTES[focus];
  const base = new Date(lastAt.getTime() + gapMinutes * 60_000);
  const frozen = !market.flowing && lastAt.getTime() >= market.sessionEnd.getTime() && market.nextOpen.getTime() > base.getTime();
  return { lastAt: lastAt.toISOString(), at: (frozen ? market.nextOpen : base).toISOString(), gapMinutes, reason: frozen ? "market-closed" : "gap" };
}

/** Süre metni: "23 dk", "1 sa 12 dk", "2 gün 3 sa". Saniye yok; bir dakikanın altı "1 dk". */
export function formatSpan(ms: number, units: { min: string; hour: string; day: string }): string {
  const total = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const d = Math.floor(total / 1440), h = Math.floor((total % 1440) / 60), m = total % 60;
  if (d) return h ? `${d} ${units.day} ${h} ${units.hour}` : `${d} ${units.day}`;
  if (h) return m ? `${h} ${units.hour} ${m} ${units.min}` : `${h} ${units.hour}`;
  return `${m} ${units.min}`;
}
