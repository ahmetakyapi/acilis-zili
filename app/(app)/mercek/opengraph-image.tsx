import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Mercek";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Uzun Okuma",
      title: "Mercek",
      dek: "Piyasada yaşananların uzun anlatımı — olayın arkasındaki mekanizma.",
      chips: ["Analiz", "Bağlam"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
