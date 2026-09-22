import "server-only";

import { indexMemberOf } from "@/db/seed/indices";
import type { Locale } from "@/lib/i18n/config";
import { industryLabel, sectorLabel } from "@/lib/sectors";

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
 * almalı (bkz. `CompanyBalloon` — sunucuda çiziliyor).
 */
export function companySector(
  symbol: string,
  industry: string | null | undefined,
  locale: Locale,
): string | null {
  return sectorLabel(indexMemberOf(symbol)?.sector, locale) ?? industryLabel(industry, locale);
}
