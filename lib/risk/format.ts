/**
 * Risk Masası biçimlendiricileri — ekran ve Claude girdisi AYNI biçimi
 * kullanır (lib/ai-grounding.ts: çıktıdaki sayı girdide aynen geçmeli).
 * Eksi işareti sitenin eksisi (U+2212), yüzde sitenin yüzdesi.
 */

import { formatMeasure } from "@/lib/portfolio-risk";
import { formatEtDateMedium, formatPercentPlain, formatPercentText, NO_VALUE } from "@/lib/utils";

export type Loc = "tr" | "en";

export const num = (v: number | null | undefined, locale: Loc, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? NO_VALUE : formatMeasure(v, locale, digits);

/** İşaretsiz yüzde: "%18,4". */
export const pct = (v: number | null | undefined, locale: Loc, digits = 1) =>
  v === null || v === undefined ? NO_VALUE : formatPercentPlain(v, locale, digits);

/** Gösterilen haneye yuvarlanmış değer: −0,04 bir hanede "−%0,0" değil "%0,0" yazılsın. */
export const rounded = (v: number, digits: number) => {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return Object.is(r, -0) ? 0 : r;
};

/** İşaretli yüzde, metin biçimi: "+%2,1" / "−%3,4". */
export const signedPct = (v: number | null | undefined, locale: Loc, digits = 1) =>
  v === null || v === undefined ? NO_VALUE : formatPercentText(rounded(v, digits), locale, digits);

/** İşaretli düz sayı: "+0,32" / "−1,10". */
export const signedNum = (v: number | null | undefined, locale: Loc, digits = 2) => {
  if (v === null || v === undefined) return NO_VALUE;
  const r = rounded(v, digits);
  return `${r > 0 ? "+" : ""}${formatMeasure(r, locale, digits)}`;
};

export const day = (date: string | null | undefined, locale: Loc) => (date ? formatEtDateMedium(date, locale) : NO_VALUE);

/** Şablon doldurma: "{n} Seans" → "12 Seans". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
