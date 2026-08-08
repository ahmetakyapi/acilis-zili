import { ImageResponse } from "next/og";
import {
  C,
  Chip,
  OG_CONTENT_TYPE,
  OG_SIZE,
  OgDek,
  OgFrame,
  OgTitle,
  ogFonts,
} from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — ABD Piyasa Takibi";

/**
 * Ana sayfanın paylaşım kartı.
 *
 * Sitenin vaadi tek cümlede, altında ürünün ne taşıdığı künye çipleriyle.
 * Sağ üstteki blok seansın kendisi: açılış saatinin iki şehirdeki karşılığı
 * — sitenin "TR önce" kuralı kartta da geçerli.
 */
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <OgFrame
        eyebrow="ABD Piyasa Takibi"
        accent={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: C.muted,
              }}
            >
              AÇILIŞ
            </span>
            <span
              style={{
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: C.strong,
              }}
            >
              16:30
            </span>
            <span style={{ fontSize: 20, color: C.muted }}>
              TR · 09:30 NY
            </span>
          </div>
        }
        footer={
          <>
            <Chip tone="primary">Ekonomik Takvim</Chip>
            <Chip>Bilanço Analizleri</Chip>
            <Chip>Haberler</Chip>
            <Chip>Favoriler</Chip>
          </>
        }
      >
        <OgTitle size={74}>Zil çalmadan önce bugünü gör</OgTitle>
        <OgDek>
          Ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin —
          Türkiye saatiyle birlikte.
        </OgDek>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
