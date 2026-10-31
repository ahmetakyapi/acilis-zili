import type { Dictionary } from "@/lib/i18n";
import type { OpenPlan, OpenSide } from "@/lib/technical";

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
  const { buy, sell } = open;
  const where =
    sell?.state === "beyond" ? op.where.aboveResistance
    : buy?.state === "beyond" ? op.where.belowSupport
    : sell?.state === "at" ? op.where.atResistance
    : buy?.state === "at" ? op.where.atSupport
    : buy && sell ? op.where.between
    : sell ? op.where.belowResistance
    : buy ? op.where.aboveSupport
    : null;
  return where ? op.whyHold.replace("{where}", where) : op.whyHoldPlain;
}

/** Açık planın bir tarafının sözlük anahtarı — SAT'ta hedef "tepki seviyesi". */
export function openSideKey(side: OpenSide, verdict: "hold" | "sell"): "support" | "resistance" | "target" | "sellLevel" {
  return side.kind === "target" && verdict === "sell" ? "sellLevel" : side.kind;
}

/** Açık planın bir tarafının kısa nitelemesi: "Destek", "Dirençte", "Destek Kırıldı"… */
export function openSideLabel(side: OpenSide, verdict: "hold" | "sell", t: Dictionary): string {
  return t.technical.openPlan[side.state][openSideKey(side, verdict)];
}
