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
 * İskeletin ölçüsü grafiğin kendi kabıyla birebir aynı — düzen kaymıyor.
 */
export const PriceChartLazy = dynamic(
  () => import("./PriceChart").then((m) => m.PriceChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-3">
        <div className="skeleton h-[52px] w-full rounded-(--radius-md)" />
        <div className="skeleton h-[300px] w-full rounded-(--radius-md) sm:h-[430px]" />
      </div>
    ),
  },
) as typeof PriceChartType;
