"use client";

import dynamic from "next/dynamic";
import type { PriceChart as PriceChartType } from "./PriceChart";

/**
 * Grafiği ana demetten ayıran sarmalayıcı.
 *
 * NEDEN GEREKLİ. `lightweight-charts` (~187 KB ham, ~60 KB gzip) PriceChart'ın
 * tepesinden statik import ediliyordu ve PriceChart hem hisse sayfasına hem
 * grafik bloğu taşıyan her mercek/rehber yazısına bağlı. Kütüphane sunucuda
 * hiçbir şey çizmiyor — kap boş geliyor, seri hidrasyondan sonra kuruluyor —
 * yani o 60 KB ilk boyamaya hiç katkı yapmadan ana demette duruyor ve
 * hidrasyonu geciktiriyordu.
 *
 * SARMALAYICI OLMADAN OLMUYOR: `ssr: false` doğrudan bir sunucu bileşeninde
 * kullanılamıyor. Sayfalar bu dosyayı import ediyor, `dynamic` çağrısı
 * istemci sınırının içinde kalıyor.
 *
 * İSKELET GRAFİĞİN TAMAMINI KAPLAR, yalnızca çizim alanını değil.
 *
 * Eski iskelet iki bloktu (başlık 52 + çizim 300/430) ve bileşenin
 * altındaki iki şeridi hiç saymıyordu: seans efsanesi (Ön Seans · Seans ·
 * Akşam · Gece) ve aralık düğmeleri. Ölçüldü — hidrasyon sonrası gerçek
 * bileşen 390 pikselde 597, iskelet 364; sayfa 233 piksel aşağı zıplıyordu,
 * mobil CLS 0,28 (Google eşiği 0,1). Geniş ekranda fark 143.
 *
 * Aşağıdaki blokların kenar boşluğu ve sınır sınıfları bileşeninkiyle
 * BİREBİR aynı (`mt-3 border-t pt-3`), iç yükseklikler ölçülen değerlerden:
 *   seans efsanesi  390px → 108 toplam (iç 83) · 1440px → 78 (iç 53)
 *   aralık düğmeleri 390px → 109 toplam (iç 84) · 1440px → 49 (iç 24)
 * Yükseklik değişirse burası da değişmeli; iki dosya birlikte okunur.
 */
export const PriceChartLazy = dynamic(
  () => import("./PriceChart").then((m) => m.PriceChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col">
        <div className="skeleton h-14 w-full rounded-(--radius-md)" />
        <div className="skeleton mt-2 h-[300px] w-full rounded-(--radius-md) sm:h-[430px]" />
        <div className="mt-3 border-t border-line-soft pt-3">
          <div className="skeleton h-[83px] w-full rounded-(--radius-md) sm:h-[53px]" />
        </div>
        <div className="mt-3 border-t border-line-soft pt-3">
          <div className="skeleton h-[84px] w-full rounded-(--radius-md) sm:h-6" />
        </div>
      </div>
    ),
  },
) as typeof PriceChartType;
