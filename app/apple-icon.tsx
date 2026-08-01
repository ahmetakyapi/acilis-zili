import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d5a8c",
        }}
      >
        <svg width="124" height="124" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="3.6" r="1.35" fill="#ffffff" />
          <rect x="11.35" y="4.5" width="1.3" height="1.35" rx="0.6" fill="#ffffff" />
          <path
            d="M12 5.6c2.75 0 4.33 1.85 4.55 5.1.14 2.1.62 3.45 1.5 4.4.34.36.42.78.28 1.12-.14.35-.5.58-.95.58H6.62c-.45 0-.81-.23-.95-.58-.14-.34-.06-.76.28-1.12.88-.95 1.36-2.3 1.5-4.4C7.67 7.45 9.25 5.6 12 5.6Z"
            fill="#ffffff"
          />
          <circle cx="12" cy="19" r="1.6" fill="#e0b95f" />
          <path
            d="M4.4 5.4C3.15 6.75 2.45 8.4 2.3 10.25"
            stroke="#e0b95f"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M19.6 5.4c1.25 1.35 1.95 3 2.1 4.85"
            stroke="#e0b95f"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
