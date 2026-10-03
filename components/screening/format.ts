import type { Dictionary } from "@/lib/i18n";
import type { Check, CheckId } from "@/lib/screening";
import {
  formatCompact,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  formatVolume,
} from "@/lib/utils";

type T = Dictionary["screening"];

/** Göreli ölçüler yüzde değil PUAN farkı: hissenin %40'ı ile endeksin
    %28'i arasındaki fark "%12" değil "12 puan". Yüzde yazmak "endeksten %12
    fazla getiri" diye okunurdu, ki o başka bir sayı. */
const POINT_CHECKS = new Set<CheckId>(["vsMarket", "vsSector", "analystTrend"]);
/** Uzaklıklar: işaret anlam taşımıyor (dibin ÜSTÜNDE, zirvenin ALTINDA). */
const DISTANCE_CHECKS = new Set<CheckId>(["aboveLow", "nearHigh"]);
const GROWTH_CHECKS = new Set<CheckId>(["epsGrowthQ", "salesGrowthQ", "epsGrowth3Y", "growthSource", "dilution", "upside"]);

const one = (value: number, locale: string, digits = 1) =>
  new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/**
 * Bir kontrolün ölçüsü — `cell` tablo hücresi (birim Title Case, işaretli),
 * `text` artı/eksi cümlesinin içi (cümle zaten yönü söylüyor: "geride
 * bıraktı" / "gerisinde kaldı", o yüzden mutlak değer).
 */
export function formatCheckValue(check: Check, locale: string, t: T, mode: "cell" | "text"): string | null {
  const v = check.value;
  if (v === null) return null;
  const id = check.id;
  if (POINT_CHECKS.has(id)) {
    if (mode === "text") return t.unitPointsText.replace("{n}", one(Math.abs(v), locale));
    const sign = v > 0 ? "+" : v < 0 ? "−" : "";
    return t.unitPoints.replace("{n}", `${sign}${sign ? " " : ""}${one(Math.abs(v), locale)}`);
  }
  if (DISTANCE_CHECKS.has(id)) return formatPercentPlain(v, locale, 1);
  if (GROWTH_CHECKS.has(id)) return formatPercent(v, locale, 1);
  switch (id) {
    case "marketCap":
      return formatMoneyCompact(v, locale);
    case "price":
    case "profitable":
      return formatPrice(v, locale, { currency: true });
    case "liquidity":
      return mode === "text" ? formatCompact(v, locale) : t.unitShares.replace("{n}", formatCompact(v, locale));
    case "margins":
      /* Marj işaretli bir büyüklük değil, düzey: eksi yalnızca negatifte. */
      return v < 0 ? `−${formatPercentPlain(v, locale, 1)}` : formatPercentPlain(v, locale, 1);
    case "currentRatio":
    case "debt":
      return one(v, locale, 2);
    case "runway":
      return mode === "text" ? one(v, locale) : t.unitYears.replace("{n}", one(v, locale));
    case "funds":
      return mode === "text" ? formatVolume(v, locale) : t.unitFunds.replace("{n}", formatVolume(v, locale));
    case "insiders":
      return v > 0 ? `+${one(v, locale, 0)}` : v < 0 ? `−${one(Math.abs(v), locale, 0)}` : "0";
    case "earningsQuality":
      return `${one(v, locale, 0)} ${t.outOf}`;
    default:
      return one(v, locale);
  }
}

/** Artı/eksi cümlesi — `{value}` ölçünün metin hâliyle doldurulur. */
export function checkSentence(check: Check, locale: string, t: T, side: "pro" | "con"): string {
  /* Baz etkisi kendi cümlesiyle: "%1.061 büyüdü" kalıbı "tabanın altında"
     diyen eksi cümlesine sığmıyor. */
  const template =
    side === "con" && check.baseEffect && check.id in t.baseEffect
      ? t.baseEffect[check.id as keyof T["baseEffect"]]
      : (side === "pro" ? t.pro : t.con)[check.id];
  const value = formatCheckValue(check, locale, t, "text");
  return template.replace("{value}", value ?? t.noneLabel);
}
