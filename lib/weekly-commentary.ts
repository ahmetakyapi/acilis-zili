import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { numbersGrounded } from "@/lib/ai-grounding";
import { claudeKey } from "@/lib/claude-key";
import type { Locale } from "@/lib/i18n/config";
import { emailPercent } from "@/lib/notify-emails";
import type { DigestData } from "@/lib/weekly-digest";

/**
 * PAZAR ÖZETİNİN YORUMU (17 Ekim) — postanın iki bölüm bandının altındaki
 * kısa paragraflar: geride kalan hafta ve yeni hafta. Claude yazar, YALNIZ
 * postanın kendi verisinden (endeks yüzdeleri, bilanço karnesi, haber
 * başlıkları, takvim). Sahibinin isteği: "geçen haftanın özeti, bu hafta
 * bizi ne bekliyor — bir yazı".
 *
 * YAZMA KATMANI KURALI (CLAUDE.md "Veri dürüstlüğü"): posta gidince geri
 * alınamaz. Bu yüzden:
 * - Modele yalnız postada basılan sayılar BİÇİMLENMİŞ hâlde verilir; model
 *   hesap yapmaz, yeni sayı üretmez.
 * - Çıktıdaki her sayı girdide geçmek ZORUNDA (`numbersGrounded`, lib/ai-grounding.ts); geçmeyen
 *   tek bir sayı yorumu düşürür. Posta yorumsuz da eksiksiz.
 * - Fiyat yönü tahmini, öneri ve "yatırım tavsiyesi" dili yasak; postada
 *   ayrıca "Claude ile yazıldı" künyesi var.
 *
 * Dil başına haftada BİR çağrı: süreç önbelleği hafta + dil anahtarıyla;
 * saatlik tekrar koşuları aynı metni kullanır (alıcılar arasında fark yok).
 * Maliyet: Opus 5.5'te ~3K giriş + ~400 çıkış jetonu ≈ 0,02 $.
 */

export type DigestCommentary = { past: string; ahead: string };

const Schema = z.object({ past: z.string(), ahead: z.string() });

const SYSTEM = {
  tr: `Açılış Zili'nin pazar özeti postası için kısa bir hafta yorumu yazıyorsun. Okur, ABD borsalarını Türkçe takip eden bireysel yatırımcı.

İki paragraf yaz:
- past: geride kalan haftanın hikâyesi — öne çıkan haberler ve büyük şirketlerin bilançoları önde, endeksler bağlam olarak. Şirketleri adıyla an; kaç şirketin açıkladığını ya da beklentiyi aştığını SAYMA. En çok 70 kelime.
- ahead: yeni haftada nelere dikkat edileceği — hangi gün hangi büyük şirket açıklıyor, önemli veriler. Şirketleri adıyla an; günlük şirket sayısı verme. En çok 60 kelime.

Kurallar:
- YALNIZ verilen veriyi kullan. Verilmeyen hiçbir sayı, tarih, fiyat ya da olay yazma; hesap yapma (fark, toplam, ortalama yok). Sayıyı kullanırsan verilen biçimde aynen yaz.
- Fiyat ya da endeks yönü tahmini yapma, al/sat/tut önerme, "fırsat" deme. Neyin izleneceğini söyle, ne olacağını değil.
- Düz, sakin, gazete dili. Ünlem, emoji, başlık, madde işareti yok. "Sen" diye hitap edebilirsin.
- Bir bölüm için veri yoksa o paragrafı kısa tut ve veri yokluğunu uydurma bir anlatıyla doldurma.`,
  en: `You write a short weekly commentary for Açılış Zili's Sunday digest email. The reader is an individual investor following US markets.

Write two paragraphs:
- past: the story of the week behind — the key headlines and the big companies' earnings first, the indices as context. Name the companies; do NOT count how many reported or beat. At most 70 words.
- ahead: what to watch in the week ahead — which big company reports on which day, and key data. Name the companies; no per-day company counts. At most 60 words.

Rules:
- Use ONLY the data given. Do not write any number, date, price or event that is not given; do not compute (no differences, sums or averages). If you use a number, copy it exactly as formatted.
- No predictions of price or index direction, no buy/sell/hold advice, no "opportunity". Say what to watch, not what will happen.
- Plain, calm newspaper prose. No exclamation marks, emoji, headings or bullet points. Address the reader as "you" if needed.
- If a section has no data, keep that paragraph short and do not fill the gap with invented narrative.`,
} as const;

