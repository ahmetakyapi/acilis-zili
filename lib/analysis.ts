import type { AnalysisIndexRow, SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import {
  formatCompact,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";

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

/* --------------------------------------------------------------------------
   Tablo satırının görünüm modeli

   Analiz tablosu ARTIK bir istemci bileşeni (anlık arama için) ama sözlüğün
   tamamını istemciye taşımak istemiyoruz — `lib/i18n/dictionaries/tr.ts` yedi
   yüz satır ve tablonun ihtiyacı olan on beş dize. Bu yüzden hücrelerin
   metinleri SUNUCUDA hesaplanıyor; istemciye yalnızca basılacak dizeler
   gidiyor. Biçimlendirme (binlik ayracı, yüzde işaretinin yeri) da böylece
   sunucuda ve dile göre kalıyor.
   -------------------------------------------------------------------------- */

export type CellTone = "up" | "down" | "muted";

export type AnalysisRowView = {
  key: string;
  href: string;
  symbol: string;
  company: string;
  periodLabel: string;
  logoUrl: string | null;
  reported: string;
  revenue: string;
  revenueTone: CellTone;
  eps: string;
  epsTone: CellTone;
  reaction: string;
  reactionTone: CellTone;
  score: number;
  verdict: VerdictKey;
  verdictText: string;
  /** Aramanın taradığı alan — küçültülmüş sembol + şirket + dönem. */
  search: string;
};

function toneOf(value: number | null | undefined): CellTone {
  if (value === null || value === undefined || Number.isNaN(value)) return "muted";
  return value >= 0 ? "up" : "down";
}

/** Türkçe küçültme: `toLowerCase()` "I" harfini yanlış çeviriyor. */
export function foldForSearch(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

/**
 * Kayıt satırını tablo satırına çevirir.
 *
 * Sunucuda koşar (sözlük ve biçimlendirme orada kalsın diye) ve çıktısı
 * tamamen serileştirilebilir — istemci bileşenine prop olarak geçer.
 */
export function toAnalysisRowView(
  row: AnalysisIndexRow,
  meta: SymbolMeta | undefined,
  locale: Locale,
  t: Dictionary,
): AnalysisRowView {
  const timing =
    row.timing === "bmo"
      ? t.earnings.beforeOpenShort
      : row.timing === "amc"
        ? t.earnings.afterCloseShort
        : row.timing === "dmh"
          ? t.earnings.duringMarket
          : t.earnings.timeUnknown;

  const revenueTone = toneOf(row.revenueYoyPct);
  const revenue =
    row.revenue !== null
      ? `${formatCompact(row.revenue, locale)} $` +
        (row.revenueYoyPct !== null
          ? ` ${row.revenueYoyPct >= 0 ? "▲" : "▼"} ${formatPercentPlain(row.revenueYoyPct, locale, 0)}`
          : "")
      : "—";

  const eps =
    row.eps !== null
      ? formatPrice(row.eps, locale, { currency: true }) +
        (row.epsSurprisePct !== null
          ? ` · ${formatPercent(row.epsSurprisePct, locale, 0)}`
          : "")
      : "—";

  const reaction =
    row.reactionPct !== null
      ? `${row.reactionPct >= 0 ? "▲" : "▼"} ${formatPercentPlain(row.reactionPct, locale, 1)}`
      : "—";

  const verdict = verdictOf(row.verdict);

  return {
    key: `${row.symbol}-${row.period}`,
    href: analysisHref(row.symbol, row.period),
    symbol: row.symbol,
    company: row.company,
    periodLabel: row.periodLabel,
    logoUrl: meta?.logoUrl ?? null,
    reported: `${formatEtDateCompact(row.reportDate, locale)} · ${timing}`,
    revenue,
    revenueTone,
    eps,
    epsTone: toneOf(row.epsSurprisePct),
    reaction,
    reactionTone: toneOf(row.reactionPct),
    score: row.score,
    verdict,
    verdictText: verdictLabel(verdict, t),
    search: foldForSearch(
      `${row.symbol} ${row.company} ${row.periodLabel} ${row.sector ?? ""}`,
    ),
  };
}

/** Tablonun ihtiyaç duyduğu on beş dize — sözlüğün tamamı yerine bu gider. */
export function analysisTableLabels(t: Dictionary) {
  return {
    colSymbol: t.analysis.colSymbol,
    colCompany: t.analysis.colCompany,
    colReported: t.analysis.colReported,
    colRevenue: t.analysis.colRevenue,
    colEps: t.analysis.colEps,
    colReaction: t.analysis.colReaction,
    colScore: t.analysis.colScore,
    colVerdict: t.analysis.colVerdict,
    colCard: t.analysis.colCard,
    cardLink: t.analysis.reportCardLink,
    searchPlaceholder: t.analysis.searchPlaceholder,
    searchEmpty: t.analysis.searchEmpty,
    searchClear: t.analysis.searchClear,
    resultCount: t.analysis.resultCount,
  };
}
