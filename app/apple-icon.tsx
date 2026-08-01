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
        <svg width="132" height="132" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10.2"
            stroke="#ffffff"
            strokeWidth="1.35"
          />
          <path
            d="M 5.44 19.81 A 10.2 10.2 0 0 0 18.56 19.81"
            stroke="#e0b95f"
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <circle cx="12" cy="6.1" r="1.02" fill="#ffffff" />
          <rect x="11.51" y="6.78" width="0.98" height="0.98" rx="0.49" fill="#ffffff" />
          <path
            d="M12 7.75c2.05 0 3.22 1.42 3.39 3.8.1 1.56.46 2.56 1.11 3.27.25.27.31.58.2.84-.1.26-.37.43-.71.43H8.01c-.34 0-.61-.17-.71-.43-.11-.26-.05-.57.2-.84.65-.71 1.01-1.71 1.11-3.27C8.78 9.17 9.95 7.75 12 7.75Z"
            fill="#ffffff"
          />
          <circle cx="12" cy="17.35" r="1.26" fill="#e0b95f" />
        </svg>
      </div>
    ),
    size,
  );
}
