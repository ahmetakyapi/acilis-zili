import Anthropic from "@anthropic-ai/sdk";
import type { EconomicEventRow, EarningsRow } from "./schema";
import type { Quote } from "./providers/types";
import type { Locale } from "./i18n/config";
import { formatPercent } from "./utils";

/**
 * Günlük özet üretimi.
 *
 * İki kademe: ANTHROPIC_API_KEY varsa Claude doğal dilde kısa bir piyasa
 * brifingi yazar; yoksa kural tabanlı özet üretilir (olaylar + bilançolar +
 * endeks durumu listelenir). İkisi de yalnızca kendisine verilen gerçek
 * verilerden konuşur — modelden tahmin veya yatırım tavsiyesi istenmez.
 */

export type BriefInput = {
  dateEt: string;
  locale: Locale;
  events: EconomicEventRow[];
  earnings: EarningsRow[];
  indexQuotes: { symbol: string; label: string; quote: Quote | null }[];
};

export type BriefOutput = {
  headline: string;
  bodyMd: string;
  generatedBy: "rules" | "claude";
};

/* --------------------------------------------------------------------------
   Kural tabanlı özet — her zaman çalışır
   -------------------------------------------------------------------------- */

export function buildRulesBrief(input: BriefInput): BriefOutput {
  const { locale, events, earnings, indexQuotes } = input;
  const tr = locale === "tr";
  const lines: string[] = [];

  const highEvents = events.filter((e) => e.importance === "high");
  const headline =
    highEvents.length > 0
      ? tr
        ? `Bugün ${highEvents.length} kritik veri açıklanıyor`
        : `${highEvents.length} high-impact release${highEvents.length > 1 ? "s" : ""} today`
      : earnings.length > 0
        ? tr
          ? `Sakin makro gün — ${earnings.length} şirket bilanço açıklıyor`
          : `Quiet macro day — ${earnings.length} compan${earnings.length > 1 ? "ies" : "y"} reporting`
        : tr
          ? "Sakin bir gün görünüyor"
          : "A quiet session ahead";

  if (events.length > 0) {
    lines.push(tr ? "**Takvim:**" : "**Calendar:**");
    for (const event of events.slice(0, 6)) {
      const title = tr ? event.titleTr : event.titleEn;
      const time = event.eventTimeEt ? `${event.eventTimeEt} ET — ` : "";
      const forecast = event.forecast
        ? tr
          ? ` (beklenti: ${event.forecast}${event.unit === "%" ? "%" : ""})`
          : ` (forecast: ${event.forecast}${event.unit === "%" ? "%" : ""})`
        : "";
      lines.push(`- ${time}${title}${forecast}`);
    }
    lines.push("");
  }

  if (earnings.length > 0) {
    const bmo = earnings.filter((e) => e.hour === "bmo").map((e) => e.symbol);
    const amc = earnings.filter((e) => e.hour === "amc").map((e) => e.symbol);
    lines.push(tr ? "**Bilançolar:**" : "**Earnings:**");
    if (bmo.length > 0) {
      lines.push(
        tr
          ? `- Açılış öncesi: ${bmo.slice(0, 8).join(", ")}`
          : `- Before the open: ${bmo.slice(0, 8).join(", ")}`,
      );
    }
    if (amc.length > 0) {
      lines.push(
        tr
          ? `- Kapanış sonrası: ${amc.slice(0, 8).join(", ")}`
          : `- After the close: ${amc.slice(0, 8).join(", ")}`,
      );
    }
    lines.push("");
  }

  const quoted = indexQuotes.filter((q) => q.quote !== null);
  if (quoted.length > 0) {
    lines.push(tr ? "**Endeksler (son kapanışa göre):**" : "**Indices (vs prior close):**");
    for (const { label, quote } of quoted) {
      if (!quote) continue;
      lines.push(`- ${label}: ${formatPercent(quote.changePct, locale)}`);
    }
  }

  return {
    headline,
    bodyMd: lines.join("\n").trim() || (tr ? "Bugün için kayıtlı veri yok." : "Nothing on the docket today."),
    generatedBy: "rules",
  };
}

/* --------------------------------------------------------------------------
   Claude ile doğal dilde özet — anahtar varsa
   -------------------------------------------------------------------------- */

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `Sen bir piyasa bülteni editörüsün. Sana verilen YAPILANDIRILMIŞ VERİDEN başka hiçbir bilgi kullanma — tahmin yürütme, fiyat hedefi verme, yatırım tavsiyesi verme, veri uydurma.

Görev: ABD piyasaları için güne başlarken okunacak kısa bir brifing yaz.
- İlk satır: en fazla 60 karakterlik bir başlık (markdown işareti olmadan).
- Sonra boş satır, ardından 3-6 cümlelik gövde. Gövdede markdown kullanabilirsin.
- Günün en önemli olayını öne al; saatleri ET olarak belirt.
- Endeks değişimlerini bağlam olarak kullan ("dün Nasdaq %1,2 yükseldi" gibi).
- Ton: sakin, net, profesyonel. Abartı yok, ünlem yok.
- İstenen dilde yaz (tr = Türkçe, en = İngilizce). Finans terimleri (CPI, FOMC, EPS) orijinal kalır.`;

export async function generateClaudeBrief(
  input: BriefInput,
): Promise<BriefOutput | null> {
  if (!isClaudeConfigured()) return null;

  const client = new Anthropic();

  const payload = {
    language: input.locale,
    date_et: input.dateEt,
    economic_events: input.events.map((e) => ({
      time_et: e.eventTimeEt,
      title: input.locale === "tr" ? e.titleTr : e.titleEn,
      importance: e.importance,
      forecast: e.forecast,
      previous: e.previous,
      unit: e.unit,
    })),
    earnings: input.earnings.map((e) => ({
      symbol: e.symbol,
      timing: e.hour,
      eps_estimate: e.epsEstimate,
    })),
    index_changes_pct: input.indexQuotes
      .filter((q) => q.quote)
      .map((q) => ({ index: q.label, change_pct: q.quote?.changePct })),
  };

  try {
    // Server-side fallback açık: güvenlik sınıflandırıcısı nadiren de olsa
    // reddederse istek otomatik olarak yedek modelde tekrar çalışır.
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Bugünün verisi:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) return null;

    const [firstLine, ...rest] = text.split("\n");
    const body = rest.join("\n").trim();
    if (!body) {
      return { headline: input.dateEt, bodyMd: text, generatedBy: "claude" };
    }

    return {
      headline: firstLine.replace(/^#+\s*/, "").trim(),
      bodyMd: body,
      generatedBy: "claude",
    };
  } catch {
    // Model erişilemezse kural tabanlı özet devreye girer.
    return null;
  }
}

export async function buildDailyBrief(input: BriefInput): Promise<BriefOutput> {
  const claude = await generateClaudeBrief(input);
  return claude ?? buildRulesBrief(input);
}
