import { CorporationJsonLd } from "@/components/seo/JsonLd";
import { exchangeLabel } from "@/components/stock/exchange-label";
import { describeSymbol } from "@/db/seed/descriptions";
import type { Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import { getCompanyProfile } from "@/lib/providers";
import { safeExternalUrl } from "@/lib/utils";

/** `tickerSymbol` öneki yalnızca iki ABD borsasında; ötekiler kodsuz. */
const LISTING_PREFIX = new Set(["Nasdaq", "NYSE"]);

/**
 * Şirket künyesi — profil gelince basılıyor (`Suspense`, yedeği boş).
 * Profil kartı aynı çağrıyı yapıyor ve sonuç önbellekli: ek tur yok.
 * Profil yoksa künye de yok; adı bilinmeyen bir "Corporation" uydurmaz.
 */
export async function StockJsonLd({ symbol, locale }: { symbol: string; locale: Locale }) {
  const profile = await getCompanyProfile(symbol);
  if (!profile.ok || !profile.data.name) return null;
  const listing = exchangeLabel(profile.data.exchange, "en");
  const description = await describeSymbol(symbol, locale);
  return (
    <CorporationJsonLd
      name={profile.data.name}
      symbol={symbol}
      exchange={listing && LISTING_PREFIX.has(listing) ? listing.toUpperCase() : null}
      description={description}
      website={safeExternalUrl(profile.data.weburl)}
      logo={logoSrc(symbol, profile.data.logoUrl)}
      path={`/hisse/${symbol}`}
      locale={locale}
    />
  );
}
