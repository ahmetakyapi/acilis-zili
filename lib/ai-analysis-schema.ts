import { z } from "zod";

/**
 * Claude analizinin GİRİŞ ve ÇIKIŞ şemaları — yalnız sunucu
 * (`app/api/ai/analysis/route.ts`, `lib/ai-analysis.ts`) ve testler okur.
 *
 * `lib/ai-analysis-core.ts`ten AYRILDI (20 Ekim). Çekirdekteki küçük saf
 * yardımcıları (`formatSpan`, `HORIZON_OF`, `triggerMath`…) dört "use client"
 * bileşeni içe aktarıyor; şemalar modülün tepesinde `z.object(...)` ile
 * kurulduğu için ağaçtan silkelenemiyordu ve /claude sayfasının istemci
 * paketine zod'un tamamı, modele giden açıklama metinleriyle birlikte
 * iniyordu (tek parça 441.935 B, gzip 106.485 B; yalnız bu rota). Çekirdek
 * buradan YALNIZ TİP alır (`import type`), değer geri aktarılmaz — aktarılırsa
 * zod pakete geri döner. Bu modüle `server-only` konmadı: testler tsx ile
 * doğrudan içe aktarıyor.
 */
export const AnalysisInput = z.object({
  requestId: z.uuid(),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,9}$/),
  horizon: z.enum(["short", "medium"]),
  locale: z.enum(["tr", "en"]).default("tr"),
});
const prose = z.string().min(1).max(1800);
/* Açıklamalar JSON şemasıyla modele gider; uzunluk sınırları gevşek tutulur
   (prompt 600 karakter ister), aşan yanıt ücretli çağrıyı boşa düşürmesin. */
export const AnalysisOutput = z.object({
  verdict: z.enum(["buy", "hold", "sell", "insufficient"]).describe("View for the selected horizon; insufficient when evidence cannot support a view."),
  overallScore: z.number().int().min(0).max(100).describe("Technical, business and news evidence combined for the horizon."),
  technicalScore: z.number().int().min(0).max(100).describe("Trend, momentum, volatility and volume."),
  newsScore: z.number().int().min(0).max(100).nullable().describe("Net effect of the cited news; null when no usable news is supplied."),
  summary: prose.describe("Two to four sentences: the view and its main reason."),
  reasons: z.array(prose).min(1).max(5).describe("Two to four concrete supporting points with their numbers."),
  risks: z.array(prose).min(1).max(5).describe("Two to four concrete risks with their numbers."),
  bullScenario: prose.describe("What would have to happen for the positive case, tied to supplied levels."),
  bearScenario: prose.describe("What would have to happen for the negative case, tied to supplied levels."),
  invalidation: prose.describe("Observable conditions that would overturn the view."),
  confidence: z.enum(["low", "medium", "high"]).describe("How firmly the evidence supports the verdict: high when trend, momentum, business quality and news agree; low when they conflict or data is thin."),
  bullLevel: z.number().nullable().describe("The supplied price level whose daily close above would trigger the positive scenario; null if none fits."),
  bearLevel: z.number().nullable().describe("The supplied price level whose daily close below would trigger the negative scenario; null if none fits."),
  takeaways: z.array(z.string().min(1).max(300)).min(1).max(3).describe("Exactly three short lines a reader should take away, most important first, each under 140 characters, each with one supplied number; they must not repeat the summary sentence by sentence."),
  watch: z.array(z.string().min(1).max(400)).min(1).max(4).describe("One to three short, concrete things to watch within the horizon (a level, a scheduled report, a news thread)."),
  news: z.array(z.object({
    sourceIndex: z.number().int().min(0).describe("sourceIndex of a supplied news item."),
    title: z.string().min(1).max(300).describe("The story's headline rendered in request.language, faithful to the original, under 110 characters."),
    impact: prose.describe("How this story bears on the horizon."),
  })).max(8),
});
export type AnalysisResult = z.infer<typeof AnalysisOutput>;
