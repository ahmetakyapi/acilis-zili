import type { Dictionary } from "@/lib/i18n";
import { openWhere, type OpenPlan, type OpenSide } from "@/lib/technical";

/* Ayrı modül: plan şeridi, ray, kart ve detay sayfası aynı cümleleri
   kullanıyor; `TechnicalCard` ile `PlanStrip` birbirini içe aktarmasın. */

/**
 * Planın neden olmadığı — tek cümle, yalnız durumdan (31 Ekim).
 *
 * Rutinin metnine dayanmıyor: başlık cümlesi her yayında başka bir şey
 * anlatıyor ve "bölge yok"u söylemeyebiliyor. Cümle görüşten ve fiyatın
 * rutinin verdiği seviyelere göre yerinden kuruluyor; yeni iddia yok.
 */
export function openWhyText(open: OpenPlan, t: Dictionary): string {
  const op = t.technical.openPlan;
  if (open.verdict === "sell") return op.whySell;
  const where = openWhere(open);
  return where ? op.whyHold.replace("{where}", op.where[where]) : op.whyHoldPlain;
}

/**
 * Bölgesiz TUT'ta "bundan sonra ne olur" — tek cümle, seviye dilinde
 * (31 Ekim, sahibinin sorusu: "böyle olunca ne anlama geliyor?").
 *
 * KOŞUL RUTİNİN KENDİ KURALINDAN, UYDURMA DEĞİL. Rutin promptu
 * (docs/claude-rutinler.md § 5, "GÖRÜŞÜ KOLAY DEĞİŞTİRME" ve "PLANIN ÖNÜNE
 * GEÇİLDİYSE") görüşün ancak somut bir tetikle değiştiğini, tetiğin başında
 * "bir seviyenin kırılması" geldiğini ve kırılan seviyenin rolünün
 * değiştiğini söylüyor. Cümle bunu söylüyor: hangi iki seviye, ve kırılırsa
 * sonraki yayın yeniden değerlendirir. "Kapanışla" gibi rutinde olmayan
 * bir koşul ya da "buradan alınır" gibi bir yönlendirme YOK (tavsiye
 * denetimi, CLAUDE.md § Site İçi Claude). Eski cümleler ("Alım için
 * izlenecek seviye …", "Satış için izlenecek seviye …") okura alım/satış
 * yeri gösteriyordu; kalktı.
 */
export function openWatchText(open: OpenPlan, money: (value: number) => string, t: Dictionary): string {
  const op = t.technical.openPlan;
  const { buy, sell } = open;
  if (buy?.state === "beyond") return op.brokeSupport.replace("{level}", money(buy.level));
  if (sell?.state === "beyond") return op.clearedResistance.replace("{level}", money(sell.level));
  if (buy && sell) return op.watchBoth.replace("{support}", money(buy.level)).replace("{resistance}", money(sell.level));
  if (buy) return op.watchSupport.replace("{support}", money(buy.level));
  if (sell) return op.watchResistance.replace("{resistance}", money(sell.level));
  return op.noLevels;
}

/** Açık planın bir tarafının sözlük anahtarı — SAT'ta hedef "tepki seviyesi". */
export function openSideKey(side: OpenSide, verdict: "hold" | "sell"): "support" | "resistance" | "target" | "sellLevel" {
  return side.kind === "target" && verdict === "sell" ? "sellLevel" : side.kind;
}

/** Açık planın bir tarafının kısa nitelemesi: "Destek", "Dirençte", "Destek Kırıldı"… */
export function openSideLabel(side: OpenSide, verdict: "hold" | "sell", t: Dictionary): string {
  return t.technical.openPlan[side.state][openSideKey(side, verdict)];
}
