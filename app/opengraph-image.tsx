import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Açılış Zili — ABD Piyasa Takibi";

/**
 * Paylaşım görseli — gece paletinde. Satori CSS değişkeni çözmez, renkler
 * burada sabit yazılır; kaynak app/globals.css `[data-theme="dark"]`.
 */
const BG = "#070d16";
const TX = "#eaf1f8";
const DIM = "#94a7ba";
const FAINT = "#8497a9";
const ACC = "#35b8ff";
const LINE = "rgba(255,255,255,0.14)";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "72px 80px",
        }}
      >
        {/* Marka — gradient kare + zil */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 21,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundImage:
                "linear-gradient(145deg, #6fd0ff 0%, #2f95e8 46%, #124f9e 100%)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 256 256" fill="#06121f">
              <circle cx="128" cy="26" r="14" />
              <path d="M128 30a82 82 0 00-82 82c0 40-6 58-17 69-6 6-2 17 7 17h184c9 0 13-11 7-17-11-11-17-29-17-69a82 82 0 00-82-82z" />
              <path d="M98 214a30 30 0 0060 0z" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 34,
              letterSpacing: "-0.03em",
              color: TX,
              fontWeight: 700,
            }}
          >
            Açılış Zili
          </span>
        </div>

        {/* Tez */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.04,
              color: TX,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              maxWidth: 900,
            }}
          >
            Zil çalmadan önce bugünü gör
          </div>
          <div style={{ fontSize: 30, color: DIM, maxWidth: 820 }}>
            Ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin —
            saatleriyle birlikte.
          </div>
        </div>

        {/* Gün şeridi — ürünün imzası */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", height: 6 }}>
            <div style={{ width: 250, height: 6, borderRadius: 100, background: LINE }} />
            <div style={{ width: 600, height: 6, background: "rgba(53,184,255,0.28)" }} />
            <div style={{ width: 190, height: 6, borderRadius: 100, background: LINE }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 20,
              color: FAINT,
              letterSpacing: "0.08em",
            }}
          >
            <span>04:00</span>
            <span>08:30 · CPI</span>
            <span style={{ color: ACC, fontWeight: 700 }}>09:30 · AÇILIŞ</span>
            <span>14:00 · FOMC</span>
            <span>20:00</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
