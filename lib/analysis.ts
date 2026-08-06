import type { Dictionary } from "@/lib/i18n";

/**
 * Görüş ve skorun tek kaynağı.
 *
 * Kayıtta `buy | hold | sell` duruyor, ekranda AL/TUT/SAT ya da BUY/HOLD/SELL
 * yazıyor: karar bir veri değeri, üç harfli kısaltma onun çevirisi. Rutin
 * yanlış bir dize gönderirse `hold`'a düşülür — sayfa çökmez, en nötr karar
 * gösterilir.
 */
export type VerdictKey = "buy" | "hold" | "sell";

export function verdictOf(raw: string | null | undefined): VerdictKey {
  const key = raw?.trim().toLowerCase();
  if (key === "buy" || key === "al") return "buy";
  if (key === "sell" || key === "sat") return "sell";
  return "hold";
}

export function verdictLabel(verdict: VerdictKey, t: Dictionary): string {
  return verdict === "buy"
    ? t.analysis.verdictBuy
    : verdict === "sell"
      ? t.analysis.verdictSell
      : t.analysis.verdictHold;
}

/** Metin ve halka rengi — AL yükseliş yeşili, SAT düşüş kırmızısı, TUT nötr. */
export function verdictTextClass(verdict: VerdictKey): string {
  return verdict === "buy"
    ? "text-up"
    : verdict === "sell"
      ? "text-down"
      : "text-primary";
}

/** Rozet zemini — aynı üçlü, yıkanmış hâli. */
export function verdictPillClass(verdict: VerdictKey): string {
  return verdict === "buy"
    ? "bg-up-wash text-up"
    : verdict === "sell"
      ? "bg-down-wash text-down"
      : "bg-primary-wash text-primary";
}

/** SVG halkasının `stroke` değeri — CSS değişkeni doğrudan verilir. */
export function verdictStroke(verdict: VerdictKey): string {
  return verdict === "buy"
    ? "var(--up)"
    : verdict === "sell"
      ? "var(--down)"
      : "var(--primary)";
}

export function analysisHref(symbol: string, period: string): string {
  return `/bilancolar/${symbol.toLowerCase()}/${period}`;
}

/**
 * Dönem etiketinden URL parçası.
 *
 * "4Ç FY2026" → "4c-fy2026". Türkçe harfler ASCII'ye indirilir çünkü bu bir
 * adres: `Ç` yüzdelik kaçışla yazılınca bağlantı paylaşılamaz hâle geliyor.
 */
export function periodSlug(label: string): string {
  return label
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