/** Postada basılan biçimle aynı: model bu metinleri görür, sayıları buradan kopyalar. */
function payloadOf(data: DigestData) {
  const pct = (value: number, digits = 2) => emailPercent(value, data.locale, digits);
  const day = (date: string) =>
    new Intl.DateTimeFormat(data.locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${date}T12:00:00Z`),
    );
  return {
    pastWeek: `${day(data.pastMonday)} – ${day(data.pastFriday)}`,
    indices: data.indices.map((i) => ({ name: i.label, weeklyChange: pct(i.changePct), dailySteps: i.steps.map((s) => `${day(s.date)}: ${pct(s.changePct)}`) })),
    reported: data.reported.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      weeklyStockChange: r.week ? pct(r.week.changePct, 1) : null,
      eps: r.eps ? { verdict: r.eps.direction, surprise: r.eps.ratio !== null ? pct(r.eps.ratio * 100, 1) : null } : null,
      revenue: r.revenue ? { verdict: r.revenue.direction, surprise: r.revenue.ratio !== null ? pct(r.revenue.ratio * 100, 1) : null } : null,
    })),
    weeklyBrief: data.brief?.headline ?? null,
    headlines: [...data.stories, ...data.news].map((l) => l.title),
    nextWeek: `${day(data.thisMonday)} – ${day(data.thisFriday)}`,
    earningsAhead: data.aheadFailed
      ? null
      : data.ahead.map((d) => ({ day: day(d.date), marketClosed: d.closed, largest: d.items.map((i) => (i.name ? `${i.name} (${i.symbol})` : i.symbol)) })),
    keyData: data.eventsFailed ? null : data.events.map((e) => ({ day: day(e.date), time: e.time, title: e.title })),
    nextKeyDataAfterThisWeek: data.nextEvent ? { day: day(data.nextEvent.date), title: data.nextEvent.title } : null,
  };
}

const cache = new Map<string, DigestCommentary | null>();

export async function weeklyCommentary(data: DigestData): Promise<DigestCommentary | null> {
  const key = `${data.locale}:${data.thisMonday}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const apiKey = claudeKey();
  if (!apiKey) return null;
  const input = JSON.stringify(payloadOf(data));
  const result = await write(apiKey, data.locale, input);
  /* Yalnız başarı önbelleğe girer: düşen çağrı sonraki saatlik koşuda
     yeniden denensin (o koşuda kalan alıcılar yorumu alır). */
  if (result && !data.pastFailed && !data.aheadFailed) cache.set(key, result);
  return result;
}

async function write(apiKey: string, locale: Locale, input: string): Promise<DigestCommentary | null> {
  try {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });
    /* Reddetmede sunucu tarafı yedek model (fallbacks "default"): finans
       metni nadiren takılır ama takılırsa yorum yine yazılsın. */
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM[locale],
      output_config: { effort: "medium", format: betaZodOutputFormat(Schema) },
      messages: [{ role: "user", content: input }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    const out = { past: response.parsed_output.past.trim(), ahead: response.parsed_output.ahead.trim() };
    if (!out.past || !out.ahead) return null;
    if (!numbersGrounded(`${out.past} ${out.ahead}`, input)) {
      console.error("[haftalık yorum] girdide olmayan sayı — yorum düşürüldü");
      return null;
    }
    return out;
  } catch (error) {
    console.error(`[haftalık yorum] yazılamadı: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
