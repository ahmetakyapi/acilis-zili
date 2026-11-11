import "server-only";
import { pickAlertReason, type AlertReason, type ReasonNote } from "@/lib/alert-reason";
import { CACHE_ONLY } from "@/lib/claude-budget";
import { getNewsForSymbol } from "@/lib/data";
import { getMoveInsight } from "@/lib/stock-insights";

/**
 * Alarm gerekçesinin okuması — seçim saf modülde (lib/alert-reason.ts).
 *
 * TESLİMAT BEKLEMEZ. Tarama gerekçeleri tetik işçilerinden ÖNCE, bütün
 * semboller için birlikte ve tek bir süre tavanıyla (`REASON_DEADLINE_MS`)
 * okur; tavanda yetişmeyen sembol gerekçesiz gider. Her hata sessiz: alarm
 * gerekçe yüzünden ne gecikir ne düşer.
 *
 * Not `CACHE_ONLY` kimliğiyle istenir (lib/claude-budget.ts): önbellekte
 * varsa döner, yoksa Claude'a GİDİLMEZ ve hak yanmaz. Notun anahtarı
 * sembol + son tamamlanmış seans, yani dönen not her zaman güncel haftanın.
 */

export const REASON_DEADLINE_MS = 2500;

async function reasonFor(symbol: string, now: Date): Promise<AlertReason | null> {
  const [insight, news] = await Promise.all([
    getMoveInsight(symbol, CACHE_ONLY).catch(() => null),
    getNewsForSymbol(symbol, 6).catch(() => []),
  ]);
  const note: ReasonNote | null = insight ? { explained: insight.explained, summary: { tr: insight.text.tr.summary, en: insight.text.en.summary } } : null;
  return pickAlertReason({
    note,
    headlines: news.map((n) => ({ headline: n.headline, headlineTr: n.headlineTr, source: n.source, publishedAt: n.publishedAt })),
    now,
  });
}

/** Sembol → gerekçe; tavanda yetişmeyen ya da bulunmayan sembol haritada yok. */
export async function loadAlertReasons(symbols: Iterable<string>, now: Date = new Date(), deadlineMs = REASON_DEADLINE_MS): Promise<Map<string, AlertReason>> {
  const out = new Map<string, AlertReason>();
  const unique = [...new Set(symbols)].slice(0, 40);
  if (unique.length === 0) return out;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, deadlineMs);
  });
  const work = Promise.all(
    unique.map(async (symbol) => {
      const reason = await reasonFor(symbol, now).catch(() => null);
      if (reason) out.set(symbol, reason);
    }),
  );
  await Promise.race([work, deadline]);
  clearTimeout(timer);
  /* Tavandan sonra yetişen sonuç kopyaya yazılmaz: çağıran haritayı okumaya başladı. */
  return new Map(out);
}
