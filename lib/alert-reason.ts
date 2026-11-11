import type { Locale } from "@/lib/i18n/config";

/**
 * ALARM GEREKÇESİ — saf seçim (11 Kasım, sahibinin isteği: alarm "ne oldu"
 * diyor ama "neden" demiyordu). Tetiklenen fiyat/yüzde alarmının push'una,
 * gelen kutusu satırına ve postasına tek cümlelik "neden hareket etti"
 * eklenir. Okuma ve zaman aşımı `lib/alert-reason-load.ts`; burada yalnız
 * hangi metnin basılacağı.
 *
 * SIRA (yeni Claude çağrısı YOK):
 * 1. Hisse sayfasındaki "Bu Hafta Neden Hareket Etti" notunun (önbellekteki
 *    hâli; lib/stock-insights.ts → getMoveInsight, `CACHE_ONLY`) özetinin
 *    İLK cümlesi. Not "unclear" diyorsa (haberler hareketi açıklamıyor) not
 *    gerekçe sayılmaz: "bilinmiyor" cümlesi bildirimde gürültü.
 * 2. Yoksa son 48 saatin EN YENİ manşeti, kaynağıyla ("… (Reuters)"); TR'de
 *    çevirisi varsa çevirisi.
 * 3. O da yoksa hiçbir şey — bildirim bugünkü hâliyle gider.
 *
 * Neden alarm anında yeni not yazdırılmıyor: tetik sert günlerde onlarca
 * sembolde birden düşer; her biri Claude'a giderse günlük ortak tavanı
 * (lib/claude-budget.ts) hisse sayfalarının elinden alır ve teslimatı
 * saniyelerce bekletir. Önbellekteki not ve veritabanındaki manşet bedava.
 *
 * Not BEŞ SEANSI anlatır, alarm bugünü: cümle "bu hafta" çerçevesiyle
 * okunur, postada kaynağı ("Hisse Sayfasındaki Claude Notundan") yazar.
 */

export type ReasonNote = {
  explained: "news" | "market" | "mixed" | "unclear";
  summary: { tr: string; en: string };
};

export type ReasonHeadline = {
  headline: string;
  headlineTr: string | null;
  source: string | null;
  publishedAt: Date;
};

export type AlertReason =
  | { kind: "note"; text: { tr: string; en: string } }
  | { kind: "headline"; text: { tr: string; en: string }; source: string | null };

/** Manşetin geçerlilik penceresi. */
export const REASON_NEWS_WINDOW_MS = 48 * 3600_000;
/** Bildirime giden cümlenin tavanı — push gövdesi ve gelen kutusu satırı kısa kalsın. */
export const REASON_MAX_CHARS = 180;

/**
 * Metnin ilk cümlesi. Nokta ancak ardından boşluk ve büyük harf/rakam/tırnak
 * geliyorsa cümle sonu sayılır: "3.5" ya da "%3,5" bölünmez; "Inc. ile"
 * gibi küçük harfle süren kısaltma da bölünmez.
 */
export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = /^(.+?[.!?…])(?=\s+["“'(\p{Lu}\p{N}])/u.exec(clean);
  return clip(match ? match[1]! : clean);
}

/** Tavanı aşan metin kelime sınırında kesilir, sonuna "…". */
export function clip(text: string, max = REASON_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/u, "")}…`;
}

export function pickAlertReason(input: { note: ReasonNote | null; headlines: readonly ReasonHeadline[]; now: Date }): AlertReason | null {
  const { note, headlines, now } = input;
  if (note && note.explained !== "unclear") {
    const tr = firstSentence(note.summary.tr);
    const en = firstSentence(note.summary.en);
    if (tr && en) return { kind: "note", text: { tr, en } };
  }
  const since = now.getTime() - REASON_NEWS_WINDOW_MS;
  const latest = headlines
    .filter((h) => h.headline.trim() && h.publishedAt.getTime() >= since && h.publishedAt.getTime() <= now.getTime() + 5 * 60_000)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0];
  if (!latest) return null;
  const en = clip(latest.headline);
  const tr = clip(latest.headlineTr?.trim() || latest.headline);
  const source = latest.source?.trim() || null;
  return { kind: "headline", text: { tr, en }, source };
}

/** Push ve gelen kutusu için tek satır: not cümlesi düz, manşet kaynağıyla. */
export function reasonLine(reason: AlertReason, locale: Locale): string {
  const text = reason.text[locale];
  return reason.kind === "headline" && reason.source ? `${text} (${reason.source})` : text;
}

/** Bildirim gövdesinin altına gerekçe satırı; gerekçe yoksa gövde aynen. */
export function withReason(body: string, reason: AlertReason | null | undefined, locale: Locale): string {
  return reason ? `${body}\n${reasonLine(reason, locale)}` : body;
}
