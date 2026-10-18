import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { companySector } from "@/lib/company-sector";
import { getSymbolNames } from "@/lib/data";
import type { Locale } from "@/lib/i18n/config";
import { barDate } from "@/lib/period-returns";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import { callClaude, completedDailyBars, expectedLastSession, insightsConfigured, upcomingEarnings } from "@/lib/stock-insights";
import { formatPercent } from "@/lib/utils";

/**
 * PORTFÖY NOTU (18 Ekim) — /portfoy'da okurun kendi pozisyonlarından kısa
 * bir okuma: ağırlık nerede toplanmış, son beş seansta neyi taşımış, yakında
 * hangisi bilanço açıklıyor.
 *
 * YAZMA KATMANI (CLAUDE.md, veri dürüstlüğü 4): ekrandaki canlı kâr/zarar
 * notta YOK. Her sayı son TAMAMLANMIŞ seansın kapanışından — ağırlık
 * (kapanış × adet), beş seanslık değişim, maliyete göre getiri. Bir
 * pozisyonun barları o seansa kadar gelmiyorsa pozisyon notun DIŞINDA
 * kalır; yarıdan azı okunuyorsa not hiç yazılmaz (eksik portföyün
 * "ağırlığı" yanlış olurdu).
 *
 * MALİYET: okur başına günde en çok bir çağrı — önbellek anahtarı okur +
 * seans günü + pozisyonların parmak izi (adet, maliyet): pozisyon eklenince
 * not tazelenir, sayfayı yeniden açmak ödemez. Okurun dilinde tek metin.
 * Not istemciden, panel görünüme girince istenir; uç oturum ister.
 */

export type PortfolioNote = {
  summary: string;
  points: { title: string; detail: string }[];
  session: string;
  covered: number;
  total: number;
  generatedAt: string;
};

const SYSTEM = {
  tr: `Açılış Zili'nde okurun KENDİ PORTFÖYÜ için kısa bir okuma yazıyorsun. Bir giriş cümlesi (en çok 35 kelime) ve en çok üç madde: ağırlığın nerede toplandığı (hisse ve sektör), son beş seansta portföyü en çok taşıyan pozisyonlar, ve varsa yakında bilanço açıklayacak olanlar. Madde başlığı kısa ve Title Case; ayrıntı en çok iki cümle.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, sebep ya da olay yazma, hesap yapma. Sayıyı verilen biçimde aynen yaz.
- Fiyat yönü tahmini, al/sat/tut önerisi, "çeşitlendirmelisin" gibi yönlendirme yok; gözlem yaz. Sakin, günlük Türkçe; "sen" diye hitap edebilirsin. Ünlem ve emoji yok.`,
  en: `You write a short reading of the reader's OWN PORTFOLIO on Açılış Zili. One opening sentence (at most 35 words) and at most three points: where the weight is concentrated (stocks and sectors), which positions moved the portfolio most over the last five sessions, and which report earnings soon, if any. Point titles short and in Title Case; details at most two sentences.

Rules:
- Use ONLY the data given; no number, date, cause or event that is not given, no computation. Copy numbers exactly as formatted.
- No price predictions, no buy/sell/hold advice, no "you should diversify" steering; write observations. Calm, plain English; address the reader as "you". No exclamation marks or emoji.`,
} as const;

const Schema = z.object({
  summary: z.string(),
  points: z.array(z.object({ title: z.string(), detail: z.string() })),
});

const failures = new Map<string, number>();
const FAILURE_TTL = 20 * 60_000;

