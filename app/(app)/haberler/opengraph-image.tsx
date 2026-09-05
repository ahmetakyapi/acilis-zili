import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Haberler · Açılış Zili";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Akış",
      title: "Haberler",
      dek: "ABD piyasalarından haberler — Türkçe künyeleriyle.",
      chips: ["Piyasa", "Şirket", "Makro"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
