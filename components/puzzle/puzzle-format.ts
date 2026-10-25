/**
 * "Hisseyi Bil" ekran biçimleri — ipucu değeri, piyasa değeri bandı, karo
 * metni. Düz modül (`"use client"` değil): oyunun parçaları ayrı
 * dosyalarda ve hepsi aynı biçimi kullanıyor.
 */
import { formatMoneyCompact, formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";
import { CAP_BANDS, IPO_YEAR_FLOOR, type Clue, type GuessFeedback, type TileKind } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/* Bant sınırları yuvarlak sayılar: "75,0 Mr $" değil "75 Mr $". */
export const capText = (value: number, locale: Locale) => formatMoneyCompact(value, locale).replace(/[.,]0+(?!\d)/, "");

export function capBandText(band: number, locale: Locale, labels: StockPuzzleLabels): string {
  const lower = CAP_BANDS[band];
  const upper = CAP_BANDS[band + 1];
  if (band === 0 && upper !== undefined) return fill(labels.capBelow, { v: capText(upper, locale) });
  if (upper === undefined) return fill(labels.capAbove, { v: capText(lower, locale) });
  return `${capText(lower, locale)} - ${capText(upper, locale)}`;
}

export function clueValue(clue: Clue, locale: Locale, labels: StockPuzzleLabels): string {
  switch (clue.kind) {
    case "silhouette":
      return labels.silhouetteNote;
    case "sector":
      return clue.sector;
    case "capBand":
      return capBandText(clue.band, locale, labels);
    case "ipoYear":
      return String(clue.year);
    case "revenueGrowth":
      return formatPercent(clue.pct, locale, 1);
    case "initial":
      return clue.letter;
    case "dividend":
      return clue.yieldPct > 0 ? formatPercentPlain(clue.yieldPct, locale, 2) : labels.dividendNone;
    case "beta":
      return fill(labels.betaValue, { v: formatPrice(clue.beta, locale, { digits: 2 }) });
    case "industry":
      return clue.industry;
    case "netMargin":
      return formatPercent(clue.pct, locale, 1);
    case "letters":
      return fill(labels.lettersCount, { n: clue.shape.replace(/[^•]/g, "").length });
  }
}

/** Karoda yazan değer — tahmin edilen şirketinki; yoksa null. */
export function tileValue(kind: TileKind, values: GuessFeedback["values"], locale: Locale, labels: StockPuzzleLabels): string | null {
  switch (kind) {
    case "sector":
      return values.sector;
    case "cap":
      return values.marketCap !== null && values.marketCap > 0 ? formatMoneyCompact(values.marketCap, locale) : null;
    case "ipo":
      if (values.ipoYear === null) return null;
      return values.ipoYear < IPO_YEAR_FLOOR ? labels.ipoBefore : String(values.ipoYear);
    case "growth":
      return values.revenueGrowth === null ? null : formatPercent(values.revenueGrowth, locale, 1);
  }
}
