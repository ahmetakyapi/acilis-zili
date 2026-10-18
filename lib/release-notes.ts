import "server-only";
import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { ungroundedNumbers } from "@/lib/ai-grounding";
import { db } from "@/lib/db";
import { eventExplainer } from "@/lib/event-explainers";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { RELEASED_WINDOW_DAYS, compareReleased, pickReleased, releaseNoteKey } from "@/lib/release-notes-core";
import { economicEvents, type EconomicEventRow } from "@/lib/schema";
import { callClaude, insightsConfigured } from "@/lib/stock-insights";
import { formatEventValue } from "@/lib/utils";

/**
 * VERİ AÇIKLANINCA CLAUDE NOTU (18 Ekim, sahibinin isteği) — /takvim'in
 * "Son Açıklanan Veriler" panelinde her açıklamanın kısa notu: rakam ne,
 * beklentiye ve önceki değere göre nerede (üstünde / altında / aynı — yalnız
 * verilen sayılarla), bu tür bir sonuç piyasada GENELDE nasıl okunur.
 *
 * YAZMA KATMANI KURALLARI (CLAUDE.md "Veri dürüstlüğü"):
 * - Girdi yalnız veritabanındaki satır: açıklanmış (`actual` dolu), yüksek ya
 *   da orta etkili, son on gün. Sayılar iki dilde, ekranla AYNI
 *   biçimlendiriciden (`formatEventValue`); yön (`vsForecast`,
 *   `vsPrevious`) panelin rozetiyle aynı fonksiyondan (`compareReleased`).
 *   Model fark, yüzde ya da yeni sayı hesaplamaz.
 * - Çıktıdaki her sayı girdide geçmek zorunda (lib/ai-grounding.ts); geçmeyen
 *   tek sayı notu düşürür. "Fed'in %2 hedefi" bile girdide yoksa yazılamaz.
 * - Fiyat yönü tahmini ve öneri yok: "genel anlam" cümlesi bu tür bir
 *   sürprizin piyasada GENELDE nasıl okunduğunu söyler, bugünkü fiyatı değil.
 *
 * MALİYET: not tek çağrıda İKİ DİLDE yazılır, anahtar olay + üç değer
 * (`releaseNoteKey`: gerçekleşen revize edilirse not yeniden yazılır) ve 30
 * gün önbellekte. Hisse ve haber notlarıyla aynı günlük tavan
 * (`INSIGHT_DAILY_CAP`, lib/stock-insights.ts → callClaude). Haber nöbeti son
 * iki günün açıklamalarını önceden yazdırır (`warmReleaseNotes`), okur notu
 * hazır bulur. Botlar uca hiç ulaşmaz (app/api/ai/veri-notu).
 */

export type ReleaseNoteText = { summary: string; context: string };
export type ReleaseNote = { kind: "release"; id: string; actual: string; text: { tr: ReleaseNoteText; en: ReleaseNoteText }; generatedAt: string };

const RELEASE_SYSTEM = `You write a short note on a US macroeconomic data release for Açılış Zili (a Turkish site for individual investors following US markets), shown on the economic calendar right after the figure is published.

Return tr / en, each with:
- summary: at most 2 sentences, at most 40 words. What the figure is and the number that was released, then how it compares with the forecast and with the previous value, using vsForecast / vsPrevious ("above", "below", "inline") and the supplied numbers only. If forecast or previous is null, it is unknown; do not mention it. If a comparison is null (the values are not plain numbers), state the values without calling one higher or lower.
- context: at most 2 sentences, at most 40 words. What a result like this USUALLY means for markets in general terms (for example how investors tend to read a hotter or cooler inflation print for the Fed's rate path, or a stronger or weaker jobs figure for growth). Phrase it as a general tendency ("genellikle", "usually", "tends to"). Never say what markets, stocks, yields or the dollar did or will do today. If the result is in line with the forecast, say that an in-line figure usually carries little surprise. The "about" field describes the release; you may rely on it.

Rules:
- Use ONLY the supplied JSON. Never invent figures, dates, revisions, sub-components, quotes, reactions or causes.
- Numbers: copy them exactly as formatted in the input for that language (the input gives each number as {tr, en}). Do not compute anything new (no differences, percentages of change, sums or averages). Do not write any other number, not even well-known ones such as a central bank target, unless it appears in the input.
- No predictions of price direction, no buy/sell/hold advice, no "opportunity". Plain, calm newspaper prose; no exclamation marks, emoji or hype.
- Write "tr" in natural, everyday Turkish financial language as used in Turkish financial media (enflasyon, TÜFE, istihdam, faiz, beklenti, Fed). Percentages as %3,1 (never "yüzde 3,1"). Normal sentences.
- Write "en" in plain English with the same content.`;

const Lang = z.object({ summary: z.string(), context: z.string() });
const ReleaseSchema = z.object({ tr: Lang, en: Lang });

