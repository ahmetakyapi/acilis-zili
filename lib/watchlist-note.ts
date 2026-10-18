import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { numbersGroundedAcrossLocales } from "@/lib/ai-grounding";
import type { Locale } from "@/lib/i18n/config";
import { emailPercent, type DigestPersonal } from "@/lib/notify-emails";
import { callClaude, insightsConfigured } from "@/lib/stock-insights";
import { weeklyMoves, type DigestData } from "@/lib/weekly-digest";

/**
 * TAKİP LİSTESİNE ÖZEL HAFTA NOTU (18 Ekim, sahibinin isteği) — pazar
 * postasının kişisel kutusu. İki parça:
 *
 * 1. Hareket listesi (kod): okurun takip ettiği hisselerin geride kalan
 *    haftası, kapanıştan kapanışa (endekslerle aynı ölçü — weeklyMoves);
 *    en büyük mutlak hareketler önce.
 * 2. Claude notu: bu listeden, S&P 500'ün haftasından ve okurun yeni
 *    haftadaki bilanço takviminden bir paragraf. Yalnız verilen biçimlenmiş
 *    sayılar (çıktıdaki her sayı girdide geçmek zorunda — ayraç farkı
 *    tanınır); tahmin ve öneri yok.
 *
 * MALİYET: okur başına haftada bir çağrı, okurun dilinde tek metin.
 * Önbellek okur + hafta + dil anahtarıyla: saatlik tekrar koşuları ve
 * deneme postası ikinci kez ödemez. Koşu başına tavan
 * (`WATCHLIST_NOTE_CAP`, varsayılan 60); tavanı aşan okur notsuz ama
 * hareket listesiyle alır. Not düşerse kutu yine eksiksiz.
 */

export type WatchMover = { symbol: string; changePct: number };
export type WatchWeek = { movers: WatchMover[]; note: string | null };

const MAX_MOVERS = 6;
export const watchlistNoteCap = () => {
  const raw = Number(process.env.WATCHLIST_NOTE_CAP);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 60;
};

/** Bütün alıcıların takip ettiği sembollerin haftası — tek seferde (bar önbelleği ortak). */
export async function watchedMoves(symbols: Iterable<string>, data: DigestData, now: Date): Promise<Map<string, number>> {
  const list = [...new Set(symbols)].slice(0, 150);
  const moves = await weeklyMoves(list, data.pastMonday, data.pastFriday, now).catch(() => []);
  return new Map(moves.map((move) => [move.symbol, move.changePct]));
}

export function moversFor(mine: Iterable<string>, moves: Map<string, number>): WatchMover[] {
  return [...mine]
    .filter((symbol) => moves.has(symbol))
    .map((symbol) => ({ symbol, changePct: moves.get(symbol)! }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct) || a.symbol.localeCompare(b.symbol))
    .slice(0, MAX_MOVERS);
}

const SYSTEM = {
  tr: `Açılış Zili'nin pazar postasında okurun TAKİP LİSTESİ için kısa bir not yazıyorsun. Tek paragraf, en çok 60 kelime: takip ettiği hisselerden geride kalan haftada en çok hareket edenler (S&P 500'e göre), ve varsa yeni haftada bilanço açıklayacak olanlar.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, sebep ya da olay yazma, hesap yapma. Sayıyı verilen biçimde aynen yaz.
- Fiyat yönü tahmini, al/sat/tut önerisi, "fırsat" yok. Sakin, günlük Türkçe; "sen" diye hitap edebilirsin. Ünlem, emoji, madde işareti yok.`,
  en: `You write a short note about the reader's WATCHLIST for Açılış Zili's Sunday email. One paragraph, at most 60 words: which watched stocks moved most in the week behind (relative to the S&P 500), and which report earnings in the week ahead, if any.

Rules:
- Use ONLY the data given; no number, date, cause or event that is not given, no computation. Copy numbers exactly as formatted.
- No price predictions, no buy/sell/hold advice, no "opportunity". Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

const Schema = z.object({ text: z.string() });

export async function watchlistNote(
  userId: string,
  locale: Locale,
  data: DigestData,
  movers: WatchMover[],
  personal: DigestPersonal,
): Promise<string | null> {
  if (!insightsConfigured() || movers.length < 2) return null;
  const day = (date: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const sp = data.indices.find((i) => i.symbol === "SPY");
  const input = JSON.stringify({
    pastWeek: `${day(data.pastMonday)} – ${day(data.pastFriday)}`,
    sp500WeeklyChange: sp ? emailPercent(sp.changePct, locale, 2) : null,
    watchedMovers: movers.map((m) => ({ symbol: m.symbol, weeklyChange: emailPercent(m.changePct, locale, 1) })),
    earningsAhead: personal.slice(0, 6).map((p) => ({ symbol: p.symbol, day: day(p.date), timing: p.timing })),
  });
  try {
    return await unstable_cache(
      async () => {
        const out = await callClaude(SYSTEM[locale], Schema, input);
        const text = out?.text.trim() ?? "";
        if (!text) throw new Error("no-output");
        if (!numbersGroundedAcrossLocales(text, input)) throw new Error("ungrounded");
        return text;
      },
      ["watchlist-note-v1", userId, data.thisMonday, locale],
      { revalidate: 7 * 24 * 3600, tags: ["watchlist-note"] },
    )();
  } catch (error) {
    console.error(`[takip notu] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return null;
  }
}
