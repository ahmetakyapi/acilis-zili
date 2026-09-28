import type { Dictionary } from "@/lib/i18n";
import type { Move, TradeDetail } from "@/lib/investor-view";
import { formatCompact, formatEtDateMedium, formatPrice, withCurrency } from "@/lib/utils";

/**
 * Ünlü yatırımcılar ekranlarının dize biçimleri — saf, sunucu ve istemci
 * aynı dosyayı okuyabilir (`"use client"` DEĞİL; gerekçe CLAUDE.md
 * "İstemci ile sunucu sınırı").
 */

type T = Dictionary["investors"];

/** "2026-06-30" → "2. Çeyrek 2026" / "Q2 2026". */
export function quarterLabel(period: string, t: T): string {
  const [year, month] = period.split("-").map(Number);
  const q = Math.ceil(month / 3);
  return t.quarter.replace("{q}", String(q)).replace("{year}", String(year));
}

/** "30 Haz 2026 İtibarıyla" — tarih orta biçimde (yıl gerekli). */
export function asOfLabel(period: string, locale: string, t: T): string {
  return t.asOf.replace("{date}", formatEtDateMedium(period, locale));
}

export function filedLabel(date: string, locale: string, t: T): string {
  return t.filedOn.replace("{date}", formatEtDateMedium(date, locale));
}

export function moveLabel(move: Move | null, t: T): string {
  switch (move) {
    case "new":
      return t.moveNew;
    case "increased":
      return t.moveIncreased;
    case "decreased":
      return t.moveDecreased;
    case "soldOut":
      return t.moveSoldOut;
    case "unchanged":
      return t.moveUnchanged;
    default:
      return t.moveFirst;
  }
}

export type MoveTone = "up" | "down" | "flat";

export function moveTone(move: Move | null): MoveTone {
  return move === "new" || move === "increased" ? "up" : move === "decreased" || move === "soldOut" ? "down" : "flat";
}

/**
 * Haritadaki ton: yeni pozisyon en koyu yeşil, artış ve azalış adet
 * değişiminin büyüklüğüyle kademeli, aynı kalan nötr. Isı ölçeğinin
 * (Themes.module.css → `.heat`) aynı dokuz kademesi; eşikler burada
 * yüzde değil adet değişimi: 10 ve 50.
 */
const HEAT_STEPS = [10, 50] as const;
export function moveHeat(move: Move | null, changePct: number | null): { tone: MoveTone; level: 0 | 1 | 2 | 3 | 4 } {
  if (move === "new") return { tone: "up", level: 4 };
  if (move !== "increased" && move !== "decreased") return { tone: "flat", level: 0 };
  const size = Math.abs(changePct ?? 0);
  const level = size < HEAT_STEPS[0] ? 1 : size < HEAT_STEPS[1] ? 2 : 3;
  return { tone: move === "increased" ? "up" : "down", level };
}

/** Hisse adedi: 400.000.000 → "400 Mn", 12.345 → "12.345". */
export function formatShares(amount: number, locale: string): string {
  const LARGE = 1e6;
  if (Math.abs(amount) >= LARGE) return formatCompact(amount, locale);
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 0 }).format(amount);
}

/** Kısaltılmış tutar, gereksiz ",00" olmadan: 1.000.000 → "1 Mn $". */
function roundMoney(value: number, locale: string): string {
  const body = formatCompact(value, locale).replace(/[,.]0+(?=\u00A0|$)/, "");
  return withCurrency(body, locale);
}

/**
 * Kongre bildiriminin tutar aralığı. Alt uç bildirimde "1.000.001" diye
 * yazılıyor; ekranda "1 Mn $ - 5 Mn $" — aralığın okunur hâli, tek sayı
 * değil. Üst uç yoksa "50 Mn $ Üstü".
 */
export function amountRange(low: number | null, high: number | null, locale: string, t: T): string {
  if (low === null) return t.amountUnknown;
  const floor = low % 1000 === 1 ? low - 1 : low;
  if (high === null) return t.amountOver.replace("{low}", roundMoney(floor, locale));
  return `${roundMoney(floor, locale)} - ${roundMoney(high, locale)}`;
}

export function txLabel(txType: string, t: T): string {
  if (txType === "P") return t.txBuy;
  if (txType === "S") return t.txSell;
  if (txType.startsWith("S")) return t.txPartial;
  if (txType === "E") return t.txExchange;
  return txType;
}

export function txTone(txType: string): MoveTone {
  return txType === "P" ? "up" : txType.startsWith("S") ? "down" : "flat";
}

export function ownerLabel(owner: string | null, t: T): string {
  if (owner === "SP") return t.ownerSpouse;
  if (owner === "JT") return t.ownerJoint;
  if (owner === "DC") return t.ownerChild;
  return owner ?? t.ownerSelf;
}

/** Açıklama satırının dile göre hâli; tanınmayan kalıp olduğu gibi. */
export function tradeDetailText(detail: TradeDetail | null, locale: string, t: T): { text: string; original: boolean } | null {
  if (!detail) return null;
  const count = (value: number) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US").format(value);
  const money = (value: number | null) => (value === null ? "" : formatPrice(value, locale, { currency: true, digits: value % 1 === 0 ? 0 : 2 }));
  const right = (kind: "call" | "put") => (kind === "call" ? t.optionCall : t.optionPut);
  switch (detail.kind) {
    case "shares":
      return {
        text: (detail.side === "buy" ? t.detailBuyShares : t.detailSellShares).replace("{shares}", count(detail.shares)),
        original: false,
      };
    case "options":
      return {
        text: t.detailOptions
          .replace("{contracts}", count(detail.contracts))
          .replace("{right}", right(detail.right))
          .replace("{strike}", money(detail.strike))
          .replace("{expiry}", detail.expiry ? formatEtDateMedium(detail.expiry, locale) : ""),
        original: false,
      };
    case "exercise":
      return {
        text: t.detailExercise
          .replace("{contracts}", count(detail.contracts))
          .replace("{right}", right(detail.right))
          .replace("{shares}", detail.shares === null ? "" : count(detail.shares))
          .replace("{strike}", money(detail.strike)),
        original: false,
      };
    default:
      return { text: detail.text, original: true };
  }
}

/** Ağırlık: 0,2203 → "%22,0" / "22.0%". */
export function formatWeight(weight: number, locale: string): string {
  const pct = weight * 100;
  const digits = pct >= 1 ? 1 : 2;
  const body = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(pct);
  return locale === "tr" ? `%${body}` : `${body}%`;
}

