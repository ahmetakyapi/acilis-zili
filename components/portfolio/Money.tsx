import type { ReactNode } from "react";
import { NO_VALUE } from "@/lib/utils";

/**
 * OKURUN KENDİ PARASI — gizlenebilir tutar (10 Kasım; sözleşme `lib/privacy.ts`).
 *
 * Tek öznitelik: `data-money`. Gizleme açıkken (`<html data-privacy>`)
 * içteki değer `display:none` olur ve yerine SABİT uzunlukta bir nokta dizisi
 * basılır (globals.css → "TUTAR GİZLEME"). Bulanıklık değil: bulanık rakam
 * hâlâ okunur ve uzunluğu sayının basamağını ele verir. Nokta dizisi her
 * tutarda aynı, ekran okuyucu "Gizli" der (CSS `content` alt metni).
 *
 * Değer yoksa ("–") maskelenmez: yokluk gizlenecek bir şey değil.
 * Sunucu ve istemci bileşenlerinde aynı; durum taşımaz.
 */
export function Money({ children, className }: { children: ReactNode; className?: string }) {
  if (children === NO_VALUE || children === null || children === undefined || children === "") {
    return className ? <span className={className}>{children}</span> : <>{children}</>;
  }
  return (
    <span data-money className={className}>
      <span data-money-value>{children}</span>
    </span>
  );
}
