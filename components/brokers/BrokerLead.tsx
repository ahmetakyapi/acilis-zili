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
 */
export function BrokerLead({
  lines,
  total,
  fractional,
  templates,
  locale,
}: {
  lines: CostLine[];
  total: number;
  fractional: number;
  templates: BrokersLeadTemplates;
  locale: "tr" | "en";
}) {
  const line = lines[useAmountIndex()];
  const sentence = brokersLead(
    {
      amount: line.amount,
      min: line.min,
      max: line.max,
      total,
      fractional,
      unpriced: line.unpriced.length,
    },
    templates,
    (value, digits = 2) => formatPrice(value, locale, { currency: true, digits }),
  );
  if (!sentence) return null;
  return (
    <p className="max-w-3xl text-read leading-relaxed text-strong sm:text-lead" aria-live="polite">
      {sentence}
    </p>
  );
}
