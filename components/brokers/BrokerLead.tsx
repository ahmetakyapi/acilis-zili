"use client";

import type { CostLine } from "@/lib/broker-line";
import { brokersLead, type BrokersLeadTemplates } from "@/lib/broker-cards";
import { formatPrice } from "@/lib/utils";
import { useAmountIndex } from "./broker-view-state";

/**
 * EKRANIN TEPESİNDEKİ TEK CÜMLE (25 Ekim görsel turu), veriden: seçili
 * alımda komisyonun aralığı ve kesirli hisse sunan kurum sayısı. Şablon ve
 * hesap `lib/broker-cards.ts` → `brokersLead` (testli). Kaydırıcıyla birlikte
 * değişiyor; ekran okuyucuya kibarca duyuruluyor (eskiden maliyet
 * çizgisinin içindeki cümle bu işi yapıyordu, o cümle buraya taşındı).
 * Kompakt turdan (25 Ekim) beri kapağın altında değil, panonun başında.
 */
export function BrokerLead({
  lines,
  total,
  fractional,
  templates,
  locale,
  omitUnpriced = false,
  className,
}: {
  lines: CostLine[];
  total: number;
  fractional: number;
  templates: BrokersLeadTemplates;
  locale: "tr" | "en";
  /** Hesaplanamayan kurum sayısını cümleye katma (aynı bilgi yakında ayrıca duruyorsa). */
  omitUnpriced?: boolean;
  className?: string;
}) {
  const line = lines[useAmountIndex()];
  const sentence = brokersLead(
    {
      amount: line.amount,
      min: line.min,
      max: line.max,
      total,
      fractional,
      unpriced: omitUnpriced ? 0 : line.unpriced.length,
    },
    templates,
    (value, digits = 2) => formatPrice(value, locale, { currency: true, digits }),
  );
  if (!sentence) return null;
  return (
    <p className={className ?? "max-w-3xl text-read leading-relaxed text-strong sm:text-lead"} aria-live="polite">
      {sentence}
    </p>
  );
}
