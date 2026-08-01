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
            <circle cx="12" cy="12" r="10.4" stroke="#1d5a8c" strokeWidth="1.4" />
            <path
              d="M 5.32 19.97 A 10.4 10.4 0 0 0 18.68 19.97"
              stroke="#9a741b"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="12" cy="6" r="1.05" fill="#1d5a8c" />
            <rect x="11.5" y="6.7" width="1" height="1" rx="0.5" fill="#1d5a8c" />
            <path
              d="M12 7.55c2.1 0 3.3 1.45 3.47 3.9.1 1.6.47 2.62 1.14 3.35.26.28.32.6.21.86-.11.27-.38.44-.73.44H7.91c-.35 0-.62-.17-.73-.44-.11-.26-.05-.58.21-.86.67-.73 1.04-1.75 1.14-3.35C8.7 9 9.9 7.55 12 7.55Z"
              fill="#1d5a8c"
            />
            <circle cx="12" cy="17.5" r="1.3" fill="#9a741b" />
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
