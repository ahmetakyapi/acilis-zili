import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, ogFonts, sectionOg } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Makro · Açılış Zili";

export default async function SectionOgImage() {
  return new ImageResponse(
    sectionOg({
      eyebrow: "Ekonomi",
      title: "Makro",
      dek: "Enflasyon, istihdam ve faiz — ABD ekonomisinin ana göstergeleri.",
      chips: ["TÜFE", "PCE", "Politika Faizi"],
    }),
    { ...size, fonts: await ogFonts() },
  );
}
