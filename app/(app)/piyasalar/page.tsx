import { permanentRedirect } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { legacyIndexTarget } from "@/lib/index-pages";
import { pageMetadata } from "@/lib/page-meta";
import { MarketsScreen } from "./_screen/MarketsScreen";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/piyasalar",
  tr: {
    title: "S&P 500, Nasdaq ve Dow Hisseleri: Isı Haritası",
    description:
      "S&P 500, Nasdaq 100 ve Dow Jones hisseleri tek ekranda: ısı haritası, günün en çok artan ve düşenleri, sektör performansı ve piyasa genişliği.",
  },
  en: {
    title: "S&P 500, Nasdaq and Dow Stocks: Heat Map",
    description:
      "S&P 500, Nasdaq 100 and Dow Jones stocks on one screen: heat map, top gainers and losers, sector performance and market breadth.",
  },
});

/**
 * Piyasalar kökü — ekranın kendisi `_screen/MarketsScreen.tsx` (karar
 * yorumları orada). Kök, varsayılan endeksle açılır ve çipleri/kartları
 * üç endeks sayfasına (`/piyasalar/[endeks]`) bağlar.
 *
 * ESKİ `?endeks=` ADRESİ 308 (14 Kasım 2026). Dizinde ve paylaşılmış
 * bağlantılarda duran `/piyasalar?endeks=sp500` tek adımda
 * `/piyasalar/sp-500`a iner; sıralama ve derinlik parametreleri korunur,
 * `endeks` düşer. Yönlendirme burada, `next.config.ts`te değil: yapılandırma
 * kuralı sorgu değerini hedefe de taşır (gerekçe lib/index-pages.ts).
 * Sayfa hiçbir şey akıtmadan önce fırlattığı için yanıt gerçek 308'dir
 * (segmentte `loading.tsx` yok — `app/(app)/layout.tsx`).
 */
export default async function MarketsPage(props: PageProps<"/piyasalar">) {
  const search = await props.searchParams;
  const legacy = legacyIndexTarget(search);
  if (legacy) permanentRedirect(withLocale(legacy, await getLocale()));
  return <MarketsScreen search={search} />;
}
