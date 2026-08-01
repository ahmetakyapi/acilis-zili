import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Açılış Zili — ABD piyasa takibi";

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
              backgroundImage: "linear-gradient(140deg, #4fc3ff, #1a63c4)",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 256 256" fill="none">
              <path
                d="M128 32a80 80 0 00-80 80c0 45-18 62-18 62h196s-18-17-18-62a80 80 0 00-80-80z"
                fill="none"
                stroke="#06121f"
                strokeWidth="19"
                strokeLinejoin="round"
              />
              <path
                d="M100 182a28 28 0 0056 0"
                fill="none"
                stroke="#06121f"
                strokeWidth="19"
                strokeLinecap="round"
              />
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
