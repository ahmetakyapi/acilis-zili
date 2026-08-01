import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Marka işareti — gradient kare içinde tek çizgi zil (mockup 4a).
 * Satori CSS değişkeni çözmez; renkler burada gece paletinden sabit yazılır.
 */
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
          backgroundImage: "linear-gradient(140deg, #4fc3ff, #1a63c4)",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 256 256" fill="none">
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
    ),
    size,
  );
}
