import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { eq, desc, isNull } from "drizzle-orm";
import { db } from "./db";
import { news } from "./schema";

/**
 * Haber çevirisi — Claude ile toplu.
 * ANTHROPIC_API_KEY yoksa sessizce atlanır; arayüz orijinal İngilizce başlığı
 * gösterir. Çeviri yorumlamaz: başlık ve özet birebir Türkçeleştirilir,
 * finans terimleri (Fed, CPI, EPS, hedge fund gibi) yerleşik kullanımına göre
 * korunur ya da çevrilir.
 */

const TranslationSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      headline_tr: z.string(),
      summary_tr: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `Finans haber başlıklarını ve özetlerini Türkçeye çeviren bir editörsün.
- Anlamı birebir koru; yorum, ekleme, süsleme yapma.
- Şirket adları, ürün adları ve borsa sembolleri olduğu gibi kalır.
- Yerleşik finans terimleri Türkçe basındaki kullanımıyla yazılır: Fed, CPI (TÜFE), EPS, halka arz, bilanço, faiz kararı.
- Başlıklar haber başlığı gibi kısa ve doğal olmalı; kelimesi kelimesine çeviri yerine akıcı Türkçe.
- Özet boşsa boş dize döndür.`;

export function isTranslateConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Çevrilmemiş son haberleri çevirir; çevrilen kayıt sayısını döner. */
export async function translatePendingNews(limit = 40): Promise<number> {
  if (!isTranslateConfigured()) return 0;

  const pending = await db
    .select({ id: news.id, headline: news.headline, summary: news.summary })
    .from(news)
    .where(isNull(news.headlineTr))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  if (pending.length === 0) return 0;

  const client = new Anthropic();

  const payload = pending.map((item) => ({
    id: item.id,
    headline: item.headline,
    summary: item.summary?.slice(0, 600) ?? "",
  }));

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(TranslationSchema) },
    messages: [
      {
        role: "user",
        content: `Şu haberleri çevir ve aynı id ile döndür:\n${JSON.stringify(payload)}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) return 0;

  const validIds = new Set(pending.map((item) => item.id));
  let updated = 0;
  for (const item of parsed.items) {
    if (!validIds.has(item.id) || !item.headline_tr.trim()) continue;
    await db
      .update(news)
      .set({
        headlineTr: item.headline_tr.trim(),
        summaryTr: item.summary_tr.trim() || null,
      })
      .where(eq(news.id, item.id));
    updated++;
  }

  return updated;
}
