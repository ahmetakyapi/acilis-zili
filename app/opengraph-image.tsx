import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Açılış Zili — ABD piyasa takibi";

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
          background: "#f2ece0",
          padding: "72px 80px",
        }}
      >
        {/* Marka */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="3" r="1.35" fill="#1d5a8c" />
            <rect x="11.35" y="3.9" width="1.3" height="1.4" rx="0.6" fill="#1d5a8c" />
            <path
              d="M12 5.1c2.75 0 4.33 1.85 4.55 5.1.14 2.1.62 3.45 1.5 4.4.34.36.42.78.28 1.12-.14.35-.5.58-.95.58H6.62c-.45 0-.81-.23-.95-.58-.14-.34-.06-.76.28-1.12.88-.95 1.36-2.3 1.5-4.4C7.67 6.95 9.25 5.1 12 5.1Z"
              fill="#1d5a8c"
            />
            <circle cx="12" cy="18.55" r="1.6" fill="#9a741b" />
            <path
              d="M4.4 4.9C3.15 6.25 2.45 7.9 2.3 9.75"
              stroke="#9a741b"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <path
              d="M19.6 4.9c1.25 1.35 1.95 3 2.1 4.85"
              stroke="#9a741b"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontSize: 30,
              letterSpacing: "0.16em",
              color: "#0f2c44",
              fontWeight: 700,
            }}
          >
            AÇILIŞ ZİLİ
          </span>
        </div>

        {/* Tez */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.04,
              color: "#0f2c44",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              maxWidth: 900,
            }}
          >
            Zil çalmadan önce bugünü gör
          </div>
          <div style={{ fontSize: 30, color: "#294356", maxWidth: 820 }}>
            Ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin —
            saatleriyle birlikte.
          </div>
        </div>

        {/* Gün şeridi — ürünün imzası */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", height: 3 }}>
            <div style={{ width: 250, height: 3, background: "rgba(15,44,68,0.15)" }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#9a741b", marginLeft: -7, marginRight: -7 }} />
            <div style={{ width: 600, height: 3, background: "#1d5a8c" }} />
            <div style={{ width: 200, height: 3, background: "rgba(15,44,68,0.15)" }} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 20,
              color: "#71838f",
              letterSpacing: "0.08em",
            }}
          >
            <span>04:00</span>
            <span>08:30 · CPI</span>
            <span>09:30 · ZİL</span>
            <span>14:00 · FOMC</span>
            <span>16:00</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