const both = (value: string | null, unit: string | null) => {
  if (value === null || value.trim() === "") return null;
  return { tr: formatEventValue(value, unit, "tr") ?? value.trim(), en: formatEventValue(value, unit, "en") ?? value.trim() };
};

function releaseInput(row: EconomicEventRow): string {
  const about = eventExplainer(row.slug, "tr");
  return JSON.stringify({
    release: {
      title: { tr: row.titleTr, en: row.titleEn },
      about: about ? { tr: about, en: eventExplainer(row.slug, "en") } : null,
      date: row.eventDate,
      timeEt: row.eventTimeEt,
      importance: row.importance,
    },
    actual: both(row.actual, row.unit),
    forecast: both(row.forecast, row.unit),
    previous: both(row.previous, row.unit),
    vsForecast: compareReleased(row.actual, row.forecast),
    vsPrevious: compareReleased(row.actual, row.previous),
  });
}

/** Notu yazılabilecek satır: pencere içinde, yüksek/orta etkili, açıklanmış. */
async function releasedRow(id: string): Promise<EconomicEventRow | null> {
  const today = todayEt();
  const [row] = await db.select().from(economicEvents).where(eq(economicEvents.id, id)).limit(1);
  if (!row) return null;
  return pickReleased([row], { from: addEtDays(today, -RELEASED_WINDOW_DAYS), today, limit: 1 })[0] ?? null;
}

/* BAŞARISIZLIK DA HATIRLANIR — hisse notlarıyla aynı gerekçe
   (lib/stock-insights.ts → remembered): `unstable_cache` hatayı saklamıyor,
   düşen not her okurda Claude'a yeniden giderdi. Olay başına son başarısızlık
   süreçte 20 dakika; neden ve eksik sayılar uca tanı olarak geçer. */
const failures = new Map<string, { at: number; reason: string; detail?: string }>();
const FAILURE_TTL = 20 * 60_000;
export const releaseNoteFailure = (id: string) => failures.get(id) ?? null;

export async function getReleaseNote(id: string): Promise<ReleaseNote | null> {
  const failed = failures.get(id);
  if (failed && Date.now() - failed.at < FAILURE_TTL) return null;
  let missing: string[] = [];
  try {
    const row = await releasedRow(id);
    if (!row) return null;
    const input = releaseInput(row);
    const note = await unstable_cache(
      async (): Promise<ReleaseNote> => {
        const out = await callClaude(RELEASE_SYSTEM, ReleaseSchema, input);
        if (!out) throw new Error("no-output");
        const tidy = (lang: z.infer<typeof Lang>): ReleaseNoteText => ({ summary: lang.summary.trim(), context: lang.context.trim() });
        const text = { tr: tidy(out.tr), en: tidy(out.en) };
        if (!text.tr.summary || !text.en.summary) throw new Error("no-output");
        missing = ungroundedNumbers([text.tr, text.en].flatMap((t) => [t.summary, t.context]).join("\n"), input);
        if (missing.length) throw new Error("ungrounded");
        return { kind: "release", id: row.id, actual: row.actual!.trim(), text, generatedAt: new Date().toISOString() };
      },
      ["macro-release-v1", ...releaseNoteKey(row)],
      { revalidate: 30 * 24 * 3600, tags: ["release-insight"] },
    )();
    failures.delete(id);
    return note;
  } catch (error) {
    const reason = error instanceof Error && ["ungrounded", "no-output"].includes(error.message) ? error.message : "error";
    failures.set(id, { at: Date.now(), reason, detail: reason === "ungrounded" ? missing.join(" ") : undefined });
    console.error(`[veri notu] ${id}: ${reason}${reason === "ungrounded" ? ` (${missing.join(" ")})` : ""}`);
    return null;
  }
}

/**
 * VERİ AÇIKLANINCA HAZIR: /api/cron/haberler her koşuda (günde üç) son iki
 * günün açıklanmış yüksek/orta etkili verilerinin notunu yazdırır. Koşu
 * başına en çok `limit`; önbellekteki not çağrı harcamaz.
 */
export async function warmReleaseNotes(limit = 6): Promise<number> {
  if (!insightsConfigured()) return 0;
  const today = todayEt();
  const from = addEtDays(today, -2);
  let rows: EconomicEventRow[];
  try {
    rows = await db
      .select()
      .from(economicEvents)
      .where(
        and(
          gte(economicEvents.eventDate, from),
          lte(economicEvents.eventDate, today),
          isNotNull(economicEvents.actual),
          inArray(economicEvents.importance, ["high", "medium"]),
        ),
      );
  } catch {
    return 0;
  }
  let written = 0;
  for (const row of pickReleased(rows, { from, today, limit })) if (await getReleaseNote(row.id)) written += 1;
  return written;
}
