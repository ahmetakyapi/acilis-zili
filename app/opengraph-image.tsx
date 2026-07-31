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
            <path
              d="M12 2.15c.62 0 1.12.5 1.12 1.12v.62h-2.24v-.62c0-.62.5-1.12 1.12-1.12Z"
              fill="#1d5a8c"
            />
            <path
              d="M12 3.6c3.42 0 5.06 3.42 5.24 7.68.1 2.32.62 3.42 1.32 4.22.36.42.1 1.05-.46 1.05H5.9c-.56 0-.82-.63-.46-1.05.7-.8 1.22-1.9 1.32-4.22C6.94 7.02 8.58 3.6 12 3.6Z"
              fill="#1d5a8c"
            />
            <rect x="7.4" y="18.6" width="1.5" height="2.2" rx="0.75" fill="#9a741b" />
            <rect x="11.25" y="18.6" width="1.5" height="3.4" rx="0.75" fill="#9a741b" />
            <rect x="15.1" y="18.6" width="1.5" height="2.2" rx="0.75" fill="#9a741b" />
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
