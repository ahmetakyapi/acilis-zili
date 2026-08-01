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
          backgroundImage:
            "linear-gradient(145deg, #6fd0ff 0%, #2f95e8 46%, #124f9e 100%)",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 256 256" fill="#06121f">
          <circle cx="128" cy="26" r="14" />
          <path d="M128 30a82 82 0 00-82 82c0 40-6 58-17 69-6 6-2 17 7 17h184c9 0 13-11 7-17-11-11-17-29-17-69a82 82 0 00-82-82z" />
          <path d="M98 214a30 30 0 0060 0z" />
        </svg>
      </div>
    ),
    size,
  );
}
