import { ImageResponse } from "next/og";
import {
  BRAND_GRADIENT,
  C,
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

/* Rayın penceresi: ön seansın başından uzatılmış seansın sonuna (ET 04:00 →
   20:00, on altı saat). Açılış ve kapanış bu pencerenin içindeki GERÇEK
   oranlarında duruyor (%34,4 ve %75); eski şerit sabit piksellerle
   çiziliyordu ve seansın kendisini değil bir süsü gösteriyordu. */
const RAIL_START = SESSION_BOUNDS.preMarketOpen;
const RAIL_SPAN = SESSION_BOUNDS.afterHoursClose - RAIL_START;
const at = (minutes: number) => ((minutes - RAIL_START) / RAIL_SPAN) * 100;
const OPEN_AT = at(SESSION_BOUNDS.regularOpen);
const CLOSE_AT = at(SESSION_BOUNDS.regularClose);

/** Sayaç karosu — sitedeki geri sayımın rakamı, kart ölçüsünde. */
function DigitTile({ digit, accent }: { digit: string; accent?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 86,
        height: 118,
        borderRadius: 20,
        background: accent ? C.primaryWash : C.primaryTint,
        border: `1px solid ${accent ? C.primaryFaint : C.line}`,
        color: accent ? C.primary : C.strong,
        fontSize: 96,
        fontWeight: 700,
        letterSpacing: "-0.05em",
      }}
    >
      {digit}
      {/* Sayaç çizgisi: karonun ortasından geçen ince yarık. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 58,
          height: 2,
          background: C.surface,
          opacity: 0.9,
        }}
      />
    </div>
  );
}

/**
 * Ana sayfanın paylaşım kartı (26 Eylül).
 *
 * GERİ SAYIM DİLİ, GERİ SAYIM DEĞİL. Kartın sağında açılış saati sitedeki
 * sayacın rakam karolarıyla duruyor. KALAN SÜRE bilerek basılmıyor:
 * paylaşım kartları WhatsApp ve X tarafından günlerce önbellekte tutuluyor
 * ve donmuş bir "2g 3sa" yanlış bir sayı olurdu ("uydurma kesinlik yok").
 * Açılış saati ise her gün doğru; kart her istekte o günün tarihiyle
 * hesaplıyor, çünkü ABD yaz saatinde açılış 16:30, kışın 17:30 TR.
 *
 * Başlık ve künyeler Title Case, açıklama cümle (CLAUDE.md). Eski kart
 * başlığı cümle düzeninde, künyeleri büyük harfle basıyordu.
 */
export default async function OpenGraphImage() {
  const day = todayEt();
  const open = timePair(day, clockOf(SESSION_BOUNDS.regularOpen), "tr");
  const close = timePair(day, clockOf(SESSION_BOUNDS.regularClose), "tr");
  const railStart = timePair(day, clockOf(SESSION_BOUNDS.preMarketOpen), "tr");
  const railEnd = timePair(day, clockOf(SESSION_BOUNDS.afterHoursClose), "tr");
  const [h1, h2, , m1, m2] = open.primary.split("");

  const marker = (left: number, label: string, time: string) => (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: "translateX(-50%)",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, fontSize: 19 }}>
        <span style={{ color: C.body }}>{label}</span>
        <span style={{ fontWeight: 700, color: C.strong }}>{time}</span>
      </div>
      <div style={{ width: 3, height: 22, borderRadius: 2, background: C.strong }} />
    </div>
  );

  return new ImageResponse(
    (
      <OgFrame
        eyebrow="ABD Piyasa Takibi"
        accent={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 999,
              background: C.primaryWash,
              color: C.primary,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Türkiye Saatiyle
          </div>
        }
        rail={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative", display: "flex", height: 52 }}>
              {marker(OPEN_AT, "Açılış", open.primary)}
              {marker(CLOSE_AT, "Kapanış", close.primary)}
            </div>
            <div style={{ display: "flex", height: 10, marginTop: -4 }}>
              <div
                style={{
                  width: `${OPEN_AT}%`,
                  height: 10,
                  borderTopLeftRadius: 99,
                  borderBottomLeftRadius: 99,
                  background: C.line,
                }}
              />
              <div style={{ width: `${CLOSE_AT - OPEN_AT}%`, height: 10, backgroundImage: BRAND_GRADIENT }} />
              <div
                style={{
                  width: `${100 - CLOSE_AT}%`,
                  height: 10,
                  borderTopRightRadius: 99,
                  borderBottomRightRadius: 99,
                  background: C.line,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 17,
                color: C.muted,
              }}
            >
              <span>{railStart.primary}</span>
              <span>{railEnd.primary} TR</span>
            </div>
          </div>
        }
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 540 }}>
            <OgTitle size={62}>Zil Çalmadan Önce Bugünü Gör</OgTitle>
            <OgDek>
              Takvim, bilançolar, haberler ve takip listen; Türkiye saatiyle
              tek ekranda.
            </OgDek>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 700, color: C.primary }}>
              Açılış Zili
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DigitTile digit={h1} />
              <DigitTile digit={h2} />
              <span
                style={{
                  display: "flex",
                  fontSize: 72,
                  fontWeight: 700,
                  color: C.primaryFaint,
                  margin: "0 2px",
                }}
              >
                :
              </span>
              <DigitTile digit={m1} accent />
              <DigitTile digit={m2} accent />
            </div>
            <span style={{ fontSize: 19, color: C.muted }}>
              New York {open.secondary} · Kapanış Zili {close.primary} TR
            </span>
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