export async function getPortfolioNote(userId: string, locale: Locale): Promise<PortfolioNote | null> {
  if (!insightsConfigured()) return null;
  const failKey = `${userId}:${locale}`;
  const failed = failures.get(failKey);
  if (failed && Date.now() - failed < FAILURE_TTL) return null;

  const result = await getPortfolioPositions(userId);
  if (!result.ok || result.positions.length === 0) return null;
  /* Aynı hissenin lotları birleşir: adet toplanır, maliyet adetle ağırlıklı. */
  const holdings = new Map<string, { quantity: number; cost: number }>();
  for (const p of result.positions) {
    const h = holdings.get(p.symbol) ?? { quantity: 0, cost: 0 };
    holdings.set(p.symbol, { quantity: h.quantity + p.quantity, cost: h.cost + p.quantity * p.costUsd });
  }
  const session = await expectedLastSession();
  const fingerprint = createHash("sha256")
    .update([...holdings].sort(([a], [b]) => a.localeCompare(b)).map(([s, h]) => `${s}:${h.quantity}:${h.cost.toFixed(4)}`).join("|"))
    .digest("hex")
    .slice(0, 16);

  try {
    return await unstable_cache(
      () => buildNote([...holdings], session, locale),
      ["portfolio-note-v1", userId, session, fingerprint, locale],
      { revalidate: 24 * 3600, tags: ["portfolio-note"] },
    )();
  } catch (error) {
    failures.set(failKey, Date.now());
    console.error(`[portföy notu] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return null;
  }
}

async function buildNote(holdings: [string, { quantity: number; cost: number }][], session: string, locale: Locale): Promise<PortfolioNote> {
  const symbols = holdings.map(([symbol]) => symbol);
  const [names, bars, ahead] = await Promise.all([
    getSymbolNames(symbols),
    Promise.all(symbols.map((symbol) => completedDailyBars(symbol).catch(() => null))),
    Promise.all(symbols.map((symbol) => upcomingEarnings(symbol))),
  ]);
  const rows = holdings
    .map(([symbol, h], i) => {
      const series = bars[i];
      if (!series || barDate(series[series.length - 1]!) !== session || series.length < 6) return null;
      const close = series[series.length - 1]!.close;
      const fiveAgo = series[series.length - 6]!.close;
      const avgCost = h.quantity > 0 ? h.cost / h.quantity : 0;
      return {
        symbol,
        name: names[symbol]?.name ?? symbol,
        sector: companySector(symbol, names[symbol]?.industry, locale),
        value: close * h.quantity,
        fiveSession: fiveAgo > 0 ? ((close - fiveAgo) / fiveAgo) * 100 : null,
        sinceCost: avgCost > 0 ? ((close - avgCost) / avgCost) * 100 : null,
        earnings: ahead[i] ? { date: ahead[i]!.reportDate, timing: ahead[i]!.hour ?? null } : null,
      };
    })
    .filter((row) => row !== null);
  if (rows.length < 1 || rows.length * 2 < holdings.length) throw new Error("bars");

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const pct = (value: number, digits = 1) => formatPercent(value, locale, digits);
  /* Ağırlık tam sayı yüzde: kesir hassasiyet uydurur, okur da ondalığa bakmaz. */
  const share = (value: number) => `${locale === "en" ? "" : "%"}${Math.round((value / total) * 100)}${locale === "en" ? "%" : ""}`;
  const bySector = new Map<string, number>();
  for (const row of rows) if (row.sector) bySector.set(row.sector, (bySector.get(row.sector) ?? 0) + row.value);
  const day = (date: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  /* Sayım ve pencere de girdide: "5 seans", "3 pozisyon" gibi doğal ifadeler
     sayı denetimine takılmasın (lib/ai-grounding.ts — girdide olmayan tek
     sayı notu düşürür). */
  const input = JSON.stringify({
    session: day(session),
    window: locale === "en" ? "5 sessions" : "5 seans",
    positionCount: rows.length,
    sectorCount: bySector.size,
    positions: rows
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
      .map((row) => ({
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        weight: share(row.value),
        lastFiveSessions: row.fiveSession === null ? null : pct(row.fiveSession),
        sinceAverageCost: row.sinceCost === null ? null : pct(row.sinceCost),
      })),
    sectors: [...bySector].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sector, value]) => ({ sector, weight: share(value) })),
    earningsSoon: rows.filter((row) => row.earnings).map((row) => ({ symbol: row.symbol, day: day(row.earnings!.date), timing: row.earnings!.timing })),
  });

  const out = await callClaude(SYSTEM[locale], Schema, input);
  if (!out || !out.summary.trim()) throw new Error("no-output");
  const points = out.points.slice(0, 3).map((p) => ({ title: p.title.trim(), detail: p.detail.trim() }));
  const text = [out.summary, ...points.flatMap((p) => [p.title, p.detail])].join(" ");
  const missing = ungroundedNumbers(text, input);
  if (missing.length) throw new Error(`ungrounded (${missing.join(" ")})`);
  return { summary: out.summary.trim(), points, session, covered: rows.length, total: holdings.length, generatedAt: new Date().toISOString() };
}
