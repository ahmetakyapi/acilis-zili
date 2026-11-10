import type { Dictionary, Locale } from "@/lib/i18n";
import { getRecommendations } from "@/lib/providers/finnhub";
import { formatEtDateLong, formatPercentPlain } from "@/lib/utils";

/**
 * Bölüm başlıklarının VERİ satırı (10 Kasım 2026, görsel kalite turu).
 *
 * "Değerleme", "Bilançolar" ve "Gündem" yalın birer kelimeydi: 30 puntoluk
 * başlık, altında doğrudan paneller. `ChapterHeading`in `dek` yuvası tam
 * bunun için var ve kuralı orada yazılı: genel bir tanıtım cümlesi değil,
 * o şirketin o bölümdeki TEK satırlık verisi. Okur başlığa bakınca bölümün
 * içinde ne bulacağını sayıyla görüyor.
 *
 * YENİ İSTEK YOK. Bilançolar ve Gündem satırları sayfa kabuğunun zaten
 * okuduğu değerlerden (takvim, yatırımcılar, mercek) kuruluyor ve senkron.
 * Değerleme satırı Analist kartının çağrısını (`getRecommendations`, altı
 * saat önbellekli) paylaşıyor ve akışla geliyor; yedeği aynı yükseklikte
 * görünmez bir satır, yani geldiğinde hiçbir şey kaymıyor. Veri yoksa satır
 * boş kalıyor (yüksekliği korunarak) — uydurma cümle basılmıyor.
 */
const NBSP = " ";

/** Akış yedeği: satırın yerini tutar, okunmaz. */
export function DekPlaceholder() {
  return <span aria-hidden>{NBSP}</span>;
}

/** "Al Yönünde %96 · 69 Analist" — Analist Görüşleri kartının halkasıyla AYNI hesap. */
export async function ValuationDek({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const result = await getRecommendations(symbol);
  const latest = result.ok ? result.data[0] : null;
  const total = latest ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell : 0;
  if (!latest || total === 0) return <DekPlaceholder />;
  const share = formatPercentPlain(((latest.strongBuy + latest.buy) / total) * 100, locale, 0);
  return (
    <span className="numeral">
      {t.stockVisuals.dekValuation.replace("{share}", share).replace("{n}", String(total))}
    </span>
  );
}

/** "Sonraki Rapor 17 Kasım Salı · Kapanış Sonrası" — kabuğun takvim okumasından. */
export function earningsDek(
  next: { date: string; hour: string | null } | null,
  locale: Locale,
  t: Dictionary,
): string | undefined {
  if (!next) return undefined;
  const window =
    next.hour === "amc"
      ? t.earnings.afterClose
      : next.hour === "bmo"
        ? t.earnings.beforeOpen
        : next.hour === "dmh"
          ? t.earnings.duringMarket
          : null;
  const line = t.stockVisuals.dekEarnings.replace("{date}", formatEtDateLong(next.date, locale));
  return window ? `${line} · ${window}` : line;
}

/** "6 Ünlü Yatırımcının Portföyünde · 3 Mercek Yazısı" — kabuğun okumalarından. */
export function contextDek(holders: number, stories: number, t: Dictionary): string | undefined {
  const parts = [
    holders > 0 ? t.stockVisuals.dekHolders.replace("{n}", String(holders)) : null,
    stories > 0 ? t.stockVisuals.dekStories.replace("{n}", String(stories)) : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
