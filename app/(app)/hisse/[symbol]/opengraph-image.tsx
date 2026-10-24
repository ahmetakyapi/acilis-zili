import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { stockOgImage } from "@/lib/og-cards";
import { isKnownSymbol } from "@/lib/data";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { isValidSymbol } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* DİL SABİT, İSTEKTEN OKUNMUYOR — gerekçenin tamamı lib/og.tsx başında.
   Özeti: paylaşım kartının adresi önek taşımıyor, dolayısıyla `getI18n()`
   buradan hiçbir zaman `en` döndürmüyordu; çıktıyı değiştirmeden yalnızca
   her istekte `headers()` ve `cookies()` okuyordu. */
export const alt = "Hisse · Açılış Zili";

/**
 * Hisse sayfasının paylaşım kartı — fiyat, seans künyesi ve son bir ayın
 * kapanış çizgisi. Çizim ve gerekçesi `lib/og-cards.tsx` → `stockOgImage`.
 */
export default async function StockOgImage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();

  /* /api/chart'ın KAPISININ AYNISI (15 Ekim taraması): bu rota da yetkisiz,
     her farklı sembol ayrı önbellek anahtarı ve kart her istekte Alpaca'ya
     gidip Satori çizdiriyor — "AAAA" sayım döngüsü chart ucundaki ölçülmüş
     arızayı (200 istek/dk kota dakikalar içinde bitti, canlı fiyat herkes
     için öldü) buradan da üretebiliyordu. Ayrım orada olduğu gibi kardinalite
     üzerinden: tanınan ~800 sembol kapalı küme ve cömert; tanınmayan uzun
     kuyruk meşru ama sayımın tek girişi, dar. Sınırda kart yerine 429 döner
     — paylaşım önizlemesi kaybolur, site kaybolmaz. */
  if (!isValidSymbol(symbol)) return new Response(null, { status: 404 });
  const known = await isKnownSymbol(symbol);
  const gate = rateLimit(
    await requestKey(known ? "og-hisse" : "og-hisse-unknown"),
    known ? 120 : 10,
    60_000,
  );
  if (!gate.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }

  /* Kart `lib/og-cards.tsx`te (dil parametresiyle); burada yalnız kapı. */
  return stockOgImage(symbol, DEFAULT_LOCALE);
}
