"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChangePill } from "@/components/ui/primitives";
import { cn, directionOf, formatChange, formatPrice } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import styles from "./ChartReading.module.css";

/**
 * GRAFİKTE OKUNAN NOKTA BAŞLIK FİYATINA YAZILIYOR (24 Eylül).
 *
 * NEDEN: hisse sayfasında imleç grafikte gezerken okuma, grafiğin ÜSTÜNDEKİ
 * 60 (telefonda 72) piksellik ayrı bir satıra 32 puntoyla basılıyordu. Yani
 * aynı panelde iki büyük fiyat vardı — başlıktaki canlı fiyat ve onun yüz
 * piksel altında okunan barın kapanışı — ve o satır imleç yokken de yerini
 * tutuyordu. Artık okuma başlığın kendisinde: imleç gezerken 48 puntoluk
 * fiyat barın kapanışını yazıyor, künye satırı "{an} · Bar Kapanışı" diyor
 * ve grafiğin üstündeki satır 24 piksellik dönem özetine iniyor.
 *
 * VERİ DÜRÜSTLÜĞÜ (CLAUDE.md § 2): geçmiş bir sayı canlı damganın yanında
 * durmamalı. Okuma sürerken "Gecikmeli · Güncellendi" damgası yerini barın
 * kendi anına bırakıyor; imleç kalkınca canlı kotasyon dizesi birebir geri
 * geliyor (sunucunun çizdiği düğümler hiç sökülmüyor, yalnızca gizleniyor).
 *
 * SUNUCU DÜĞÜMLERİ ÇOCUK OLARAK. Sağlayıcı istemci ama sardığı panelin
 * çoğu (kimlik, profil, damga) sunucuda çiziliyor — CLAUDE.md "İstemci ile
 * sunucu sınırı". İstemciye inen tek yaprak fiyat satırı (`HeaderReadout`).
 *
 * Bağlam yoksa (yazıların içindeki `::: grafik` bloğu) grafik okumayı
 * eskisi gibi kendi satırında gösteriyor.
 */

export type ChartReading = {
  price: number;
  /** Aralığın tabanına göre fark — 1G'de önceki kapanış. */
  change: number;
  changePct: number;
  dateLabel: string;
} | null;

type ReadingContext = {
  reading: ChartReading;
  setReading: (reading: ChartReading) => void;
};

const Context = createContext<ReadingContext | null>(null);

export function ChartReadingProvider({ children }: { children: ReactNode }) {
  const [reading, setReading] = useState<ChartReading>(null);
  return <Context.Provider value={{ reading, setReading }}>{children}</Context.Provider>;
}

export function useChartReading(): ReadingContext | null {
  return useContext(Context);
}

/**
 * Başlığın fiyat satırı + künye satırı. Canlı hâlin tamamı sunucudan
 * geliyor (`price`, `change`, `changePct`, `stamp`); okuma sürerken yalnızca
 * sayılar ve künye değişiyor, satırın geometrisi değil — CLS sıfır.
 *
 * Rakamlar saymıyor, 140 ms'de yerine geçiyor (marka eğrisi); azaltılmış
 * harekette doğrudan değişiyor.
 */
export function HeaderReadout({
  price,
  change,
  changePct,
  locale,
  barCloseLabel,
  session,
  stamp,
  classes,
}: {
  price: number | null;
  change: number | null;
  changePct: number | null;
  locale: Locale;
  barCloseLabel: string;
  /** Seans dışı hapı ve önceki kapanış — sunucuda çizilmiş, okumada da kalır. */
  session?: ReactNode;
  /** Canlı damga — sunucuda çizilmiş. */
  stamp: ReactNode;
  classes: { line: string; price: string; change: string };
}) {
  const reading = useChartReading()?.reading ?? null;
  const shownPrice = reading ? reading.price : price;
  const shownChange = reading ? reading.change : change;
  const shownPct = reading ? reading.changePct : changePct;
  const tone = directionOf(shownChange);
  const key = reading ? reading.dateLabel : "live";
  /* İlk çizimde geçiş YOK: hidrasyonda fiyat bir an soluklaşmasın (ilk
     ekrandaki veri sabit kalır, PremiumMotion). Geçiş ancak bir okuma
     olduktan sonra, iki yönde de oynuyor. */
  const [engaged, setEngaged] = useState(false);
  if (reading && !engaged) setEngaged(true);
  const swap = engaged ? styles.swap : undefined;

  return (
    <>
      <div className={classes.line}>
        <p key={`p-${key}`} className={cn(classes.price, swap)}>
          {formatPrice(shownPrice, locale, { currency: true })}
        </p>
        <div key={`c-${key}`} className={cn(classes.change, swap)}>
          <span
            className={cn(
              "numeral text-sm",
              tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted",
            )}
          >
            {formatChange(shownChange, locale)}
          </span>
          <ChangePill changePct={shownPct} locale={locale} />
        </div>
      </div>
      {session}
      {/* Canlı künye DOM'da kalıyor, okuma sürerken gizleniyor: imleç
          kalkınca aynı düğüm geri geliyor, yeniden çizilmiyor. İki satır
          aynı ızgara hücresinde üst üste — yükseklik değişmiyor. */}
      <div className={styles.stampSlot}>
        <div className={styles.stampLive} data-hidden={reading ? "" : undefined}>
          {stamp}
        </div>
        {reading && (
          <p className={cn("numeral", styles.stampReading)}>
            {reading.dateLabel} · {barCloseLabel}
          </p>
        )}
      </div>
    </>
  );
}
