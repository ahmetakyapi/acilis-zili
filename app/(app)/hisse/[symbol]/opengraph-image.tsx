import { ImageResponse } from "next/og";
import {
  C,
  Chip,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgFrame,
  OgTitle,
  Tri,
  clip,
  ogFonts,
} from "@/lib/og";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { DEFAULT_LOCALE, getDictionary } from "@/lib/i18n";
import { formatMoneyCompact, formatPercentPlain, formatPrice } from "@/lib/utils";
import { industryLabel, sectorGroupLabel, sectorGroupOf } from "@/lib/sectors";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/* DİL SABİT, İSTEKTEN OKUNMUYOR — gerekçenin tamamı lib/og.tsx başında.
   Özeti: paylaşım kartının adresi önek taşımıyor, dolayısıyla `getI18n()`
   buradan hiçbir zaman `en` döndürmüyordu; çıktıyı değiştirmeden yalnızca
   her istekte `headers()` ve `cookies()` okuyordu. */
export const alt = "Hisse · Açılış Zili";

/**
 * Hisse sayfasının paylaşım kartı.
 *
 * Fiyat CANLI çekiliyor: kart paylaşıldığı anın kotasyonunu gösterir.
 * Sağlayıcı yanıt vermezse (anahtar yok, kota doldu) fiyat bloğu hiç
 * basılmıyor — sitedeki kuralın aynısı: eksik veri yerine boş bir kutu
 * göstermek, yanlış sayı göstermekten iyi ama yerinde iskelet bırakmak
 * ikisinden de kötü.
 */
export default async function StockOgImage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const locale = DEFAULT_LOCALE;
  const t = getDictionary(locale);
  const fonts = await ogFonts();

  const status = await getStatus();
  const [meta, quotes] = await Promise.all([
    getSymbolNames([symbol]),
    getQuotes([symbol], status),
  ]);
  const info = meta[symbol];
  const quote = quotes.ok ? quotes.data[symbol] : undefined;
  const up = (quote?.changePct ?? 0) >= 0;
  /* Sektör TÜRKÇE: sağlayıcı "Technology" gibi İngilizce alan döndürüyor,
     sitenin geri kalanı bunu `industryLabel` ile çeviriyor. Karta ham hâliyle
     basmak, Türkçe bir kartın ortasında tek İngilizce kelime bırakıyordu. */
  const sector = industryLabel(info?.industry, locale);
  const group = sectorGroupLabel(sectorGroupOf(info?.industry), locale);

  return new ImageResponse(
    (
      <OgFrame
        eyebrow={t.nav.companies} locale={locale}
        accent={
          quote ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 58,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  color: C.strong,
                  lineHeight: 1,
                }}
              >
                {formatPrice(quote.price, locale, { currency: true })}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 28,
                  fontWeight: 700,
                  color: up ? C.up : C.down,
                }}
              >
                <Tri up={up} color={up ? C.up : C.down} />
                {formatPercentPlain(quote.changePct, locale, 2)}
              </div>
            </div>
          ) : undefined
        }
        footer={
          <>
            <Chip tone="primary">{symbol}</Chip>
            {sector && <Chip>{clip(sector, 34)}</Chip>}
            {info?.marketCap ? (
              <Chip>{`≈ ${formatMoneyCompact(info.marketCap, locale)}`}</Chip>
            ) : null}
          </>
        }
      >
        <OgTitle size={(info?.name?.length ?? 0) > 24 ? 54 : 68}>
          {clip(info?.name ?? symbol, 36)}
        </OgTitle>
        {/* Başlığın altı boş kalmasın: sektör grubu kartın ne hakkında
            olduğunu bir kelimede söylüyor ve kompozisyonu dengeliyor. */}
        <div style={{ fontSize: 28, color: C.body, display: "flex" }}>
          {group}
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
