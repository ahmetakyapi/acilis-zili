import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Açılış Zili — Rehber";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Müfredat",
      title: "Rehber",
      dek: "Borsayı anlatan yazılar — kavramdan stratejiye, kolaydan zora.",
      chips: ["Temel Kavramlar", "Risk", "Değerleme"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
