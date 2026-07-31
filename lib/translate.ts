import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { eq, desc, isNull } from "drizzle-orm";
import { db } from "./db";
import { news } from "./schema";

/**
 * Haber çevirisi — çok sağlayıcılı.
 *
 * Öncelik sırası:
 *   1. DEEPL_API_KEY      → DeepL API Free (ayda 500K karakter ücretsiz)
 *   2. ANTHROPIC_API_KEY  → Claude (daha doğal başlıklar, ücretli)
 *   3. hiçbiri            → çeviri atlanır, arayüz orijinali gösterir
 *
 * Ücretsiz DeepL kotasını korumak için özetler kırpılır; başlıklar tam
 * çevrilir. Günlük ~40 yeni haber ≈ ayda ~400K karakter — limitin altında.
 */

const SUMMARY_CLIP = 350;

export type TranslateBackend = "deepl" | "claude" | null;

export function activeTranslateBackend(): TranslateBackend {
  if (process.env.DEEPL_API_KEY) return "deepl";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

export function isTranslateConfigured(): boolean {
  return activeTranslateBackend() !== null;
}

type PendingItem = { id: string; headline: string; summary: string | null };

/** Çevrilmemiş son haberleri çevirir; çevrilen kayıt sayısını döner. */
export async function translatePendingNews(limit = 40): Promise<number> {
  const backend = activeTranslateBackend();
  if (!backend) return 0;

  const pending: PendingItem[] = await db
    .select({ id: news.id, headline: news.headline, summary: news.summary })
    .from(news)
    .where(isNull(news.headlineTr))
    .orderBy(desc(news.publishedAt))
    .limit(limit);

  if (pending.length === 0) return 0;

  const results =
    backend === "deepl"
      ? await translateWithDeepL(pending)
      : await translateWithClaude(pending);

  let updated = 0;
  for (const item of results) {
    if (!item.headlineTr.trim()) continue;
    await db
      .update(news)
      .set({
        headlineTr: item.headlineTr.trim(),
        summaryTr: item.summaryTr?.trim() || null,
      })
      .where(eq(news.id, item.id));
    updated++;
  }
  return updated;
}

type Translated = { id: string; headlineTr: string; summaryTr: string | null };

/* --------------------------------------------------------------------------
   DeepL — ücretsiz katman (api-free.deepl.com)
   Tek istekte çoklu metin desteklenir; başlıklar ve özetler tek çağrıda
   sıralı dizi olarak gönderilir.
   -------------------------------------------------------------------------- */

async function translateWithDeepL(items: PendingItem[]): Promise<Translated[]> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return [];

  // Ücretli anahtarlar ":fx" içermez ve api.deepl.com kullanır.
  const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";

  // Metin dizisi: [b1, ö1, b2, ö2, ...] — boş özet için boşluk tutucu.
  const texts: string[] = [];
  for (const item of items) {
    texts.push(item.headline);
    texts.push(item.summary ? item.summary.slice(0, SUMMARY_CLIP) : "");
  }

  try {
    const res = await fetch(`https://${host}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        source_lang: "EN",
        target_lang: "TR",
        // Başlık kısalığında cümle bölünmesin
        split_sentences: "1",
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      translations?: { text: string }[];
    };
    const out = data.translations ?? [];
    if (out.length !== texts.length) return [];

    return items.map((item, index) => ({
      id: item.id,
      headlineTr: out[index * 2]?.text ?? "",
      summaryTr: item.summary ? (out[index * 2 + 1]?.text ?? null) : null,
    }));
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------------------
   Claude — anahtar varsa tercih edilebilir (daha doğal başlık dili)
   -------------------------------------------------------------------------- */

const TranslationSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      headline_tr: z.string(),
      summary_tr: z.string(),
    }),
  ),
});

const CLAUDE_SYSTEM = `Finans haber başlıklarını ve özetlerini Türkçeye çeviren bir editörsün.
- Anlamı birebir koru; yorum, ekleme, süsleme yapma.
- Şirket adları, ürün adları ve borsa sembolleri olduğu gibi kalır.
- Yerleşik finans terimleri Türkçe basındaki kullanımıyla yazılır: Fed, CPI (TÜFE), EPS, halka arz, bilanço, faiz kararı.
- Başlıklar haber başlığı gibi kısa ve doğal olmalı.
- Özet boşsa boş dize döndür.`;

async function translateWithClaude(items: PendingItem[]): Promise<Translated[]> {
  try {
    const client = new Anthropic();
    const payload = items.map((item) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary?.slice(0, 600) ?? "",
    }));

    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: CLAUDE_SYSTEM,
      output_config: { format: zodOutputFormat(TranslationSchema) },
      messages: [
        {
          role: "user",
          content: `Şu haberleri çevir ve aynı id ile döndür:\n${JSON.stringify(payload)}`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return [];

    const validIds = new Set(items.map((item) => item.id));
    return parsed.items
      .filter((item) => validIds.has(item.id))
      .map((item) => ({
        id: item.id,
        headlineTr: item.headline_tr,
        summaryTr: item.summary_tr || null,
      }));
  } catch {
    return [];
  }
}
