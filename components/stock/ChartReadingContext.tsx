"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ChangePill } from "@/components/ui/primitives";
import { cn, directionOf, formatChange, formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import styles from "./ChartReading.module.css";

/**
 * HİSSE SAYFASININ GRAFİĞİ — başlık hep canlı fiyatı, okuma grafiğin içinde.
 *
 * TARİHÇE. İmleç grafikte gezerken okuma önce grafiğin ÜSTÜNDEKİ 60 (telefonda
 * 72) piksellik ayrı bir satıra 32 puntoyla basılıyordu: aynı panelde iki
 * büyük fiyat vardı ve o satır imleç yokken de yerini tutuyordu. Sonra
 * (24 Eylül) okuma başlığın kendisine yazıldı — 48 puntoluk fiyat barın
 * kapanışına dönüşüyor, künye "{an} · Bar Kapanışı" diyordu. Bu da ikinci bir
 * sorun doğurdu (sahibinin geri bildirimi, aynı gün): "şu an kaç" sorusunun
 * cevabı imleç grafikten çıkana kadar ekrandan siliniyordu; aynı yerde iki
 * anlamlı sayı dönüşümlü duruyordu.
 *
 * ŞİMDİ: başlık HİÇ değişmiyor. Okuma noktanın yanında küçük bir etiket
 * (PriceChart → `floatingReading`); grafiğin üstüne ikinci bir büyük fiyat
 * satırı da açılmıyor. Sağlayıcı yalnızca "bu grafik hisse sayfasında" bilgisini
 * taşıyor; bağlam yoksa (yazıların içindeki `::: grafik` bloğu) grafik okumayı
 * kendi satırında gösteriyor.
 *
 * SUNUCU DÜĞÜMLERİ ÇOCUK OLARAK. Sağlayıcı istemci ama sardığı panelin çoğu
 * (kimlik, profil, damga) sunucuda çiziliyor — CLAUDE.md "İstemci ile sunucu
 * sınırı".
 */

const Context = createContext(false);

export function ChartReadingProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value>{children}</Context.Provider>;
}

/** Grafik hisse sayfasının içinde mi (okuma yüzen etikette). */
export function useChartReading(): boolean {
  return useContext(Context);
}

/**
 * Başlığın fiyat satırı + künye satırı — canlı hâl, sunucudan gelen değerlerle.
 * İmleç okuması buraya yazılmıyor (gerekçe dosyanın başında).
 */
export function HeaderReadout({
  price,
  change,
  changePct,
  locale,
  session,
  stamp,
  classes,
}: {
  price: number | null;
  change: number | null;
  changePct: number | null;
  locale: Locale;
  /** Seans dışı hapı ve önceki kapanış — sunucuda çizilmiş. */
  session?: ReactNode;
  /** Canlı damga — sunucuda çizilmiş. */
  stamp: ReactNode;
  classes: { line: string; price: string; change: string };
}) {
  const tone = directionOf(change);
  return (
    <>
      <div className={classes.line}>
        <p className={classes.price}>{formatPrice(price, locale, { currency: true })}</p>
        <div className={classes.change}>
          <span
            className={cn(
              "numeral text-sm",
              tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted",
            )}
          >
            {formatChange(change, locale)}
          </span>
          <ChangePill changePct={changePct} locale={locale} />
        </div>
      </div>
      {session}
      <div className={styles.stampSlot}>{stamp}</div>
    </>
  );
}
