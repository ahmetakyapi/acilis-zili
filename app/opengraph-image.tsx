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
import { SESSION_BOUNDS, todayEt } from "@/lib/market-hours";
import { clockOf, timePair } from "@/lib/session-clock";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili · ABD Piyasa Takibi";

/**
 * Ana sayfanın paylaşım kartı.
 *
 * Sitenin vaadi tek cümlede, altında ürünün ne taşıdığı künye çipleriyle.
 * Sağ üstteki blok seansın kendisi: açılış saatinin iki şehirdeki karşılığı
 * — sitenin "TR önce" kuralı kartta da geçerli.
 */
export default async function OpenGraphImage() {
  /* SAAT HESAPLANIR, YAZILMAZ. Kart açılışı sabit "16:30 TR" basıyordu ve
     ABD kış saatine geçtiğinde doğrusu 17:30 TR oluyor — yani sitenin en
     çok paylaşılan görseli yılın dört ayı yanlış bilgi taşıyordu. Projenin
     kuralı da bu: hiçbir yere sabit saat yazılmaz, o günün tarihiyle
     hesaplanır (CLAUDE.md → saat kuralı). Kart zaten her istekte yeniden
     çiziliyor, maliyet yok. */
  const { primary, secondary } = timePair(
    todayEt(),
    clockOf(SESSION_BOUNDS.regularOpen),
    "tr",
  );

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
              {primary}
            </span>
            <span style={{ fontSize: 20, color: C.muted }}>
              TR · {secondary} NY
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
