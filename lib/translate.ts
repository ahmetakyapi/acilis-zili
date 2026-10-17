import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { eq, desc, isNull } from "drizzle-orm";
import { claudeKey } from "./claude-key";
import { db } from "./db";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./providers/timeout";
import { news } from "./schema";

/**
 * Haber çevirisi — çok sağlayıcılı.
 *
 * Öncelik sırası (17 Ekim'de Claude öne alındı — başlıkları daha doğal,
 * sitenin terim ve sayı biçimine uyuyor; Haiku ile maliyeti DeepL'in
 * ücretli katmanından düşük):
 *   1. ANTHROPIC_API_KEY  → Claude
 *   2. CLAUDE_ANALYSIS_API_KEY → aynı Claude çağrısı, analiz anahtarıyla
 *      (sunucuda tanımlı tek Claude anahtarı buydu ve çeviri ona hiç
 *      bakmıyordu — haberler İngilizce kalıyordu)
 *   3. DEEPL_API_KEY      → DeepL API Free (ayda 500K karakter ücretsiz)
 *   4. hiçbiri            → çeviri atlanır, arayüz orijinali gösterir
 *
 * Kadans: günlük cron (hafta içi) ve /api/cron/haberler (her gün üç kez,
 * deploy/cron-news.sh) — çevrilen satır tabloda kalır, ikinci kez çevrilmez.
 *
 * Ücretsiz DeepL kotasını korumak için özetler kırpılır; başlıklar tam
 * çevrilir. Günlük ~40 yeni haber ≈ ayda ~400K karakter — limitin altında.
 */

const SUMMARY_CLIP = 350;

export type TranslateBackend = "deepl" | "claude" | null;

export function activeTranslateBackend(): TranslateBackend {
  if (claudeKey()) return "claude";
  if (process.env.DEEPL_API_KEY) return "deepl";
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

/* Yönerge (17 Ekim, Haiku'ya geçişle yeniden yazıldı). Sitenin dili
   CLAUDE.md'de: başlık TITLE CASE DEĞİL, haber başlığı cümle düzeninde
   (TopNews, haber kartı); sayı biçimi Türkçe; terimler sözlüğe uygun.
   Örnek çiftler modelin en çok kaydığı yerleri sabitliyor: "beats
   estimates", "guidance", "shares rise/fall", büyüklük birimleri. */
const CLAUDE_SYSTEM = `Açılış Zili (ABD borsalarını Türkçe takip eden bir site) için finans haberlerinin başlık ve özetlerini Türkçeye çeviriyorsun.

Kurallar:
- Anlamı birebir koru. Yorum, tahmin, ekleme ya da süsleme yapma; kaynakta olmayan bilgi yazma.
- Şirket, ürün, kişi adları ve borsa sembolleri olduğu gibi kalır (Nvidia, iPhone, $NVDA, NVDA).
- Başlık doğal bir Türkçe haber başlığı olsun: kısa, etken, cümle düzeninde (her kelime büyük harfle BAŞLAMAZ). Sonuna nokta koyma.
- Sayılar Türkçe biçimde: ondalık virgül (3,5), binlik nokta (1.250), yüzde işareti önde (%12), para birimi sonda (4,2 milyar dolar). "bn/billion" milyar, "m/million" milyon, "trillion" trilyon.
- Yerleşik karşılıklar: earnings = bilanço, EPS = hisse başına kâr (HBK), revenue = gelir, guidance = beklenti/öngörü, beats estimates = beklentiyi aştı, misses = beklentinin altında kaldı, shares rise/fall = hisseleri yükseldi/düştü, rate cut = faiz indirimi, Fed = Fed, CPI = TÜFE, PCE = PCE, jobs report = istihdam raporu, IPO = halka arz, buyback = hisse geri alımı, downgrade/upgrade = not indirimi/artırımı, price target = hedef fiyat, Wall Street = Wall Street.
- Özet akıcı Türkçe olsun, kaynak özetten uzun olmasın. Özet boşsa boş dize döndür.
- Her öğeyi aldığın id ile, aynı sırada döndür; hiçbir öğeyi atlama.`;

/** Paket boyu: tek istekte 20 haber. Kırk haberlik tek istek yavaşladığında
    koşunun tamamı düşüyordu; paket düşerse yalnız o paket sonraki koşuya
    kalır. */
const CLAUDE_CHUNK = 20;

/**
 * Model (17 Ekim, sahibinin onayıyla): Claude Haiku 5.5. Çeviri kısa,
 * kalıplı bir iş; Opus'un fiyatının ~%3'üne (giriş 0,10 $, çıkış 0,50 $ /
 * milyon jeton) günde üç koşu × ~40 haber ayda birkaç dolar bile tutmuyor.
 * `TRANSLATE_MODEL` ile değiştirilebilir. Haiku 5.5'te düşünme varsayılan
 * açık; çeviri için `effort: "low"` — düşünmeyi çoğu istekte atlıyor.
 */
const translateModel = () => process.env.TRANSLATE_MODEL?.trim() || "claude-haiku-5-5";

async function translateWithClaude(items: PendingItem[]): Promise<Translated[]> {
  const out: Translated[] = [];
  for (let i = 0; i < items.length; i += CLAUDE_CHUNK) {
    out.push(...(await translateChunkWithClaude(items.slice(i, i + CLAUDE_CHUNK))));
  }
  return out;
}

async function translateChunkWithClaude(items: PendingItem[]): Promise<Translated[]> {
  try {
    const client = new Anthropic({ apiKey: claudeKey() });
    const payload = items.map((item) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary?.slice(0, 600) ?? "",
    }));

    /* SÜRE SINIRI. Yavaşlayan istek cron'un tamamını bekletmesin
       (`providers/timeout.ts` → BACKGROUND_TIMEOUT_MS). Süre dolarsa
       aşağıdaki `catch` boş dizi döndürür — bu paket sonraki koşuya kalır. */
    const response = await withTimeout(
      client.messages.parse({
        model: translateModel(),
        max_tokens: 16000,
        system: CLAUDE_SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(TranslationSchema) },
        messages: [
          {
            role: "user",
            content: `Şu haberleri çevir ve aynı id ile döndür:\n${JSON.stringify(payload)}`,
          },
        ],
      }),
      BACKGROUND_TIMEOUT_MS,
    );
    if (response.stop_reason === "refusal") return [];

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
  } catch (error) {
    console.error(`[çeviri] paket düştü: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
