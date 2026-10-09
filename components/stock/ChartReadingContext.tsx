"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ChangePill, DataStamp, type DataStampLabels } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { TickingFigure } from "@/components/ui/TickingFigure";
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

/** Grafiğin canlı yoklamasından gelen kotasyon (3 Ekim). */
export type LiveQuote = {
  price: number | null;
  change: number | null;
  changePct: number | null;
  source: string;
  fetchedAt: string;
};

type ReadingContext = { live: LiveQuote | null; setLive: (quote: LiveQuote) => void };

const Context = createContext<ReadingContext | null>(null);

/**
 * CANLI KOTASYON DA BURADAN (3 Ekim). Grafik seans içinde dakikada bir
 * tazeleniyor (PriceChart → canlı yoklama) ve başlık fiyatı sunucu
 * çiziminde kalsaydı ekranda iki farklı "şu an" dururdu: eğrinin ucu
 * 12:05'i, başlık 12:00'yi (CLAUDE.md, veri dürüstlüğü 3). Grafik yeni
 * kotasyonu buraya yazıyor, başlık buradan okuyor — fiyat, değişim ve damga
 * birlikte.
 */
export function ChartReadingProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveQuote | null>(null);
  const value = useMemo(() => ({ live, setLive }), [live]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Grafik hisse sayfasının içinde mi (okuma yüzen etikette). */
export function useChartReading(): boolean {
  return useContext(Context) !== null;
}

/** Grafiğin canlı kotasyonu bağlama yazması için; bağlam yoksa no-op. */
export function usePublishLiveQuote(): (quote: LiveQuote) => void {
  return useContext(Context)?.setLive ?? noop;
}
const noop = () => {};

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
  stampLabels,
  classes,
}: {
  price: number | null;
  change: number | null;
  changePct: number | null;
  locale: Locale;
  /** Canlı kotasyon gelince damga istemcide yeniden basılıyor. */
  stampLabels?: DataStampLabels;
  /** Seans dışı hapı ve önceki kapanış — sunucuda çizilmiş. */
  session?: ReactNode;
  /** Canlı damga — sunucuda çizilmiş. */
  stamp: ReactNode;
  classes: { line: string; price: string; change: string };
}) {
  const live = useContext(Context)?.live ?? null;
  const serverPrice = formatPrice(price, locale, { currency: true });
  const serverChange = formatChange(change, locale);
  if (live) {
    price = live.price;
    change = live.change;
    changePct = live.changePct;
  }
  const tone = directionOf(change);
  const formatted = formatPrice(price, locale, { currency: true });
  return (
    <>
      <div className={classes.line}>
        {/* FİYAT YUVARLANARAK GELİYOR (28 Eylül). Başlık fiyatı sayfanın ilk
            okunan sayısı ve ilk ekranda; `RollingFigure` onu sunucuda son
            hâliyle basıyor, yalnızca rakam şeritleri CSS'le yerine dönüyor
            (JS yok, genişlik sıçramıyor, ekran okuyucu düz sayıyı duyuyor).
            Bu sayfada fiyatı canlı güncelleyen bir istemci döngüsü YOK —
            değer sunucu çiziminden geliyor ve bileşen yeniden bağlanmadıkça
            dönüş bir daha oynamıyor. Değer yoksa tire düz metin kalır. */}
        <p className={classes.price}>
          {price === null ? (
            formatted
          ) : live ? (
            /* CANLI GÜNCELLEMEDE yalnızca değişen rakamlar dönüyor (9 Ekim,
               gerekçe ui/TickingFigure). İlk değer sunucunun bastığı:
               grafiğin ilk yoklaması farklı bir fiyat getirirse o değişim
               de görünüyor. */
            <TickingFigure value={formatted} initial={serverPrice} decimal={locale === "tr" ? "," : "."} />
          ) : (
            <RollingFigure value={formatted} />
          )}
        </p>
        {/* DEĞİŞİMİN İKİ KATI (28 Eylül). Mutlak fark ile yüzde aynı
            satırda, fiyatın dibinde 14 ve 12 puntoyla duruyordu ve 48
            puntoluk fiyatın yanında kayboluyordu. Yüzde artık öndeki
            okuma (rozet büyüdü), mutlak fark onun altında ikinci satır:
            fiyat → yüzde → fark, üç kademe. Renk yalnızca yönden. */}
        <div className={classes.change}>
          <ChangePill changePct={changePct} locale={locale} />
          <span
            className={cn(
              "numeral",
              tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted",
            )}
          >
            {live ? (
              <TickingFigure value={formatChange(change, locale)} initial={serverChange} decimal={locale === "tr" ? "," : "."} />
            ) : (
              formatChange(change, locale)
            )}
          </span>
        </div>
      </div>
      {session}
      <div className={styles.stampSlot}>
        {live && stampLabels ? (
          <DataStamp labels={stampLabels} source={live.source} at={live.fetchedAt} locale={locale} className="m-0 justify-start" />
        ) : (
          stamp
        )}
      </div>
    </>
  );
}
