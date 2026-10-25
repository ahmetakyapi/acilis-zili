import "server-only";

import { indexMemberOf } from "@/db/seed/indices";
import type { Locale } from "@/lib/i18n/config";
import { industryLabel, sectorGroupOf, sectorLabel } from "@/lib/sectors";

/**
 * Bir şirketin ekranda yazılacak sektörü — tercih sırası TEK YERDE.
 *
 * GICS ana sektörü (endeks tohumundan) varsa o, yoksa sağlayıcının serbest
 * metinli `industry` alanı. Sıra bir dönem /teknik kartında ve /hisse
 * künyesinde ayrı ayrı yazılıydı; iki ekranın aynı şirket için ayrı sektör
 * adı yazması bir hata gibi okunurdu.
 *
 * SUNUCUYA KİLİTLİ (`server-only`). Endeks tohumu (`db/seed/indices.ts`)
 * 71 KB'lık bir tablo: bu fonksiyonu bir istemci modülü içe aktarırsa
 * tablonun tamamı tarayıcı paketine iner. Kilit bunu derlemede kırıyor,
 * sessizce büyümesine izin vermiyor. İstemci bileşeni sektörü prop olarak
 * almalı (bkz. `lib/company-card.ts` — şirket kartının kaydı sunucuda
 * hazırlanıyor, sektör istemciye yalnızca dize olarak iniyor).
 */
export function companySector(
  symbol: string,
  industry: string | null | undefined,
  locale: Locale,
): string | null {
  return sectorLabel(indexMemberOf(symbol)?.sector, locale) ?? industryLabel(industry, locale);
}

/**
 * Sektör DAĞILIMI için şirketin GICS ANA sektörü (25 Ekim).
 *
 * `companySector` tek şirketin künyesi için doğru: GICS ana sektörü yoksa
 * sağlayıcının alt sektörünü yazar. Bir DAĞILIMDA ise iki sınıflandırma
 * aynı listeye düşüyordu — profil vitrininde "Bilgi Teknolojileri %97,5"
 * ile "Teknoloji %2,5" yan yana duruyordu (endekste olmayan hisse
 * Finnhub'ın "Technology"siyle geldi). Burada alt sektör de ana sektöre
 * çıkarılır: sektör grubundan (`sectorGroupOf`, lib/sectors.ts) GICS
 * karşılığına; eşleşmeyen null döner ve çağıran "Diğer"e koyar. Portföy
 * ekranı ile profil vitrini aynı fonksiyonu okur.
 */
const GROUP_TO_GICS: Record<string, string> = {
  teknoloji: "Information Technology",
  "yari-iletken": "Information Technology",
  saglik: "Health Care",
  finans: "Financials",
  sanayi: "Industrials",
  ulastirma: "Industrials",
  enerji: "Energy",
  medya: "Communication Services",
  tuketim: "Consumer Discretionary",
  "temel-tuketim": "Consumer Staples",
  "kamu-hizmetleri": "Utilities",
  hammadde: "Materials",
  gayrimenkul: "Real Estate",
};

export function companyMajorSector(
  symbol: string,
  industry: string | null | undefined,
  locale: Locale,
): string | null {
  const gics = indexMemberOf(symbol)?.sector ?? GROUP_TO_GICS[sectorGroupOf(industry).key] ?? null;
  return sectorLabel(gics, locale);
}
